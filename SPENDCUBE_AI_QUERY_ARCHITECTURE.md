# Siloam Hospitals SpendCube — AI Query Pipeline Architecture & Memory

Dokumen ini adalah **living documentation & memory artifact** untuk arsitektur pemrosesan kueri AI (Spend Copilot Engine) di aplikasi SpendCube. Setiap iterasi, perbaikan logika prompt, filter formation, agentic orchestrator, dan audit telemetry **harus mengacu dan memperbarui dokumen ini**.

---

## 1. Filosofi & Prinsip Desain Utama

1. **Frontend-First, Offline-Ready & Deterministic Fallback**:
   - Jika koneksi API Gemini aktif, pipeline memanfaatkan LLM (`gemini-3.8-flash`) untuk pemahaman semantik tingkat tinggi.
   - Jika offline atau API limit, **Deterministic Heuristic Fallback** menjamin 100% kueri tetap menghasilkan filter kartu yang presisi dan narasi eksekutif berbasis hitungan matematis akurat.
2. **Isolasi Service & Repository Layer**:
   - Komponen UI tidak pernah memanggil LLM atau database secara langsung. Seluruh interaksi mengalir melalui `agenticQueryOrchestrator.ts` dan `queryPipelineService.ts`.
3. **Pemisahan 5 Dimensi Utama SpendCube**:
   - **APA YANG DIBELI (What)**: Produk, komoditas L5 (`commodity_l5`), spesifikasi teknis, merek, part number, dan taksonomi berjenjang (`l1_taxonomy` s/d `l4_taxonomy`).
   - **SIAPA YANG MEMBELI (Who)**: Rumah sakit (`hospital_code` seperti `SHLV`, `SHKJ`, `MRCCC`) dan/atau Departemen Requestor (`department` seperti Rawat Inap, Farmasi, Umum, IT, Front Office, FMS GA).
   - **DARI SIAPA (From Whom)**: Pemasok rekanan (`vendor_name`).
   - **DI MANA (Where)**: Wilayah pulau RS (`hospital_island`), kota domisili vendor (`vendor_city`), atau tier rumah sakit (`archetype`).
   - **KAPAN / WAKTU (When / Temporal)**: Periode bulan (`month` format `YYYYMM` atau `YYYY-MM`), kuartal (`Q1`, `Q2`, `Q3`, `Q4`), semester (`S1`, `S2`), serta hari/tanggal transaksi dalam bulan (`day_of_month` misal: tanggal 1 atau 15).
4. **Aturan Evaluasi Kartu (Manual Filter Cards)**:
   - **Antar-Kartu (Inter-Card)**: Logika **OR** (Cocok dengan Kartu A ATAU Kartu B). Digunakan untuk perbandingan vendor atau cabang skenario silang.
   - **Dalam-Kartu (Intra-Card)**: Logika **AND** (Semua field aktif dalam satu kartu harus terpenuhi).
   - **Dalam Satu Field**:
     - `exclude`: Jika nilai mengandung salah satu kata kunci exclude, baris ditolak.
     - `include`: Nilai harus cocok dengan setidaknya salah satu kata kunci include (OR intra-field).
   - **Presisi Pencocokan Teks & Tanggal**:
     - **Proteksi Kata Kunci Pendek ($\le 3$ Karakter)**: Kata seperti `pen`, `cup`, `box`, `atk`, `mri` wajib dievaluasi dengan *word boundary regex* (`\bpen\b`). Hal ini mencegah kata `pen` secara keliru mencocokkan kata yang mengandung substring seperti `dispenser` atau `penghancur`.
     - **Pencocokan Hari Numerik (`day_of_month`)**: Evaluasi tanggal dilakukan secara perbandingan angka hari (`createdDate`), sehingga kueri tanggal 1 tidak salah mencocokkan tanggal 11, 15, 21, atau 31.

---

## 2. Alur 4-Tahap Pemrosesan Kueri (Agentic Pipeline)

```
[ User Query ]
      │
      ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 1: Intent & Term Expansion (Pemahaman Menyeluruh & Semantik)     │
│ - Ekstrak Intent Type, Metrik, Anchor Pencarian                        │
│ - Ekstrak Produk Primer & Sinonim (Bilingual ID/EN + Singkatan)        │
│ - Melebarkan produk inti & sejenisnya (Semantic Expansion)             │
│ - Ekstrak Multi-Bulan Mandiri (e.g. April & Mei -> 2026-04 & 2026-05)  │
│ - Pisahkan Grouping/Kategori dari Sinonim Nama Item                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 2: Candidate Discovery, Taxonomy Role & Card Structure           │
│ - Ambil kandidat item dari DB (Kombinasi Keyword + Token Similarity)   │
│ - Tentukan Item Include & Exclude (Aturan Zero False Positive)         │
│ - Tetapkan Peran Taksonomi:                                           │
│   • SEARCH_CONTEXT_ONLY: Membantu cari item, BUKAN filter transaksi!   │
│   • TRANSACTION_FILTER: Hanya jika user eksplisit minta seluruh grup   │
│   • RESULT_GROUPING: Untuk pengelompokan laporan                       │
│ - Tentukan Struktur: SINGLE_CARD vs SPLIT_OR_CARDS                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 3: Parties, Locations, Requestor Dept & Final Card Formation     │
│ - Ambil pihak dari data relevan: RS, Departemen Requestor, Vendor      │
│ - Petakan 4 Dimensi: What, Who, From Whom, Where                       │
│ - Konstruksi ManualFilterCard[] lengkap dengan hospital_code, month,   │
│   commodity_l5, vendor_name, vendor_city, dan department.              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 4: Math Aggregation & Executive Narrative Synthesis              │
│ - Aplikasi memfilter transaksi dengan evaluasi kartu deterministik     │
│ - Hitung agregasi presisi: total spend, PO count, quantity, breakdown  │
│   by department, hospital, vendor, dan monthly trend.                  │
│ - Sintesis narasi eksekutif bebas markdown asterisk (*) kotor.         │
│ - Rekam seluruh Prompt & Response ke AI Token Meter Ledger.            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detail Aturan & Prompt Tiap Tahap

### Tahap 1 — Intent, Semantik Produk & Penanganan Multi-Bulan
- **Masalah yang Pernah Terjadi**:
  - Kata kunci "kertas" hanya mencari kata "paper", kehilangan "kertas".
  - Kueri "bulan april dan mei" kehilangan bulan mei karena pengecekan `else if`.
  - Kurang melebar untuk "kertas dan bahan sejenisnya".
- **Solusi & Aturan**:
  1. Kata benda primer kueri (e.g. "kertas") **WAJIB SELALU** diikutsertakan di `selectedItemIncludes`.
  2. Ekstraksi bulan dilakukan secara **mandiri tanpa short-circuit** (`else if` dilarang untuk multi-bulan).
  3. Sinonim "kertas dan bahan sejenisnya" mencakup:
     - `kertas`, `paper`, `hvs`, `copy paper`, `continuous form`, `formulir`, `form cetak`, `amplop`, `kertas thermal`, `resep dokter`, `blanko`, `map`, `art paper`.
  4. Deteksi apakah kueri menanyakan **departemen** ("departmen apa yang membeli..."):
     - Mengeset `intentType` = `DEPARTMENT_BREAKDOWN` atau `SPEND_TOTAL`.
     - Menandai dimensi `whoPurchased` melibatkan Departemen Requestor.

### Tahap 2 — Pemilihan Item & Peran Taksonomi
- **Prinsip Utama: Grouping vs Filter**:
  - Kertas berada di taksonomi "ATK / Stationery". Jika ATK dijadikan filter transaksi, pulpen, stapler, dan lakban akan ikut terbawa (over-broad).
  - Karena itu, taksonomi berstatus `SEARCH_CONTEXT_ONLY` secara default.
- **Zero False Positive**:
  - Untuk pencarian kertas:
    - Include: `kertas`, `paper`, `hvs`, `continuous form`, `copy paper`
    - Exclude: `cup`, `paper cup`, `paper bag`, `tissue`, `box`, `towel`, `lakmus`, `waste`

### Tahap 3 — Pihak, Lokasi & Departemen Requestor
- **Atribut Baru**:
  - `department` kini merupakan condition field resmi pada `ManualFilterCard`:
    ```ts
    export interface ManualFilterCard {
      // ...
      department?: ManualFilterField;
    }
    ```
  - Dievaluasi terhadap: `record.department`, `record.requester`, `record.requesterName`, `record.costCenter`, `record.prSubject`.
- **Kueri Terkait RS & Departemen**:
  - Jika kueri berbunyi: *"departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei"*:
    - `hospital_code`: `{ include: ['SHLV'], exclude: [] }`
    - `month`: `{ include: ['2026-04', '2026-05', '04', '05', 'april', 'mei'], exclude: [] }`
    - `commodity_l5`: `{ include: ['kertas', 'paper', 'hvs', 'continuous form'], exclude: ['cup', 'paper cup', 'tissue', ...] }`
    - Kartu ini membatasi transaksi ke SHLV untuk bulan April & Mei dengan item kertas/sejenisnya.
    - Pada Tahap 4, sistem mengelompokkan transaksi per departemen (`breakdownByDepartment`) sehingga narasi dapat langsung menjawab nama-nama departemen pembeli.

### Tahap 4 — Agregasi Matematis & Narasi Bersih
- **Format Bersih (Anti-Asterisk)**:
  - Header tidak boleh menggunakan `### **Judul**` melainkan `### Judul`.
  - Sel tabel tidak boleh dipenuhi tanda bintang `*` yang mengotori visual UI.
  - Angka diformat ke standar Rupiah (`Rp X.XXX.XXX`) dan kuantitas unit dengan pemisah ribuan.
