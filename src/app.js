const { App } = require('@slack/bolt');
const schedule = require('node-schedule');
const {buildRecurrenceRule} = require("./util");
const dialog = require('./dialog')

const app = new App({
    token: process.env.BOT_USER_OAUTH_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SOCKET_MODE_TOKEN
});

const users = {};

app.message(async ({ message, say }) => {
    let user = users[message.user];
    if (!user) {
        // first time we hear from this user
        user = {
            user: message.user,
            channel: message.channel,
            troi: {
                username: null,
                password: null,
                projects: {}, // key: nickname, value: ID
                defaultProject: null // ID
            },
            reminder: {
                active: true,
                pausedUntil: null,
                rule: {
                    dayOfWeek: {
                        fixDay: null,
                        range: {
                            start: 1,
                            end: 5, // 1-5 = weekdays, easy way to skip public holidays?
                            step: null
                        }
                    },
                    hour: null,
                    minute: null,
                    second: null
                }
            }
        };
        users[message.user] = user;
        let job = schedule.scheduleJob("reminder_" + user.user, buildRecurrenceRule(user.reminder.rule), () => {
            postMessage(user, "reminder");
        });
    }
    let response = await dialog.handleMessage(user, message);
    if (response) {
        await say(response);
    }
});

async function postMessage(user, text) {
    try {
        const result = await app.client.chat.postMessage({
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
    await app.start();
    console.log('BleibTroy is running');
})();
