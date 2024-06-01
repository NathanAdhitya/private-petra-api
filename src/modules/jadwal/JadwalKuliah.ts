import { SIMSession } from "../../SIMSession.js";
import type {
    EntryJadwalKuliah,
    EntryJadwalKuliahCollection,
} from "../../types/JadwalKuliah.js";
import { JSDOM } from "jsdom";

export class JadwalKuliah {
    constructor(public session: SIMSession) {}

    async getJadwalKuliah(): Promise<EntryJadwalKuliahCollection> {
        // Get the data at ?page=view_jadwalkuliah
        const response = await this.session.fetch(
            "index.php?page=view_jadwalkuliah"
        );

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

        // Table is in <table width="800" cellpadding="4" cellspacing="0" class="GridStyle">
        // Headers are: Hari | Jam | Lama | Ruang | Mata Kuliah | Kelas | Dosen

        // Get the table
        const table = dom.window.document.querySelector(
            "table.GridStyle[width='800'][cellpadding='4'][cellspacing='0']"
        ) as HTMLTableElement;

        // Get the rows
        const rows = [...table.querySelectorAll("tr")];

        // Remove the first row (headers)
        rows.shift();

        // Map the rows to EntryJadwalKuliah
        const entries = rows.map((row) => {
            // Get the columns
            const columns = [...row.querySelectorAll("td")];

            // Map the columns to strings
            const strings = columns.map((column) => column.textContent);

            // Return the EntryJadwalKuliah
            return {
                hari: strings[0]?.trim() ?? "",
                jam: strings[1]?.trim() ?? "",
                lama: parseInt(strings[2]?.trim() ?? "0"),
                ruang: strings[3]?.trim() ?? "",
                mataKuliah: strings[4]?.trim() ?? "",
                kelas: strings[5]?.trim() ?? "",
                dosen: strings[6]?.trim() ?? "",
            } satisfies EntryJadwalKuliah;
        });

        // Return the EntryJadwalKuliahCollection
        return {
            year: parseInt(year),
            periode: period,
            entries,
        };
    }
}
