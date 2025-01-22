import jadwal from "../../output/jadwal.json";

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

Object.values(jadwal).forEach((unit) => {
    // ignore any unit which name contains "(*)"
    if (unit.unit.includes("(*)")) return;

    // ignore any unit with name "magister"
    if (unit.unit.toLowerCase().includes("magister")) return;

    // ignore any unit with empty jadwal
    if (Object.keys(unit.jadwal).length === 0) return;

    const unitPrefix = guessUnitPrefix(unit.unit);

    Object.entries(unit.jadwal).forEach(([namaMatkul, matkul]) => {
        const sks = guessMatkulSks(
            matkul.kuliah.map((kelas) => kelas.lengthMinutes ?? 0)
        );

        const kode = `${unitPrefix}${unitPrefixes
            .get(unitPrefix)
            ?.toString()
            .padStart(3, "0")}`;

        // increment unit prefix counter
        unitPrefixes.set(unitPrefix, (unitPrefixes.get(unitPrefix) ?? 1) + 1);

        const newMatkul: MataKuliah = {
            nama: namaMatkul,
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
                    hariToDayOfWeek[kelas.hari as keyof typeof hariToDayOfWeek],
                startHour: kelas.jamMulai,
                startMinute: kelas.menitMulai,
                durasi: kelas.lengthMinutes ?? 0,
                ruang: kelas.ruang,
            });

            if (!findKelas) newMatkul.kelas.push(newKelas);
        });

        newJadwal.push(newMatkul);
    });
});
// write newJadwal to newJadwal.json
Bun.write("output/newJadwal.json", JSON.stringify(newJadwal, null, 2));
