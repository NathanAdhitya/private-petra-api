import type { SIMSession } from "../../SIMSession";
import { JSDOM } from "jsdom";
import { dayIndex } from "../jadwal/JadwalKuliah";

export class PRSService {
    constructor(public session: SIMSession) {}

    /**
     * Obtains matkul list from the PRS options API.
     */

    async getMatkulList(period: string, kodeUnit: string) {
        const unitmk = kodeUnit + "-" + kodeUnit;
        const params = new URLSearchParams();

        // Reverse engineered from PRS page
        params.append("f", "optmkprs");
        params.append("q[]", period);
        params.append("q[]", unitmk);
        params.append("q[]", "*");
        params.append("q[]", "1");
        params.append("q[]", "1");

        /**
         * Example Output:
         * <option value="">-- Pilih Mata Kuliah --</option>
         * <option value="2024:TF4204:15:1">01 - TF4204 - ALGORITMA DAN PEMROGRAMAN - 5 sks</option>
         * <option value="2024:TF4504:15:1">01 - TF4504 - BAHASA INGGRIS - 2 sks</option>
         * <option value="2024:TF4205:15:1">01 - TF4205 - DASAR SISTEM KOMPUTER - 2 sks</option>
         * <option value="2024:TF4229:15:1">02 - TF4229 - BASIS DATA - 3 sks</option>
         *
         * Value Labels: Year:KodeMK:Unit:Period
         * Text Labels: semester - KodeMK (ignore) - NamaMK - ... sks
         */

        const r = await this.session
            .fetch("index.php?page=ajax", {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHTTPRequest",
                },
                body: params,
            })
            .then((res) => res.text());

        const dom = new JSDOM(r);

        // For each option, get the value and text
        const options = dom.window.document.querySelectorAll("option");
        const matkulList = Array.from(options).map((option) => {
            const value = option.getAttribute("value");
            const text = option.textContent;

            if (!value || value.length === 0) {
                return null;
            }

            if (!text || text.length === 0) {
                return null;
            }

            const splittedValue = value.split(":");
            const splittedText = text.split(" - ");

            return {
                prsId: value,
                year: splittedValue[0],
                kodeMK: splittedValue[1],
                unit: splittedValue[2],
                period: splittedValue[3],
                namaMK: splittedText[splittedText.length - 2],
                semester: parseInt(splittedText[0], 10),
                sks: parseInt(
                    splittedText[splittedText.length - 1].split(" ")[0],
                    10
                ),
            };
        });

