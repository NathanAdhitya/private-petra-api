/**
 * Newer version of convertJadwal
 * This relies on PRS data as the source of truth.
 * If a matkul is not found in PRS, it won't be included in the output.
 * UTS and UAS schedule is included in the output.
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

const emptySession = new SIMSession("");
const prsService = new PRSService(emptySession);

export interface MataKuliah {
    prsId: string;
    nama: string;
    semester: number | null;
    sks: number;
    unit: string;
    kode: string;

    kelas: KelasMataKuliah[];
}

export interface KelasMataKuliah {
    kelas: string;
    keterangan?: string;
    accepted?: number;
    capacity?: number;

    jadwal: JadwalMataKuliah[];
    jadwalUts: JadwalUjianMataKuliah[];
    jadwalUas: JadwalUjianMataKuliah[];
}

export interface JadwalUjianMataKuliah {
    date: Date;
    // null for dummy
    lengthMinutes: number | null;

    ruang: string;
}

export interface JadwalMataKuliah {
    dayOfWeek: number;
    startHour: number;
    startMinute: number;
    durasi: number;

    ruang: string;
}

export interface OriginalJadwalMataKuliah {
    hari: string;
    jamMulai: number;
    menitMulai: number;
    lengthMinutes: number;
    ruang: string;
    kelas: string;
    catatan: string;
}

export interface OriginalJadwalUjian {
    date: string;
    lengthMinutes: number;
    ruang: string;
    kelas: string;
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
        const matkulList = await prsService.getMatkulList(
            period,
            unit.kodeUnit
        );

        await Promise.all(
            matkulList.map(async (matkul) => {
                const sks = matkul.sks;
                const kode = matkul.kodeMK;
                const semester = matkul.semester;
                const cleanedNamaMatkul = matkul.namaMK.replaceAll("  ", " ");
                const unitName = unit.unit;

                const newMatkul: MataKuliah = {
                    prsId: matkul.prsId,
                    nama: cleanedNamaMatkul,
                    semester,
                    sks,
                    unit: unitName,
                    kode,
                    kelas: [],
                };

                // Get kelas info from PRS
                const kelasList = await prsService.getCompleteClassesForMatkul(
                    period,
                    matkul.prsId
                );

                if (!(cleanedNamaMatkul in unit.jadwal)) {
                    console.warn(
                        `Matkul "${cleanedNamaMatkul}" not found in jadwal.json`
                    );

                    // Use class data from PRS
                    kelasList.forEach((kelas) => {
                        const newKelas: KelasMataKuliah = {
                            kelas: kelas.kelas,
                            keterangan: kelas.keterangan,
                            accepted: kelas.accepted,
                            capacity: kelas.capacity,
                            jadwal: [],
                            jadwalUts: [],
                            jadwalUas: [],
                        };

                        // Append kelas
                        newMatkul.kelas.push(newKelas);

                        kelas.schedule.forEach((jadwal) => {
                            newKelas.jadwal.push({
                                dayOfWeek: jadwal.dayOfWeek,
                                startHour: jadwal.startHour,
                                startMinute: jadwal.startMinute,
                                durasi: jadwal.duration,
                                ruang: "/",
                            });
                        });
                    });

                    newJadwal.push(newMatkul);

                    return;
                }

                // Find class in original jadwal
                const originalMatkulJadwal = (
                    unit.jadwal[
                        cleanedNamaMatkul as keyof typeof unit.jadwal
                    ] as any
                ).kuliah as OriginalJadwalMataKuliah[];

                const originalMatkulJadwalUts = (
                    unit.jadwal[
                        cleanedNamaMatkul as keyof typeof unit.jadwal
                    ] as any
                ).uts as OriginalJadwalUjian[];

                const originalMatkulJadwalUas = (
                    unit.jadwal[
                        cleanedNamaMatkul as keyof typeof unit.jadwal
                    ] as any
                ).uas as OriginalJadwalUjian[];

                kelasList.forEach((kelas) => {
                    const newKelas: KelasMataKuliah = {
                        kelas: kelas.kelas,
                        keterangan: kelas.keterangan,
                        accepted: kelas.accepted,
                        capacity: kelas.capacity,
                        jadwal: [],
                        jadwalUts: [],
                        jadwalUas: [],
                    };

                    newKelas.jadwal.push(
                        ...originalMatkulJadwal
                            .filter((jadwal) => jadwal.kelas === kelas.kelas)
                            .map((jadwal) => ({
                                dayOfWeek:
                                    hariToDayOfWeek[
                                        jadwal.hari as keyof typeof hariToDayOfWeek
                                    ],
                                startHour: jadwal.jamMulai,
                                startMinute: jadwal.menitMulai,
                                durasi: jadwal.lengthMinutes,
                                ruang: jadwal.ruang,
                            }))
                    );

                    newKelas.jadwalUts.push(
                        ...originalMatkulJadwalUts
                            .filter((jadwal) => jadwal.kelas === kelas.kelas)
                            .map((jadwal) => ({
                                date: new Date(jadwal.date),
                                lengthMinutes: jadwal.lengthMinutes,
                                ruang: jadwal.ruang,
                            }))
                    );

                    newKelas.jadwalUas.push(
                        ...originalMatkulJadwalUas
                            .filter((jadwal) => jadwal.kelas === kelas.kelas)
                            .map((jadwal) => ({
                                date: new Date(jadwal.date),
                                lengthMinutes: jadwal.lengthMinutes,
                                ruang: jadwal.ruang,
                            }))
                    );

                    // Append kelas
                    newMatkul.kelas.push(newKelas);
                });

                newJadwal.push(newMatkul);
            })
        );
    })
);

// Add missing data from original jadwal into the newJadwal

function guessMatkulSks(classDurationPair: [string, number][]) {
    // Guess the SKS of a matkul based on the duration of its classes
    // Put into bins based on the class label

    const bins = new Map<string, number[]>();
    classDurationPair.forEach(([label, duration]) => {
        if (!bins.has(label)) bins.set(label, []);
        bins.get(label)?.push(duration);
    });

    // If each class only contains one schedule, find median and calculate from that.
    // If each class contains more than one schedule, add all the durations and divide by 2.
    // This assumes that the subject has a practical class.
    const values = Array.from(bins.values()).map((durations) => {
        if (durations.length === 1) return durations[0];
        return durations.reduce((a, b) => a + b, 0) / 2;
    });

    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];

    // Guess the SKS based on the median duration
    // Some units like to use 60 minutes per SKS, while some like to do the proper 50 minutes per SKS.
    // If evenly divisible by 50, then we use 50, else we use 60 rounded down.
    if (median % 50 === 0) return Math.floor(median / 50);
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

    const firstAttempt =
        "~" +
        namaUnit
            .split(" ")
            .slice(0, 2)
            .map((word) => word[0].toUpperCase())
            .join("");
    const secondAttempt = "~" + namaUnit.slice(0, 2).toUpperCase();

    if (firstAttempt.length === 3 && !unitPrefixes.has(firstAttempt)) {
        unitPrefixes.set(firstAttempt, 1);
        return firstAttempt;
    }

    if (secondAttempt.length === 3 && !unitPrefixes.has(secondAttempt)) {
        unitPrefixes.set(secondAttempt, 1);
        return secondAttempt;
    }

    // throw new Error(`Unit prefix collision for unit "${namaUnit}"`);
    return secondAttempt;
}

// Add all existing unit prefixes to the map
newJadwal.forEach((matkul) => {
    const prefix = matkul.kode.slice(0, 2);
    unitPrefixes.set(prefix, 1);
});

// Find duplicate mata kuliah
function findDuplicate(unit: string, nama: string, kode: string) {
    let matchedMatkul = newJadwal.find(
        (mk) => mk.unit === unit && mk.nama === nama
    );

    if (!matchedMatkul) {
        matchedMatkul = newJadwal.find((mk) => mk.kode === kode);
    }

    return matchedMatkul;
}

// Loop over the old schedule. If no duplicate is found, then add it to the new schedule.
await Promise.all(
    Object.values(jadwal).map(async (unit) => {
        // ignore any unit which name contains "(*)"
        if (unit.unit.includes("(*)")) return;

        // ignore any unit with name "magister"
        if (unit.unit.toLowerCase().includes("magister")) return;

        // ignore any unit with empty jadwal
        if (Object.keys(unit.jadwal).length === 0) return;

        const unitPrefix = guessUnitPrefix(unit.unit);

        Object.entries(unit.jadwal).forEach(([namaMatkul, matkul]) => {
            // Check duplicate
            const duplicate = findDuplicate(unit.unit, namaMatkul, unitPrefix);
            if (duplicate) return;

            console.log(
                `${namaMatkul} is present in old, adding to new with guessed SKS and kode`
            );

            const sks = guessMatkulSks(
                matkul.kuliah.map((kelas) => [
                    kelas.kelas,
                    kelas.lengthMinutes ?? 0,
                ])
            );

            const kode = `${unitPrefix}${unitPrefixes
                .get(unitPrefix)
                ?.toString()
                .padStart(3, "0")}`;

            const semester: null | number = null;

            // increment unit prefix counter
            unitPrefixes.set(
                unitPrefix,
                (unitPrefixes.get(unitPrefix) ?? 1) + 1
            );

            // Remove double spaces in namaMatkul
            const cleanedNamaMatkul = namaMatkul.replaceAll("  ", " ");

            const newMatkul: MataKuliah = {
                prsId: "",
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
                const newKelas =
                    findKelas ??
                    ({
                        kelas: kelas.kelas,
                        jadwal: [] as JadwalMataKuliah[],
                        jadwalUts: [] as JadwalUjianMataKuliah[],
                        jadwalUas: [] as JadwalUjianMataKuliah[],
                    } satisfies KelasMataKuliah);

                if ("catatan" in kelas && typeof kelas.catatan === "string") {
                    newKelas.keterangan = kelas.catatan;
                }

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

            // Do the same for UTS and UAS
            matkul.uts.forEach((kelas) => {
                // find kelas or append new kelas
                const findKelas = newMatkul.kelas.find(
                    (k) => k.kelas === kelas.kelas
                );
                const newKelas =
                    findKelas ??
                    ({
                        kelas: kelas.kelas,
                        jadwal: [] as JadwalMataKuliah[],
                        jadwalUts: [] as JadwalUjianMataKuliah[],
                        jadwalUas: [] as JadwalUjianMataKuliah[],
                    } satisfies KelasMataKuliah);

                // append jadwal
                newKelas.jadwalUts.push({
                    date: new Date(kelas.date ?? 0),
                    lengthMinutes: kelas.lengthMinutes,
                    ruang: kelas.ruang,
                });

                if (!findKelas) newMatkul.kelas.push(newKelas);
            });

            matkul.uas.forEach((kelas) => {
                // find kelas or append new kelas
                const findKelas = newMatkul.kelas.find(
                    (k) => k.kelas === kelas.kelas
                );
                const newKelas =
                    findKelas ??
                    ({
                        kelas: kelas.kelas,
                        jadwal: [] as JadwalMataKuliah[],
                        jadwalUts: [] as JadwalUjianMataKuliah[],
                        jadwalUas: [] as JadwalUjianMataKuliah[],
                    } satisfies KelasMataKuliah);

                // append jadwal
                newKelas.jadwalUas.push({
                    date: new Date(kelas.date ?? 0),
                    lengthMinutes: kelas.lengthMinutes,
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
Bun.write("output/newJadwalv2.json", JSON.stringify(newJadwal, null, 2));
