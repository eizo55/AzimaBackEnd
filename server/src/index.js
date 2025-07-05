import express from "express";
import cors from "cors";

import {
  authorizeLogin, register, getUserData, getUserEvents, getUserGroups, myOwnerGroups, myAdminGroups, updateUser, getConEvents,
  updatePassword, deleteAccount, getUserNots, getUserPastEvents, getConPastEvents
} from "./controllers/Users.js";
import {
  GetRandomGroups, createGroup, getGroup, updateGroup, getGroupMembers, banMember, getCategories, assignAdmin,
  removeBan, BannedMembers, getAdmins, removeAdmin, getGroupEvents, getGroupReqs, getPastEvents, joinGroup, joinGroupRes,
  leaveGroup, deleteGroup, filterGroups
} from "./controllers/Groups.js"
import {
  createEvent, getEventData, updateEvent, eventUsers, joinEvent, sendConRequest, conResponse,
  deleteEvent, leaveEvent, rateEvent, getEventRatings, deleteRating, getEventOwner, getContributors
} from "./controllers/Events.js"

const hostname = "127.0.0.1";
const port = 3000;

const app = express();

app.use(express.json());
app.use(cors());


app.post("/login", authorizeLogin)
app.post("/register", register)

app.post("/userData", getUserData)
app.post("/userEvents", getUserEvents)
app.post("/userGroups", getUserGroups)
app.get("/randomGroups", GetRandomGroups)
app.post("/createGroup", createGroup)
app.get("/getGroup/:id", getGroup)
app.put("/updateGroup", updateGroup)
app.get("/getGroupMembers/:id", getGroupMembers)
app.put("/banMember", banMember) // returns nothing
app.put("/removeBan", removeBan) //returns nothing
app.get("/BannedMembers/:id", BannedMembers) //returns array of user objects
app.get("/getCategories", getCategories) // returns array of category objects
app.put("/assignAdmin", assignAdmin) // returns nothing
app.get("/getAdmins/:id", getAdmins) // returns array of user objects
app.put("/removeAdmin", removeAdmin)// returns nothing
app.get("/getGroupEvents/:id", getGroupEvents)// returns array of group objects   ++ NAME CHANGED
app.get("/getGroupReqs/:id", getGroupReqs)//returns array of user objects
app.post('/createEvent', createEvent)// returns event object
app.get("/getEventData/:id", getEventData)// returns event object
app.post("/updateEvent", updateEvent)// returns event object
app.get("/eventUsers/:id", eventUsers)// new (takes event_id from params and returns user info from users table + user_event table info )
app.post("/joinEvent/:event_id", joinEvent)// returns user_events object
app.put("/sendConRequest", sendConRequest)// returns user_events object
app.put("/conResponse", conResponse)// takse event and user IDs with a string saying "accept"/"reject" (all lowerCase) in the req body and returns a user_events object 
app.get("/myOwnerGroups/:id", myOwnerGroups)// Returns array of group objects
app.get("/myAdminGroups/:id", myAdminGroups)// Returns array of group objects
app.put("/updateUser/:id", updateUser)// Returns user object
app.get("/getPastEvents/:id", getPastEvents) // Returns array of event objects
app.post("/joinGroup", joinGroup)
app.put("/joinGroupRes", joinGroupRes)
app.post("/getConEvents", getConEvents)
app.put("/updatePassword", updatePassword)
app.post("/deleteAccount", deleteAccount)
app.post("/deleteEvent", deleteEvent)
app.post("/getUserNots", getUserNots)
app.post("/leaveGroup", leaveGroup)
app.post("/leaveEvent", leaveEvent)
app.post("/rateEvent", rateEvent) // returns a message
app.post("/getEventRatings", getEventRatings) // returns array of objects (each object contains ratings attributes and the user object)
app.post("/deleteRating", deleteRating)
app.post("/getEventOwner", getEventOwner)
app.post("/deleteGroup", deleteGroup)
app.post("/getContributors", getContributors)
app.post("/getUserPastEvents", getUserPastEvents)
app.post("/getConPastEvents", getConPastEvents)
app.post('/filter-groups', async (req, res) => {
  try {
    const filters = req.body;
    const groups = await filterGroups(filters);
    res.status(200).json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

/* To create a new request:
  1) Add app.x('/url',functionToExecute)
  2) Create functionToExecute body in controllers
  3) export the fucntion and import



*/