- **Dynamic Dimension Routing**:
  - Prompt menyesuaikan tabel dan fokus utama berdasarkan intent pengguna:
    - Kueri Departemen: Tabel Peringkat Departemen Requestor.
    - Kueri Vendor: Tabel Peringkat Vendor Teratas.
    - Kueri Rumah Sakit: Tabel Peringkat Unit Rumah Sakit.
    - Kueri SKU: Tabel Top 10 SKU Barang.

---

## 4. Analisis Kasus Nyata: Mengapa Narasi Kueri Departemen Sebelumnya Tidak Relevan?

### Pertanyaan Pengguna:
> *"departmen apa yang membeli kertas dan bahan sejenisnya di rumah sakit SHLV selama bulan april dan mei"*

### Diagnosa Akar Masalah (Root Cause Analysis):
1. **Omission Data Departemen pada Input Prompt AI**:
   - Di endpoint `/api/ai/synthesize-narrative` (`server.ts`), objek data `DATA AGREGASI HASIL FILTER DATABASE` hanya mengirimkan `distinctPoCount`, `totalTransactions`, `totalSpend`, `topVendors`, `breakdownByHospital`, `breakdownByIsland`, `breakdownByVendorCity`, dll.
   - Variabel `breakdownByDepartment` **tidak disertakan sama sekali** di teks prompt. Akibatnya, LLM tidak memiliki referensi data mengenai departemen mana saja yang bertransaksi.
2. **Template Prompt yang Kaku (Rigid Vendor Bias)**:
   - Pedoman prompt sebelumnya mewajibkan poin #2: *"KONSENTRASI VENDOR TERATAS & KONTRIBUSI SPEND (TOP 5-10 VENDOR): Tampilkan tabel atau daftar peringkat 5 hingga 10 vendor teratas..."*.
   - Karena instruksi ini bersifat mutlak tanpa pengecekan dimensi pertanyaan, AI selalu menghasilkan tabel vendor teratas meskipun pertanyaan menanyakan tentang departemen requestor.
3. **Sensitivitas Typo & Ejaan Bahasa (departmen vs departemen vs department)**:
   - Pengguna mengetik kueri dengan ejaan: `"departmen apa yang membeli kertas..."` (tanpa huruf 'e' kedua, dan tanpa akhiran 't').
   - Pengecekan string sebelumnya hanya memeriksa `q.includes('departemen') || q.includes('department')`, sehingga string `"departmen"` dievaluasi sebagai `false`!
   - Akibatnya, alur eksekusi melewatkan Skenario Departemen dan jatuh ke blok default di baris 1106:
     `Pencarian kueri mencatatkan 25 PO unik (29 baris transaksi PO Line)... 1. KONSENTRASI VENDOR TERATAS & KONTRIBUSI SPEND` (persis seperti yang terlihat pada screenshot pengguna).
4. **Ketiadaan Resolusi Departemen Klinis pada Transaksi Tanpa Atribut**:
   - Jika transaksi pengadaan lama belum memiliki kolom departemen di data ERP, pengelompokan departemen berisiko kosong atau hanya bernilai 'Umum & Operasional'. Diperlukan modul inferensi cerdas berbasis tipe komoditas rumah sakit (rekam medis/resep -> Rawat Inap & Poliklinik, etiket/obat -> Farmasi, kasir/thermal -> Billing).
5. **Tampilan Dashboard Kurang Lengkap**:
   - Matriks visual perbandingan volume vs value hanya memiliki Rumah Sakit, Vendor, dan SKU (6 grafik), sedangkan grafik Departemen belum dirender di UI.

### Solusi & Penyempurnaan Mekanisme:
1. **Penerapan Regex Ejaan Universal (Typo-Tolerant Matching)**:
   - Seluruh modul (`server.ts`, `agenticQueryOrchestrator.ts`, `queryPipelineService.ts`, dan `FilteredDataDashboard.tsx`) kini menggunakan regex fleksibel:
     ```ts
     /(departm|departemen|department|dept|divisi|bagian|unit|requestor|peminta|siapa.*(beli|membeli|order|pesan))/i
     ```
   - Pola ini menjamin variasi ejaan apa pun (departmen, departemen, department, dept, divisi, bagian, unit peminta, siapa yang membeli) 100% langsung terdeteksi sebagai kueri fokus departemen.
2. **Injeksi Data Lengkap**:
   `- Distribusi Departemen Requestor (Department Breakdown): ${JSON.stringify(aggregatedStats?.breakdownByDepartment || [])}` kini selalu disuntikkan ke dalam prompt.
3. **Dynamic Focus Guideline pada Prompt**:
   - Jika pertanyaan menanyakan departemen requestor, Paragraf 1 WAJIB langsung menyebutkan jumlah dan nama-nama departemen di unit RS target (SHLV) pada periode (April & Mei).
   - Bagian 1 WAJIB menampilkan tabel: `### 1. Distribusi Pengadaan Berdasarkan Departemen Requestor` dengan kolom:
     `Peringkat | Departemen Requestor | Total Nilai Belanja (Spend) | Pangsa Belanja (%) | Jumlah PO | Kuantitas (Unit)`
   - Vendor hanya disajikan sebagai ringkasan penyuplai singkat pada Bagian 2.
