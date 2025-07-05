import pgPromise from "pg-promise";

const db = pgPromise()('postgresql://postgres:Aziz.com7@localhost:5432/AzimaMainDB')

const authorizeLogin = async (req, res) => {
    const { email, password } = req.body;

    let checkEmail = email.toLowerCase();

    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', checkEmail);

    if (!user) {
        return res.status(404).json({ msg: "User data not found, try signing up first" });
    } else {
        if (user.password !== password) {
            return res.status(401).json({ msg: "Wrong username or password" });
        } else {
            try {
                const userPreferences = await db.manyOrNone('SELECT category_id FROM user_preferences WHERE user_id = $1', user.ID)
                    .then(data => data.map(row => row.category_id));

                if (!userPreferences || userPreferences.length === 0) {
                    return res.status(404).json({ user, msg: "User preferences not found" });
                }

                const groups = await db.manyOrNone(`
                    SELECT DISTINCT g.*
                    FROM "group" g
                    JOIN group_category gc ON g.group_id = gc.group_id
                    WHERE gc.category_id IN ($1:csv)
                `, [userPreferences]);

                return res.status(200).json({ user, userPreferences, groups: groups });
            } catch (error) {
                console.error("Error fetching user preferences:", error);
                return res.status(500).json({ msg: "Internal server error" });
            }

        }
    }
}

