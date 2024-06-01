import "dotenv/config";

// Create SIMLogin then print PHPSESSID
import { SIMSession } from "./SIMSession.js";
import { JadwalKuliahGlobal } from "./modules/jadwal/JadwalKuliahGlobal.js";

console.log("Logging in...");
console.log("Username:", process.env["SIM_USERNAME"]);

(async () => {
    const session = await SIMSession.login(
        process.env["SIM_USERNAME"]!,
        process.env["SIM_PASSWORD"]!,
        "@john.petra.ac.id"
    );

    console.log("Logged in.");

    // generateCSVJadwalKuliah(session);
    // generatePerwalian1(session);
    const jadwalKuliahGlobal = new JadwalKuliahGlobal(session);
    const results = await jadwalKuliahGlobal.getAllJadwalKuliah();

    // Save it to a file for dev
    function replacer(key: string, value: any) {
        if (value instanceof Map) {
            // turn map into a regular object
            return Object.fromEntries(value);
        } else {
            return value;
        }
    }

    await Bun.write(
        Bun.file("output/jadwal.json"),
        JSON.stringify(results, replacer, 2)
    );
})();
