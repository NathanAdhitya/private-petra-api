export type JenisKelaminMahasiswa = "L" | "P";

export interface BiodataPerkuliahanMahasiswa {
    periodeMasuk?: string;
    jurusanProdi?: string;
    programTrack?: string;
    bidangMinat?: string;
    statusMahasiswa: string;
    dosenWali?: string;
    periodeLulus?: string;
    nimKopertis?: string;

    informasiPMB?: InformasiPMBMahasiswa;
    informasiLulusKeluar?: InformasiLulusKeluar;
    informasiLain?: InformasiLainMahasiswa;
    catatan?: string;
}

export interface InformasiPMBMahasiswa {
    jalurPenerimaan: string;
    noUjian: number;
}

export interface InformasiLulusKeluar {
    statusKeluar?: string;
    periodeWisuda?: string;
    noIjazah?: string;
    tglLulusKeluar?: Date;
    tglYudisium?: Date;
    noTranskrip?: string;
    judulTa?: string;
}

export interface InformasiLainMahasiswa {
    semesterCuti?: number;
    semesterCurang?: number;
}

export interface BiodataUtamaMahasiswa {
    nrp: string;
    nama: string;
    image: string;
    nik: string;
    jenisKelamin: JenisKelaminMahasiswa;
    tanggalLahir: Date;
    tempatLahir: string;
    agama: string;
    warganegara: string;
    email: string;
    hp1?: string;
    hp2?: string;

    informasiSuratMenyurat: InformasiSuratMenyurat;
    informasiDomisili: InformasiDomisili;
    informasiPersonal: InformasiPersonal;

    golonganDarah?: string;
    negara?: string;
    virtualAccount?: string;
    rfid?: string;
}

export interface InformasiSuratMenyurat {
    alamat?: string;
    provinsi?: string;
    kota?: string;
    kecamatan?: string;
    kelurahan?: string;
    kodepos?: string;
    rw?: string;
    rt?: string;
}

export interface InformasiDomisili {
    alamat?: string;
    provinsi?: string;
    kota?: string;
    kodepos?: string;
    telepon?: string;
}

export interface InformasiPersonal {
    noWa?: string;
    emailPersonal?: string;
    telepon1?: string;
    telepon2?: string;
    homepage?: string;
}
