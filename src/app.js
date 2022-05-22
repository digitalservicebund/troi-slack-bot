const { App } = require("@slack/bolt");
const schedule = require("node-schedule");
// const nano = require("nano")("http://admin:admin@localhost:5984"); TODO
// const { GoogleSpreadsheet } = require("google-spreadsheet"); TODO
// const git = require("simple-git"); TODO
const dialog = require("./dialog")
const { buildRecurrenceRule, buildDefaultUser, lang, todayIsPublicHoliday, userSubmittedToday } = require("./util");

let troiApi;

const slackApp = new App({
    token: process.env.BOT_USER_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SOCKET_MODE_TOKEN
});

// nano.db.create("troi-slack-app");
// const db = nano.use("troi-slack-app");

const users = {};

slackApp.event("app_home_opened", async ({ event, client, say }) => {
    if (!users[event.user]) await registerNewUser(event, client, say);
});

slackApp.action(new RegExp('^btn', 'i'), async ({ body, ack, say }) => {
    let user = users[body.user.id];
    let actionId = body.actions[0].action_id; // actions array? how can there be more than one in there?
    let value = body.actions[0].value;
    console.log("user:", user.displayName, "actionId:", actionId, "value:", value);
    await ack();
    await say(`<@${body.user.id}> clicked the button`);
});

// INCOMING messages from Slack
slackApp.message(async ({ message, client, say }) => {
    let user = users[message.user];
    if (user && message.text.toLowerCase() === "reset") {
        schedule.cancelJob("reminder_" + user.user);
        users[message.user] = null;
        user = null;
    }
    if (!user) {
        await registerNewUser(message, client, say);
        return;
    }
    if (message.text === "dev") {
        await dev(message, say);
        return;
    }
    let response = await dialog.handleMessage(user, message,
        () => schedule.rescheduleJob("reminder_" + user.user, buildRecurrenceRule(user.reminder.rule))
    );
    if (response) await say(response);
});

async function dev(message, say) {
    await say({
        blocks: [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `:wave: *Hey there* <@${message.user}>!`
                },
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Button 1",
                        },
                        "value": "btn1",
                        "action_id": "btn1"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Button 2",
                        },
                        "value": "btn2",
                        "action_id": "btn2"
                    }
                ]
            }
        ],
        text: "text to be shown in slack notification etc."
    });
}

async function registerNewUser(eventOrMessage, client, say) {
    // first time we hear from this user, get their info
    const userInfo = await client.users.info({ user: eventOrMessage.user });
    let user = buildDefaultUser(eventOrMessage.user, eventOrMessage.channel, userInfo);
    // await db.insert(user,user.displayName + "_" + user.user);
    users[user.user] = user;
    schedule.scheduleJob("reminder_" + user.user, buildRecurrenceRule(user.reminder.rule), () => {
        // also pause when user is on holiday: API-call to Personio, read out Status in Slack or user has to do manually? TODO
        if (todayIsPublicHoliday() || !user.reminder.active || userSubmittedToday(user)) return;
        postMessage(user, lang(user, "motivational_prompt"));
    });
    // user.troi.employeeId = await troiApi.getEmployeeIdForUserName(user.troi.username); TODO
    /*let projects = await troiApi.getCalculationPositions();
    if (projects.length === 1) {
        user.troi.defaultProject = projects[0].id;
    } else {
        // ask users to give nicknames for projects TODO
    }*/
    // don't allow changing of usernames? Instead verify email with Google OAuth? TODO
    // instead of API impersonation, use a PIN that people have to enter with each entry and encrypt the stored password with that? TODO
    await say("Hey there " + user.displayName + ", nice to meet you! I set up the default reminder for you:" +
        " _every weekday at 17:00_.\n" +
        "From your email-address I derived that your Troi username is *" + user.troi.username + "*. If this" +
        " is not correct, please change it by sending: _username: <your-Troi-username>_");
    console.log("New user registered: " + user.displayName);
}

// OUTGOING messages to Slack
async function postMessage(user, text) {
    try {
        const result = await slackApp.client.chat.postMessage({
            token: process.env.BOT_USER_OAUTH_TOKEN,
            channel: user.channel,
            text: text
        });
        console.log("Sent message to " + user.user);
    } catch (error) {
        console.error(error);
    }
}

(async () => {
    await slackApp.start();
    const TroiApiService = await import("troi-library");
    troiApi = new TroiApiService.default(process.env.TROI_API_URL, process.env.TROI_USERNAME, process.env.TROI_PASSWORD);
    await troiApi.initialize();
    console.log("Connection to the Troi API is initialized");
    console.log("BleibTroy is running");
})();
