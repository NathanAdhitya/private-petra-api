import { SIMSession } from "../../SIMSession.js";
import {
  CapaianPembelajaranLulus,
  CapaianPembelajaranMataKuliah,
  HasilAsesmenMataKuliah,
  KHSMataKuliah,
  KHSParameters,
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
      option.getAttribute("value") as string,
      option.text,
    ]);

    // All year options are in <select name="tahun" id="tahun" class="ControlStyle">
    const yearSelect = dom.window.document.querySelector(
      `select.ControlStyle[name="tahun"][id="tahun"]`
    );

    const yearValues = [...(yearSelect?.querySelectorAll("option") ?? [])].map(
      (option) => [option.getAttribute("value") as string, option.text]
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
    const baseParameters: Omit<KHSParameters, "psem" | "semester" | "tahun"> = {
      no: noInput?.getAttribute("value") ?? "",
      nim: nimInput?.getAttribute("value") ?? "",
      key: keyInput?.getAttribute("value") ?? "",
    };

    // Append baseParameters to formData
    for (const [key, value] of Object.entries(baseParameters)) {
      formData.append(key, value);
    }

    // Construct formData for each possible year and semester combination
    const combinationFormData: FormData[] = [];

    for (const [semesterValue, semesterText] of semesterValues) {
      for (const [yearValue, yearText] of yearValues) {
        // Clone the existing formData params
        const newFormData = new FormData();
        const newParameters: KHSParameters = {
          ...baseParameters,
          semester: semesterValue,
          tahun: yearValue,
          psem: `${yearValue}${semesterValue}`,
        };

        // Append newParameters to newFormData
        for (const [key, value] of Object.entries(newParameters)) {
          newFormData.append(key, value);
        }

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
      combinationResponses.map(async (result) => {
        const textResult = await result[0].text();
        return [
          await this.parsePeriod(new JSDOM(textResult)).catch(async (e) => {
            console.error(e);

            // Convert formData to object
            const formDataObject: Record<string, string> = {};
            for (const [key, value] of result[1]) {
              formDataObject[key] = value as string;
            }

            // Error data string should contain the error message, context, and parameters
            const errorData = `${e.message}\n${e.stack}\n${JSON.stringify(
              formDataObject
            )}`;

            // ErrorID should be date and time + random 3 digits
            const errorID = `${new Date()
              .toISOString()
              .replaceAll(":", "-")}-${Math.floor(Math.random() * 1000)
              .toString()
              .padStart(3, "0")}`;

            // Write a file in directory error_dump
            const fs = await import("fs");
            fs.writeFile(
              `error_dump/${errorID}.html`,
              errorData + "\n" + textResult,
              (err) => {
                if (err) {
                  console.error(err);
                }
              }
            );

            return [];
          }),
          result[1],
        ] as const;
      })
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
      parameters: {
        semester: combination[1].get("semester") as string,
        tahun: combination[1].get("tahun") as string,
        no: combination[1].get("no") as string,
        nim: combination[1].get("nim") as string,
        psem: combination[1].get("psem") as string,
        key: "",
      },
    }));

    return result;
  }

  async getMKDetail(params: KHSParameters) {
    const endpoint = "index.php?page=view_khsdetailobe";
    const formData = new FormData();

    formData.append("semester", params.semester);
    formData.append("tahun", params.tahun.toString());
    formData.append("no", params.no.toString());
    formData.append("nim", params.nim);
    formData.append("psem", params.psem);
    formData.append("key", params.key);

    const response = await this.session.fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    const dom = new JSDOM(await response.text());
    const hasilAsesmen = await this.parseHasilAsesmen(dom);
    const cpmk = await this.parseCPMK(dom);
    const cpl = await this.parseCPL(dom);

    return {
      hasilAsesmen,
      cpmk,
      cpl,
    };
  }

  async parseHasilAsesmen(
    dom: JSDOM
  ): Promise<HasilAsesmenMataKuliah[] | null> {
    /*
      Table format is:
      No | Jenis Nilai | Bobot | Nilai

      Table tag is:
      <table width="700" cellpadding="4" cellspacing="0" class="GridStyle">
    */

    const result: HasilAsesmenMataKuliah[] = [];

    const table = dom.window.document.querySelectorAll(
      `table.GridStyle[width="700"][cellpadding="4"][cellspacing="0"]`
    );

    // Find the table which first td in first tr starts with "ASESMEN"
    const hasilAsesmenTable = [...table.values()].find((table) =>
      table
        .querySelector("tr")
        ?.querySelector("td")
        ?.textContent?.trim()
        .startsWith("ASESMEN")
    );

    if (!hasilAsesmenTable) return null;

    const rows = hasilAsesmenTable.querySelectorAll("tr");
    let rowsSkipped = 0;

    for (const row of rows) {
      // First two rows are junk, skip them.
      if (rowsSkipped < 2) {
        rowsSkipped++;
        continue;
      }

      const cells = [...row.querySelectorAll("td").values()];
      // If the last cell is empty, means that there is no data.
      if (!cells[3].textContent?.trim()) break;

      const no = Number.parseInt(cells[0].textContent ?? "");
      const jenisNilai = cells[1].textContent?.trim() ?? "";
      const bobot = Number.parseFloat(
        cells[2].textContent?.trim().replaceAll("%", "") ?? ""
      );
      const nilai = Number.parseFloat(cells[3].textContent?.trim() ?? "");

      result.push({
        no,
        jenisNilai,
        bobot,
        nilai,
      });
    }

    return result.length > 0 ? result : null;
  }

  async parseCPMK(dom: JSDOM): Promise<CapaianPembelajaranMataKuliah[] | null> {
    /*
      Table format is:
      No | CPMK<br>Rumusan | CPL | Bobot | Nilai

      Table tag is:
      <table width="700" cellpadding="4" cellspacing="0" class="GridStyle">
    */

    const result: CapaianPembelajaranMataKuliah[] = [];

    const table = dom.window.document.querySelectorAll(
      `table.GridStyle[width="700"][cellpadding="4"][cellspacing="0"]`
    );

    // Find the table which first td in first tr starts with "Capaian Pembelajaran Mata Kuliah"
    const cpmkTable = [...table.values()].find((table) =>
      table
        .querySelector("tr")
        ?.querySelector("td")
        ?.textContent?.trim()
        .startsWith("Capaian Pembelajaran Mata Kuliah")
    );

    if (!cpmkTable) return null;

    const rows = cpmkTable.querySelectorAll("tr");
    let rowsSkipped = 0;

    for (const row of rows) {
      // First two rows are junk, skip them.
      if (rowsSkipped < 2) {
        rowsSkipped++;
        continue;
      }

      const cells = [...row.querySelectorAll("td").values()];
      const no = Number.parseInt(cells[0].textContent ?? "");
      // CPMK, get before <br>
      const cpmk =
        cells[1].querySelector("br")?.previousSibling?.textContent?.trim() ??
        "";
      // Rumusan, get after <br>
      const rumusan =
        cells[1].querySelector("br")?.nextSibling?.textContent?.trim() ?? "";
      const cpl = cells[2].textContent?.trim() ?? "";
      const bobot = Number.parseFloat(
        cells[3].textContent?.trim().replaceAll("%", "") ?? ""
      );
      const nilai = Number.parseFloat(cells[4].textContent?.trim() ?? "");

      result.push({
        no,
        cpmk,
        rumusan,
        cpl,
        bobot,
        nilai,
      });
    }

    return result.length > 0 ? result : null;
  }

  async parseCPL(dom: JSDOM): Promise<CapaianPembelajaranLulus[] | null> {
    /*
      Table format is:
      Kode | Indikator | Bobot | Nilai

      Table tag is:
      <table width="550" cellpadding="4" cellspacing="0" class="GridStyle">
    */

    const result: CapaianPembelajaranLulus[] = [];

    const table = dom.window.document.querySelectorAll(
      `table.GridStyle[width="550"][cellpadding="4"][cellspacing="0"]`
    );

    // Find the table which first td in first tr is "Capaian Pembelajaran Lulus"
    const cplTable = [...table.values()].find(
      (table) =>
        table.querySelector("tr")?.querySelector("td")?.textContent?.trim() ===
        "Capaian Pembelajaran Lulus"
    );

    if (!cplTable) return null;

    const rows = cplTable.querySelectorAll("tr");
    let rowsSkipped = 0;

    for (const row of rows) {
      // First two rows are junk, skip them.
      if (rowsSkipped < 2) {
        rowsSkipped++;
        continue;
      }

      const cells = [...row.querySelectorAll("td").values()];
      const kode = cells[0].textContent?.trim() ?? "";
      const indikator = cells[1].textContent?.trim() ?? "";
      const bobot = Number.parseFloat(
        cells[2].textContent?.trim().replaceAll("%", "") ?? ""
      );
      const nilai = Number.parseFloat(cells[3].textContent?.trim() ?? "");

      result.push({
        kode,
        indikator,
        bobot,
        nilai,
      });
    }

    return result.length > 0 ? result : null;
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
