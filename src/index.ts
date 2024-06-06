import "dotenv/config";

// Create SIMLogin then print PHPSESSID
import { SIMSession } from "./SIMSession.js";
import { generateCSVJadwalKuliah } from "./cli/CSVJadwalKuliah.js";

console.log("Logging in...");
console.log("Username:", process.env["SIM_USERNAME"]);

const session = await SIMSession.login(
    process.env["SIM_USERNAME"]!,
    process.env["SIM_PASSWORD"]!,
    "@john.petra.ac.id"
);

console.log("Logged in.");

await generateCSVJadwalKuliah(session);
// generatePerwalian1(session);
