import "dotenv/config";

// Create SIMLogin then print PHPSESSID
import { SIMSession } from "./SIMSession.js";

console.log("Logging in...");
console.log("Username:", process.env.SIM_USERNAME);

(async () => {
    const session = await SIMSession.login(
        process.env.SIM_USERNAME!,
        process.env.SIM_PASSWORD!,
        "@john.petra.ac.id"
    );
    console.log(session.PHPSESSID);
})();
