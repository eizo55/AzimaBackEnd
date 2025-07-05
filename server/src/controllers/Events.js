import pgPromise from "pg-promise";

const db = pgPromise()('postgresql://postgres:Aziz.com7@localhost:5432/AzimaMainDB')

const createEvent = async (req, res) => {
    const { user_id, name, group_id, event_date, time, age_restriction, event_capacity, ticket_price, currency, ticket_included_items,
        ticket_not_included_items, return_policy, guests, is_event_private, is_contribution_allowed, rules, event_image, location, description } = req.body;

    try {
        const event = await db.one(`INSERT INTO event (
                name,
                group_id,
                event_date,
                time,
                age_restriction,
                event_capacity,
                ticket_price,
                currency,
                ticket_included_items,
                ticket_not_included_items,
                return_policy,
                guests,
                is_event_private,
                is_contribution_allowed,
                rules,
                event_image,
                location,
                description
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            ) RETURNING *`, [name, group_id, event_date, time, age_restriction, event_capacity, ticket_price, currency, ticket_included_items,
            ticket_not_included_items, return_policy, guests, is_event_private, is_contribution_allowed, rules, event_image, location, description]);

        await db.none('INSERT INTO user_events (user_id, event_id, is_contributer) VALUES ($1, $2, $3)', [user_id, event.event_id, true]);

        const groupMembers = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1', group_id)
            .then(data => data.map(row => row.user_id));

        const notificationID = await db.one('SELECT not_id FROM notifications WHERE group_id = $1 AND "type" = 1', group_id)
            .then(data => data.not_id);

        await Promise.all(groupMembers.map(async (groupMember) => {
            await db.none('INSERT INTO user_notifications (not_id, user_id, event_id) VALUES ($1, $2, $3)', [notificationID, groupMember, event.event_id])
        }))

        return res.status(200).json(event);
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const getEventData = async (req, res) => {
    const { id } = req.params;

    try {
        const eventData = await db.oneOrNone('SELECT * FROM event WHERE event_id = $1', id);

        if (eventData) {
            return res.status(200).json(eventData)
        } else {
            return res.status(404).json("Event not found!")
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const updateEvent = async (req, res) => {
    const { event_id, name, group_id, event_date, time, age_restriction, event_capacity, ticket_price, currency, ticket_included_items,
        ticket_not_included_items, return_policy, guests, is_event_private, is_contribution_allowed, rules, event_image } = req.body;

    try {
        const updatedEvent = await db.one('UPDATE "event" set name = $1, group_id = $2, event_date = $3, time = $4, age_restriction = $5, event_capacity = $6, ticket_price = $7, currency = $8, ticket_included_items = $9, ticket_not_included_items = $10, return_policy = $11, guests = $12, is_event_private = $13, is_contribution_allowed = $14, rules = $15, event_image = $16 WHERE event_id = $17 RETURNING * ', [name, group_id, event_date, time, age_restriction, event_capacity, ticket_price, currency, ticket_included_items, ticket_not_included_items, return_policy, guests, is_event_private, is_contribution_allowed, rules, event_image, event_id]);

        return res.status(200).json(updatedEvent)
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }




}

const eventUsers = async (req, res) => {
    const { id } = req.params;

    try {
        const users = await db.manyOrNone(`SELECT e.event_id, e.is_contributer, e.is_con_pending, g.*
        FROM user_events e 
        INNER JOIN users g ON e.user_id = g."ID" 
        WHERE e.event_id = $1`, id);

        if (users.length > 0) {
            return res.status(200).json(users)
        } else {
            return res.status(404).json("No users found!")
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const joinEvent = async (req, res) => {
    const { event_id } = req.params;
    const { user_id } = req.body;

    try {
        let eventCapacity = await db.one('SELECT event_capacity FROM event WHERE event_id = $1', event_id)
            .then(data => data.event_capacity);
        if (eventCapacity > 0) {
            eventCapacity--;
            await db.none('UPDATE event SET event_capacity = $1 WHERE event_id = $2', [eventCapacity, event_id]);
            await db.none('INSERT INTO user_events (event_id, user_id) VALUES ($1, $2)', [event_id, user_id]);
            return res.status(200).json("user joined the event");
        } else {
            return res.status(404).json({ msg: "No capacity" })
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const sendConRequest = async (req, res) => {
    const { event_id, user_id } = req.body;

    try {
        const checkUser = await db.oneOrNone('SELECT is_contributer, is_con_pending FROM user_events WHERE event_id = $1 AND user_id = $2', [event_id, user_id]);

        if (checkUser) {
            if (!checkUser.is_contributer && !checkUser.is_con_pending) {
                const reqUser = await db.one('UPDATE user_events SET is_con_pending = true WHERE event_id = $1 AND user_id = $2 RETURNING * ', [event_id, user_id]);
                return res.status(200).json(reqUser);
            } else {
                if (checkUser.is_contributer) {
                    return res.status(409).json("User is already a contributer")
                }
                if (checkUser.is_con_pending) {
                    return res.status(409).json("User request is pending")
                }
            }
        } else {
            return res.status(404).json("User is not a member of the event")
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const conResponse = async (req, res) => {
    const { event_id, user_id, status } = req.body;

    try {
        const isUserPending = await db.one('SELECT is_con_pending FROM user_events WHERE event_id = $1 AND user_id = $2 ', [event_id, user_id]);

        if (!isUserPending.is_con_pending) {
            return res.status(409).json("No request found for this user")
        } else {
            if (status === "accept") {
                const reqUser = await db.one("UPDATE user_events SET is_con_pending = false, is_contributer = true WHERE event_id = $1 AND user_id = $2 RETURNING * ", [event_id, user_id]);
                return res.status(200).json(reqUser)
            } else if (status === "reject") {
                const reqUser = await db.one("UPDATE user_events SET is_con_pending = false, is_contributer = false WHERE event_id = $1 AND user_id = $2 RETURNING * ", [event_id, user_id]);
                return res.status(200).json(reqUser)
            }
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const deleteEvent = async (req, res) => {
    const { event_id } = req.body;

    const now = new Date();
    const nowDate = now.toISOString();

    try {
        const eventDate = await db.one('SELECT event_date FROM event WHERE event_id = $1', event_id);

        if (eventDate < nowDate) {
            return res.status(403).json({ msg: "Past events can't be deleted" });
        } else {
            await db.none('DELETE FROM user_events WHERE event_id = $1', event_id);

            const groupId = await db.one('SELECT group_id FROM event WHERE event_id = $1', event_id)
                .then(data => data.group_id);

            const groupMembers = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1', groupId)
                .then(data => data.map(row => row.user_id));

            await db.none('DELETE FROM user_notifications WHERE event_id = $1', event_id);

            const newNotification = await db.one('SELECT not_id FROM notifications WHERE group_id = $1 AND type = 2', groupId)
                .then(data => data.not_id);

            if (groupMembers.length > 0) {
                groupMembers.map(async (groupMember) => {
                    await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [newNotification, groupMember])
                })
            }

            await db.none('DELETE FROM event WHERE event_id = $1', event_id);

            return res.status(200).json("Event deleted")
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const leaveEvent = async (req, res) => {
    const { user_id, event_id } = req.body;

    try {
        let eventCapacity = await db.one('SELECT event_capacity FROM event WHERE event_id = $1', event_id)
            .then(data => data.event_capacity);

        eventCapacity++;

        await db.none('UPDATE event SET event_capacity = $1', eventCapacity);

        await db.none('DELETE FROM user_events WHERE user_id = $1 AND event_id = $2', [user_id, event_id]);

        const groupID = await db.one('SELECT group_id FROM event WHERE event_id = $1', event_id)
            .then(data => data.group_id);

        const notifications = await db.many('SELECT not_id FROM notifications WHERE group_id = $1 AND type IN (1, 2)', groupID)
            .then(data => data.map(row => row.not_id));

        await Promise.all(notifications.map(async (notification) => {
            await db.none('DELETE FROM user_notifications WHERE not_id = $1 AND user_id = $2', [notification, user_id])
        }))

        const notID = await db.one('SELECT not_id FROM notifications WHERE group_id = $1 AND type = 10', groupID)
            .then(data => data.not_id);

        const notifyUsers = await db.many(`
            SELECT owner_id AS user_id
            FROM "group"
            WHERE group_id = $1
            UNION
            SELECT user_id
            FROM user_groups
            WHERE group_id = $1 AND is_admin = true
        `, [groupID])
            .then(data => data.map(row => row.user_id));

        await Promise.all(notifyUsers.map(async (notifyUser) => {
            await db.none('INSERT INTO user_notifications (user_id, not_id) VALUES ($1, $2)', [notifyUser, notID])
        }));

        return res.status(200).json({ msg: "User left event" });
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const rateEvent = async (req, res) => {
    const { star, comment, event_id, user_id } = req.body;

    try {
        const userCheck = await db.oneOrNone('SELECT * FROM ratings WHERE event_id = $1 AND user_id = $2', [event_id, user_id]);
        if (userCheck) {
            return res.status(403).json({ msg: "User can't rate an event twice!" })
        } else {
            const rating = await db.one('INSERT INTO ratings (star, comment, event_id, user_id ) VALUES ($1, $2, $3, $4) RETURNING *', [star, comment, event_id, user_id]);
            return res.status(200).json(rating);
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }

}

const getEventRatings = async (req, res) => {
    const { event_id } = req.body;

    try {
        const eventRatings = await db.manyOrNone('SELECT * FROM ratings WHERE event_id = $1 ORDER BY rate_date DESC', event_id);

        let finalArray = [];

        for (const rating of eventRatings) {
            const user = await db.one('SELECT * FROM users WHERE "ID" = $1', rating.user_id);
            finalArray.push({ ...rating, ...user });
        }

        return res.status(200).json(finalArray)
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" })
    }



}

const deleteRating = async (req, res) => {
    const { rate_id } = req.body;

    try {
        await db.none('DELETE FROM ratings WHERE rate_id = $1', rate_id);
        return res.status(200).json({ msg: "Rating deleted" });
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getEventOwner = async (req, res) => {
    const { event_id } = req.body;

    try {
        const groupOwner = await db.one(`SELECT
        g.owner_id
        FROM event e
        JOIN "group" g ON e.group_id = g.group_id
        WHERE e.event_id = $1`, event_id)
            .then(data => data.owner_id);
        return res.status(200).json(groupOwner);
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getContributors = async (req, res) => {
    const { event_id } = req.body;

    try {
        const users = await db.manyOrNone(`
    SELECT
        users.*
    FROM
        users
    INNER JOIN 
        user_events 
    ON
        user_events.user_id = users."ID"
    WHERE
        user_events.event_id = $1
    AND
        user_events.is_con_pending = true
    `, event_id);

        return res.status(200).json(users);
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }



}


export {
    createEvent, getEventData, updateEvent, eventUsers, joinEvent, sendConRequest, conResponse, deleteEvent, leaveEvent,
    rateEvent, getEventRatings, deleteRating, getEventOwner, getContributors
}