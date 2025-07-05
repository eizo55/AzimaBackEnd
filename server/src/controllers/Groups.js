import { json } from "express";
import pgPromise from "pg-promise";

const db = pgPromise()('postgresql://postgres:Aziz.com7@localhost:5432/AzimaMainDB')

const GetRandomGroups = async (req, res) => {

    try {
        const sportIDs = await db.manyOrNone("SELECT group_id FROM group_category WHERE category_id = 1 LIMIT 10").then(data => data.map(row => row.group_id))
        const comedyIDs = await db.manyOrNone("SELECT group_id FROM group_category WHERE category_id = 2 LIMIT 10").then(data => data.map(row => row.group_id))
        const eduIDs = await db.manyOrNone("SELECT group_id FROM group_category WHERE category_id = 3 LIMIT 10").then(data => data.map(row => row.group_id))
        const religionIDs = await db.manyOrNone("SELECT group_id FROM group_category WHERE category_id = 4 LIMIT 10").then(data => data.map(row => row.group_id))


        const sports = await Promise.all(sportIDs.map(async (sportID) => {
            return await db.one('SELECT * FROM "group" WHERE group_id = $1', sportID);
        }))
        const comedy = await Promise.all(comedyIDs.map(async (comedyID) => {
            return await db.one('SELECT * FROM "group" WHERE group_id = $1', comedyID);
        }))
        const education = await Promise.all(eduIDs.map(async (eduID) => {
            return await db.one('SELECT * FROM "group" WHERE group_id = $1', eduID);
        }))
        const religion = await Promise.all(religionIDs.map(async (religionID) => {
            return await db.one('SELECT * FROM "group" WHERE group_id = $1', religionID);
        }))

        const suggestedGroups = { sports, comedy, education, religion }

        return res.status(200).json(suggestedGroups);
    } catch (error) {
        console.log("Error: ", error);
        return res.status(500).json({ msg: "Internal error server" });
    }


}

