import { SIMSession } from "../../SIMSession.js";
import type {
    JadwalGlobal,
    EntryJadwalKuliahGlobal,
    DayString,
    EntryJadwalUjianGlobal,
} from "../../types/JadwalGlobal.js";
import { JSDOM } from "jsdom";

export class JadwalKuliahGlobal {
    constructor(public session: SIMSession) {}

    async getAllJadwalKuliah() {
        // Fetch default jadwalutsjurusan to get all possible units
        const defaultJadwalUts = await this.fetchJadwalUnit(
            "view_jadwalutsjurusan"
        );
        const defaultJsdom = new JSDOM(await defaultJadwalUts.text());
        const units = await this.extractUnits(defaultJsdom);
        const periode = await this.extractPeriode(defaultJsdom);

        // Map<Unit name, JadwalGlobal>
        const results = new Map<string, JadwalGlobal>();

        // Fetch all jadwal from each unit
        for (const unit of units) {
            const unitName = unit.label.trim();
            console.log(`Fetching jadwal for ${unitName}`);

            const jadwal = [
                this.fetchJadwalUnit("view_jadwaljurusan", unit.value),
                this.fetchJadwalUnit("view_jadwalutsjurusan", unit.value),
                this.fetchJadwalUnit("view_jadwaluasjurusan", unit.value),
            ];

            const responses = await Promise.all(jadwal).then((res) =>
                Promise.all(res.map((r) => r.text()))
            );

            const doms = responses.map((r) => new JSDOM(r));

            // Make sure all are returning from the same unit except regular jadwal
            const extractedUnits = await Promise.all(
                doms.map((dom) => this.extractCurrentUnit(dom))
            );

            if (extractedUnits[1].value !== extractedUnits[2].value) {
                throw new Error(
                    `All jadwal are not from the same unit. Found ${extractedUnits
                        .map((unit) => unit.value)
                        .join(", ")}`
                );
            }

            const jadwalKuliah = await this.extractJadwalKuliahDOM(doms[0]);
            const jadwalUts = await this.extractJadwalUjianDOM(doms[1]);
            const jadwalUas = await this.extractJadwalUjianDOM(doms[2]);

            // Merge based on mataKuliah
            const mergedJadwal = new Map<
                string,
                {
                    kuliah: EntryJadwalKuliahGlobal[];
                    uts: EntryJadwalUjianGlobal[];
                    uas: EntryJadwalUjianGlobal[];
                }
            >();

            jadwalKuliah.forEach((value, key) => {
                mergedJadwal.set(key, {
                    kuliah: value,
                    uts: jadwalUts.get(key) ?? [],
                    uas: jadwalUas.get(key) ?? [],
                });

                const kelas = new Set<string>();
                value.forEach((entry) => kelas.add(entry.kelas));
                jadwalUts.get(key)?.forEach((entry) => kelas.add(entry.kelas));
                jadwalUas.get(key)?.forEach((entry) => kelas.add(entry.kelas));

                console.log(
                    `-- ${key} has ${kelas.size} classes, ${
                        value.length
                    } kuliah, ${jadwalUts.get(key)?.length ?? 0} uts, ${
                        jadwalUas.get(key)?.length ?? 0
                    } uas`
                );
            });

            // if not found, set else merge the jadwal
            if (!results.has(unitName)) {
                results.set(unitName, {
                    periode: periode,
                    unit: unitName,
                    jadwal: mergedJadwal,
                });
            } else {
                const existingJadwal = results.get(unitName);
                if (!existingJadwal) {
                    throw new Error("Existing jadwal not found");
                }

                mergedJadwal.forEach((value, key) => {
                    if (existingJadwal.jadwal.has(key)) {
                        existingJadwal.jadwal
                            .get(key)
                            ?.kuliah.push(...value.kuliah);
                        existingJadwal.jadwal.get(key)?.uts.push(...value.uts);
                        existingJadwal.jadwal.get(key)?.uas.push(...value.uas);
                    } else {
                        existingJadwal.jadwal.set(key, value);
                    }
                });

                results.set(unitName, existingJadwal);
            }
        }

        return results;
    }