const register = async (req, res) => {
    const { name, surname, username, email, password, profile_image, birthdate, is_name_private, is_email_private, is_updates_notifications_on, preferences } = req.body

    let lowerEmail = email.toLowerCase();

    try {
        // Check if user exists 
        const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', lowerEmail);

        if (user) {
            return res.status(409).json({ msg: "Email already registered, try logining in" })
        } else {
            const newUser = await db.one(`INSERT INTO users (
                name,
                surname,
                username,
                email,
                password,
                profile_image,
                birthdate
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7
            ) RETURNING *`, [name, surname, username, lowerEmail, password, profile_image, birthdate])


            if (preferences && preferences.length > 0) {
                await Promise.all(preferences.map(async (preference) => {
                    await db.none('INSERT INTO user_preferences (category_id, user_id) VALUES ($1, $2)', [preference, newUser.ID]);
                }));
                const newUserData = { ...newUser, preferences: preferences || [] };

                return res.status(200).json(newUserData);
            } else {
                return res.status(200).json(newUser)
            }

        }
    } catch (error) {
        console.error('Error :', error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getUserData = async (req, res) => {
    const { user_id } = req.body;

    try {
        const user = await db.oneOrNone('SELECT * FROM users WHERE "ID" = $1', user_id)

        if (user) {
            const userPreferences = await db.manyOrNone('SELECT category_id FROM user_preferences WHERE user_id = $1', user_id)
                .then(data => data.map(row => row.category_id));

            if (userPreferences.length > 0) {
                return res.status(200).json({ ...user, userPreferences });
            }

            return res.status(200).json(user);
        } else {
            return res.status(404).json({ msg: "user not found" });
        }
    } catch (error) {
        console.error('Error: ', error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getUserEvents = async (req, res) => {
    const { user_id } = req.body;

    try {
        const eventIDs = await db.manyOrNone("SELECT event_id FROM user_events WHERE user_id = $1", user_id)
            .then(data => data.map(row => row.event_id));

        if (eventIDs.length > 0) {
            const events = await Promise.all(eventIDs.map(async (eventID) => {
                return await db.one(`SELECT 
                event.*,
                user_events.is_contributer,
                user_events.is_con_pending
            FROM 
                event
            INNER JOIN 
                user_events
            ON 
                event.event_id = user_events.event_id
            WHERE
                event.event_id = $1
            AND
                user_events.user_id = $2;
            `, [eventID, user_id]);
            }));

            const result = events.flat();

            return res.status(200).json(result);

        } else {
            return res.status(404).json({ msg: "No events found" })
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error " })
    }


}

const getUserGroups = async (req, res) => {
    const { user_id } = req.body;

    try {
        const groups = await db.manyOrNone(`
            SELECT 
                g.*,
                ug.is_admin,
                ug.is_banned,
                ug.is_pending
            FROM 
                "group" g
            INNER JOIN 
                user_groups ug
            ON 
                g.group_id = ug.group_id
            WHERE 
                ug.user_id = $1
        `, [user_id]);

        const result = groups.flat();

        if (groups.length > 0) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json({ msg: "No groups found for this user" });
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error " });
    }

}

const myOwnerGroups = async (req, res) => {
    const { id } = req.params;

    try {
        const groups = await db.manyOrNone('SELECT * FROM "group" WHERE owner_id = $1', id);
        if (groups.length > 0) {
            return res.status(200).json(groups);
        } else {
            return res.status(404).json("No groups found");
        }
    } catch (error) {
        console.error("Error : ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const myAdminGroups = async (req, res) => {
    const { id } = req.params;

    try {

        const groups = await db.manyOrNone(`
            SELECT
                *
            FROM
                "group" g
            INNER JOIN
                user_groups ug
            ON
                ug.group_id = g.group_id
            WHERE
                ug.user_id = $1
            AND
                ug.is_admin = true
        `, id);

        if (groups.length > 0) {
            return res.status(200).json(groups);
        } else {
            return res.status(404).json("User isn't admin in any group");
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, surname, username, profile_image, birthdate, is_name_private, is_email_private, is_updates_notifications_on, preferences } = req.body;

    try {
        const updatedUser = await db.one('UPDATE users SET name = $1, surname = $2, username = $3, profile_image = $4, birthdate = $5, is_name_private = $6, is_email_private = $7, is_updates_notifications_on = $8 WHERE "ID" = $9 RETURNING * '
            , [name, surname, username, profile_image, birthdate, is_name_private, is_email_private, is_updates_notifications_on, id]);

        if (preferences.length > 0) {
            db.none('DELETE FROM user_preferences WHERE user_id = $1', id);

            const user_preferences = await Promise.all(preferences.map(async (preference) => {
                return await db.one(`INSERT INTO user_preferences (
                        user_id,
                        category_id
                    ) VALUES (
                        $1, $2
                    ) RETURNING category_id`, [id, preference])
            })).then(data => data.map(row => row.category_id))

            return res.status(200).json({ ...updatedUser, user_preferences });
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }




}

const getConEvents = async (req, res) => {
    const { user_id } = req.body;

    try {
        const events = await db.manyOrNone(`
            SELECT
                e.*
            FROM 
                event e
            INNER JOIN
                user_events ue
            ON
                ue.event_id = e.event_id
            WHERE
                ue.user_id = $1
            AND
                ue.is_contributer = true
        `, user_id);

        if (events.length > 0) {
            return res.status(200).json(events)
        } else {
            return res.status(404).json("No events found")
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json("Internal server error")
    }

}

const updatePassword = async (req, res) => {
    const { id, password } = req.body;

    try {
        const updatedUser = await db.one('UPDATE users SET password = $1 WHERE "ID" = $2 RETURNING *', [password, id]);
        return res.status(200).json(updatedUser)
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error" })
    }


}

const deleteAccount = async (req, res) => {
    const { id } = req.body;

    try {

        await db.none('DELETE FROM user_groups WHERE user_id = $1', id);

        await db.none('DELETE FROM user_events WHERE user_id = $1', id);

        await db.none('DELETE FROM user_preferences WHERE user_id = $1', id);

        await db.none('DELETE FROM user_notifications WHERE user_id = $1', id);

        await db.none('DELETE FROM users WHERE "ID" = $1', id);

        return res.status(200).json("Account Deleted")
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getUserNots = async (req, res) => {
    const { user_id } = req.body;

    try {
        const notifications = await db.manyOrNone(`
            SELECT *
            FROM user_notifications un
            JOIN notifications n ON un.not_id = n.not_id
            WHERE un.user_id = $1
            ORDER BY un.not_date DESC
        `, [user_id]);

        let finalNotifications = [];

        await Promise.all(notifications.map(async (notification) => {
            if (notification.type === 1 || notification.type === 2) {

                const event = await db.one(`
                    SELECT *
                    FROM event 
                    WHERE event_id = $1 
                `, [notification.event_id]);

                if (event) {
                    finalNotifications.push({
                        ...notification,
                        ...event
                    });
                } else {
                    finalNotifications.push({
                        ...notification,
                    });
                }
            } else {
                const group = await db.oneOrNone(`
                    SELECT *
                    FROM "group"
                    WHERE group_id = $1
                `, [notification.group_id]);

                if (group) {
                    finalNotifications.push({
                        ...notification,
                        ...group
                    });
                }
            }
        }))

        res.status(200).json(finalNotifications);
    } catch (error) {
        console.error("Error: ", error);
        res.status(500).json({ msg: "Internal server error" });
    }
}

const getUserPastEvents = async (req, res) => {
    const { user_id } = req.body;

    const now = new Date();
    const nowDate = now.toISOString();

    try {
        const events = await db.manyOrNone(`
        SELECT e.*
        FROM
            event e
        INNER JOIN
            user_events ue
        ON
            ue.event_id = e.event_id
        WHERE
            ue.user_id = $1
        AND
            e.event_date < $2
        `, [user_id, nowDate]);

        if (events.length > 0) {
            return res.status(200).json(events);
        } else {
            return res.status(404).json("No events found");
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "INternal server error" });
    }

}

const getConPastEvents = async (req, res) => {
    const { user_id } = req.body;

    const now = new Date();
    const nowDate = now.toISOString();

    try {
        const events = await db.manyOrNone(`
        SELECT e.*
        FROM
            event e
        INNER JOIN
            user_events ue
        ON
            ue.event_id = e.event_id
        WHERE
            ue.user_id = $1
        AND
            e.event_date < $2
        AND
            ue.is_contributer = true
        `, [user_id, nowDate]);

        if (events.length > 0) {
            return res.status(200).json(events);
        } else {
            return res.status(404).json("No events found");
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "INternal server error" });
    }

}

export {
    authorizeLogin, register, getUserData, getUserEvents, getUserGroups, myOwnerGroups, myAdminGroups, updateUser,
    getConEvents, updatePassword, deleteAccount, getUserNots, getUserPastEvents, getConPastEvents
}