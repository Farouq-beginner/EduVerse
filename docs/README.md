# Dokumentasi EduVerse

EduVerse adalah aplikasi web pembelajaran SMP (Next.js App Router + Prisma + Supabase Auth)
dengan dua peran utama: **Guru** dan **Siswa**. Setiap peran punya dashboard, ruang kerja, dan
alur masing-masing. Dokumen ini menjelaskan alur pemakaian web dari awal sampai akhir.

## Daftar Dokumen

| Dokumen | Isi |
|---|---|
| [alur-guru.md](alur-guru.md) | Alur lengkap guru: login → dashboard → course builder → kuis → game studio → forum |
| [alur-siswa.md](alur-siswa.md) | Alur lengkap siswa: login → pilih pembelajaran → belajar → kuis/tugas → progres |

## Gambaran Umum Sistem

### Peran dan Route Utama

| Route | Siapa | Fungsi |
|---|---|---|
| `/auth` | Semua | Login / registrasi (pilih peran siswa atau guru) |
| `/teacher` | Guru | Dashboard guru: ringkasan, peserta, analitik |
| `/teacher/course/[slug]` | Guru | Course builder: kelola modul & materi |
| `/teacher/course/[slug]/quiz/[blockId]` | Guru | Editor kuis per blok |
| `/teacher/game-studio` | Guru | Studio game: buat & versi game pembelajaran |
| `/student` | Siswa | Dashboard siswa: daftar kelas yang diikuti |
| `/pilih-pembelajaran` | Siswa | Katalog pembelajaran yang sudah dipublikasikan |
| `/learn/[slug]` | Siswa | Halaman utama satu pembelajaran |
| `/learn/[slug]/modul/[moduleId]` | Siswa | Halaman belajar per modul (materi, kuis, tugas, forum) |
| `/learn/[slug]/games` | Siswa | Area game pembelajaran |

> Catatan: halaman admin sudah dihapus dari alur (login, navigasi, dan middleware tidak lagi
> mengarahkan ke `/auth/admin`). Halaman admin hanya menampilkan pemberitahuan fitur tidak
> tersedia.

### Prinsip Penyimpanan Data

- **Semua data penting tersimpan di database (Prisma/PostgreSQL)**, bukan di browser:
  progres belajar, jawaban, attempt kuis, enrollment, struktur course, dan forum.
- **Berkas (PDF materi & lampiran jawaban siswa)** disimpan di tabel `StoredFile` lewat
  API `/api/files`, dengan hak baca berdasarkan pemilik/course — materi publik terbuka untuk
  peserta, jawaban siswa hanya bisa dibaca pemiliknya dan guru pengampu.
- Data lokal di browser hanya dipakai sebagai cadangan sementara (misalnya progres yang
  dibuat saat belum login) lalu disinkronkan ke database begitu siswa bergabung.
- **Isolasi data**: guru hanya melihat course miliknya sendiri; siswa hanya melihat course
  berstatus `PUBLISHED`.

### Autentikasi

- Login/registrasi di `/auth` dengan email + password (Supabase Auth), profil dan peran
  disimpan di tabel `Profile`.
- Middleware menjaga route per peran dan mengarahkan ke `?next=` yang aman (anti open-redirect).
- Di halaman login tersedia tombol cepat akun demo: guru dan siswa (1-klik masuk).
