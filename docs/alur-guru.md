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
- **Daftar pembelajaran** milik guru lengkap dengan status (Published/Draft) dan jumlah
  pertemuan.
- Tombol **Buat pembelajaran**: isi judul, mata pelajaran, kelas, dan deskripsi → langsung
  disimpan ke database dan dibuka di course builder.
- Tombol **Publish** / **Jadikan draft** pada kartu pembelajaran: Publish mengambil snapshot
  draft terbaru dan menampilkannya ke siswa; Jadikan draft menyembunyikan pembelajaran dari
  siswa tanpa menghapus data.

### Tab Peserta
- Daftar peserta dari database pembelajaran milik guru sendiri (tanpa data contoh).
- Pencarian berdasarkan nama atau kelas.

### Tab Analitik
- Progres dan respons per pertemuan, dihitung dari aktivitas siswa yang sebenarnya.
- Baris analitik per pertemuan: jumlah materi dan tingkat penyelesaian.

> Semua data di dashboard ini terisolasi — guru lain tidak akan melihat course atau
> peserta milik akun ini.

## 3. Course Builder (`/teacher/course/[slug]`)

Tempat guru mengisi seluruh isi pembelajaran. Semua perubahan **tersimpan otomatis di draft**
dan baru terlihat siswa setelah **Publish**. Tidak ada tombol "Simpan info", "Batal", atau
"Simpan rincian" — cukup ketik, perubahan langsung disimpan.

Saat perubahan pertama dibuat, muncul dialog **Buat draft baru?** → pilih
**Ya, buat draft** (perubahan disimpan) atau **Batal** (perubahan dikembalikan).
Banner di atas halaman menunjukkan status: sedang menyimpan, draft tersimpan, atau gagal
menyimpan (tekan **Simpan Draft** untuk mencoba lagi).

### Info Pembelajaran
- Ubah judul, deskripsi, mata pelajaran, target kelas, dan durasi → tersimpan otomatis.
- **Modul pembelajaran · khusus guru**: unggah dokumen modul ajar (**PDF, PPT/PPTX, atau
  DOC/DOCX**), lalu buka dengan tombol **Lihat Modul**, ganti, atau hapus. Bagian ini **tidak
  terlihat oleh siswa**.

### Pertemuan
- **Tambah pertemuan**: judul, label (mis. "Pertemuan 05"), estimasi durasi, warna aksen.
- **Edit pertemuan**: field terbuka langsung di kartu, perubahan tersimpan otomatis.
- **Hapus pertemuan** ikut menghapus semua materi di dalamnya.
- Setiap pertemuan punya tombol **Forum** — guru bisa melihat dan menghapus semua
  pertanyaan/tanggapan di forum pertemuan tersebut.

### Materi per Blok
Tombol **Tambah materi** membuka pilihan tipe blok:

| Tipe | Penjelasan |
|---|---|
| **Teks** | Materi tulis biasa (isi teks/instruksi) |
| **Video / YouTube** | Tempel link YouTube, opsional link Google Drive pendukung |
| **Link** | Sumber belajar eksternal: judul, deskripsi singkat, dan URL |
| **Aktivitas** | Hanya **judul, deskripsi, dan pilihan visual interaktif** dari mini-game yang tersedia. Siswa membuka visual dengan tombol **Buka Visual / Tutup Visual** |
| **Kuis** | Blok kuis — langsung diarahkan ke editor khusus (lihat bagian 4) |
| **Lembar Kerja / Tugas** | Instruksi, berkas materi, dan lembar kerja siswa |
| **Game** | Pilih game dari library dan atur instruksi game |

Semua tipe materi punya bagian yang sama:

- **Berkas materi (PDF, PPT, DOCX, atau gambar)** — unggah dari perangkat; PDF/gambar bisa
  dipratinjau, PPT/DOCX bisa diunduh siswa.
- **Lembar kerja, jawaban & lampiran** — satu format untuk semua materi: guru menulis
  instruksi lembar kerja, label kolom jawaban, dan label kolom lampiran. Bisa dimatikan untuk
  materi tertentu. Siswa menjawab dan melampirkan foto/PDF/PPT/DOCX.

Klik ikon pensil pada materi untuk membuka **editor inline** (judul, deskripsi, isi sesuai
tipe, berkas, dan lembar kerja). Editor tidak menutup sendiri dan tidak punya tombol
simpan/batal: setiap ketikan langsung masuk draft.

### Pengaturan Akses (sidebar kanan)
- **Toggle akses**: `open` = siswa baru bisa bergabung dengan nama dan kelas;
  `locked` = link tetap ada tetapi siswa baru ditolak.
- **Link pembelajaran** (`/learn/[slug]`) bisa disalin dengan satu klik.
- Tombol **Preview siswa** membuka halaman persis seperti yang dilihat siswa.
- Tombol **Simpan Draft** menyimpan sekarang; **Publish** menerbitkan draft ke siswa.

## 4. Editor Kuis (`/teacher/course/[slug]/quiz/[blockId]`)

Dibuka otomatis saat guru menambah atau mengedit blok kuis. Di halaman ini guru bisa:

- Menambah soal dengan pilihan jawaban dan **kunci jawaban**.
- Menambah **pembahasan** untuk setiap soal.
- Mengatur **poin** per soal, jumlah **percobaan** (attempt) yang diberikan ke siswa,
  dan pengaturan **tampilan skor**.
- Versi kuis disimpan di database sehingga attempt siswa selalu menunjuk ke blok yang benar.
- Perubahan kuis ikut draft: siswa baru melihat soal terbaru setelah **Publish** di course
  builder.

## 5. Game Studio (`/teacher/game-studio`)

- Pilih template game (misalnya Number Line Challenge) dari library.
- Konfigurasi perilaku game: nama, instruksi, parameter sesuai template.
- **Simpan draft** (tersimpan sementara di perangkat, atau ke database bila course sudah ada),
  lalu **Publikasikan** versi game yang bisa dipakai di blok Game pertemuan.

## 6. Forum Diskusi

- Guru membuka forum per pertemuan dari course builder (tombol **Forum**).
- Semua pertanyaan dan tanggapan siswa di pertemuan itu tampil, dan guru dapat menghapus
  postingan mana pun (moderasi penuh).

## 7. Menyimpan dan Mempublikasikan

1. Guru mengedit apa pun — identitas, pertemuan, materi, lembar kerja, kuis.
2. Perubahan **otomatis tersimpan ke draft** di database (terlihat dari banner dan status
   di sidebar). Kalau halaman tertutup/refresh, draft tetap ada.
3. Tekan **Publish** untuk membuat snapshot terbit. Siswa baru melihat perubahan setelah itu.
4. Selama ada draft yang belum terbit, siswa tetap melihat versi terbit sebelumnya.
