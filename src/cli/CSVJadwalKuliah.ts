/**
 * @description Generates csv of jadwal kuliah
 */

import { SIMSession } from "../SIMSession.js";
import ical, {
    ICalCalendarMethod,
    ICalEventRepeatingFreq,
} from "ical-generator";
import {
    getJadwalKuliah,
    getJadwalUjian,
    parseJadwalKuliahResponse,
    parseJadwalUjianResponse,
} from "../modules/jadwal/JadwalKuliah.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function generateCSVJadwalKuliah(session: SIMSession) {
    const currentJadwalKuliah = await getJadwalKuliah(session);
    const { year, periode } = currentJadwalKuliah;
    const cal = ical({
        name: "Nathan's Petra Sync",
    });

    const currentJadwalKuliahData = currentJadwalKuliah.entries.rows.map(
        parseJadwalKuliahResponse
    );

    const currentJadwalUTSData = (
        await getJadwalUjian("view_jadwaluts", session)
    ).entries.rows.map(parseJadwalUjianResponse);
    const currentJadwalUASData = (
        await getJadwalUjian("view_jadwaluas", session)
    ).entries.rows.map(parseJadwalUjianResponse);

    // Guess start and end time of recurring events

    // 1st semester is expected to start around January (periode === "S1")
    // 2nd semester is expected to start around July (periode === "S2")
    if (!["S1", "S2"].includes(periode)) {
        throw new Error("Invalid periode");
    }

    const userSuppliedStartBoundary = new Date("5 February 2024");

    const startBoundary =
        userSuppliedStartBoundary ??
        new Date(year, periode === "S1" ? 0 : 6, 1);

    // End boundary for classes should be the earliest UAS date, if UAS is available.
    // Each class usually has around 16 meetings including UTS and UAS.
    // If no breaks are given, a class would span 16 weeks.
    // If UAS is not available to determine end boundary, we assume the class ends at: 16 weeks after startBoundary

    // Let's initially assume around 6 months after startBoundary
    let classEndBoundary = new Date(startBoundary);

    // Iterate through every UAS date to find the earliest one
    for (const uas of currentJadwalUASData) {
        if (uas.date < classEndBoundary) {
            classEndBoundary = new Date(uas.date);
        }
    }

    console.log("Start boundary:", startBoundary);
    console.log("End boundary:", classEndBoundary);

    let utsStartBoundary = new Date(classEndBoundary);
    let utsEndBoundary = new Date(startBoundary);

    // Iterate through every UTS date to find the earliest and latest one
    for (const uts of currentJadwalUTSData) {
        if (uts.date < utsStartBoundary) {
            utsStartBoundary = new Date(uts.date);
        }

        if (uts.date > utsEndBoundary) {
            utsEndBoundary = new Date(uts.date);
        }
    }

    // Create an event for every UTS
    for (const uts of currentJadwalUTSData) {
        const start = new Date(uts.date);
        const end = new Date(uts.date);
        end.setMinutes(start.getMinutes() + uts.durationMinutes);

        cal.createEvent({
            start,
            end,
            summary: `UTS ${uts.subject} ${uts.class}`,
            description: `Ruang: ${uts.room}`,
        });
    }

    // Write cal to file
    Bun.write(Bun.file("output/jadwal_uts.ics"), cal.toString());
    cal.clear();

    // Create an event for every UAS
    for (const uas of currentJadwalUASData) {
        const start = new Date(uas.date);
        const end = new Date(uas.date);
        end.setMinutes(start.getMinutes() + uas.durationMinutes);

        cal.createEvent({
            start,
            end,
            summary: `UAS ${uas.subject} ${uas.class}`,
            description: `Ruang: ${uas.room}`,
        });
    }

    // Write cal to file
    Bun.write(Bun.file("output/jadwal_uas.ics"), cal.toString());
    cal.clear();
}