    async getJadwalKuliah() {
        const jadwal = [
            this.fetchJadwalUnit("view_jadwaljurusan"),
            this.fetchJadwalUnit("view_jadwalutsjurusan"),
            this.fetchJadwalUnit("view_jadwaluasjurusan"),
        ];

        const responses = await Promise.all(jadwal).then((res) =>
            Promise.all(res.map((r) => r.text()))
        );

        const doms = responses.map((r) => new JSDOM(r));

        // Make sure all are returning from the same unit
        const extractedUnits = await Promise.all(
            doms.map((dom) => this.extractCurrentUnit(dom))
        );

        if (
            extractedUnits.some(
                (unit) => unit.value !== extractedUnits[0].value
            )
        ) {
            throw new Error(
                `All jadwal are not from the same unit. Found ${extractedUnits
                    .map((unit) => unit.value)
                    .join(", ")}`
            );
        }

        const jadwalKuliah = await this.extractJadwalKuliahDOM(doms[0]);
        const jadwalUts = await this.extractJadwalUjianDOM(doms[1]);
        const jadwalUas = await this.extractJadwalUjianDOM(doms[2]);

        console.log({
            unit: extractedUnits[0],
            jadwal: {
                kuliah: jadwalKuliah,
                uts: jadwalUts,
                uas: jadwalUas,
            },
        });
    }

