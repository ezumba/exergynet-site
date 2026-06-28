import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/apiAuth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const CUSTOM_DIR    = "/home/ubuntu/sovereign-tts/custom";
const PROFILES_FILE = "/home/ubuntu/sovereign-tts/custom_profiles.json";

function loadProfiles(): Record<string, any> {
  try { return JSON.parse(require("fs").readFileSync(PROFILES_FILE, "utf8")); }
  catch { return {}; }
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user.id ?? user.email;
  const { voiceId, displayName, pitchRatio, baseModel, recordings } = await req.json();

  if (!voiceId || !pitchRatio) {
    return NextResponse.json({ error: "voiceId and pitchRatio required" }, { status: 400 });
  }

  // Save recordings to disk for future fine-tuning
  if (recordings && Array.isArray(recordings)) {
    const userDir = join(CUSTOM_DIR, userId.replace(/[^a-zA-Z0-9]/g, "_"));
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });
    recordings.forEach((b64: string, i: number) => {
      const buf = Buffer.from(b64.replace(/^data:audio\/[^;]+;base64,/, ""), "base64");
      writeFileSync(join(userDir, `sample_${i}.webm`), buf);
    });
  }

  // Register via TTS server
  try {
    const r = await fetch("http://127.0.0.1:5011/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, displayName, pitchRatio, baseModel, userId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("TTS server registration failed");
    return NextResponse.json({ success: true, voiceId, displayName });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profiles = loadProfiles();
  return NextResponse.json({ voices: profiles });
}
