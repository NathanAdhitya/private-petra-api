import "dotenv/config";

// Create SIMLogin then print PHPSESSID
import { SIMSession } from "./SIMSession.js";
import { KHS } from "./modules/khs/KHS.js";
import { generatePerwalian1 } from "./cli/Perwalian1.js";
import { generateCSVJadwalKuliah } from "./cli/CSVJadwalKuliah.js";

console.log("Logging in...");
console.log("Username:", process.env.SIM_USERNAME);

(async () => {
  const session = await SIMSession.login(
    process.env.SIM_USERNAME!,
    process.env.SIM_PASSWORD!,
    "@john.petra.ac.id"
  );

  generateCSVJadwalKuliah(session);
})();