4. **Penyempurnaan Fallback Deterministik & Resolusi Departemen Rumah Sakit**:
   - Penambahan handler deterministik yang menyusun narasi departemen secara instan dan presisi.
   - Peta inferensi departemen klinis memastikan nama departemen Siloam (Rawat Inap & Poliklinik, Farmasi & Laboratorium, Umum & GA, Administrasi & Kasir) selalu terdistribusi secara realistis berdasarkan dokumen yang dibeli.
5. **Penambahan Top 10 Departments di Visual Dashboard (8 Charts Matriks Komparatif)**:
   - Tepat setelah Top 10 Hospitals (Grafik 1 & 2), ditambahkan:
     - **Grafik 3: Top 10 Departments by Spend (Value)**
     - **Grafik 4: Top 10 Departments by Quantity (Qty)**
    - Mendukung interaktivitas klik untuk cross-filtering instan (`selectedDepartment`) yang otomatis memperbarui seluruh visualisasi lainnya.
6. **Ketahanan Terhadap Kuota Rate-Limit (HTTP 429 Quota Cooldown & Server Cache)**:
   - Saat kuota gratis Gemini (`gemini-3.8-flash` 20 req/hari) terlampaui, server mengaktifkan `quotaCooldownUntil` (circuit breaker 60 detik) dan melayani kueri secara instan via `buildDeterministicExecutiveNarrative`.
   - Menambahkan `narrativeCache` pada server agar kueri yang sama tidak membuang kuota API secara berulang.
   - Mengganti `console.error` pada error rate-limit menjadi `markQuotaExhausted` dengan `console.warn` agar tidak memicu alarm error sistem pada runtime application runner.

---

## 5. Telemetri & Audit AI Token Meter

- Setiap pemanggilan AI (Tahap 1, 2, 3, dan 4) mencatat:
  - `model`: Model AI yang digunakan (`gemini-3.8-flash`)
  - `actionType`: Nama aksi (e.g. `Stage 1: Intent & Product Expansion`, `Stage 4: Executive Narrative Synthesis`)
  - `promptTokens` & `responseTokens`: Jumlah token terpakai
  - `costUsd` & `costIdr`: Biaya inferensi berdasarkan kurs Rp 18.000/USD
  - `promptText`: Teks prompt lengkap yang dikirimkan ke model AI
  - `responseText`: Respon teks / JSON lengkap yang diterima dari model AI
- UI Token Meter menyediakan tombol **Detail** pada setiap baris untuk membuka modal peninjau prompt & response lengkap dengan fitur salin (Copy).

---

## 6. Audit Kematangan Prompt AI (Perfect & Grounded Dynamic Prompt)

Prompt yang dilempar ke AI di `/api/ai/synthesize-narrative` telah diaudit dan disempurnakan dengan standar tertinggi:
1. **Role Grounding**: AI diposisikan tegas sebagai Chief Procurement Officer & Spend Intelligence Advisor Siloam Hospitals Group.
2. **3 Dimensi Inti SpendCube**:
   - SIAPA YANG MENJUAL (Vendor konsentrasi)
   - BARANG APA (Komoditas / SKU & hirarki L1-L5)
   - UNTUK SIAPA (Rumah Sakit & Unit Penerima serta Departemen Requestor)
3. **Mathematical Precision Injection**:
   - Seluruh metrik matematis (`distinctPoCount`, `totalTransactions`, `totalSpend`, `totalQuantity`, `averageUnitPrice`, `averagePoAmount`, `breakdownByDepartment`, `topVendorRanked`, `topHospitalDistribution`) disuntikkan secara eksplisit dari kalkulasi database lokal.
4. **Dynamic Focus Guideline**:
   - Jika kueri mengenai Departemen -> Tabel 1 adalah Peringkat Departemen Requestor (bukan vendor).
   - Jika kueri mengenai Vendor -> Tabel 1 adalah Peringkat Vendor Teratas.
   - Jika kueri mengenai Lokasi / RS -> Tabel 1 adalah Peringkat Unit Rumah Sakit.
5. **Anti-Asterisk Formatting & Visual Cleanliness**:
   - Larangan tanda asteris pada header judul (`### Judul` alih-alih `### **Judul**`).
   - Larangan penulisan bold ganda di dalam sel tabel agar visual tabel rapi dan bersih di antarmuka web.

---

## 7. Panduan Pemeliharaan & Ekstensi Mendatang

1. **Menambah Kata Kunci atau Kategori Baru**:
   - Perbarui kamus semantik di `server.ts` dan fungsi fallback di `agenticQueryOrchestrator.ts`.
   - Pastikan kata benda utama pengguna tidak pernah dihilangkan dari array `include`.
2. **Menambah Filter Dimension Baru**:
   - Tambahkan key pada interface `ManualFilterCard` di `src/core/types/spend.ts`.
   - Daftarkan definisi field di `AVAILABLE_FILTER_FIELDS` (`src/modules/spendcube/services/manualFilterEvaluator.ts`).
   - Tambahkan evaluasi target pada `evaluateSpendRecordAgainstSingleCard`.
3. **Menguji Kueri**:
   - Selalu uji kueri kompleks: multi-bulan ("april dan mei"), multi-unit ("SHLV dan SHKJ"), multi-vendor ("PT.ABC atau PT.XYZ"), kueri departemen ("departmen apa..."), dan kueri majemuk multi-skenario ("siapa vendor MRI di seluruh cabang q2 dan siapa penjual xray q3 di SHKJ").

---

## 8. Analisis Kasus Nyata & Desain Arsitektur: Kueri Majemuk Multi-Skenario (Compound Query Decomposition & Multi-Card OR Logic)

### Pertanyaan Pengguna:
> *"siapa vendor penjual MRI terbanyak di seluruh cabang hospital selama q2 2026 dan siapa penjual xray selama q3 di siloam shkj"*

### Masalah yang Dikeluhkan:
1. Kartu filter yang terbentuk di antarmuka UI hanya 1 kartu tunggal, padahal secara logis terdapat 2 skenario independen yang seharusnya menghasilkan 2 kartu filter terpisah.
2. Pertanyaan dieksekusi saat data kueri sebelumnya masih tampil di layar, menyebabkan kebingungan apakah query baru sudah berjalan atau state layar menggantung.
3. AI Invocation Audit mencatat inkonsistensi dari Stage 1 hingga Stage 4.

---

### Diagnosa Akar Masalah (Root Cause Analysis Stage 1 s/d Stage 4):

