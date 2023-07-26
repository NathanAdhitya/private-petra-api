import { SIMSession } from "../../SIMSession.js";
import {
  KHSMataKuliah,
  PeriodeKHS,
  Semester,
} from "../../types/KartuHasilStudi.js";
import { JSDOM } from "jsdom";

export class KHS {
  constructor(public session: SIMSession) {}

  async getAllValidPeriods(): Promise<PeriodeKHS[]> {
    const response = this.session.fetch("index.php?page=view_khs");
    const dom = new JSDOM(await (await response).text());

    // Get all listed periods in the dropdown
    // All semester options are in <select name="semester" id="semester" class="ControlStyle">
    const semesterSelect = dom.window.document.querySelector(
      `select.ControlStyle[name="semester"][id="semester"]`
    );

    // Get all listed years in the dropdown
    const semesterOptions = semesterSelect?.querySelectorAll("option");
    const semesterValues = [...(semesterOptions ?? [])].map((option) => [
      option.getAttribute("value"),
      option.text,
    ]);

    // All year options are in <select name="tahun" id="tahun" class="ControlStyle">
    const yearSelect = dom.window.document.querySelector(
      `select.ControlStyle[name="tahun"][id="tahun"]`
    );

    const yearValues = [...(yearSelect?.querySelectorAll("option") ?? [])].map(
      (option) => [option.getAttribute("value"), option.text]
    );

    // Get inputs: no, nim, psem, key
    const noInput = dom.window.document.querySelector(
      `input[name="no"][type="hidden"]`
    );
    const nimInput = dom.window.document.querySelector(
      `input[name="nim"][type="hidden"]`
    );
    const psemInput = dom.window.document.querySelector(
      `input[name="psem"][type="hidden"]`
    );
    const keyInput = dom.window.document.querySelector(
      `input[name="key"][type="hidden"]`
    );

    // Construct the base FormData contianing the hidden inputs
    const formData = new FormData();
    formData.append("no", noInput?.getAttribute("value") ?? "");
    formData.append("nim", nimInput?.getAttribute("value") ?? "");
    formData.append("key", keyInput?.getAttribute("value") ?? "");

    // Construct formData for each possible year and semester combination
    const combinationFormData: FormData[] = [];

    for (const [semesterValue, semesterText] of semesterValues) {
      for (const [yearValue, yearText] of yearValues) {
        // Clone the existing formData
        const newFormData = new FormData();

        for (const [key, value] of formData.entries()) {
          newFormData.append(key, value);
        }

        // Append the new semester and year
        newFormData.append("semester", semesterValue as string);
        newFormData.append("tahun", yearValue as string);

        // psem is the combination of year and semester
        newFormData.append("psem", `${yearValue}${semesterValue}`);

        combinationFormData.push(newFormData);
      }
    }

    // Fetch all the combinations
    const combinationResponses = await Promise.all(
      combinationFormData.map(
        async (formData) =>
          [
            await this.session.fetch("index.php?page=view_khs", {
              method: "POST",
              body: formData,
            }),
            formData,
          ] as const
      )
    );

    // Parse all the combinations
    const combinations = await Promise.all(
      combinationResponses.map(
        async (result) =>
          [
            await this.parsePeriod(new JSDOM(await result[0].text())),
            result[1],
          ] as const
      )
    );

    // Filter out invalid combinations
    const validCombinations = combinations.filter(
      (combination) => combination[0].length > 0
    );

    // Create the final result
    const result: PeriodeKHS[] = validCombinations.map((combination) => ({
      // parse back to semester values and year values retrieved from the dropdown
      semester: (semesterValues.find(
        (value) => value[0] === combination[1].get("semester")
      ) ?? ["???", "???"])[1] as unknown as Semester,
      tahun: Number.parseInt(combination[1].get("tahun") as string),
      mataKuliah: combination[0],
    }));

    return result;
  }

  async parsePeriod(dom: JSDOM): Promise<KHSMataKuliah[]> {
    /*
      Table format is:
      No | Kode MK | Mata Kuliah | SKS | Nilai | Persen Kehadiran

      Table tag is:
      <table width="800" cellpadding="4" cellspacing="0" class="GridStyle">
    */

    const result: KHSMataKuliah[] = [];

    const table = dom.window.document.querySelector(
      `table.GridStyle[width="800"][cellpadding="4"][cellspacing="0"]`
    );

    if (!table) throw new Error("Table not found");

    const rows = table.querySelectorAll("tr");
    let rowsSkipped = 0;

    for (const row of rows) {
      // First two rows are junk, skip them.
      if (rowsSkipped < 2) {
        rowsSkipped++;
        continue;
      }

      const cells = [...row.querySelectorAll("td").values()];

      // If first td has the text "Data tidak ditemukan", means that there is no data.
      if (cells[0].textContent?.trim() === "Data tidak ditemukan") break;

      const no = Number.parseInt(cells[0].textContent ?? "");
      // KodeMK is inside u tag within the td.
      // <td align="center"><u title="Detail Nilai" onclick="goDetailOBE('detailId');">kodeMK</u></td>
      const kodeMK = cells[1].querySelector("u")?.textContent ?? "";
      const namaMK = cells[2].textContent ?? "";
      const sks = Number.parseInt(cells[3].textContent ?? "");
      const nilai = cells[4].textContent?.trim() ?? "";
      const persenKehadiran = Number.parseFloat(cells[5].textContent ?? "");
      const detailId =
        cells[1]
          .querySelector("u")
          ?.getAttribute("onclick")
          ?.match(/goDetailOBE\('(.*)'\)/)?.[1] ?? "";

      result.push({
        no,
        kodeMK,
        namaMK,
        sks,
        nilai,
        persenKehadiran,
        detailId,
      });
    }

    return result;
  }
}
