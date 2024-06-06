import { SIMSession } from "../../SIMSession.js";
import { JSDOM } from "jsdom";
import { parseHTMLTable } from "../TableParser.js";

interface BaseJadwalResponse {
    [key: string]: string;
    Jam: string;
    Lama: string;
    Ruang: string;
    "Mata Kuliah": string;
    Kelas: string;
}

interface JadwalKuliahResponse extends BaseJadwalResponse {
    Hari: string;
    Dosen: string;
}

interface JadwalUjianResponse extends BaseJadwalResponse {
    Tanggal: string;
}

interface BaseJadwalParsedResponse {
    hourStart: number;
    minuteStart: number;
    durationMinutes: number;
    room: string;
    subject: string;
    class: string;
}

interface JadwalKuliahParsedResponse extends BaseJadwalParsedResponse {
    /**
     * 0 is sunday, 6 is saturday
     */
    dayIndex: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    lecturer: string;
}

interface JadwalUjianParsedResponse extends BaseJadwalParsedResponse {
    date: Date;
}

const dayIndex = {
    Senin: 1,
    Selasa: 2,
    Rabu: 3,
    Kamis: 4,
    Jumat: 5,
    Sabtu: 6,
    Minggu: 0,
} as const;

export function parseJadwalKuliahResponse(
    response: JadwalKuliahResponse
): JadwalKuliahParsedResponse {
    const day = response.Hari;
    const [hourStart, minuteStart] = response.Jam.split(":").map(Number);
    const durationMinutes = Number.parseInt(response.Lama);
    const room = response.Ruang;
    const subject = response["Mata Kuliah"];
    const class_ = response.Kelas;
    const lecturer = response.Dosen;

    if (isNaN(hourStart) || isNaN(minuteStart) || isNaN(durationMinutes)) {
        throw new Error("Invalid time format");
    }

    if (!(day in dayIndex)) {
        throw new Error("Invalid day");
    }

    return {
        dayIndex: dayIndex[day as keyof typeof dayIndex],
        hourStart,
        minuteStart,
        durationMinutes,
        room,
        subject,
        class: class_,
        lecturer,
    };
}

export async function getJadwalKuliah(session: SIMSession) {
    // Get the data at ?page=view_jadwalkuliah
    const response = await session.fetch("index.php?page=view_jadwaluts");

    // Parse the HTML
    const dom = new JSDOM(await response.text());

    // Get Periode and Year

    // Period is in <select name="semester" id="semester">.
    // Get the value from the selected option's value attribute.
    const period = (
        dom.window.document.querySelector(
            "#semester > option[selected]"
        ) as HTMLOptionElement
    ).value;

    // Year is in <select name="tahun" id="tahun">.
    // Get the value from the selected option's value attribute.
    const year = (
        dom.window.document.querySelector(
            "#tahun > option[selected]"
        ) as HTMLOptionElement
    ).value;

    const table = dom.window.document.querySelector(
        "table.GridStyle[width='800'][cellpadding='4'][cellspacing='0']"
    ) as HTMLTableElement;

    return {
        year: parseInt(year),
        periode: period,
        entries: parseHTMLTable<JadwalKuliahResponse>(table),
    };
}

export function parseJadwalUjianResponse(
    response: JadwalUjianResponse
): JadwalUjianParsedResponse {
    // All date and time are in UTC+7, must make sure that is correct
    // The new date should also contain the time

    // Original date is dd-mm-yyyy
    const [day, month, year] = response.Tanggal.split("-")
        .map(Number)
        .map(String)
        .map((it) => it.padStart(2, "0"));
    const [hourStart, minuteStart] = response.Jam.split(":").map(Number);
    const [hour, minute] = [hourStart, minuteStart]
        .map(String)
        .map((it) => it.padStart(2, "0"));

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+07:00`);

    const durationMinutes = Number.parseInt(response.Lama);
    const room = response.Ruang;
    const subject = response["Mata Kuliah"];
    const class_ = response.Kelas;

    if (isNaN(hourStart) || isNaN(minuteStart) || isNaN(durationMinutes)) {
        throw new Error("Invalid time format");
    }

    return {
        date,
        hourStart,
        minuteStart,
        durationMinutes,
        room,
        subject,
        class: class_,
    };
}

export async function getJadwalUjian(page: string, session: SIMSession) {
    // Data is at ?page=view_jadwaluts
    const response = await session.fetch(`index.php?page=${page}`);
    const dom = new JSDOM(await response.text());

    // Get Periode and Year
    const period = (
        dom.window.document.querySelector(
            "#semester > option[selected]"
        ) as HTMLOptionElement
    ).value;

    const year = Number.parseInt(
        (
            dom.window.document.querySelector(
                "#tahun > option[selected]"
            ) as HTMLOptionElement
        ).value
    );

    const table = dom.window.document.querySelector(
        "table.GridStyle[width='800'][cellpadding='4'][cellspacing='0']"
    ) as HTMLTableElement;

    return {
        year,
        periode: period,
        entries: parseHTMLTable<JadwalUjianResponse>(table),
    };
}
