# Akun Dummy untuk Uji Kelompok

Dokumen ini berisi **tujuh akun siswa aktif** yang masing-masing memiliki pembelajarannya
sendiri, sehingga progres, jawaban, chat, dan tugas satu siswa tidak tercampur dengan siswa
lain.

## Ringkasan Akun

Semua akun memakai password yang sama dan sudah aktif (email terkonfirmasi, tidak terkunci).

| No | Nama | Email | Password | Kelas | Pembelajaran (slug) |
|---|---|---|---|---|---|
| 1 | Dewi Anggraini | `siswa1@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa1` |
| 2 | Bagas Pratama | `siswa2@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa2` |
| 3 | Citra Lestari | `siswa3@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa3` |
| 4 | Fajar Nugroho | `siswa4@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa4` |
| 5 | Gita Maharani | `siswa5@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa5` |
| 6 | Hendra Saputra | `siswa6@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa6` |
| 7 | Intan Permata | `siswa7@eduverse.id` | `SiswaDummy2026!` | VII-B | `/learn/operasi-bilangan-bulat-siswa7` |

## Pemisahan Data per Siswa

Setiap akun memiliki **course sendiri** (judulnya memakai nama siswa, mis. “Operasi Hitung
Bilangan Bulat — Dewi Anggraini”) yang disalin dari pembelajaran contoh
`operasi-bilangan-bulat`:

- 4 pertemuan dan 10 blok materi ikut tersalin, lalu dipublikasikan (snapshot terbit sendiri).
- 2 kelompok awal (**Kelompok 1** dan **Kelompok 2**) tersedia di halaman kelompok siswa.
- Hanya siswa pemilik akun itu yang terdaftar sebagai peserta; siswa dummy **tidak** lagi
  tergabung di course bersama `operasi-bilangan-bulat`.
- Akibatnya progres belajar, attempt kuis, jawaban lembar kerja, nilai game, forum, anggota
  kelompok, chat, dan tugas tersimpan pada course masing-masing — benar-benar terpisah.

Guru pemilik tetap bisa membuka semua course itu dari dashboard guru, karena semuanya berada
di bawah akun guru yang sama.

## Cara Membuat / Menyegarkan Akun

Prasyarat: `.env` berisi `DATABASE_URL`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY`
(service role, bukan anon key).

```bash
npx tsx scripts/seed-dummy-students.ts
```

Skrip ini:

1. Membuat akun Supabase Auth dengan email terkonfirmasi (atau memakai akun yang sudah ada).
2. Menyamakan password menjadi `SiswaDummy2026!` supaya daftar di atas selalu berlaku.
3. Membuat/memperbarui `Profile` dengan role `STUDENT`, kelas `VII-B`, status aktif.
4. Membuat course pribadi per siswa, menyalin modul/blok/kuis bila masih kosong, lalu
   mempublikasikannya.
5. Menyiapkan dua kelompok awal dan memastikan hanya siswa tersebut yang terdaftar.

Skrip idempoten: akun dan course dipakai ulang, jadi aman dijalankan berkali-kali. Isi course
tidak ditimpa ulang bila sudah ada — untuk memuat ulang konten terbaru, hapus dulu course
siswa yang bersangkutan lalu jalankan skrip lagi.

## Cara Menguji

1. Login sebagai guru (`guru@eduverse.id` / `GuruEduVerse123!`), buka salah satu course siswa
   dari dashboard untuk melihat isinya.
2. Login sebagai `siswa1@eduverse.id`, buka `/student` — hanya pembelajaran miliknya yang
   tampil. Buka kartu **Game nilai tambah** untuk melihat **Kelompok 1** dan **Kelompok 2**.
3. Tekan **Gabung kelompok**: penanda kapasitas berubah (`0/5` → `1/5`) tanpa kode. Karena
   tiap siswa punya course sendiri, anggota tiap kelompok hanya siswa tersebut.
4. Kerjakan materi/kuis sebagai `siswa1`, lalu login `siswa2` — progres dan jawaban siswa 1
   tidak terlihat dan tidak berubah di akun siswa 2.
5. Setelah selesai menguji, hapus data uji lewat aplikasi atau reset course siswa terkait.

## Catatan

- Karena satu course hanya berisi satu siswa dummy, batas penuh `5/5` tidak bisa dicapai
  dengan tujuh akun ini. Untuk menguji kapasitas penuh, daftarkan beberapa akun ke satu course
  yang sama lewat dashboard siswa/guru, atau buat 5 anggota lain pada satu kelompok.
- Kapasitas kelompok tetap dicek di server: tombol berubah menjadi **Penuh** saat jumlah
  anggota mencapai batas dan siswa harus memilih kelompok lain.
- Satu siswa hanya boleh berada di satu kelompok per pembelajaran; bergabung ke kelompok lain
  otomatis memindahkannya.