        return matkulList.filter((matkul) => matkul !== null);
    }

    /**
     * Schedule string is in the format:
     * Selasa, 10:30 - 13:30
     * This should be converted to:
     * - dayOfWeek: number
     * - startHour: number
     * - startMinute: number
     * - duration: number
     */
    private parseSchedule(schedule: string) {
        const dayOfWeekStr = schedule.split(",")[0];
        const dayOfWeek = dayIndex[dayOfWeekStr as keyof typeof dayIndex];

        if (dayOfWeek === undefined) {
            console.error("Invalid day of week for", schedule);
        }

        const match = /(\d+):(\d+) - (\d+):(\d+)/.exec(schedule.split(",")[1]);

        if (!match) {
            throw new Error("Failed to parse schedule for " + schedule);
        }

        const startHour = parseInt(match[1], 10);
        const startMinute = parseInt(match[2], 10);
        const endHour = parseInt(match[3], 10);
        const endMinute = parseInt(match[4], 10);

        const duration = (endHour - startHour) * 60 + (endMinute - startMinute);

        return {
            dayOfWeek,
            startHour,
            startMinute,
            duration,
        };
    }

    /**
     * Get kelas for matkul.
     * Returns classes for each matkul with the information:
     * - kelas: class name (A, B, C, etc.)
     * - accepted: number of students accepted
     * - capacity: total capacity
     * - schedule: schedule for the class
     * - swk: ??
     */
    async getClassesForMatkul(period: string, prsId: string) {
        const params = new URLSearchParams();

        // Extract necessary information from prsId
        const splittedValue = prsId.split(":");
        const [year, kodeMK, kodeUnit] = splittedValue;

        // Reverse engineered from PRS page
        params.append("f", "optkelasobe");
        params.append("q[]", period);
        params.append("q[]", kodeUnit);
        params.append("q[]", year);
        params.append("q[]", kodeMK);
        params.append("q[]", `${kodeUnit}-${kodeUnit}`);
        params.append("q[]", "1");

        /**
         * Example Output:
         * <option value="">-- Pilih Kelas --</option>
         * <option value="A">A | TRM: 0/50 | Selasa, 07:30 - 10:30 | SWK:2</option>
         * <option value="B">B | TRM: 0/50 | Selasa, 10:30 - 13:30 | SWK:2</option>
         *
         * Text Labels: Class Index | TRM: accepted/capacity | schedule 1 | schedule ... | SWK: ?
         */

        const r = await this.session
            .fetch("index.php?page=ajax", {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHTTPRequest",
                },
                body: params,
            })
            .then((res) => res.text());

        const dom = new JSDOM(r);

        // For each option, get the value and text
        const options = dom.window.document.querySelectorAll("option");
        const matkulClassList = Array.from(options).map((option) => {
            const value = option.getAttribute("value");
            const text = option.textContent;

            if (!value || value.length === 0) {
                return null;
            }

            if (!text || text.length === 0) {
                return null;
            }

            const splittedText = text.split(" | ");
            const parsedCapacity = /TRM: (\d+)\/(\d+)/.exec(splittedText[1]);
            const schedule = splittedText
                .slice(2)
                .slice(0, -1)
                .map(this.parseSchedule);

            if (!parsedCapacity) {
                console.log("Failed to parse capacity for", text);
                return null;
            }

            return {
                kelas: value,
                schedule,
                accepted: parseInt(parsedCapacity[1], 10),
                capacity: parseInt(parsedCapacity[2], 10),
            };
        });

        return matkulClassList.filter((matkul) => matkul !== null);
    }

    /**
     * Get complete class data (merge keterangan)
     */
    async getCompleteClassesForMatkul(period: string, prsId: string) {
        const classes = await this.getClassesForMatkul(period, prsId);
        const keterangan = await this.getKeteranganKelasForMatkul(
            period,
            prsId
        );

        const keteranganMap = new Map<string, string>();
        keterangan.forEach((entry) => {
            keteranganMap.set(entry.kelas, entry.desc);
        });

        return classes.map((entry) => {
            return {
                ...entry,
                keterangan: keteranganMap.get(entry.kelas),
            };
        });
    }

    /**
     * Get all keterangan kelas for a matkul
     */
    async getKeteranganKelasForMatkul(period: string, prsId: string) {
        const params = new URLSearchParams();

        // Extract necessary information from prsId
        const splittedValue = prsId.split(":");
        const [year, kodeMK, kodeUnit] = splittedValue;

        // Reverse engineered from PRS page
        params.append("f", "ketkelas");
        params.append("q[]", period);
        params.append("q[]", kodeUnit);
        params.append("q[]", year);
        params.append("q[]", kodeMK);
        params.append("q[]", `1`);
        params.append("q[]", "1");

        /**
         * Example Output:
         * <strong>A :</strong> Umum<br><strong>A1 :</strong> Umum<br><strong>A2 :</strong> Umum<br><strong>B :</strong>
Umum<br><strong>B1 :</strong> Umum<br><strong>B2 :</strong> Umum<br><strong>C :</strong> Umum<br><strong>C1 :</strong>
Umum<br><strong>D :</strong> Umum<br><strong>D1 :</strong> Umum<br><strong>D2 :</strong> Umum<br><strong>E :</strong>
Umum<br><strong>E1 :</strong> Umum<br><strong>F :</strong> Umum<br><strong>F1 :</strong> Umum<br><strong>F2 :</strong>
Umum<br><strong>F3 :</strong> Umum<br><strong>G :</strong> Umum<br><strong>G1 :</strong> Umum<br><strong>G2 :</strong>
Umum<br><strong>H :</strong> Umum<br><strong>H1 :</strong> Umum<br><strong>I :</strong> Umum<br><strong>I1 :</strong>
Umum<br><strong>J :</strong> Umum<br><strong>J1 :</strong> Umum<br><strong>J2 :</strong> Umum<br><strong>K :</strong>
Umum<br><strong>K1 :</strong> Umum<br><strong>K2 :</strong> Umum<br><strong>L :</strong> Umum<br><strong>L1 :</strong>
Umum<br><strong>L2 :</strong> Umum<br><strong>M :</strong> Umum<br><strong>M1 :</strong> Umum<br><strong>N :</strong>
Umum<br><strong>N1 :</strong> Umum<br><strong>YA :</strong> PROGRAM INTERNASIONAL TRACK
         *
         * Text Labels: Class Index : Description
         * Need to split by <br>, remove all HTML tags, split, then trim the result
         */

        const r = await this.session
            .fetch("index.php?page=ajax", {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHTTPRequest",
                },
                body: params,
            })
            .then((res) => res.text());

        const entries = r
            .split("<br>")
            .map((entry) => {
                // Remove all HTML tags
                const cleanedEntry = entry.replace(/<[^>]*>?/gm, "");
                if (cleanedEntry.trim().length === 0) return null;

                const [kelas, desc] = cleanedEntry.split(" : ");
                return {
                    kelas: kelas.trim(),
                    desc: desc.trim(),
                };
            })
            .filter((entry) => entry !== null);

        return entries;
    }
}
