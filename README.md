# SIM Inventaris RS

Aplikasi web monitoring inventaris rumah sakit berbasis React, Vite, dan Supabase.

## Fitur fondasi
- Login dan pendaftaran akun petugas (Supabase Auth).
- Dashboard ringkasan kondisi barang: ada, tidak ada, dipinjam, belum dimonitor.
- Data inventaris per lantai.
- Monitoring shift pagi/siang/malam dengan foto wajib.
- Riwayat monitoring dengan identitas dan waktu pencatatan.
- Penyimpanan foto pada bucket privat Supabase.
- Role awal: `officer`, mendukung `super_admin`, `inventory_admin`, `head_nurse`.

## Konfigurasi lokal
1. Install Node.js LTS.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env`.
4. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Jalankan `npm run dev`.

## Deploy
Build dengan `npm run build`; hasil berada di folder `dist`. Tambahkan kedua environment variable di layanan hosting.

## Database
Project ref: `mkhcmsjuxjexapfrdapu`.
Migration awal sudah diterapkan melalui Supabase:
- profiles dan role pengguna
- floors, rooms, inventory_items
- monitoring_sessions, monitoring_records
- RLS policies dan private Storage bucket `monitoring-photos`

## Setup administrator pertama
Pendaftaran publik membuat akun dengan role `officer`. Setelah akun administrator pertama didaftarkan, ubah role akun tersebut dari Supabase SQL Editor oleh pemilik proyek:
```sql
update public.profiles
set role = 'super_admin', updated_at = now()
where id = (select id from auth.users where email = 'EMAIL_ADMIN');
```
Jangan memberikan hak ubah role melalui formulir frontend. Jangan pernah menaruh Supabase secret/service-role key di browser.

## Catatan pengembangan
- Hasil monitoring bersifat append-only pada tabel `monitoring_records`.
- Tidak ada record berarti belum dimonitor, bukan otomatis hilang.
- Satu sesi per tanggal/lantai/shift; satu catatan per barang per sesi.
- Foto wajib disimpan privat di Storage.