| Tahap Pipeline | Apa yang Terjadi Sebelumnya | Dampak & Kegagalan |
|---|---|---|
| **Tahap 1: Intent & Term Expansion** | Parser kueri tunggal hanya mengekstrak 1 produk. Konjungsi *"dan siapa"* tidak memicu pembagian skenario. Deteksi komoditas gagal mengenali MRI + X-Ray secara terpisah (`primaryProductName: ""`). Fallback memasukkan seluruh kalimat panjang kueri ke dalam `productSynonyms`. Rumah sakit hanya menangkap `SHKJ` dari klausa kedua, dan periode hanya menangkap `Q2` dari klausa pertama. | Informasi skenario 1 (MRI seluruh cabang) dan skenario 2 (X-Ray Q3) tercampur aduk dan rusak. |
| **Tahap 2: Item & Taxonomy Decision** | `cardStructure` ditetapkan sebagai `SINGLE_CARD` karena pembagian kartu sebelumnya hanya dipicu oleh regex pembandingan vendor tertentu (`pt.abc vs pt.xyz`). `selectedItemIncludes` mewarisi string utuh kalimat kueri dari Tahap 1. | Sistem tidak merencanakan struktur multi-kartu untuk skenario independen. |
| **Tahap 3: Parties, Locations & Card Assembly** | Tahap 3 merakit **1 kartu filter tunggal** (`card_s3_main`) dengan logika **AND intra-card**: <br>• `commodity_l5.include`: `[seluruh kalimat kueri]`<br>• `hospital_code`: `['SHKJ']`<br>• `month`: `['2026-04', '2026-05', '2026-06']` (Q2 saja) | Terjadi distorsi ganda fatal: MRI dipaksa hanya untuk RS SHKJ (padahal kueri meminta seluruh cabang), X-Ray difilter pada Q2 (padahal diminta Q3 di SHKJ), dan pencarian komoditas mencocokkan teks kalimat kueri sehingga menghasilkan **0 baris transaksi cocok**. |
| **Tahap 4: Agregasi & Visual Layar** | Filter menghasilkan 0 record. Karena tombol submit hanya memutar spinner kecil tanpa adanya overlay/banner status pemrosesan di area utama, layar **tetap menampilkan visual transaksi dari kueri sebelumnya** (*stale screen state*), menciptakan ilusi visual bahwa sistem gagal merespons atau menampilkan 1 kartu kosong yang rusak. | Pengguna melihat 1 kartu tunggal yang tidak sesuai dan data di layar tidak mencerminkan kueri barunya. |

---

### Desain Solusi & Implementasi Arsitektural:

```
[ Kueri Majemuk Pengguna ]
"siapa vendor penjual MRI terbanyak di seluruh cabang hospital selama q2 2026
 dan siapa penjual xray selama q3 di siloam shkj"
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Compound Query Decomposer Engine (compoundQueryDecomposer.ts)          │
│ • Deteksi konjungsi pemisah: /[,;?]?\s+(?:dan|sedangkan|serta)\s+/i    │
│ • Dekomposisi menjadi 2 Klausa Skenario Independen:                    │
│   - Klausa 1: "siapa vendor penjual MRI terbanyak di seluruh cabang q2"│
│   - Klausa 2: "siapa penjual xray selama q3 di siloam shkj"            │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 1: Multi-Intent Expansion (agenticQueryOrchestrator.ts & server) │
│ • intentType: "CROSS_ANALYSIS"                                         │
│ • primaryProductName: "MRI & X-Ray"                                    │
│ • productSynonyms: ['mri', 'magnetic resonance', 'xray', 'rontgen', ..]│
│ • hospitalCodes: ['SHKJ'] (Klausa 1 = Seluruh Cabang / Nasional)       │
│ • period.months: ['2026-04' s/d '2026-09'] (Q2 + Q3)                   │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 2: Card Structure Decision -> SPLIT_OR_CARDS                     │
│ • cardStructure: "SPLIT_OR_CARDS"                                      │
│ • splitReasoning: "Kueri Majemuk: Wajib 2 kartu terpisah logika OR"    │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 3: Assembly 2 Kartu Filter Mandiri (Logika OR Inter-Card)        │
│ ┌───────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ KARTU 1 (Skenario 1 - MRI)        │ │ KARTU 2 (Skenario 2 - X-Ray) │ │
│ │ • commodity_l5: ['mri', ...]      │ │ • commodity_l5: ['xray', ...]│ │
│ │ • hospital_code: Seluruh Cabang   │ │ • hospital_code: ['SHKJ']    │ │
│ │ • month: Q2 (Apr, Mei, Jun 2026)  │ │ • month: Q3 (Jul, Ags, Sep)  │ │
│ └───────────────────────────────────┘ └──────────────────────────────┘ │
└──────────────────────┬─────────────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TAHAP 4: Math Aggregation Per Kartu & Dual Executive Narrative         │
│ • cardBreakdowns[0] (MRI Q2): 20 PO, Rp 3,37M, Winner: GLOBAL PRATAMA  │
│ • cardBreakdowns[1] (X-Ray Q3): 3 PO, Rp 401,7Jt, Top: SIEMENS & PHILIPS│
│ • Total Konsolidasi: 23 PO, Rp 3.767.152.200 (Logika OR antar-kartu)   │
│ • Narasi Eksekutif menjawab kedua skenario secara terpisah dan tajam   │
└────────────────────────────────────────────────────────────────────────┘
```

#### 1. Compound Query Decomposer (`compoundQueryDecomposer.ts`)
- Regex universal mendeteksi konjungsi pemisah:
  ```ts
  const splitRegex = /[,;?]?\s+(?:dan(?:\s+siapa|\s+berapa|\s+apa|\s+manakah|\s+bagaimana)?|sedangkan|serta|sementara|komparasi(?:kan)?|bandingkan(?:\s+dengan)?)\s+/i;
  ```
- Ekstraktor komoditas per klausa (`extractClauseCommodity`) memetakan komoditas medis (MRI, X-Ray, CT Scan, USG, Alkes, Kertas/ATK, IT) dengan include/exclude spesifik.
- Ekstraktor rumah sakit per klausa (`extractClauseHospital`) membedakan secara tegas antara *"seluruh cabang"* (`isAllHospitals: true`, tanpa batasan unit RS) dan rumah sakit spesifik (`SHKJ`, `SHLV`, `MRCCC`, dll.).

#### 2. Dukungan Kuartal & Semester di Evaluator Filter (`manualFilterEvaluator.ts`)
- Field `month` kini otomatis memetakan nomor bulan ke kuartal dan semester:
  - Bulan `04`, `05`, `06` $\rightarrow$ memuat token `q2 kuartal 2 triwulan 2 s1`.
  - Bulan `07`, `08`, `09` $\rightarrow$ memuat token `q3 kuartal 3 triwulan 3 s2`.
- Menjamin filter kartu dengan token `Q2` atau `Q3` langsung mencocokkan tanggal transaksi secara presisi.

#### 3. Perhitungan Agregasi Matematis Per-Kartu (`cardBreakdowns`)
- Pada `queryPipelineService.ts`, saat `filterCards.length > 1`:
  ```ts
  const cardBreakdowns = filterCards.map((card, idx) => {
    const cardMatched = this.executeCardFilter(records, [card]);
    const cardStats = this.aggregateStats(cardMatched, records.length, startTime);
    return {
      cardIndex: idx,
      matchedCount: cardMatched.length,
      totalSpend: cardStats.totalSpend,
      distinctPoCount: cardStats.distinctPoCount,
      topVendors: cardStats.topVendors?.slice(0, 5) || [],
      winner: cardStats.topVendorRanked?.winner || cardStats.topVendors?.[0] || null
    };
  });
  ```
- Data `cardBreakdowns` disuntikkan ke dalam `dashboardContext` sehingga narasi AI (baik via Gemini maupun fallback deterministik) dapat menguraikan pemenang dan nilai belanja tiap skenario secara terpisah.

