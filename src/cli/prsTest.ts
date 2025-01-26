import { PRSService } from "../modules/prs/PRSService";
import { SIMSession } from "../SIMSession";

const session = new SIMSession("");
const prsService = new PRSService(session);

console.dir(await prsService.getCompleteClassesForMatkul("2024S2", "2024:DU4101:XXX:1"), {depth: null});

