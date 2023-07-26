import "dotenv/config";

// Create SIMLogin then print PHPSESSID
import { SIMSession } from "./SIMSession.js";
import { KHS } from "./modules/khs/KHS.js";

console.log("Logging in...");
console.log("Username:", process.env.SIM_USERNAME);

(async () => {
  const session = await SIMSession.login(
    process.env.SIM_USERNAME!,
    process.env.SIM_PASSWORD!,
    "@john.petra.ac.id"
  );

  const khs = new KHS(session);
  khs.getAllValidPeriods().then((periods) => {
    console.dir(periods, { depth: null });
  });
})();
