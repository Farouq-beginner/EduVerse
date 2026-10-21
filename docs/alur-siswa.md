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
- Klik salah satu untuk masuk ke ruang belajar tersebut.

## 4. Halaman Pembelajaran (`/learn/[slug]`)

- Menampilkan identitas course, daftar modul, dan **progres belajar** (persentase blok yang
  selesai) yang dihitung dari database.
- **Jika belum bergabung**: siswa harus bergabung dulu (untuk course dengan akses terkunci,
  muncul kartu "akses terkunci" dan siswa baru ditolak sesuai pengaturan guru).
- Progres yang sempat tersimpan lokal (saat belum login/bergabung) otomatis **disinkronkan ke
  database** saat enrollment terdeteksi, jadi tidak hilang.
- Klik modul untuk masuk ke halaman belajar modul tersebut.

## 5. Halaman Modul (`/learn/[slug]/modul/[moduleId]`)

Inti dari pengalaman belajar. Di dalamnya ada daftar blok materi; blok yang sudah selesai
ditandai centang. Jenis blok dan cara mengerjakannya:

### Materi Teks / Video / Link
- **Teks**: dibaca langsung, lalu klik **Selesai** → progres bertambah.
- **Video**: player YouTube (opsional link Drive pendukung).
- **Link**: kartu sumber belajar dengan judul dan deskripsi → membuka URL di tab baru.
- **PDF**: tombol membuka **PDF viewer popup** tanpa meninggalkan halaman.

### Aktivitas
- Sesuai konfigurasi guru: pilihan ganda interaktif, jawaban singkat, uraian, atau **upload
  bukti** (file diunggah ke `/api/files` dan tersimpan di database).
- Jawaban dikirim ke guru untuk ditinjau; poin/umpan balik tampil bila diaktifkan guru.

### Kuis (`QUIZ`)
- Siswa mengerjakan soal pilihan jawaban sesuai jumlah attempt yang diberikan guru.
- Skor langsung dihitung dan ditampilkan (jika guru mengaktifkan tampilan skor).
- Attempt dan nilai tersimpan di database — bisa dilanjutkan/dilihat kembali saat login lagi.
- Tampilan **empty state** bila kuis belum memiliki soal.

### Tugas (PDF / Assignment)
- Siswa menulis jawaban dan/atau **mengunggah lampiran** (PDF/gambar) lewat `/api/files`.
- Jawaban tersimpan di database; saat halaman dibuka lagi, teks dan lampiran **otomatis
  dimuat ulang** (tidak hilang setelah refresh).
- Status penilaian guru (`score`, `status`) ikut tampil pada jawaban yang sudah dinilai.

### Game
- Blok Game membuka game pembelajaran sesuai konfigurasi guru (poin, ambang lulus).
- Nilai sesi ikut dihitung ke gradebook (akun guru tidak dihitung saat playtest).

### Forum Diskusi Modul
- Di bawah materi ada **forum khusus modul**: siswa bisa bertanya dan membalas.
- Siswa dapat menghapus postingannya sendiri; guru dapat menghapus semua postingan.

## 6. Area Game (`/learn/[slug]/games`)

- Kumpulan game dari pembelajaran yang diikuti (dicek dulu apakah siswa sudah bergabung).
- Siswa bermain sesi game dan skornya tercatat bila game tersebut dinilai.

## 7. Progres dan Sinkronisasi

- Setiap blok yang ditandai selesai memanggil `markBlockComplete` / `syncBlockCompletions` →
  persentase progres course ikut ter-update di database.
- Untuk siswa yang **sudah bergabung**, progres selalu tersimpan di server sehingga bisa
  dilanjutkan di perangkat lain; siswa yang belum bergabung masih memakai progres perangkat
  (ditampilkan label "progres perangkat") sampai enrollment terjadi.
- Nilai kuis, jawaban tugas, dan aktivitas terkumpul otomatis di analitik milik guru.

## Ringkasan Perjalanan Singkat

```
/login (demo siswa)
   ↓
/student  →  gabung kelas via link
   ↓
/pilih-pembelajaran  atau  buka /learn/[slug]
   ↓
modul  →  baca materi / tonton video / buka PDF
   ↓
kerjakan kuis · kirim tugas (upload) · main game · ikut forum
   ↓
blok "Selesai"  →  progres tersimpan di database
   ↓
guru melihat nilai & progres di dashboard guru
```
