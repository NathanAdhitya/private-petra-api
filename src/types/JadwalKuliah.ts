export interface EntryJadwalKuliah {
  hari: string;
  jam: string;
  lama: number;
  ruang: string;
  mataKuliah: string;
  kelas: string;
  dosen: string;
}

export interface EntryJadwalKuliahCollection {
  periode: string;
  year: number;
  entries: EntryJadwalKuliah[];
}