const createGroup = async (req, res) => {
    const { name, description, group_image, owner_id, is_adult_only, is_private_group, is_online, is_f2f, categories } = req.body;

    try {
        const newGroup = await db.one(`INSERT INTO "group" (
            name,
            description,
            group_image,
            is_adult_only,
            is_private_group,
            is_online,
            is_f2f,
            owner_id
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *`, [name, description, group_image, is_adult_only, is_private_group, is_online, is_f2f, owner_id]);

        await db.none('INSERT INTO user_groups (group_id, user_id) VALUES ($1, $2)', [newGroup.group_id, owner_id]);

        const group_categories = await categories.map(async (category) => {
            return await db.one(`INSERT INTO group_category (
                group_id,
                category_id
            ) VALUES (
                $1, $2
            ) RETURNING category_id`, [newGroup.group_id, category])
        })

        await db.none(`
        INSERT INTO "notifications" (group_id, message, type) 
        VALUES 
        ($1, $2, $3), 
        ($4, $5, $6), 
        ($7, $8, $9), 
        ($10, $11, $12), 
        ($13, $14, $15), 
        ($16, $17, $18), 
        ($19, $20, $21), 
        ($22, $23, $24), 
        ($25, $26, $27), 
        ($28, $29, $30)
    `, [
            newGroup.group_id, name + `: just added a new event!`, 1,
            newGroup.group_id, name + `: canceled an event`, 2,
            newGroup.group_id, name + `: New join request`, 3,
            newGroup.group_id, name + `: join request accepted`, 4,
            newGroup.group_id, name + `: join request declined`, 5,
            newGroup.group_id, name + `: You are assigned as admin!`, 6,
            newGroup.group_id, name + `: You have been demoted`, 7,
            newGroup.group_id, name + `: New user joined`, 8,
            newGroup.group_id, name + `: User left group`, 9,
            newGroup.group_id, name + `: User left event`, 10
        ]);

        const result = { newGroup, group_categories };
        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getGroup = async (req, res) => {
    const { id } = req.params;

    try {
        const newGroup = await db.one('SELECT * FROM "group" WHERE group_id = $1', id);
        const categoryIDs = await db.many('SELECT category_id FROM group_category WHERE group_id = $1', id)
            .then(data => data.map(row => row.category_id));

        const categories = categoryIDs
            ? await Promise.all(
                categoryIDs.map(async (categoryID) => {
                    return await db.one(
                        "SELECT * FROM category WHERE category_id = $1",
                        categoryID
                    );
                })
            )
            : [];

        if (newGroup) {
            return res.status(200).json({ ...newGroup, categories })
        } else {
            return res.status(404).json({ msg: "Group not found" })
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }


}

const updateGroup = async (req, res) => {
    const { group_id, name, description, group_image, is_adult_only, is_private_group, is_online, is_f2f, categories } = req.body;

    try {
        const newGroup = await db.one('UPDATE "group" set name = $1, description = $2, group_image = $3, is_adult_only = $4, is_private_group = $5, is_online = $6, is_f2f = $7 WHERE group_id = $8 RETURNING * ', [name, description, group_image, is_adult_only, is_private_group, is_online, is_f2f, group_id]);

        if (categories.length > 0) {
            db.manyOrNone('DELETE FROM group_category WHERE group_id = $1', group_id);

            const group_categories = await Promise.all(categories.map(async (category) => {
                return await db.one(`INSERT INTO group_category (
                    group_id,
                    category_id
                ) VALUES (
                    $1, $2
                ) RETURNING category_id`, [group_id, category])

            })).then(data => data.map(row => row.category_id))
            return res.status(200).json({ ...newGroup, group_categories });
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getGroupMembers = async (req, res) => {
    const { id } = req.params;

    try {
        const userIDs = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1 AND is_banned = false AND is_pending = false', id)
            .then(data => data.map(row => row.user_id));

        const temp = await Promise.all(userIDs.map(async (userID) => {
            return await db.one(`SELECT users.*, user_groups.is_admin
             FROM users
             JOIN user_groups ON user_groups.user_id = users."ID"
             WHERE "ID" = $1 AND user_groups.group_id = $2`, [userID, id])
        }))

        const groupMembers = temp.flat();

        return res.status(200).json(groupMembers)
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const BannedMembers = async (req, res) => {
    const { id } = req.params;

    try {
        const userIDs = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1 AND is_banned = true', id)
            .then(data => data.map(row => row.user_id))

        const members = await Promise.all(userIDs.map(async (userID) => {
            return await db.one('SELECT * FROM users WHERE "ID" = $1', userID)
        }))

        const result = members.flat();

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const banMember = async (req, res) => {
    const { group_id, user_id } = req.body;

    try {

        const checkUser = await db.one('SELECT is_admin, is_pending FROM user_groups WHERE user_id = $1 AND group_id = $2', [user_id, group_id]);

        if (checkUser.is_admin) {
            await db.none('UPDATE user_groups SET is_admin = false, is_banned = true WHERE user_id = $1 AND group_id = $2', [user_id, group_id]);
        } else if (checkUser.is_pending) {
            await db.none('UPDATE user_groups SET is_pending = false, is_banned = true WHERE user_id = $1 AND group_id = $2', [user_id, group_id]);
        } else {
            await db.none('UPDATE user_groups SET is_banned = true WHERE user_id = $1 AND group_id = $2', [user_id, group_id]);
        }

        return res.status(200).json("user banned")
    } catch (error) {
        console.error(error)
    }
}

const removeBan = async (req, res) => {
    const { group_id, user_id } = req.body;

    try {
        await db.none("UPDATE user_groups SET is_banned = false WHERE group_id = $1 AND user_id = $2", [group_id, user_id]);
        await db.none('DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2', [group_id, user_id]);
        return res.status(200).json("user ban removed")
    } catch (error) {
        console.error(error)
    }
}

const getCategories = async (req, res) => {
    try {
        const categories = await db.many('SELECT * FROM category');
        return res.status(200).json(categories);
    } catch (error) {
        console.log("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }
}

const getAdmins = async (req, res) => {
    const { id } = req.params;

    try {
        const userIDs = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1 AND is_admin = true', id)
            .then(data => data.map(row => row.user_id));

        if (userIDs.length > 0) {

            const admins = await Promise.all(userIDs.map(async (userID) => {
                return await db.one('SELECT * FROM users WHERE "ID" = $1', userID);
            }))

            const result = admins.flat();
            return res.status(200).json(result);
        } else {
            return res.status(404).json({ msg: "No admins found" });
        }

    } catch (error) {
        console.log("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const assignAdmin = async (req, res) => {
    const { group_id, user_id } = req.body;

    try {

        await db.none("UPDATE user_groups SET is_admin = true WHERE group_id = $1 AND user_id = $2", [group_id, user_id]);

        const notID = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND type = 6', group_id)
            .then(data => data.not_id);

        await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notID, user_id]);

        return res.status(200).json("User assigned as admin")
    } catch (error) {
        console.error(error)
    }

}

const removeAdmin = async (req, res) => {
    const { group_id, user_id } = req.body;

    try {
        await db.none('UPDATE user_groups SET is_admin = false WHERE group_id = $1 AND user_id = $2', [group_id, user_id]);

        const notID = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND type = 7', group_id)
            .then(data => data.not_id);

        await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notID, user_id]);

        return res.status(200).json("User demoted");
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getGroupEvents = async (req, res) => {
    const { id } = req.params;

    try {
        const events = await db.manyOrNone('SELECT * FROM event WHERE group_id = $1', id);

        if (events.length > 0) {
            return res.status(200).json(events);
        } else {
            return res.status(404).json("NO events found");
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getGroupReqs = async (req, res) => {
    const { id } = req.params;

    try {
        const userIDs = await db.manyOrNone('SELECT user_id FROM user_groups WHERE group_id = $1 AND is_pending = true', id)
            .then(data => data.map(row => row.user_id));

        const usersPromises = await Promise.all(userIDs.map(async (userID) => {
            return await db.one('SELECT * FROM users WHERE "ID" = $1', userID)
        }))

        const users = usersPromises.flat();
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const getPastEvents = async (req, res) => {
    const { id } = req.params;

    const now = new Date();
    const nowDate = now.toISOString().split('T')[0];

    try {
        const events = await db.manyOrNone('SELECT * FROM event WHERE group_id = $1 AND event_date < $2', [id, nowDate]);
        if (events.length > 0) {
            return res.status(200).json(events);
        } else {
            return res.status(404).json({ msg: "No past events" })
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const joinGroup = async (req, res) => {
    const { user_id, group_id } = req.body;

    try {
        const checkGroup = await db.one('SELECT is_private_group FROM "group" WHERE group_id = $1', group_id)
            .then(data => data.is_private_group)

        if (checkGroup) {
            await db.none('INSERT INTO user_groups (group_id, user_id, is_pending) VALUES ($1, $2, $3)', [group_id, user_id, true]);

            const notID = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND "type" = 3', group_id)
                .then(data => data.not_id);

            const notifyUsers = await db.many(`
                SELECT owner_id AS user_id
                FROM "group"
                WHERE group_id = $1
                UNION
                SELECT user_id
                FROM user_groups
                WHERE group_id = $1 AND is_admin = true
            `, [group_id])
                .then(data => data.map(row => row.user_id));

            if (notifyUsers.length > 0) {
                notifyUsers.map(async (notifyUser) => {
                    await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notID, notifyUser])
                })
            }

            return res.status(200).json({ msg: "Join request sent" })

        } else {

            await db.none('INSERT INTO user_groups (group_id, user_id) VALUES ($1, $2)', [group_id, user_id]);

            const notID = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND type = 8', group_id)
                .then(data => data.not_id);

            const notifyUsers = await db.many(`
                SELECT owner_id AS user_id
                FROM "group"
                WHERE group_id = $1
                UNION
                SELECT user_id
                FROM user_groups
                WHERE group_id = $1 AND is_admin = true
            `, [group_id])
                .then(data => data.map(row => row.user_id));

            if (notifyUsers.length > 0) {
                notifyUsers.map(async (notifyUser) => {
                    await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notID, notifyUser])
                })
            }

            return res.status(200).json({ msg: "User Joined" })
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const joinGroupRes = async (req, res) => {
    const { group_id, user_id, status } = req.body;

    try {
        if (status == "accept") {
            await db.none('UPDATE user_groups SET is_pending = false WHERE group_id = $1 AND user_id = $2', [group_id, user_id]);

            const notID = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND type = 4', group_id)
                .then(data => data.not_id);

            await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notID, user_id]);

            const notIdOwner = await db.one('SELECT not_id FROM "notifications" WHERE group_id = $1 AND type = 8', group_id)
                .then(data => data.not_id);

            const notifyUsers = await db.many(`
                SELECT owner_id AS user_id
                FROM "group"
                WHERE group_id = $1
                UNION
                SELECT user_id
                FROM user_groups
                WHERE group_id = $1 AND is_admin = true
            `, [group_id])
                .then(data => data.map(row => row.user_id));

            if (notifyUsers.length > 0) {
                notifyUsers.map(async (notifyUser) => {
                    await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [notIdOwner, notifyUser]);
                })
            }

            return res.status(200).json("User request accepted");

        } else if (status == "reject") {
            const notID = await db.one('SELECT not_id FROM notifications WHERE group_id = $1 AND type = 5', group_id)
                .then(data => data.not_id);

            await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2) ', [notID, user_id]);

            await db.none('DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2', [group_id, user_id]);
            return res.status(200).json("User request declined");
        } else {
            return res.status(404).json("status error");
        }
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const leaveGroup = async (req, res) => {
    const { user_id, group_id } = req.body;

    try {
        const eventIDs = await db.manyOrNone('SELECT event_id FROM event WHERE group_id = $1', group_id)
            .then(data => data.map(row => row.event_id));

        eventIDs.map(async (eventID) => {
            await db.none('DELETE FROM user_events WHERE user_id = $1 AND event_id = $2', [user_id, eventID])
        });

        await db.none('DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2', [user_id, group_id]);

        // notifications related part
        const groupPrivacy = await db.one('SELECT is_private_group FROM "group" WHERE group_id = $1', group_id)
            .then(data => data.is_private_group);

        if (groupPrivacy) {
            const notIDs = await db.many('SELECT not_id FROM notifications WHERE group_id = $1', group_id)
                .then(data => data.map(row => row.not_id));

            notIDs.map(async (notID) => {
                await db.none('DELETE FROM user_notifications WHERE not_id = $1 AND user_id = $2', [notID, user_id])
            })
        }

        const notifyUsers = await db.many(`
                SELECT owner_id AS user_id
                FROM "group"
                WHERE group_id = $1
                UNION
                SELECT user_id
                FROM user_groups
                WHERE group_id = $1 AND is_admin = true
            `, [group_id])
            .then(data => data.map(row => row.user_id));

        const newNotification = await db.one('SELECT not_id FROM notifications WHERE group_id = $1 AND type = 9', group_id)
            .then(data => data.not_id);

        await Promise.all(notifyUsers.map(async (notifyUser) => {
            await db.none('INSERT INTO user_notifications (not_id, user_id) VALUES ($1, $2)', [newNotification, notifyUser]);
        }))

        return res.status(200).json({ msg: "User left group" });
    } catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const deleteGroup = async (req, res) => {
    const { group_id } = req.body;

    try {

        const eventIDs = await db.manyOrNone('SELECT event_id FROM event WHERE group_id = $1', group_id)
            .then(data => data.map(row => row.event_id));

        if (eventIDs.length > 0) {
            await Promise.all(eventIDs.map(async (eventID) => {
                await db.none('DELETE FROM user_events WHERE event_id = $1', eventID)
            }))

            await Promise.all(eventIDs.map(async (eventID) => {
                await db.none('DELETE FROM ratings WHERE event_id = $1', eventID)
            }))
        }

        await db.none('DELETE FROM group_category WHERE group_id = $1', group_id);

        const notIDs = await db.many('SELECT not_id FROM notifications WHERE group_id = $1', group_id)
            .then(data => data.map(row => row.not_id));

        await Promise.all(notIDs.map(async (notID) => {
            await db.none('DELETE FROM user_notifications WHERE not_id = $1', notID)
        }))

        await db.none('DELETE FROM notifications WHERE group_id = $1', group_id);

        await db.none('DELETE FROM user_groups WHERE group_id = $1', group_id);

        await db.none('DELETE FROM event WHERE group_id = $1', group_id);

        await db.none('DELETE FROM "group" WHERE group_id = $1', group_id);

        return res.status(200).json("Group deleted");
    } catch (error) {
        console.error(error);
        return res.status(500).json({ msg: "Internal server error" });
    }

}

const filterGroups = async (filters) => {
    // Base query
    let query = 'SELECT * FROM "group" WHERE 1=1';

    // Array to hold query parameters
    let queryParams = [];

    // Add dynamic filters
    if (filters.is_online !== undefined) {
        query += ' AND is_online = $' + (queryParams.length + 1);
        queryParams.push(filters.is_online);
    }

    if (filters.is_f2f !== undefined) {
        query += ' AND is_f2f = $' + (queryParams.length + 1);
        queryParams.push(filters.is_f2f);
    }

    if (filters.is_private_group !== undefined) {
        query += ' AND is_private_group = $' + (queryParams.length + 1);
        queryParams.push(filters.is_private_group);
    }

    if (filters.is_adult_only !== undefined) {
        query += ' AND is_adult_only = $' + (queryParams.length + 1);
        queryParams.push(filters.is_adult_only);
    }

    // Execute query
    return db.any(query, queryParams);
};





export {
    GetRandomGroups, createGroup, getGroup, updateGroup, getGroupMembers, banMember, getCategories, assignAdmin,
    removeBan, BannedMembers, getAdmins, removeAdmin, getGroupEvents, getGroupReqs, getPastEvents, joinGroup, joinGroupRes,
    leaveGroup, deleteGroup, filterGroups
}