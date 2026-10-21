# Alur Guru

Dokumen ini menjelaskan perjalanan guru dari login sampai materi terpublikasi ke siswa.

## 1. Login

Buka `/auth`, pilih mode **Masuk** (atau **Daftar** sebagai guru), isi email dan password.
Untuk coba cepat, gunakan tombol demo **Guru: Salma Sensei** (1-klik masuk). Setelah berhasil,
guru langsung diarahkan ke `/teacher`.

## 2. Dashboard Guru (`/teacher`)

Halaman utama guru berisi tiga tab:

### Tab Overview
- **Ringkasan statistik**: jumlah pembelajaran, siswa unik, jumlah enrollment, aktivitas yang
  selesai, rata-rata nilai, dan rata-rata progres — semuanya dihitung dari database.
- **Daftar pembelajaran** milik guru lengkap dengan status (Published/Draft) dan jumlah modul.
- Tombol **Buat pembelajaran**: isi judul, mata pelajaran, kelas, dan deskripsi → langsung
  disimpan ke database dan dibuka di course builder.

### Tab Peserta
- Daftar peserta dari database pembelajaran milik guru sendiri (tanpa data contoh).
- Pencarian berdasarkan nama atau kelas.

### Tab Analitik
- Progres dan respons per modul, dihitung dari aktivitas siswa yang sebenarnya.
- Baris analitik per modul: jumlah materi dan tingkat penyelesaian.

> Semua data di dashboard ini terisolasi — guru lain tidak akan melihat course atau
> peserta milik akun ini.

## 3. Course Builder (`/teacher/course/[slug]`)

Tempat guru mengisi seluruh isi pembelajaran. Bagian utamanya:

### Info Pembelajaran
- Ubah judul, deskripsi, mata pelajaran, dan target kelas → tombol **Simpan info**.
- Status **Published/Draft** terlihat sebagai pill; tombol **Publish** / **Simpan perubahan**
  di pojok kanan atas mengubah status course (siswa hanya melihat yang Published).

### Modul
- **Tambah modul**: judul, label (mis. "Modul 05"), estimasi durasi, warna aksen.
- **Edit modul** dan **Hapus modul** (hapus modul ikut menghapus semua materi di dalamnya).
- Setiap modul punya tombol **Buka forum diskusi** — guru bisa melihat dan menghapus semua
  pertanyaan/tanggapan di forum modul tersebut.

### Materi per Blok
Tombol **Tambah materi** membuka pilihan tipe blok:

| Tipe | Penjelasan |
|---|---|
| **Teks** | Materi tulis biasa (isi teks/instruksi) |
| **Video / YouTube** | Tempel link YouTube, opsional link Google Drive pendukung |
| **Link** | Sumber belajar eksternal: judul, deskripsi singkat, dan URL |
| **Aktivitas** | Aktivitas FPBL: pilih template, atur pertanyaan, instruksi, bukti yang dikumpulkan, jenis respons (interaktif/jawaban singkat/uraian/upload), pilihan jawaban + kunci, poin, rubrik, ikut gradebook, tampilkan skor |
| **Kuis** | Blok kuis — langsung diarahkan ke editor khusus (lihat bagian 4) |
| **PDF / Tugas** | Instruksi tugas; guru bisa menempel link PDF/Drive **atau** mengunggah PDF dari perangkat (maks 8 MB, tersimpan di database, bisa dihapus dan diganti) |
| **Game** | Pilih game dari library, atur instruksi, poin per sesi, ambang lulus (%), ikut gradebook, tampilkan skor |

- Klik ikon edit pada blok untuk membuka **Editor Materi** (judul, deskripsi, isi sesuai tipe),
  lalu **Simpan rincian** — perubahan langsung tersinkron ke database dan terlihat siswa.
- Blok dan modul bisa dihapus kapan saja.

### Pengaturan Akses (sidebar kanan)
- **Toggle akses**: `open` = siswa baru bisa bergabung dengan nama dan kelas;
  `locked` = link tetap ada tetapi siswa baru ditolak.
- **Link pembelajaran** (`/learn/[slug]`) bisa disalin dengan satu klik.
- Tombol **Preview siswa** membuka halaman persis seperti yang dilihat siswa.

## 4. Editor Kuis (`/teacher/course/[slug]/quiz/[blockId]`)

Dibuka otomatis saat guru menambah atau mengedit blok kuis. Di halaman ini guru bisa:

- Menambah soal dengan pilihan jawaban dan **kunci jawaban**.
- Menambah **pembahasan** untuk setiap soal.
- Mengatur **poin** per soal, jumlah **percobaan** (attempt) yang diberikan ke siswa,
  dan pengaturan **tampilan skor**.
- Versi kuis disimpan di database sehingga attempt siswa selalu menunjuk ke blok yang benar.

## 5. Game Studio (`/teacher/game-studio`)

- Pilih template game (misalnya Number Line Challenge) dari library.
- Konfigurasi perilaku game: nama, instruksi, parameter sesuai template.
- **Simpan draft** (tersimpan sementara di perangkat, atau ke database bila course sudah ada),
  lalu **Publikasikan** versi game yang bisa dipakai di blok Game course.

## 6. Forum Diskusi

- Guru membuka forum per modul dari course builder (tombol **Buka forum diskusi**).
- Semua pertanyaan dan tanggapan siswa di modul itu tampil, dan guru dapat menghapus
  postingan mana pun (moderasi penuh).

## 7. Menyimpan dan Mempublikasikan

Tidak ada tombol "simpan" terpisah untuk sebagian besar perubahan: setiap aksi (tambah/hapus
blok, simpan materi, ubah modul, ganti status) langsung **sinkron ke database** lewat server
action, dengan banner "Menyimpan ke database..." dan toast konfirmasi. Setelah struktur siap,
tekan **Publish** — siswa bisa langsung mengakses materinya lewat link pembelajaran.
