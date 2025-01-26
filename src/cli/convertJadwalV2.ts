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

// Sort the array by "nama" field for consistency
newJadwal.sort((a, b) => a.nama.localeCompare(b.nama));

// write newJadwal to newJadwal.json
Bun.write("output/newJadwalv2.json", JSON.stringify(newJadwal, null, 2));
