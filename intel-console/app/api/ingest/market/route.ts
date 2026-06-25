import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facts, seriesPoints } from "@/lib/schema";

export async function POST(req: Request) {
  const { entityId, symbol, metric } = await req.json();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: { "User-Agent": "ExergyNet-Intel/1.0" } }
    );
    const data   = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No data for " + symbol);

    const value = metric === "price"
      ? result.meta.regularMarketPrice
      : result.meta.regularMarketVolume;

    await db.insert(facts).values({
      entityId, metric,
      value:      String(value),
      sources:    [`yahoo:${symbol}`],
      confidence: "HIGH",
      costUsdc:   "0",
    });
    await db.insert(seriesPoints).values({
      entityId, metric,
      t:     new Date(),
      value: String(value),
    });
    return NextResponse.json({ ok: true, value, symbol });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
