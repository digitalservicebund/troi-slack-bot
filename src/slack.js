const config = require("../config.json");
const { App } = require("@slack/bolt");
const { handleAppHomeOpenedEvent, handleActionResponse, handleMessage } = require("./state");

exports.startSlackApp = async () => {
    await slackApp.start();
    console.log("Slack app has started");
}

const slackApp = new App({
    token: config.SLACK_BOT_USER_OAUTH_TOKEN,
    signingSecret: config.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: config.SLACK_SOCKET_MODE_TOKEN
});

// INCOMING

slackApp.event("app_home_opened", async ({ event, client, say }) => {
    await handleAppHomeOpenedEvent(event, say, client);
});

slackApp.message(async ({ message, client, say }) => {
    if (message.subtype && message.subtype === "message_changed") return;
    await handleMessage(message, say, client);
});

// Actions

slackApp.action(/^btn/i, async ({ body, ack, say, client}) => {
    await handleActionResponse("button-response", body, ack, say, client);
});

slackApp.action(/^timepicker/i, async ({ body, ack, say, client}) => {
    await handleActionResponse("timepicker-response", body, ack, say, client);
});

slackApp.action(/^checkboxes/i, async ({ body, ack, say, client}) => {
    await handleActionResponse("checkbox-response", body, ack, say, client);
});

slackApp.action(/^radiobuttons/i, async ({ body, ack, say, client}) => {
    await handleActionResponse("radiobutton-response", body, ack, say, client);
});

slackApp.action(/^textinput/i, async ({ body, ack, say, client}) => {
    await handleActionResponse("textinput-response", body, ack, say, client);
});
