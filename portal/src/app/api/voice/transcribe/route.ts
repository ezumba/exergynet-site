import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const WHISPER_URL = process.env.WHISPER_URL ?? "http://127.0.0.1:5010/transcribe";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) return NextResponse.json({ error: "audio file required" }, { status: 400 });

    const upstream = new FormData();
    const buf = Buffer.from(await audio.arrayBuffer());

    const upRes = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/wav" },
      body: buf,
      signal: AbortSignal.timeout(30000),
    });

    if (!upRes.ok) {
      const err = await upRes.text();
      return NextResponse.json({ error: err || "Transcription failed" }, { status: 502 });
    }

    const result = await upRes.json();
    return NextResponse.json({
      text: result.text ?? "",
      duration: result.duration ?? null,
      language: result.language ?? "en",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