    async fetchJadwalUnit(
        page: string,
        kodeunit: string | undefined = undefined
    ) {
        // If kodeunit is specified, post, if not use GET
        if (kodeunit) {
            // POST
            // Request as application / x-www-form-urlencoded;
            // POST to index.php?page=view_jadwaljurusan
            return this.session.fetch(`index.php?page=${page}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ kodeunit }),
            });
        } else {
            // GET
            return this.session.fetch(`index.php?page=${page}`);
        }
    }

    async extractJadwalKuliahDOM(dom: JSDOM) {
        // all the table is contained within a <table width="800" cellpadding="4" cellspacing="0" class="GridStyle">
        // the headers are Jam | Lama | Ruang | Mata Kuliah | Kelas

        const table = dom.window.document.querySelector(
            "table.GridStyle"
        ) as HTMLTableElement;

        // Each day in the table has the format:
        // <tr><td>Day</td></tr>
        // <tr><td>Jam</td><td>Lama</td><td>Ruang</td><td>Mata Kuliah</td><td>Kelas</td></tr>
        // data is here
        // whitespace: <tr><td>&nbsp;</td></tr>

        // Result should be a map between mataKuliah and its jadwal
        const result: Map<string, EntryJadwalKuliahGlobal[]> = new Map();
        let currentDay: DayString = "DUMMY";

        // Iterate over all rows
        for (const row of table.rows) {
            // If the row is a mata kuliah
            if (row.cells.length === 1) {
                currentDay = (row.cells[0].textContent ?? "DUMMY") as DayString;
            } else if (row.cells.length === 5) {
                // Make sure the row is an actual data row
                if (row.cells[0].textContent === "Jam") {
                    continue;
                }

                // If the row is a data row
                const jam = row.cells[0].textContent ?? "";
                const lama = row.cells[1].textContent ?? "";
                const ruang = row.cells[2].textContent ?? "";
                const { mataKuliah, catatan } = this.parseMataKuliah(
                    row.cells[3]
                );
                const kelas = row.cells[4].textContent ?? "";

                const [jamMulai, menitMulai] = this.parseJam(jam);
                const lengthMinutes = Number.parseInt(lama);

                const entry: EntryJadwalKuliahGlobal = {
                    hari: currentDay,
                    jamMulai,
                    menitMulai,
                    lengthMinutes,
                    ruang,
                    kelas,
                    catatan,
                };

                if (result.has(mataKuliah)) {
                    result.get(mataKuliah)?.push(entry);
                } else {
                    result.set(mataKuliah, [entry]);
                }
            } else if (row.cells.length === 0) {
                // If the row is a whitespace
                // Do nothing
            }
        }

        return result;
    }

    async extractJadwalUjianDOM(dom: JSDOM) {
        // all the table is contained within a <table width="800" cellpadding="4" cellspacing="0" class="GridStyle">
        // the headers are Tanggal | Lama | Ruang | Kelas

        const table = dom.window.document.querySelector(
            "table.GridStyle"
        ) as HTMLTableElement;

        // Each day in the table has the format:
        // <tr><td>Day</td></tr>
        // <tr><td>Jam</td><td>Lama</td><td>Ruang</td><td>Mata Kuliah</td><td>Kelas</td></tr>
        // data is here
        // whitespace: <tr><td>&nbsp;</td></tr>

        // Result should be a map between mataKuliah and its jadwal
        const result: Map<string, EntryJadwalUjianGlobal[]> = new Map();
        let currentDate: Date = new Date();

        // Iterate over all rows
        for (const row of table.rows) {
            // If the row is a mata kuliah
            if (row.cells.length === 1) {
                currentDate = new Date(row.cells[0].textContent ?? "DUMMY");
            } else if (row.cells.length === 5) {
                // Make sure the row is an actual data row
                if (row.cells[0].textContent === "Jam") {
                    continue;
                }

                // If the row is a data row
                const jam = row.cells[0].textContent ?? "";
                const lama = row.cells[1].textContent ?? "";
                const ruang = row.cells[2].textContent ?? "";
                const { mataKuliah, catatan } = this.parseMataKuliah(
                    row.cells[3]
                );
                const kelas = row.cells[4].textContent ?? "";

                const jamMulai = this.parseJam(jam);
                const lengthMinutes = Number.parseInt(lama);

                const effectiveDate = new Date(currentDate);
                effectiveDate.setHours(jamMulai[0], jamMulai[1]);

                const entry: EntryJadwalUjianGlobal = {
                    date: effectiveDate,
                    lengthMinutes,
                    ruang,
                    kelas,
                    catatan,
                };

                if (result.has(mataKuliah)) {
                    result.get(mataKuliah)?.push(entry);
                } else {
                    result.set(mataKuliah, [entry]);
                }
            }
        }

        return result;
    }

    async extractCurrentUnit(
        dom: JSDOM
    ): Promise<{ value: string; label: string }> {
        const select = dom.window.document.querySelector(
            "select[name='kodeunit']"
        ) as HTMLSelectElement;

        const selected = select.querySelector(
            "option[selected]"
        ) as HTMLOptionElement;

        if (!selected) {
            return {
                value: "undefined",
                label: "undefined",
            };
        }

        return {
            value: selected.value,
            label: selected.textContent ?? "undefined",
        };
    }

    async extractUnits(
        dom: JSDOM
    ): Promise<{ value: string; label: string }[]> {
        const select = dom.window.document.querySelector(
            "select[name='kodeunit']"
        ) as HTMLSelectElement;

        return [...select.options].map((option) => ({
            value: option.value,
            label: option.textContent ?? "undefined",
        }));
    }

    parseJam(jam: string): [number, number] {
        const [jamStr, menitStr] = jam.split(":");
        const jamInt = Number.parseInt(jamStr);
        const menitInt = Number.parseInt(menitStr);

        return [jamInt, menitInt];
    }

    async extractPeriode(dom: JSDOM) {
        // For periode, fine a string with the pattern <font size="2"><strong>Periode : </strong>periode_value</font>
        const font = dom.window.document.querySelector(
            "font[size='2'] > strong"
        ) as HTMLFontElement;

        if (font.textContent !== "Periode : ") {
            throw new Error("Periode not found");
        }

        const periode = font.nextSibling?.textContent;
        if (!periode) {
            throw new Error("Periode not found");
        }

        return periode;
    }

    parseMataKuliah(mataKuliah: HTMLTableCellElement) {
        // If contains no <br>, then it's an ordinary mata kuliah with no catatan
        // If contains <br>, then it's mata kuliah with catatan. Make sure to only get only text before <br> as mata kuliah and after <br> as catatan

        const br = mataKuliah.querySelector("br");
        if (!br) {
            return {
                mataKuliah: mataKuliah.textContent ?? "",
                catatan: undefined,
            };
        }

        const mataKuliahText = mataKuliah.childNodes[0].textContent ?? "";
        // any text after <br> is catatan
        const catatanText = mataKuliah.childNodes[2].textContent ?? "";

        return {
            mataKuliah: mataKuliahText,
            catatan: catatanText,
        };
    }
}
