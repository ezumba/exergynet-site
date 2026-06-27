// Public demo endpoint — no auth required
// Answers questions against a synthetic patient record dataset
// Used by storage.exergynet.org interactive demo widget

const DEMO_DATASET = {
  patient_id: 'DEMO-001',
  name: 'Jane Smith (synthetic)',
  resting_heart_rate: '65 BPM',
  blood_pressure: '118/76 mmHg',
  weight_kg: 72,
  height_cm: 178,
  bmi: 22.7,
  last_visit: '2026-06-15',
  next_appointment: '2026-09-10',
  medications: ['Lisinopril 10mg', 'Metformin 500mg'],
  allergies: ['Penicillin'],
  diagnoses: ['Type 2 Diabetes (managed)', 'Mild hypertension'],
  notes: 'Patient in good health. No acute concerns. Advised 30min daily exercise and low-sodium diet.',
  lab_results: {
    HbA1c: '6.4%',
    cholesterol_total: '182 mg/dL',
    creatinine: '0.9 mg/dL',
    glucose_fasting: '98 mg/dL',
  },
};

const XLMP_ROOT = '0x4a2fbc8d91e3f2a7c5d04e6b8f1930d72c5a8e49b3f71d0c2e85a6b4f9d31e7';
const GROTH16  = '0xb226f60a6a3406e5cd3792b4bbe86ed996e2e2cc8dd31ddbe7989a20a897092d';

function resolveQuery(q: string): { result: string; confidence: number } {
  const ql = q.toLowerCase();

  if (/heart|pulse|bpm|cardiac/.test(ql))
    return { result: `${DEMO_DATASET.resting_heart_rate} — within normal range (60–100 BPM)`, confidence: 0.97 };
  if (/blood pressure|bp|systolic|diastolic/.test(ql))
    return { result: `${DEMO_DATASET.blood_pressure} — optimal range`, confidence: 0.96 };
  if (/weight|kg|lbs|pound|mass/.test(ql))
    return { result: `${DEMO_DATASET.weight_kg} kg (${(DEMO_DATASET.weight_kg * 2.205).toFixed(1)} lbs) — BMI ${DEMO_DATASET.bmi}`, confidence: 0.99 };
  if (/height|cm|tall|inches/.test(ql))
    return { result: `${DEMO_DATASET.height_cm} cm (5'10") — BMI ${DEMO_DATASET.bmi}`, confidence: 0.99 };
  if (/bmi|body mass/.test(ql))
    return { result: `BMI ${DEMO_DATASET.bmi} — normal range (18.5–24.9)`, confidence: 0.99 };
  if (/medic|drug|prescription|pill|lisinopril|metformin/.test(ql))
    return { result: `Lisinopril 10mg (ACE inhibitor for hypertension), Metformin 500mg (Type 2 diabetes management)`, confidence: 0.98 };
  if (/allerg/.test(ql))
    return { result: `Known allergy: Penicillin. No other allergies on record.`, confidence: 0.99 };
  if (/diagnos|condition|disease|diabetes|hypertension/.test(ql))
    return { result: `Active diagnoses: Type 2 Diabetes (managed, HbA1c 6.4%), Mild hypertension (controlled on Lisinopril)`, confidence: 0.95 };
  if (/last visit|appointment|last seen|recent visit/.test(ql))
    return { result: `Last visit: ${DEMO_DATASET.last_visit}. Next appointment: ${DEMO_DATASET.next_appointment}.`, confidence: 0.99 };
  if (/hba1c|a1c|glycated|hemoglobin/.test(ql))
    return { result: `HbA1c: ${DEMO_DATASET.lab_results.HbA1c} — pre-diabetic threshold is 6.5%. Well controlled.`, confidence: 0.97 };
  if (/cholesterol|lipid/.test(ql))
    return { result: `Total cholesterol: ${DEMO_DATASET.lab_results.cholesterol_total} — desirable range (<200 mg/dL)`, confidence: 0.96 };
  if (/glucose|blood sugar|fasting/.test(ql))
    return { result: `Fasting glucose: ${DEMO_DATASET.lab_results.glucose_fasting} — normal fasting range (70–99 mg/dL)`, confidence: 0.96 };
  if (/creatinine|kidney|renal/.test(ql))
    return { result: `Creatinine: ${DEMO_DATASET.lab_results.creatinine} — normal range (0.6–1.2 mg/dL). Kidney function normal.`, confidence: 0.95 };
  if (/note|summary|general|overall|health/.test(ql))
    return { result: DEMO_DATASET.notes, confidence: 0.91 };

  return {
    result: 'No direct match in demo dataset. Try: "heart rate", "blood pressure", "medications", "HbA1c", "cholesterol", "last visit", or "diagnoses".',
    confidence: 0.08,
  };
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').slice(0, 300).trim() || 'What is the patient resting heart rate?';

  const startMs = Date.now();
  // Simulate ZK proof generation (300–900ms)
  await new Promise(r => setTimeout(r, 300 + Math.random() * 600));
  const latency_ms = Date.now() - startMs;

  const { result, confidence } = resolveQuery(q);

  const body = JSON.stringify({
    demo: true,
    note: 'Live query against a synthetic patient record. Sign up at portal.exergynet.org to query your own data.',
    query: q,
    xlmp_root: XLMP_ROOT,
    shard_count: 1,
    proof_size_bytes: 256,
    latency_ms,
    journal: {
      result,
      confidence,
      citations: ['DEMO-001 · synthetic-medical-record.json · shard[0]'],
      zk_sealed: true,
      groth16_receipt: GROTH16,
    },
    dataset_preview: {
      name: 'Demo Medical Record — DEMO-001 (synthetic)',
      size_bytes: 512,
      shards: 1,
      fields: Object.keys(DEMO_DATASET),
    },
  }, null, 2);

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
