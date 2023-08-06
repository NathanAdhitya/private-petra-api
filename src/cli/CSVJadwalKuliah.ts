/**
 * @description Generates csv of jadwal kuliah
 */

import { SIMSession } from "../SIMSession.js";
import { JadwalKuliah } from "../modules/jadwal/JadwalKuliah.js";
import * as fs from "fs/promises";
import {
  EntryJadwalKuliah,
  EntryJadwalKuliahCollection,
} from "../types/JadwalKuliah.js";

export async function generateCSVJadwalKuliah(session: SIMSession) {
  const jadwalKuliah = new JadwalKuliah(session);
  const currentJadwalData = await jadwalKuliah.getJadwalKuliah();

  const currentJadwalCSV = currentJadwalData.entries.map((entry) => {
    // Ensure to escape ,
    const escapeComma = (str: string) => str.replace(/,/g, "\\,");
    return `${entry.hari},${entry.jam},${entry.lama},${
      entry.ruang
    },${escapeComma(entry.mataKuliah)},${escapeComma(
      entry.kelas
    )},${escapeComma(entry.dosen)}`;
  });

  await fs.writeFile(
    "./output/jadwal_kuliah.csv",
    "Hari,Jam,Lama,Ruang,Mata Kuliah,Kelas,Dosen\n" +
      currentJadwalCSV.join("\n")
  );
}
