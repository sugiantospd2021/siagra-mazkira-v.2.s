const { GoogleGenerativeAI } = require('@google/generative-ai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY belum di-set di Environment Variables Vercel.' });
    }

    const d = req.body;
    if (!d.topik || !d.subtopik || !d.kelompok) {
      return res.status(400).json({ success: false, error: 'Data tidak lengkap: topik, subtopik, kelompok wajib diisi.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt = buildPrompt(d);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      return res.status(500).json({
        success: false,
        error: 'Respons AI tidak valid (bukan JSON). Coba lagi.',
        raw: text.substring(0, 500)
      });
    }

    res.json({ success: true, data: parsed, model: GEMINI_MODEL });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Terjadi kesalahan pada server.' });
  }
}

function buildPrompt(d) {
  const isRPPM = d.mode === 'rppm';
  const isB = (d.kelompok || '').indexOf('Kelompok B') > -1;

  return `Anda adalah ahli Kurikulum Berbasis Cinta (KBC) untuk Raudhatul Athfal (RA).
Buat ${isRPPM ? 'Rencana Pelaksanaan Pembelajaran Mingguan (RPPM)' : 'Rencana Pelaksanaan Pembelajaran Harian (RPPH)'}
sesuai pedoman KBC Kemenag, KMA 450 Tahun 2024, dan Kurikulum Merdeka PAUD.

## DATA INPUT
- Satuan: ${d.namaSekolah || 'RA Mazkira Imani'}
- Kelompok / Rombel: ${d.kelompokRombel || '-'}
- Kelompok / Umur: ${d.kelompok}
- Fase: Fase Fondasi
- Topik: ${d.topik}
- Sub Topik: ${d.subtopik}
- Mode: ${isRPPM ? 'RPPM (Mingguan, 6 hari)' : 'RPPH (Harian)'}
- Alokasi: ${d.alokasi || (isRPPM ? '1 Minggu (6 Hari)' : '1 Hari (210 Menit)')}

## DPL (Dimensi Profil Lulusan)
${(d.dpl || []).map(x => '- ' + x).join('\n')}

## PRINSIP PEMBELAJARAN MENDALAM
${(d.prinsip || []).map(x => '- ' + x).join('\n') || '- (kosong)'}

## PENGALAMAN BELAJAR MENDALAM
${(d.pengalaman || []).map(x => '- ' + x).join('\n') || '- (kosong)'}

## KERANGKA PEMBELAJARAN MENDALAM
${(d.kerangka || []).map(x => '- ' + x).join('\n') || '- (kosong)'}

## PANCA CINTA
${(d.cinta || []).map(x => '- ' + x).join('\n')}

## OUTPUT
Kembalikan HANYA JSON valid (tanpa teks pembuka/penutup, tanpa markdown):
{
  "materi_kbc": {
    "deskripsi": "Deskripsi materi 2-3 kalimat tentang ${d.topik} - ${d.subtopik}",
    "sub_materi": ["Poin 1", "Poin 2", "Poin 3"]
  },
  "capaian_pembelajaran": {
    "nilai_agama_moral": "CP Nilai Agama & Moral",
    "fisik_motorik": "CP Fisik Motorik",
    "kognitif": "CP Kognitif",
    "bahasa": "CP Bahasa",
    "sosial_emosional": "CP Sosial Emosional",
    "seni": "CP Seni"
  },
  "tujuan_pembelajaran": [
    "TP 1: Anak mampu ...",
    "TP 2: Anak mampu ...",
    "TP 3: Anak mampu ..."
  ],
  "indikator_iktp": [
    { "dimensi": "Keimanan & Takwa", "indikator": ["Indikator 1", "Indikator 2"] }
  ],
  "kegiatan_pembelajaran": {
    "pembukaan": "Kegiatan pembukaan (±30 menit): salam, doa, bernyanyi, tanya jawab tentang ${d.subtopik}.",
    "inti": "Kegiatan inti (±150 menit): pengamatan, eksplorasi, kegiatan kreatif, bermain peran tentang ${d.subtopik}.",
    "penutup": "Kegiatan penutup (±30 menit): refleksi, apresiasi, doa penutup."
  },
  "asesmen": {
    "observasi": "Deskripsi observasi",
    "hasil_karya": "Deskripsi hasil karya"
  },
  "refleksi_guru": [
    "Pertanyaan refleksi 1",
    "Pertanyaan refleksi 2",
    "Pertanyaan refleksi 3"
  ]
}

## ATURAN
1. Bahasa Indonesia yang baik dan benar.
2. ${isB ? 'Kelompok B (5-6 tahun): indikator lebih kompleks.' : 'Kelompok A (4-5 tahun): indikator sesuai usia.'}
3. Semua kegiatan mengacu pada topik "${d.topik}" dan sub topik "${d.subtopik}".
4. Output HANYA JSON valid, jangan tambah teks apapun di luar JSON.`;
}
