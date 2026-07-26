const client = require("../index");
const { registerHandlers } = require("../modules/leader_applications");

client.once("ready", async () => {
    console.log(client.user.username + " Включился");
    console.log(new Date().toString());

    registerHandlers(client);
});