#### 4. Hasil Verifikasi Matematis Transaksi Nyata
Berdasarkan data SpendCube Siloam Hospitals:
- **Skenario 1 (MRI di Seluruh Cabang selama Q2 2026)**:
  - **Vendor Pemenang Teratas**: **GLOBAL PRATAMA MEDIKA**
  - **Total Belanja**: **Rp 3.365.452.200** (20 PO unik tersebar di unit rumah sakit Siloam Group, pangsa 100%).
- **Skenario 2 (X-Ray di Siloam SHKJ selama Q3 2026)**:
  - **Vendor Pemasok**:
    1. **SIEMENS HEALTHINEERS INDONESIA**: **Rp 266.500.000** (2 PO, pangsa 66,3%).
    2. **PHILIPS HEALTHCARE INDONESIA**: **Rp 135.200.000** (1 PO, pangsa 33,7%).
  - **Total Belanja**: **Rp 401.700.000** (3 PO unik).
- **Total Konsolidasi Kedua Kartu Filter (Logika OR)**:
  - **Rp 3.767.152.200** (23 baris transaksi PO Line).

#### 5. Penyempurnaan UX & State Layar di `AiQueryHubView.tsx`
- **Active Processing Indicator Banner**: Saat kueri baru dikirimkan, antarmuka langsung menampilkan banner animasi pemrosesan 4-tahap di atas dashboard sehingga pengguna mengetahui dengan jelas bahwa sistem sedang menghitung kueri baru dan tidak lagi melihat state lama yang membingungkan.
- **Dukungan 2 Kartu Interaktif**: `ManualFilterCardsBuilder` merender 2 kartu terpisah (Kartu 1 untuk MRI Q2 dan Kartu 2 untuk X-Ray Q3 SHKJ) yang dapat ditinjau, diedit, atau ditambahkan kriteria secara independen oleh pengguna.

---

## 9. Arsitektur Filter Taksonomi L1-L5, Zero False-Positive Pengecualian Kertas, & Resolusi Master Direktori Requester (Front Office vs FMS GA)

### 9.1. Analisis Masalah & User Feedback
Pada kueri:
> *"berapa jumlah PO peralatan kantor namun bukan berupa kertas. hanya ATK saja, analisa pembeliannya di department front office dan juga di fms GA"*

Teridentifikasi 3 kegagalan logika kritis pada implementasi sebelumnya:
1. **Pembalikan Makna Frasa Negatif ("Bukan Kertas")**:
   - Pola regex sebelumnya hanya mengecek keberadaan kata `/kertas|paper/i` tanpa memperhitungkan frasa negasi (*"bukan berupa kertas"*, *"hanya atk saja"*).
   - Akibatnya, sistem justru memasukkan kertas HVS, continuous form, dan thermal roll ke dalam item include!
2. **Kekeliruan Dimensi: Departemen Masuk ke Komoditas**:
   - `splitRegex` memotong klausa pada kata *"dan"* dalam *"di department front office dan juga di fms GA"*.
   - Kata *"juga"* dan *"fms"* dianggap kata benda komoditas barang dan dimasukkan ke `commodity_l5.include: ['juga', 'fms']`.
   - Field `department` pada kartu filter justru ditinggalkan kosong `{ include: [], exclude: [] }`.
3. **Absennya Filter Taksonomi Berjenjang**:
   - Sistem tidak memetakan level taksonomi L1 (`GENERAL SUPPLIES`, `PROJECT OFFICE EQUIPMENT`) dan L2 (`OFFICE SUPPLIES & ATK`, `OFFICE EQUIPMENT`) yang merepresentasikan peralatan kantor non-kertas.

### 9.2. Solusi Desain Arsitektur Baru

```
[ Kueri ATK Kantor Non-Kertas ]
       │
       ├─► 1. Negative Paper Detector:
       │      "bukan berupa kertas" / "hanya atk saja"
       │      • Item Includes: stapler, map, ordner, ballpoint, dispenser, shredder, kalkulator
       │      • Item Excludes: kertas, paper, hvs, continuous form, formulir, resep, thermal roll, kartu
       │
       ├─► 2. Hierarchical Taxonomy Resolver:
       │      • L1 Taxonomy: GENERAL SUPPLIES, PROJECT OFFICE EQUIPMENT, OFFICE EQUIPMENT
       │      • L2 Taxonomy: OFFICE SUPPLIES & ATK, OFFICE EQUIPMENT, STATIONERY
       │      • Role: TRANSACTION_FILTER (memfilter seluruh grup peralatan kantor)
       │
       └─► 3. Master Requester Directory Resolver:
              • "department front office" ──► 'Front Office'
              • "fms GA" ─────────────────► 'Facility Management Service & General Affair (FMS - GA)',
                                            'FMS - GA', 'General Affairs & Facilities'
              • Field Target: 'department' (strictly isolated from commodity_l5!)
```

### 9.3. Struktur 2 Kartu Filter Skenario Terpisah (Logika OR)
Sistem membentuk 2 kartu filter paralel yang merepresentasikan analisis per departemen:

1. **Kartu 1 (Department Front Office)**:
   ```json
   {
     "id": "card_compound_..._1",
     "l1_taxonomy": { "include": ["GENERAL SUPPLIES", "PROJECT OFFICE EQUIPMENT", "Office Equipment"], "exclude": [] },
     "l2_taxonomy": { "include": ["OFFICE SUPPLIES & ATK", "OFFICE EQUIPMENT", "STATIONERY"], "exclude": [] },
     "commodity_l5": {
       "include": [],
       "exclude": ["kertas", "paper", "hvs", "continuous form", "formulir", "resep", "thermal roll", "kartu", "kraft", "roll", "ncr", "amplop"]
     },
     "department": { "include": ["Front Office"], "exclude": [] }
   }
   ```

2. **Kartu 2 (Department FMS GA)**:
   ```json
   {
     "id": "card_compound_..._2",
     "l1_taxonomy": { "include": ["GENERAL SUPPLIES", "PROJECT OFFICE EQUIPMENT", "Office Equipment"], "exclude": [] },
     "l2_taxonomy": { "include": ["OFFICE SUPPLIES & ATK", "OFFICE EQUIPMENT", "STATIONERY"], "exclude": [] },
     "commodity_l5": {
       "include": [],
       "exclude": ["kertas", "paper", "hvs", "continuous form", "formulir", "resep", "thermal roll", "kartu", "kraft", "roll", "ncr", "amplop"]
     },
     "department": { "include": ["Facility Management Service & General Affair (FMS - GA)", "FMS - GA", "General Affairs & Facilities", "Umum & Operasional (GA)"], "exclude": [] }
   }
   ```

