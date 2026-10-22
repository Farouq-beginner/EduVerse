# Dokumentasi EduVerse

EduVerse adalah aplikasi web pembelajaran SMP (Next.js App Router + Prisma + Supabase Auth)
dengan dua peran utama: **Guru** dan **Siswa**. Setiap peran punya dashboard, ruang kerja, dan
alur masing-masing. Dokumen ini menjelaskan alur pemakaian web dari awal sampai akhir.

## Daftar Dokumen

| Dokumen | Isi |
|---|---|
| [alur-guru.md](alur-guru.md) | Alur lengkap guru: login → dashboard → course builder → draft & publish → kuis → game studio → forum |
| [alur-siswa.md](alur-siswa.md) | Alur lengkap siswa: login → pilih pembelajaran → belajar → lembar kerja/kuis → progres |

## Gambaran Umum Sistem

### Peran dan Route Utama

| Route | Siapa | Fungsi |
|---|---|---|
| `/auth` | Semua | Login / registrasi (pilih peran siswa atau guru) |
| `/teacher` | Guru | Dashboard guru: ringkasan, peserta, analitik |
| `/teacher/course/[slug]` | Guru | Course builder: draft pertemuan, materi, modul ajar, publish |
| `/teacher/course/[slug]/quiz/[blockId]` | Guru | Editor kuis per blok |
| `/teacher/game-studio` | Guru | Studio game: buat & versi game pembelajaran |
| `/student` | Siswa | Dashboard siswa: daftar kelas yang diikuti |
| `/pilih-pembelajaran` | Siswa | Katalog pembelajaran yang sudah dipublikasikan |
| `/learn/[slug]` | Siswa | Halaman utama satu pembelajaran (daftar pertemuan) |
| `/learn/[slug]/modul/[moduleId]` | Siswa | Halaman belajar per pertemuan (materi, lembar kerja, kuis, forum) |
| `/learn/[slug]/games` | Siswa | Area game pembelajaran |

> Istilah **Pertemuan** dipakai untuk unit pembelajaran harian (sebelumnya disebut "Modul"
> di antarmuka). **Modul** sekarang berarti dokumen modul ajar (PDF/PPT/DOCX) yang diunggah
> guru di Info Pembelajaran dan hanya terlihat oleh guru.

> Catatan: halaman admin sudah dihapus dari alur (login, navigasi, dan middleware tidak lagi
> mengarahkan ke `/auth/admin`). Halaman admin hanya menampilkan pemberitahuan fitur tidak
> tersedia.

### Prinsip Penyimpanan Data

- **Semua data penting tersimpan di database (Prisma/PostgreSQL)**, bukan di browser:
  progres belajar, jawaban, attempt kuis, enrollment, struktur course, dan forum.
- **Berkas materi** (PDF, PPT/PPTX, DOC/DOCX, gambar) dan **lampiran jawaban siswa** disimpan
  di tabel `StoredFile` lewat API `/api/files`, dengan hak baca berdasarkan pemilik/course —
  materi publik terbuka untuk peserta, modul ajar dan jawaban siswa hanya untuk guru pemilik.
- Data lokal di browser hanya dipakai sebagai cadangan sementara (misalnya progres yang
  dibuat saat belum login) lalu disinkronkan ke database begitu siswa bergabung.
- **Isolasi data**: guru hanya melihat course miliknya sendiri; siswa hanya melihat course
  berstatus `PUBLISHED`.

### Draft dan Publish

- Semua suntingan guru (identitas pembelajaran, pertemuan, materi, lembar kerja) **disimpan
  otomatis ke draft** di database.
- Siswa hanya membaca **snapshot terbit** (`CoursePublish`) yang dibuat saat guru menekan
  **Publish**. Jadi draft tidak pernah tampil di halaman siswa, termasuk kuis.
- Karena tersimpan otomatis, menutup tab, refresh, atau berpindah halaman tidak menghilangkan
  perubahan — cukup lanjutkan lalu tekan Publish.

### Autentikasi

- Login/registrasi di `/auth` dengan email + password (Supabase Auth), profil dan peran
  disimpan di tabel `Profile`.
- Middleware menjaga route per peran dan mengarahkan ke `?next=` yang aman (anti open-redirect).
- Di halaman login tersedia tombol cepat akun demo: guru dan siswa (1-klik masuk).
