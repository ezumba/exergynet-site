export interface SignalResult {
  value:      number;
  confidence: "HIGH" | "LOW" | "UNVERIFIED";
  params:     Record<string, unknown>;
}

export function zScore(points: number[], window = 20): SignalResult {
  if (points.length < window)
    return { value: 0, confidence: "UNVERIFIED", params: { window } };
  const slice = points.slice(-window);
  const mean  = slice.reduce((a, b) => a + b, 0) / slice.length;
  const std   = Math.sqrt(
    slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length
  );
  if (std === 0)
    return { value: 0, confidence: "UNVERIFIED", params: { window } };
  const z = (points[points.length - 1] - mean) / std;
  return {
    value: z,
    confidence: Math.abs(z) > 3 ? "HIGH" : Math.abs(z) > 1.5 ? "LOW" : "UNVERIFIED",
    params: { window, mean, std },
  };
}

export function spike(points: number[], threshold = 2.0): SignalResult {
  if (points.length < 2)
    return { value: 0, confidence: "UNVERIFIED", params: { threshold } };
  const prev  = points[points.length - 2];
  const curr  = points[points.length - 1];
  const ratio = prev !== 0 ? Math.abs((curr - prev) / prev) : 0;
  return {
    value: ratio,
    confidence: ratio > threshold ? "HIGH" : ratio > threshold / 2 ? "LOW" : "UNVERIFIED",
    params: { threshold, prev, curr },
  };
}

export function pctChange(points: number[], window = 1): SignalResult {
  if (points.length < window + 1)
    return { value: 0, confidence: "UNVERIFIED", params: { window } };
  const base = points[points.length - 1 - window];
  const curr = points[points.length - 1];
  const pct  = base !== 0 ? ((curr - base) / Math.abs(base)) * 100 : 0;
  return {
    value: pct,
    confidence: Math.abs(pct) > 10 ? "HIGH" : Math.abs(pct) > 3 ? "LOW" : "UNVERIFIED",
    params: { window, base, curr },
  };
}

export const OPERATORS: Record<string, (pts: number[], w?: number) => SignalResult> = {
  z_score:    zScore,
  spike,
  pct_change: pctChange,
};