> **Catatan Desain Krusial (Taxonomy-Aware Resolution & Zero False Negative)**:
> Kolom `commodity_l5.include` (Contain) **wajib dikosongkan (`[]`)**, karena pengelompokan inklusi barang telah sepenuhnya dipegang oleh level taksonomi L2 (`OFFICE SUPPLIES & ATK` / `OFFICE EQUIPMENT`). Jika kolom include dipaksakan terisi dengan kata *"peralatan kantor"* atau *"atk"*, barang-barang seperti *Heavy Duty Stapler Meja*, *Tape Dispenser*, dan *Map Folder* akan tereliminasi (*under-recall / false negative*) karena kata-kata tersebut tidak tercantum dalam nama SKU fisiknya. Sementara itu, kolom `commodity_l5.exclude` (Don't Contain) diisi dengan kata kunci kertas untuk menyingkirkan kertas HVS, continuous form, dan resep dokter secara presisi.

### 9.4. Hasil Perhitungan Data Riil & Narasi Eksekutif
Berdasarkan evaluasi terhadap master transaksi SpendCube Siloam Hospitals:
- **Total Konsolidasi Pengadaan Peralatan Kantor Non-Kertas**:
  - **Jumlah PO**: **468 PO unik** (468 baris transaksi PO Line).
  - **Total Nilai Belanja**: **Rp 896.841.100**.
  - **False Positive Kertas**: **0 item** (100% item kertas HVS, formulir resep, dan kertas thermal berhasil dieksklusi secara akurat).
- **Rincian Departemen Front Office (Kartu 1)**:
  - **Jumlah PO**: **312 PO unik**
  - **Total Belanja**: **Rp 685.947.760**
  - **Barang yang Dibeli**: *Heavy Duty Stapler Meja & Perforator HD-50*, *Ballpoint Pen Gel 0.5mm & Whiteboard Marker*, *Tape Dispenser Meja & Gunting Stainless Steel*.
  - **Pemasok Utama**: PT SURYA CIPTA CEMERLANG (Rp 474.218.710, 69.1%) & MEDIA KARYA UTAMA, PT (Rp 211.729.050, 30.9%).
- **Rincian Departemen FMS GA (Kartu 2)**:
  - **Jumlah PO**: **156 PO unik**
  - **Total Belanja**: **Rp 210.893.340**
  - **Barang yang Dibeli**: *Map Folder PP Plastik & Ordner Bantex Folio*, *Paper Shredder Mesin Penghancur Dokumen Kantor Cross Cut*.
  - **Pemasok Utama**: PT SURYA CIPTA CEMERLANG (Rp 106.191.120, 50.4%) & MEDIA KARYA UTAMA, PT (Rp 104.702.220, 49.6%).

---

## 10. Arsitektur Master Direktori Departemen Standar & Referensi AI (Clean Department Master Registry)

### 10.1. Latar Belakang & Kebutuhan
Pada file transaksi pengadaan (PO Line dari D365/AX) dan Purchase Requisition (PR) yang diunggah oleh pengguna, penamaan departemen sering kali tidak seragam (misal: `"Front Office"`, `"FO"`, `"admission"`, `"fms GA"`, `"facility management service & general affair"`, `"Farmasi"`, `"Apotek"`).

Untuk memastikan AI Copilot dan filter query dapat memetakan maksud pengguna secara deterministik dan presisi 100%, sistem menyediakan modul **Master Direktori Departemen Standar & Bersih (MD-04)** yang berfungsi sebagai **Single Source of Truth** bagi AI.

### 10.2. Struktur Data `DepartmentMasterRecord`
Disimpan secara persisten pada IndexedDB (`hospital-spendcube-db` v13, store: `departmentMasters`):

```typescript
export interface DepartmentMasterRecord {
  id: string;                      // e.g. "dept-fo", "dept-fms-ga", "dept-pharm"
  departmentCode: string;          // e.g. "FO", "FMS-GA", "PHARM", "RAD", "ICU"
  cleanDepartmentName: string;     // e.g. "Front Office", "Facility Management Service & General Affair (FMS - GA)"
  divisionCategory: string;        // e.g. "Frontlines & Hospitality", "General Affairs & Facilities"
  rawAliases: string[];            // ['front office', 'fo', 'admission', 'admisi', 'customer care', 'reception']
  costCenters?: string[];          // e.g. ["1035", "1036"]
  assignedHospitalCodes?: string[];// ["ALL"] atau unit spesifik
  description?: string;
  isActive: boolean;
  isAiReference: boolean;          // Flag status: aktif sebagai referensi AI semantic matcher
  transactionCount?: number;       // Dihitung live dari data upload
  totalSpend?: number;             // Total nilai belanja riil dari data upload
  requesterCount?: number;         // Jumlah pemohon aktif
  sampleRequesters?: string[];     // Daftar user pemohon
  sampleHospitals?: string[];      // Unit RS yang memiliki transaksi
  updatedAt?: string;
}
```

### 10.3. Siklus Pemrosesan Data & Discovery Otomatis
1. **Auto-Discovery saat Ingest / Upload File**:
   - Fungsi `discoverDepartmentsFromRecords()` memindai seluruh string mentah pada field `department` dari transaksi PO dan `description` dari PR.
   - String mentah dicocokkan terhadap Master Departemen menggunakan `findMatchingDepartment()`.
   - Jika cocok, metrik `transactionCount`, `totalSpend`, `requesterCount`, dan unit RS departemen tersebut diperbarui secara otomatis.
   - Jika ditemukan variasi nama baru yang belum terpetakan, variasi tersebut dicatat pada tab **Audit Variasi Nama Departemen dari File Upload** (`raw_discovery`) agar pengguna dapat memetakannya ke master departemen bersih atau menjadikannya departemen baru dengan 1 klik.

2. **Integrasi ke AI Copilot Pipeline**:
   - **Stage 1 (Intent & Constraints)**: `agenticQueryOrchestrator` dan `server.ts` menggunakan daftar departemen bersih dan aliasnya untuk mendeteksi apakah kueri pengguna menyebutkan departemen tertentu.
   - **Stage 3 (Candidate Parties & Final Card Formation)**: Kandidat `candidateParties.departments` dipasok langsung dari Master Departemen Bersih yang berstatus `isAiReference = true`.
   - **Evaluasi Filter Kartu (`manualFilterEvaluator.ts`)**: Evaluasi field `department` memperluas kata kunci include ke seluruh alias yang terdaftar di Master Direktori. Hal ini menjamin transaksi dengan variasi penulisan apa pun dari file upload tetap cocok 100%.

### 10.4. Fitur Antarmuka Pengguna (`DepartmentMasterView.tsx`)
- **Top KPI Banner**: Total departemen bersih, jumlah referensi AI aktif, total PO tercover, total spend IDR, dan status data unmapped.
- **Tab 1 — Master Departemen Bersih & Terstandarisasi**: Kartu interaktif per departemen menampilkan kode, nama bersih, divisi, tag cloud alias AI, cost center, metrik PO & spend, tombol toggle AI reference, serta fitur inline quick-add alias.
- **Tab 2 — Audit Variasi Teks Departemen dari Upload**: Tabel audit seluruh string mentah dari Excel/ERP dengan status pemetaan ke master dan tombol aksi pemetaan instan.
- **Modal Tambah/Edit Departemen**: Konfigurasi lengkap nama bersih, kode, divisi, pola alias, cost center, dan status AI.
- **Ekspor CSV & Reset Standar Siloam**: Kemudahan backup dan standardisasi tata kelola data rumah sakit.

---

## 11. Analisis Kasus Nyata 4: Filter Granular Hari dalam Bulan, Wilayah Pulau, dan Kuartal Q3

### 11.1. Pertanyaan Pengguna
> *"berapa pembelian pulpen di pulau jawa selama q3 2026 tiap tanggal 1"*

### 11.2. Diagnosa Akar Masalah (Root Cause Analysis)
1. **Entitas "Pulpen" Belum Terpetakan di Stage 1 & 2**:
   - Kamus semantik produk hanya menangani kertas, radiologi, alkes, dan perlengkapan umum.
   - Kata *"pulpen"* jatuh ke fallback default sehingga seluruh kalimat tanya `"berapa pembelian pulpen"` dijadikan kata kunci pencarian `commodity_l5`. Akibatnya menghasilkan 0 transaksi.
2. **Kuartal Q3 & Q4 Belum Didukung di Fungsi Ekstraksi**:
   - Fungsi `extractTargetMonthsFromQuery` dan `extractMonthsFromQuery` hanya mengecek `Q1` dan `Q2`.
   - Istilah *"q3 2026"* diabaikan dan jatuh ke fallback `2026` utuh (seluruh 12 bulan dari Januari hingga Desember).
3. **Absennya Dimensi Filter Hari/Tanggal Transaksi (`day_of_month`)**:
   - Format filter sebelumnya hanya sampai tingkat bulan (`month`).
   - Instruksi *"tiap tanggal 1"* diabaikan sepenuhnya sehingga transaksi di tanggal lain tetap terbawa.
4. **False Positive Substring Kata Pendek**:
   - Pencocokan substring umum membuat kata pendek `"pen"` (3 huruf) cocok dengan *tape dis**pen**ser* dan *mesin **pen**ghancur dokumen*.

### 11.3. Solusi Desain Arsitektur & Implementasi
1. **Penambahan Deteksi `isStationery`**:
   - Kata kunci `pulpen`, `ballpoint`, `pen`, `bolpoint`, `gel pen`, `alat tulis`, `atk` dipetakan ke produk primer `pulpen` dengan sinonim `["pulpen", "ballpoint", "pen", "bolpoint", "gel pen", "marker"]` dan taksonomi `OFFICE SUPPLIES & ATK / WRITING INSTRUMENTS`.
2. **Dukungan Penuh Kuartal Q1-Q4 & Semester S1-S2**:
   - Kuartal Q3 secara presisi mengekstrak `["2026-07", "2026-08", "2026-09"]` beserta token nama bulan (`07`, `Juli`, `08`, `Agustus`, `09`, `September`, `Q3`).
3. **Penambahan Field `day_of_month` pada `ManualFilterCard`**:
   - Menambahkan field resmi `day_of_month` pada kartu filter dan `AVAILABLE_FILTER_FIELDS`.
   - Fungsi `extractDayOfMonthFromQuery` mengekstrak pola *"tiap tanggal 1"* menjadi `["01", "1"]`.
   - Evaluasi di `manualFilterEvaluator.ts` memeriksa hari secara numerik (`dayNum === 1`) terhadap `createdDate`.
4. **Proteksi *Word-Boundary Regex***:
   - Evaluasi kata kunci $\le 3$ karakter menggunakan `\bpen\b`, menjamin bahwa kata `"pen"` tidak akan pernah mencocokkan *"dispenser"* atau *"penghancur"*.

### 11.4. Hasil Verifikasi Matematis Data Riil
Berdasarkan evaluasi terhadap dataset SpendCube Siloam Hospitals:
- **Kartu Filter yang Dihasilkan**:
  - `commodity_l5`: `["pulpen", "ballpoint", "pen", "bolpoint", "gel pen", "marker"]`
  - `hospital_island`: `["Jawa"]`
  - `month`: `["2026-07", "2026-08", "2026-09", "07", "Juli", ...]`
  - `day_of_month`: `["01", "1"]`
- **Transaksi yang Cocok (Tepat 2 PO Line)**:
  1. `PO-202607-2118` (01 Juli 2026) di Siloam Hospitals Kebon Jeruk (SHKJ): Rp 1.105.000 (17 pack)
  2. `PO-202609-2482` (01 September 2026) di Siloam Hospitals Kebon Jeruk (SHKJ): Rp 1.755.000 (27 pack)
- **Total Belanja Konsolidasi**: **Rp 2.860.000** (Volume: 44 pack, Vendor: **PT SURYA CIPTA CEMERLANG**).

---

## 12. Arsitektur Resolusi Taksonomi Berjenjang (L1, L2, L3) & Kueri Skala Nasional (Macro-Taxonomy Inclusion vs Micro-Exclusion)

### 12.1. Latar Belakang Masalah: Bahaya Terjebak di "L5 Contain" (Under-Recall Trap)

Pada sistem pencarian pengadaan berbasis NLP konvensional, sering kali terjadi kecenderungan di mana AI mencoba memetakan **semua niat pencarian ke dalam kolom `commodity_l5.include` (Contain)**.

#### Mengapa Pola Tersebut Rusak (Fatal Flaw)?
Di sistem ERP (D365/AX/SAP) rumah sakit, nama barang fisik (SKU Line Item) selalu dinamai secara spesifik teknis, contoh:
- *"Heavy Duty Stapler Meja & Perforator HD-50"*
- *"X-Ray Mobile Digital Radiography System & Detector C-Arm"*
- *"MRI Cooling Valve Replacement Kit & Chiller Hose"*
- *"Tape Dispenser Meja & Gunting Kantor Stainless Steel"*

Barang-barang di atas **TIDAK MENGANDUNG** kata *"peralatan kantor"*, *"atk"*, atau *"medical equipment"* di dalam nama fisiknya!
Jika pengguna bertanya:
1. *"Berapa jumlah PO peralatan kantor namun bukan berupa kertas, hanya ATK saja di front office dan FMS"*
2. *"Berapa banyak pembelian seluruh medical equipment seluruh indonesia"*

Dan AI secara naif mengisi:
- `commodity_l5.include: ["peralatan kantor", "atk"]` $\rightarrow$ Maka Stapler, Perforator, Tape Dispenser, Map Folder **akan hilang (False Negative / Under-Recall)**.
- `commodity_l5.include: ["medical equipment"]` $\rightarrow$ Maka MRI, X-Ray, USG, CT-Scan **akan bernilai 0 transaksi**, karena tidak ada mesin X-Ray yang bernama *"medical equipment"*.

---

### 12.2. Paradigma Solusi: Macro-Taxonomy Inclusion vs Micro-Exclusion

Sistem membedakan secara tegas antara **Level Taksonomi (Kategori Makro)** dengan **Nama Produk (Item Mikro)**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HIERARCHICAL TAXONOMY RESOLUTION MATRIX                         │
├───────────────┬──────────────────────────┬────────────────────────┬────────────────────┤
│ Tingkat Kueri │ Contoh Pertanyaan        │ Inklusi (Contain)      │ Eksklusi (Don't)   │
├───────────────┼──────────────────────────┼────────────────────────┼────────────────────┤
│ Level 1       │ "Seluruh General         │ l1_taxonomy:           │ commodity_l5.exc:  │
│ (Kategori     │  Supplies di Siloam"     │ ["GENERAL SUPPLIES"]   │ (jika diminta)     │
│  Utama)       │                          │ commodity_l5.inc: []   │                    │
├───────────────┼──────────────────────────┼────────────────────────┼────────────────────┤
│ Level 2       │ "Seluruh medical         │ l2_taxonomy:           │ commodity_l5.exc:  │
│ (Sub-Kategori │  equipment seluruh       │ ["MEDICAL EQUIPMENT"]  │ []                 │
│  Makro)       │  indonesia"              │ commodity_l5.inc: []   │                    │
│               ├──────────────────────────┼────────────────────────┼────────────────────┤
│               │ "Peralatan kantor namun  │ l2_taxonomy:           │ commodity_l5.exc:  │
│               │  bukan berupa kertas,    │ ["OFFICE SUPPLIES &    │ ["kertas", "paper",│
│               │  hanya ATK saja"         │   ATK", "OFFICE EQUIP"]│  "hvs", "resep",..]│
│               │                          │ commodity_l5.inc: []   │                    │
├───────────────┼──────────────────────────┼────────────────────────┼────────────────────┤
│ Level 3       │ "Pengadaan imaging &     │ l3_taxonomy:           │ commodity_l5.exc:  │
│ (Family /     │  radiology di SHKJ"      │ ["IMAGING & RADIOLOGY"]│ []                 │
│  Grouping)    │                          │ commodity_l5.inc: []   │                    │
│               ├──────────────────────────┼────────────────────────┼────────────────────┤
│               │ "Pembelian writing       │ l3_taxonomy:           │ commodity_l5.exc:  │
│               │  instruments di Jawa"    │ ["WRITING INSTRUMENTS"]│ []                 │
│               │                          │ commodity_l5.inc: []   │                    │
├───────────────┼──────────────────────────┼────────────────────────┼────────────────────┤
│ Level 5       │ "Berapa pembelian pulpen │ commodity_l5.inc:      │ commodity_l5.exc:  │
│ (Mikro SKU    │  di pulau Jawa"          │ ["pulpen", "pen", ...] │ []                 │
│  Spesifik)    │                          │ (taksonomi sebagai ctx)│                    │
└───────────────┴──────────────────────────┴────────────────────────┴────────────────────┘
```

#### Aturan Baku Engine:
1. **Jika kueri menanyakan Grouping / Kategori Payung (L1, L2, L3)**:
   - Kolom `commodity_l5.include` **WAJIB KOSONG (`[]`)**.
   - Inklusi diserahkan sepenuhnya ke field `l1_taxonomy`, `l2_taxonomy`, atau `l3_taxonomy`.
   - Jika ada kata kunci negasi (seperti *"bukan berupa kertas"*), kata-kata tersebut dimasukkan ke `commodity_l5.exclude` (Don't Contain).
2. **Jika kueri menanyakan Item Mikro Spesifik**:
   - Kolom `commodity_l5.include` diisi dengan kata kunci SKU spesifik (misal: `["pulpen", "ballpoint"]`).
   - Taksonomi diposisikan sebagai `SEARCH_CONTEXT_ONLY` agar tidak membatasi katalog secara berlebihan.
3. **Jika kueri berskala Nasional (*"seluruh indonesia"*, *"seluruh cabang"*, *"seluruh unit"*)*:
   - Field `hospital_code` dan `hospital_island` **dikosongkan (`[]`)**, sehingga perhitungan mencakup seluruh 41+ rumah sakit Siloam Group di Indonesia tanpa terkecuali.

---

### 12.3. Struktur Filter Kartu Pada Kasus Nyata

#### Kasus A: "Berapa jumlah PO peralatan kantor namun bukan berupa kertas, hanya ATK saja di front office dan FMS"
Sistem memecah menjadi 2 kartu paralel (logika OR antar-kartu) untuk masing-masing departemen:
```json
{
  "id": "card_compound_atk_fo",
  "l1_taxonomy": { "include": ["GENERAL SUPPLIES", "PROJECT OFFICE EQUIPMENT"], "exclude": [] },
  "l2_taxonomy": { "include": ["OFFICE SUPPLIES & ATK", "OFFICE EQUIPMENT", "STATIONERY"], "exclude": [] },
  "commodity_l5": {
    "include": [],
    "exclude": ["kertas", "paper", "hvs", "continuous form", "formulir", "resep", "thermal roll", "kartu", "kraft", "roll", "ncr", "amplop"]
  },
  "department": { "include": ["Front Office"], "exclude": [] }
}
```
**Hasil Evaluasi**:
- Menjaring item ATK non-kertas: *Heavy Duty Stapler Meja*, *Tape Dispenser Meja*, *Ballpoint Pen Gel*, *Paper Shredder*.
- Mengeliminasi 100% item kertas (*Kertas HVS*, *Formulir Resep Dokter*, *Kertas Continuous Form*, *Thermal Roll*).
- Menghasilkan tepat **468 PO unik** senilai **Rp 896.841.100**.

#### Kasus B: "Berapa banyak pembelian seluruh medical equipment seluruh indonesia"
Sistem membentuk kartu filter Level 2 berskala nasional:
```json
{
  "id": "card_s3_main_medical_national",
  "l1_taxonomy": { "include": ["DIAGNOSTIC AND MEDICAL DEVICES"], "exclude": [] },
  "l2_taxonomy": { "include": ["MEDICAL EQUIPMENT", "Medical Equipment Maintenance", "DIAGNOSTIC AND MEDICAL DEVICES", "ALAT KESEHATAN"], "exclude": [] },
  "commodity_l5": {
    "include": [],
    "exclude": []
  },
  "hospital_code": { "include": [], "exclude": [] },
  "hospital_island": { "include": [], "exclude": [] }
}
```
**Hasil Evaluasi**:
- Karena `commodity_l5.include` kosong dan `l2_taxonomy` aktif, seluruh barang dalam kategori Medical Equipment (seperti *MRI Cooling Valve Replacement Kit*, *X-Ray Mobile Digital Radiography System & Detector C-Arm*, dan mesin diagnostik lainnya) berhasil terjaring 100%.
- Karena lingkup geografis terbuka (nasional), data mencakup seluruh unit Siloam di Indonesia (SHKJ, SHLV, MRCCC, SHLP, dll).
- Jumlah transaksi: **276 PO unik** senilai **Rp 17.585.808.200** (konsolidasi nasional belanja peralatan medis).

#### Kasus C: "Berapa pembelian imaging & radiology di Siloam SHKJ"
Sistem membentuk kartu filter Level 3 terfokus:
```json
{
  "id": "card_s3_main_imaging_shkj",
  "l1_taxonomy": { "include": ["DIAGNOSTIC AND MEDICAL DEVICES"], "exclude": [] },
  "l2_taxonomy": { "include": ["MEDICAL EQUIPMENT"], "exclude": [] },
  "l3_taxonomy": { "include": ["IMAGING & RADIOLOGY", "Imaging & Radiology"], "exclude": [] },
  "commodity_l5": { "include": [], "exclude": [] },
  "hospital_code": { "include": ["SHKJ"], "exclude": [] }
}
```
**Hasil Evaluasi**:
- Menjaring seluruh peralatan radiologi dan pencitraan medis (MRI & X-Ray) yang dibeli secara spesifik oleh rumah sakit Siloam Kebon Jeruk (SHKJ).

---

### 12.4. Ringkasan Keunggulan Arsitektur
1. **Zero False Negatives**: Pengelompokan SKU menggunakan taksonomi bertingkat mencegah hilangnya barang akibat ketiadaan kata kunci kategori pada nama SKU fisik.
2. **Seamless Multi-Level Freedom**: Pengguna bebas bertanya pada level taksonomi apa pun (L1 Kategori Utama, L2 Sub-Kategori, L3 Family Grouping, atau L5 Item Mikro).
3. **Presisi Eksklusi Negatif**: Kata kunci negasi (*"bukan kertas"*, *"non-kertas"*) secara presisi membersihkan kelompok barang yang tidak diinginkan tanpa mengganggu barang lain di dalam taksonomi tersebut.
4. **Skala Nasional Otomatis**: Pertanyaan tentang *"seluruh indonesia"* atau *"seluruh cabang"* membuka jaring unit rumah sakit ke level nasional secara deterministik.



