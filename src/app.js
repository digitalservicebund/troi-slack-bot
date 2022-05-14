const { App } = require('@slack/bolt');
const schedule = require('node-schedule');
const dialog = require('./dialog')
const { buildRecurrenceRule, buildDefaultUser, lang, todayIsPublicHoliday } = require("./util");

const slackApp = new App({
    token: process.env.BOT_USER_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SOCKET_MODE_TOKEN
});

const users = {};

// INCOMING messages from Slack
slackApp.message(async ({ message, client, say }) => {
    let user = users[message.user];
    if (user && message.text.toLowerCase() === 'reset') {
        schedule.cancelJob('reminder_' + user.user);
        users[message.user] = null;
        user = null;
    }
    if (!user) {
        // first time we hear from this user, get their info
        const userInfo = await client.users.info({ user: message.user });
        user = buildDefaultUser(message, userInfo);
        users[user.user] = user;
        schedule.scheduleJob("reminder_" + user.user, buildRecurrenceRule(user.reminder.rule), () => {
            // don't if user paused reminders, it's a public holiday or user is on holiday (API-call to Personio or read out Status in Slack?) TODO
            if (todayIsPublicHoliday() || !user.reminder.active) return;
            postMessage(user, lang(user, "motivational_prompt"));
        });
    }
    let response = await dialog.handleMessage(user, message,
        () => schedule.rescheduleJob("reminder_" + user.user, buildRecurrenceRule(user.reminder.rule))
    );
    if (response) {
        await say(response);
    }
});

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
    console.log('BleibTroy is running');
})();
