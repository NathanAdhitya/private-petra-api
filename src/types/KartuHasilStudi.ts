export type Semester = "Genap" | "Gasal" | "Pendek Genap" | "Pendek Gasal";
export type PeriodeSemester = number;

export type KodeMK = string;
export type NamaMK = string;
export type SKS = number;
export type Nilai = number;
export type NilaiHuruf = string;
export type Bobot = number;
export type PersenKehadiran = number;
export type JenisNilai = string;

export interface PeriodeKHS {
  semester: Semester;
  tahun: number;
  parameters?: KHSParameters;

  mataKuliah: KHSMataKuliah[];
}

export interface KHSParameters {
  semester: string;
  tahun: string | number;
  no: string;
  nim: string;
  psem: `${string}${string}`;
  key: string;
}

export interface KHSMataKuliah {
  no: number;
  kodeMK: KodeMK;
  namaMK: NamaMK;
  sks: SKS;
  nilai: NilaiHuruf;
  persenKehadiran: PersenKehadiran;

  detailId: string;
}

export interface HasilAsesmenMataKuliah {
  no: number;
  jenisNilai: JenisNilai;
  bobot: Bobot;
  nilai: Nilai;
}

export interface CapaianPembelajaranMataKuliah {
  no: number;
  cpmk: string;
  rumusan: string;
  cpl: string;
  bobot: Bobot;
  nilai: Nilai;
}

export interface CapaianPembelajaranLulus {
  kode: string;
  indikator: string;
  bobot: Bobot;
  nilai: Nilai;
}
