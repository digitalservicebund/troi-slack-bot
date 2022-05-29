const config = require('../config.json');

let troiApi;

exports.startTroi = async () => {
    const TroiApiService = await import("troi-library");
    // make PR to troi-library for the methods required for impersonation TODO
    troiApi = new TroiApiService.default(config.TROI_API_URL, config.TROI_USERNAME, config.TROI_PASSWORD);
    await troiApi.initialize();
    console.log("Connection to the Troi API is initialized");
}
