export interface JadwalGlobal {
    periode: string;
    unit: string;

    jadwal: Map<
        string,
        {
            kuliah: EntryJadwalKuliahGlobal[];
            uts: EntryJadwalUjianGlobal[];
            uas: EntryJadwalUjianGlobal[];
        }
    >;
}

export type DayString =
    | "Senin"
    | "Selasa"
    | "Rabu"
    | "Kamis"
    | "Jumat"
    | "Sabtu"
    | "Minggu"
    | "DUMMY";

export interface EntryJadwalUjianGlobal {
    date: Date;
    lengthMinutes: number;

    ruang: string;
    kelas: string;
    catatan?: string;
}

export interface EntryJadwalKuliahGlobal {
    hari: DayString;
    jamMulai: number;
    menitMulai: number;
    lengthMinutes: number;

    ruang: string;
    kelas: string;
    catatan?: string;
}
