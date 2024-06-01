/**
 * @description Generates data for perwalian w/ Pak. Stephanus
 * Generated data:
 * - Mata kuliah with CPL under 55.5
 * - CSV of Kode, Mata Kuliah, SKS, Nilai for all periods
 */

import { SIMSession } from "../SIMSession.js";
import { KHS } from "../modules/khs/KHS.js";
import fs from "fs/promises";
import type {
    CapaianPembelajaranMataKuliah,
    KHSParameters,
} from "../types/KartuHasilStudi.js";

export async function generatePerwalian1(session: SIMSession) {
    const khs = new KHS(session);
    const allPeriods = await khs.getAllValidPeriods();

    // Get all details
    const allDetails = await Promise.all(
        allPeriods.map(async (period) =>
            Promise.all(
                period.mataKuliah.map(async (mk) => ({
                    ...mk,
                    detail: await khs.getMKDetail({
                        ...(period.parameters as KHSParameters),
                        key: mk.detailId,
                    }),
                }))
            )
        )
    );

    // Fix MK names in allDetails to have proper letter case
    allDetails.forEach((period) =>
        period.forEach((mk) => {
            mk.namaMK = mk.namaMK
                .split(" ")
                .map((word) => word[0] + word.slice(1).toLowerCase())
                .join(" ");
        })
    );

    const CPLUnder55 = allDetails
        .flat()
        .filter(
            (mk) => mk.detail.cpl?.find((cpl) => cpl.nilai < 55.5) !== undefined
        );

    const CPLCSV = CPLUnder55.map((mk) => {
        const cpl = mk.detail.cpl?.find((cpl) => cpl.nilai < 55.5);
        return `${mk.kodeMK},${mk.namaMK},${mk.sks},${cpl?.nilai}`;
    });

    // Write to output/cpl_csv.csv
    await fs.writeFile(
        "./output/cpl_csv.csv",
        "Kode,Mata Kuliah,SKS,Nilai\n" + CPLCSV.join("\n")
    );

    // Write all mata kuliah information to output/mk_details.csv
    const mkDetailsCSV = allDetails.flat().map((mk) => {
        return `${mk.kodeMK},${mk.namaMK},${mk.sks},${mk.nilai}`;
    });

    await fs.writeFile(
        "./output/mk_details.csv",
        "Kode,Mata Kuliah,SKS,Nilai\n" + mkDetailsCSV.join("\n")
    );
}
