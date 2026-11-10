# Akun Dummy untuk Uji Kelompok

Dokumen ini berisi cara membuat dan memakai **tujuh akun siswa aktif** untuk menguji fitur
kelompok (room tugas) di halaman `/learn/[slug]/game`.

## Ringkasan Akun

Semua akun memakai password yang sama dan sudah aktif (email terkonfirmasi, tidak terkunci).

| No | Nama | Email | Password | Kelas |
|---|---|---|---|---|
| 1 | Dewi Anggraini | `siswa1@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 2 | Bagas Pratama | `siswa2@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 3 | Citra Lestari | `siswa3@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 4 | Fajar Nugroho | `siswa4@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 5 | Gita Maharani | `siswa5@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 6 | Hendra Saputra | `siswa6@eduverse.id` | `SiswaDummy2026!` | VII-B |
| 7 | Intan Permata | `siswa7@eduverse.id` | `SiswaDummy2026!` | VII-B |

## Cara Membuat / Menyegarkan Akun

Prasyarat: `.env` sudah berisi `DATABASE_URL`, `SUPABASE_URL`, dan
`SUPABASE_SERVICE_ROLE_KEY` (service role, bukan anon key).

```bash
npx tsx scripts/seed-dummy-students.ts
```

Skrip ini:

1. Membuat akun Supabase Auth dengan email terkonfirmasi (atau memakai akun yang sudah ada).
2. Menyamakan password menjadi `SiswaDummy2026!` supaya daftar di atas selalu berlaku.
3. Membuat/memperbarui `Profile` dengan role `STUDENT`, kelas `VII-B`, status aktif.
4. Mendaftarkan ketujuh siswa ke pembelajaran contoh `operasi-bilangan-bulat` (bila ada).

Skrip idempoten — aman dijalankan berulang tanpa membuat akun ganda.

## Cara Menguji Kelompok

1. Login sebagai guru (`guru@eduverse.id` / `GuruEduVerse123!`), buka
   **Kelola pembelajaran → Operasi Hitung Bilangan Bulat → Game kelompok**
   (atau dari Course Builder, kartu paling bawah).
2. Buat kelompok, misalnya **Kelompok 1** dengan **5 siswa** dan **Kelompok 2** dengan **5 siswa**.
3. Keluar, lalu login sebagai `siswa1@eduverse.id`. Buka pembelajaran → kartu **Game nilai tambah**.
4. Daftar kelompok tampil sebagai kartu berisi nama kelompok dan penanda kapasitas
   (`0/5`, `1/5`, `2/5`, …). Tidak ada kolom kode.
5. Tekan **Gabung kelompok** — siswa langsung masuk dan penanda berubah (`1/5` → `2/5`).
6. Ulangi dengan akun siswa lain. Saat penanda mencapai `5/5`, tombol berubah menjadi
   **Penuh** dan tidak bisa ditekan; siswa harus memilih kelompok lain.
7. Di dalam room, tugas kelompok baru muncul — daftar di luar hanya menampilkan nama kelompok,
   kapasitas, dan deadline.
8. Satu siswa hanya boleh berada di satu kelompok per pembelajaran; bergabung ke kelompok lain
   otomatis memindahkannya.

## Catatan

- Kapasitas dicek di server, jadi dua siswa yang menekan Gabung bersamaan tetap tidak bisa
  melewati batas 5 siswa.
- Guru dapat mengubah slot (2–5 siswa), deadline, dan instruksi kapan saja. Slot tidak boleh
  lebih kecil dari jumlah anggota yang sudah bergabung.
- Menghapus kelompok ikut menghapus anggota, chat, dan tugasnya.
