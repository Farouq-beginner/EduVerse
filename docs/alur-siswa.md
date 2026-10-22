# Alur Siswa

Dokumen ini menjelaskan perjalanan siswa dari login sampai menyelesaikan materi dan melihat progres.

## 1. Login

Buka `/auth`, pilih mode **Masuk** (atau **Daftar** sebagai siswa — saat registrasi diminta
memilih kelas, mis. VII-B). Untuk coba cepat, gunakan tombol demo **Siswa: Alya Pramesti**
(1-klik masuk). Siswa diarahkan ke `/student`.

## 2. Dashboard Siswa (`/student`)

- **Daftar pembelajaran yang diikuti** (enrollment) beserta progres berbentuk cincin persentase
  dan status (aktif/selesai).
- **Gabung kelas**: tempel link pembelajaran dari guru (`/learn/...`), isi nama dan kelas →
  enrollment tercatat di database (dengan token akses course).
- **Keluar kelas** (leave) bila tidak lagi ingin mengikuti pembelajaran.
- Pencarian dan filter: `Semua` / `Aktif` / `Selesai`.

## 3. Katalog Pembelajaran (`/pilih-pembelajaran`)

- Daftar semua pembelajaran berstatus **Published** dari semua guru (dari database).
- Setiap kartu menampilkan jumlah **pertemuan**.
- Klik salah satu untuk masuk ke ruang belajar tersebut.

## 4. Halaman Pembelajaran (`/learn/[slug]`)

- Menampilkan identitas course, daftar **pertemuan**, dan **progres belajar** (persentase blok
  yang selesai) yang dihitung dari database.
- **Jika belum bergabung**: siswa harus bergabung dulu (untuk course dengan akses terkunci,
  muncul kartu "akses terkunci" dan siswa baru ditolak sesuai pengaturan guru).
- Progres yang sempat tersimpan lokal (saat belum login/bergabung) otomatis **disinkronkan ke
  database** saat enrollment terdeteksi, jadi tidak hilang.
- Klik **Buka pertemuan** untuk masuk ke halaman belajar pertemuan tersebut.
- Materi yang tampil adalah versi yang sudah **dipublikasikan guru** — draft guru tidak terlihat.

## 5. Halaman Pertemuan (`/learn/[slug]/modul/[moduleId]`)

Inti dari pengalaman belajar. Di dalamnya ada daftar blok materi; blok yang sudah selesai
ditandai centang. Jenis blok dan cara mengerjakannya:

### Materi Teks / Video / Link
- **Teks**: dibaca langsung di halaman.
- **Video**: player YouTube (opsional link Drive pendukung).
- **Link**: kartu sumber belajar dengan judul dan deskripsi → membuka URL di tab baru.
- **Berkas materi**: PDF tampil di **PDF viewer** dalam halaman; PPT/DOCX/gambar punya tombol
  **Lihat** dan **Unduh**.

### Aktivitas (Visual Interaktif)
- Guru memilih mini-game sebagai visual: garis bilangan, kartu muatan, tantangan, atau
  laboratorium garis bilangan.
- Siswa menekan **Buka Visual** untuk menampilkan visual interaktif, dan **Tutup Visual**
  untuk menyembunyikannya kembali.
- Setelah mencoba, siswa mengisi lembar kerja di bawahnya.

### Lembar Kerja · Jawaban & Lampiran
- **Semua tipe materi** punya lembar kerja yang sama: instruksi dari guru, kolom **jawaban**
  (ditulis), dan kolom **lampiran**.
- Lampiran menerima **foto, PDF, PPT/PPTX, atau DOC/DOCX** dan tersimpan di database.
- Klik **Kirim jawaban & lampiran** → jawaban tersimpan, materi ditandai selesai, dan guru bisa
  membuka jawaban serta lampirannya.
- Saat halaman dibuka lagi, jawaban dan lampiran **otomatis dimuat ulang** (tidak hilang
  setelah refresh).

### Kuis (`QUIZ`)
- Siswa mengerjakan soal sesuai jumlah attempt yang diberikan guru.
- Skor langsung dihitung dan ditampilkan (jika guru mengaktifkan tampilan skor).
- Attempt dan nilai tersimpan di database — bisa dilihat kembali saat login lagi.
- Tampilan **empty state** bila kuis belum diisi atau belum dipublikasikan guru.

### Game
- Blok Game mengarah ke area game sesuai konfigurasi guru (poin, ambang lulus).
- Nilai sesi ikut dihitung ke gradebook (akun guru tidak dihitung saat playtest).

### Forum Diskusi Pertemuan
- Di bawah materi ada **forum khusus pertemuan**: siswa bisa bertanya dan membalas.
- Siswa dapat menghapus postingannya sendiri; guru dapat menghapus semua postingan.

## 6. Area Game (`/learn/[slug]/games`)

- Kumpulan game dari pembelajaran yang diikuti (dicek dulu apakah siswa sudah bergabung).
- Siswa bermain sesi game dan skornya tercatat bila game tersebut dinilai.

## 7. Progres dan Sinkronisasi

- Setiap blok yang ditandai selesai (termasuk setelah mengirim lembar kerja) memanggil
  `markBlockComplete` / `syncBlockCompletions` → persentase progres course ikut ter-update di
  database.
- Untuk siswa yang **sudah bergabung**, progres selalu tersimpan di server sehingga bisa
  dilanjutkan di perangkat lain; siswa yang belum bergabung masih memakai progres perangkat
  (ditampilkan label "progres perangkat") sampai enrollment terjadi.
- Nilai kuis dan lembar kerja terkumpul otomatis di analitik milik guru.

## Ringkasan Perjalanan Singkat

```
/login (demo siswa)
   ↓
/student  →  gabung kelas via link
   ↓
/pilih-pembelajaran  atau  buka /learn/[slug]
   ↓
pertemuan  →  baca materi / tonton video / buka PDF-PPT-DOCX
   ↓
buka visual aktivitas · kerjakan kuis · isi lembar kerja (jawaban + lampiran) · main game · forum
   ↓
blok "Selesai"  →  progres tersimpan di database
   ↓
guru melihat nilai & progres di dashboard guru
```
