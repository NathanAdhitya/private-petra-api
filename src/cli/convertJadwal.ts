/**
 * Older version of convertJadwal
 * This relies on schedule data as the source of truth.
 * If a matkul is not found in PRS, SKS and Kode MK will be guessed.
 */

import "dotenv/config";
import jadwal from "../../output/jadwal.json";
import { SIMSession } from "../SIMSession.js";
import process from "process";
import { PRSService } from "../modules/prs/PRSService.js";

// Print parameters
let period = process.argv.slice(2)[0] ?? "";
if (period.length === 0) {
    console.warn(
        "Period is not provided as parameter, assuming 2024S2. Calculate this with the format {YEAR}S{SEMESTER 1/2}"
    );
    period = "2024S2";
}

console.log("Logging in...");
console.log("Username:", process.env["SIM_USERNAME"]);

const session = await SIMSession.login(
    process.env["SIM_USERNAME"]!,
    process.env["SIM_PASSWORD"]!,
    "@john.petra.ac.id"
);

console.log("Logged in.");

const prsService = new PRSService(session);

export function guessMatkulSks(durationMinutes: number[]) {
    // Guess the SKS of a matkul based on the duration of its classes
    // The duration of a class is an array of integers representing the duration of each class in minutes

    // Take the median duration to account for input errors
    const sorted = durationMinutes.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Guess the SKS based on the median duration
    return Math.floor(median / 60);
}

const unitPrefixes = new Map<string, number>();
function guessUnitPrefix(namaUnit: string) {
    // Unit prefix is a two digit uppercase letter that is used to identify a unit
    // This function guesses the unit prefix based on the unit name
    // Duplicates are not allowed
    // First attempt: use first letters of the first two words
    // Second attempt: use first two letters of the unit name
    // If both attempts resulted in a collision, then throw an error.

    const firstAttempt = namaUnit
        .split(" ")
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join("");
    const secondAttempt = namaUnit.slice(0, 2).toUpperCase();

    if (firstAttempt.length === 2 && !unitPrefixes.has(firstAttempt)) {
        unitPrefixes.set(firstAttempt, 1);
        return firstAttempt;
    }

    if (secondAttempt.length === 2 && !unitPrefixes.has(secondAttempt)) {
        unitPrefixes.set(secondAttempt, 1);
        return secondAttempt;
    }

    return secondAttempt;
}

export interface MataKuliah {
    nama: string;
    semester: number | null;
    sks: number;
    unit: string;
    kode: string;

    kelas: KelasMataKuliah[];
}

export interface KelasMataKuliah {
    kelas: string;
    catatan?: string;

    jadwal: JadwalMataKuliah[];
}

export interface JadwalUjianMataKuliah {
    date: Date;
    endDate: Date;

    ruang: string;
}

export interface JadwalMataKuliah {
    dayOfWeek: number;
    startHour: number;
    startMinute: number;
    durasi: number;

    ruang: string;
}

const hariToDayOfWeek = {
    Senin: 1,
    Selasa: 2,
    Rabu: 3,
    Kamis: 4,
    Jumat: 5,
    Sabtu: 6,
    Minggu: 7,
};

const newJadwal: MataKuliah[] = [];

await Promise.all(
    Object.values(jadwal).map(async (unit) => {
        // ignore any unit which name contains "(*)"
        if (unit.unit.includes("(*)")) return;

        // ignore any unit with name "magister"
        if (unit.unit.toLowerCase().includes("magister")) return;

        // ignore any unit with empty jadwal
        if (Object.keys(unit.jadwal).length === 0) return;

        // get class data for the unit
        const matkulList = await prsService.getMatkulList(period, unit.kodeUnit);
        const matkulMap = new Map<string, (typeof matkulList)[number]>(); // key: nama mk all lowercase without whitespace

        matkulList.forEach((matkul) => {
            const key = matkul.namaMK.toLowerCase().replace(/\s/g, "");
            matkulMap.set(key, matkul);
        });

        const unitPrefix = guessUnitPrefix(unit.unit);

        Object.entries(unit.jadwal).forEach(([namaMatkul, matkul]) => {
            const matkulKey = namaMatkul.toLowerCase().replace(/\s/g, "");
            const prsMatkul = matkulMap.get(matkulKey);

            let sks = guessMatkulSks(
                matkul.kuliah.map((kelas) => kelas.lengthMinutes ?? 0)
            );

            let kode = `${unitPrefix}${unitPrefixes
                .get(unitPrefix)
                ?.toString()
                .padStart(3, "0")}`;

            let semester: null | number = null;

            if(!prsMatkul){
                console.warn(`${namaMatkul} not found in PRS entry. SKS and Kode MK will be guessed. Kode unit: ${unit.kodeUnit}, key: ${matkulKey}`);
            } else {
                sks = prsMatkul.sks;
                kode = prsMatkul.kodeMK;
                semester = prsMatkul.semester;
            }
            
            // increment unit prefix counter
            unitPrefixes.set(
                unitPrefix,
                (unitPrefixes.get(unitPrefix) ?? 1) + 1
            );

            // Remove double spaces in namaMatkul
            const cleanedNamaMatkul = namaMatkul.replaceAll("  ", " ");

            const newMatkul: MataKuliah = {
                nama: cleanedNamaMatkul,
                semester,
                sks,
                unit: unit.unit,
                kode,
                kelas: [],
            };

            matkul.kuliah.forEach((kelas) => {
                // skip if jam mulai is null
                if (kelas.jamMulai === null) return;

                // skip if ruang is /
                if (kelas.ruang === "/") return;

                // find kelas or append new kelas
                const findKelas = newMatkul.kelas.find(
                    (k) => k.kelas === kelas.kelas
                );
                const newKelas = findKelas ?? {
                    kelas: kelas.kelas,
                    jadwal: [] as JadwalMataKuliah[],
                };

                // append jadwal
                newKelas.jadwal.push({
                    dayOfWeek:
                        hariToDayOfWeek[
                            kelas.hari as keyof typeof hariToDayOfWeek
                        ],
                    startHour: kelas.jamMulai,
                    startMinute: kelas.menitMulai,
                    durasi: kelas.lengthMinutes ?? 0,
                    ruang: kelas.ruang,
                });

                if (!findKelas) newMatkul.kelas.push(newKelas);
            });

            newJadwal.push(newMatkul);
        });
    })
);

// Sort the array by "nama" field for consistency
newJadwal.sort((a, b) => a.nama.localeCompare(b.nama));

// write newJadwal to newJadwal.json
Bun.write("output/newJadwal.json", JSON.stringify(newJadwal, null, 2));
