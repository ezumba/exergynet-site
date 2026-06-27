'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  initxLMPDatabase,
  xLMP_Compress,
  xLMP_Rehydrate,
  xLMP_Obliterate,
  xLMP_ObliterateAll,
} from '@/lib/xlmp_storage';
import { compileAndPlayEDL, stopEDL, isEDLPlaying } from '@/lib/exergy_dsp';
import StepSequencer from '@/components/voice/StepSequencer';
import type { SeqTrack } from '@/components/voice/StepSequencer';
import type { ExergyDSPProtocol } from '@/types/edl';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Voice {
  id: string; name: string; description: string;
  tags: string[]; accent: string; gender: string;
}

// Clip stores NO audio URL — audio lives in IndexedDB keyed by id
interface Clip {
  id: string; text: string; voice: Voice;
  duration: number; chars: number; createdAt: string; model: string; format: string;
}

interface Transcript {
  id: string; name: string; text: string;
  duration: number | null; createdAt: string; language?: string;
}

// ── Voice catalog ──────────────────────────────────────────────────────────────

const VOICES: Voice[] = [
  { id: 'sovereign-meridian', name: 'Meridian', description: 'Deep, resonant, commanding.',     tags: ['Deep', 'Resonant'],     accent: 'American', gender: 'Male'        },
  { id: 'sovereign-atlas',    name: 'Atlas',    description: 'Authoritative broadcast voice.',   tags: ['Authoritative'],        accent: 'American', gender: 'Male'        },
  { id: 'sovereign-lyra',     name: 'Lyra',     description: 'Warm, intimate, conversational.',  tags: ['Warm', 'Soft'],         accent: 'British',  gender: 'Female'      },
  { id: 'sovereign-nova',     name: 'Nova',     description: 'Bright, expressive, energetic.',   tags: ['Expressive', 'Bright'], accent: 'American', gender: 'Female'      },
  { id: 'sovereign-cipher',   name: 'Cipher',   description: 'Neutral, clinical, precise.',      tags: ['Neutral', 'Clinical'],  accent: 'Neutral',  gender: 'Androgynous' },
  { id: 'sovereign-kael',     name: 'Kael',     description: 'Smooth, narrative, storytelling.', tags: ['Smooth', 'Narrative'],  accent: 'American', gender: 'Male'        },
];

const MODELS = [
  { id: 'lnes-16',    label: 'Exergy LNES-16 (Expressive)', desc: 'Highest quality · Slowest' },
  { id: 'lnes-16-hd', label: 'Exergy LNES-16 HD',           desc: 'Studio quality · Slower'   },
  { id: 'flash',      label: 'Exergy Flash',                 desc: 'Low latency · Fastest'     },
];

const MAX_CHARS    = 5000;
const LS_META_KEY  = 'en_voice_meta_v2'; // metadata only — no audio URLs

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function initials(name: string) { return name.slice(0, 2).toUpperCase(); }
function voiceColor(id: string) {
  const colors = ['var(--accent)', '#7C3AED', '#0284C7', '#D97706', '#DC2626', '#059669'];
  return colors[VOICES.findIndex(v => v.id === id) % colors.length] ?? 'var(--accent)';
}
function extFor(fmt: string) { return fmt === 'wav' ? 'wav' : 'mp3'; }

// ── Slider ────────────────────────────────────────────────────────────────────

function Slider({ label, value, onChange, left, right }: {
  label: string; value: number; onChange: (v: number) => void; left: string; right: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'monospace' }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{left}</span>
        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{right}</span>

      </div>
    </div>
  );
}

// ── VoicePicker modal ─────────────────────────────────────────────────────────

function VoicePicker({ selected, onSelect, onClose, customVoices = {}, communityVoices = [] }: {
  selected: Voice | null; onSelect: (v: Voice) => void; onClose: () => void;
  customVoices?: Record<string, any>; communityVoices?: any[];
}) {
  const [filter,      setFilter]      = useState('');
  const [previewId,   setPreviewId]   = useState<string | null>(null);
  const previewAudio  = useRef<HTMLAudioElement | null>(null);
  const previewTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = VOICES.filter(v =>
    !filter ||
    v.name.toLowerCase().includes(filter.toLowerCase()) ||
    v.tags.some(t => t.toLowerCase().includes(filter.toLowerCase())) ||
    v.gender.toLowerCase().includes(filter.toLowerCase())
  );
  const filteredCommunity = communityVoices.filter((v: any) =>
    !filter || (v.displayName || v.id).toLowerCase().includes(filter.toLowerCase())
  );

  const PREVIEW_TEXT = "Hello, this is how my voice sounds. Natural and clear.";

  const handlePreview = async (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    if (previewAudio.current) { previewAudio.current.pause(); previewAudio.current = null; }
    if (previewTimer.current) { clearTimeout(previewTimer.current); previewTimer.current = null; }
    if (previewId === voiceId) { setPreviewId(null); return; }
    setPreviewId(voiceId);
    try {
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: PREVIEW_TEXT, voice: voiceId }),
      });
      const data = await res.json();
      if (data.audioUrl || data.url) {
        const audio = new Audio(data.audioUrl || data.url);
        previewAudio.current = audio;
        audio.play().catch(() => {});
        previewTimer.current = setTimeout(() => {
          audio.pause(); audio.currentTime = 0; setPreviewId(null);
        }, 5000);
        audio.onended = () => setPreviewId(null);
      } else { setPreviewId(null); }
    } catch { setPreviewId(null); }
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 16, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-mid)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Select Voice</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
          </div>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search voices…"
            style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(v => {
            const active = selected?.id === v.id;
            const col    = voiceColor(v.id);
            return (
              <div key={v.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                <button onClick={() => { onSelect(v); onClose(); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: active ? 'rgba(13,148,136,0.10)' : 'var(--bg-surface)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border-mid)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: col + '22', color: col, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials(v.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{v.description}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {v.tags.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--border-mid)', color: 'var(--text-soft)' }}>{t}</span>)}
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--border-mid)', color: 'var(--text-soft)' }}>{v.accent}</span>
                    </div>
                  </div>
                  {active && <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>}
                </button>
                <button onClick={e => handlePreview(e, v.id)} title="Preview 5s"
                  style={{ width: 38, borderRadius: 10, border: `1px solid ${previewId === v.id ? 'var(--accent)' : 'var(--border-mid)'}`, background: previewId === v.id ? 'var(--accent-dim)' : 'var(--bg-surface)', color: previewId === v.id ? 'var(--accent)' : 'var(--text-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.15s' }}>
                  {previewId === v.id ? '⏹' : '▶'}
                </button>
              </div>
            );
          })}
          {filteredCommunity.length > 0 && (
            <>
              <div style={{ padding: '6px 4px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--blue)', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                🌐 Community Voices
              </div>
              {filteredCommunity.map((cv: any) => {
                const active = selected?.id === cv.id;
                const voice: Voice = { id: cv.id, name: cv.displayName, description: `${cv.pricePerUse} credits/use · ${cv.uses ?? 0} uses`, tags: ['Community'], accent: 'Custom', gender: 'Custom' };
                return (
                  <div key={cv.id} style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                    <button onClick={() => { onSelect(voice); onClose(); }}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: active ? 'rgba(91,156,246,0.12)' : 'rgba(91,156,246,0.04)', border: `1px solid ${active ? 'var(--blue)' : 'rgba(91,156,246,0.25)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(91,156,246,0.15)', color: 'var(--blue)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {cv.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>🌐 {cv.displayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Community voice · {cv.pricePerUse} credits per use</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(91,156,246,0.12)', color: 'var(--blue)' }}>Community</span>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--border-mid)', color: 'var(--text-soft)' }}>{cv.uses ?? 0} uses</span>
                        </div>
                      </div>
                      {active && <span style={{ color: 'var(--blue)', fontSize: 16 }}>✓</span>}
                    </button>
                    <button onClick={e => handlePreview(e, cv.id)} title="Preview 5s"
                      style={{ width: 38, borderRadius: 10, border: `1px solid ${previewId === cv.id ? 'var(--blue)' : 'rgba(91,156,246,0.25)'}`, background: previewId === cv.id ? 'rgba(91,156,246,0.15)' : 'rgba(91,156,246,0.04)', color: previewId === cv.id ? 'var(--blue)' : 'var(--text-faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 0.15s' }}>
                      {previewId === cv.id ? '⏹' : '▶'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── StoredAudioPlayer — lazy-loads audio from IndexedDB on first play ─────────
// FIX: always render <audio> so ref.current is never null on first play click.

function StoredAudioPlayer({ clipId, label }: { clipId: string; label: string }) {
  const ref     = useRef<HTMLAudioElement>(null);
  const blobRef = useRef<string | null>(null);
  const loaded  = useRef(false);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur,      setDur]      = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [dead,     setDead]     = useState(false);

  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  const ensureLoaded = async (): Promise<boolean> => {
    if (loaded.current) return true;
    setLoading(true);
    try {
      const dataUrl = await xLMP_Rehydrate(clipId);
      if (!dataUrl) { setDead(true); setLoading(false); return false; }
      const blob   = await fetch(dataUrl).then(r => r.blob());
      const objUrl = URL.createObjectURL(blob);
      blobRef.current = objUrl;
      if (ref.current) {
        ref.current.src = objUrl;
        ref.current.load();
      }
      loaded.current = true;
      setLoading(false);
      return true;
    } catch {
      setDead(true); setLoading(false); return false;
    }
  };

  const toggle = async () => {
    const el = ref.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); return; }
    const ok = await ensureLoaded();
    if (!ok || !ref.current) return;
    try {
      await ref.current.play();
      setPlaying(true);
    } catch {
      setDead(true);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !loaded.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    ref.current.currentTime = ((e.clientX - rect.left) / rect.width) * (ref.current.duration || 0);
  };

  if (dead) return <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Audio unavailable — regenerate</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* Always rendered so ref.current is available on first click */}
      <audio ref={ref}
        onTimeUpdate={() => { if (ref.current) setProgress(ref.current.currentTime / (ref.current.duration || 1)); }}
        onLoadedMetadata={() => { if (ref.current) setDur(ref.current.duration); }}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle}
        style={{ width: 32, height: 32, borderRadius: '50%', background: loading ? 'var(--border-mid)' : 'var(--accent)', border: 'none', color: '#fff', cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
        {loading ? '…' : playing ? '❚❚' : '▶'}
      </button>
      <div style={{ flex: 1, height: 3, background: 'var(--border-mid)', borderRadius: 2, cursor: 'pointer' }} onClick={seek}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 2, transition: 'width 0.1s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace', flexShrink: 0 }}>
        {dur ? fmt(dur) : label}
      </span>
    </div>
  );
}

// ── PulseRing ─────────────────────────────────────────────────────────────────

function PulseRing() {
  return (
    <>
      <style>{`
        @keyframes pulseRing { 0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.7);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--accent)', animation: 'pulseRing 1.2s ease-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--accent)', animation: 'pulseRing 1.2s ease-out infinite 0.4s' }} />
    </>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 99999, background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 20px', fontSize: 13, color: 'var(--text)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
      {msg}
    </div>
  );
}

// ── Clip action row ───────────────────────────────────────────────────────────

function ClipActions({ clip, onDelete, onToast }: {
  clip: Clip;
  onDelete: (id: string) => void;
  onToast: (msg: string) => void;
}) {
  const download = async () => {
    const dataUrl = await xLMP_Rehydrate(clip.id);
    if (!dataUrl) { onToast('Audio not found — regenerate this clip.'); return; }
    const blob   = await fetch(dataUrl).then(r => r.blob());
    const objUrl = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = objUrl;
    a.download   = `exergynet-${clip.voice.name.toLowerCase()}-${clip.id.slice(-6)}.${extFor(clip.format)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        const dataUrl = await xLMP_Rehydrate(clip.id);
        if (dataUrl) {
          const blob = await fetch(dataUrl).then(r => r.blob());
          const ext  = extFor(clip.format);
          const file = new File([blob], `exergynet-${clip.voice.name.toLowerCase()}.${ext}`, { type: blob.type });
          await navigator.share({ files: [file], title: `${clip.voice.name} — ExergyNet Voice`, text: clip.text.slice(0, 100) });
          return;
        }
      } catch {}
    }
    // Fallback: copy transcript to clipboard
    try {
      await navigator.clipboard.writeText(clip.text);
      onToast('Transcript copied to clipboard');
    } catch {
      onToast('Share not supported on this browser — use Download');
    }
  };

  const del = async () => {
    await xLMP_Obliterate(clip.id);
    onDelete(clip.id);
  };

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={download} title="Download audio"
        style={{ fontSize: 12, color: 'var(--accent)', border: '1px solid rgba(13,148,136,0.35)', borderRadius: 6, padding: '4px 10px', background: 'none', cursor: 'pointer' }}>
        ↓ Save
      </button>
      <button onClick={share} title="Share"
        style={{ fontSize: 12, color: 'var(--text-soft)', border: '1px solid var(--border-mid)', borderRadius: 6, padding: '4px 10px', background: 'none', cursor: 'pointer' }}>
        ↗ Share
      </button>
      <button onClick={del} title="Delete"
        style={{ fontSize: 12, color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '4px 10px', background: 'none', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  );
}

// ── StepSequencer helpers ─────────────────────────────────────────────────────

function scriptToSeqTracks(script: ExergyDSPProtocol): SeqTrack[] {
  return script.tracks.map(track => {
    const steps = new Array<boolean>(16).fill(false);
    for (const note of track.notes) {
      if (!note.time) continue;
      const parts = note.time.split(':').map(Number);
      if ((parts[0] ?? 0) !== 0) continue; // first bar only
      const step = (parts[1] ?? 0) * 4 + (parts[2] ?? 0);
      if (step >= 0 && step < 16) steps[step] = true;
    }
    const inst = track.drumType ?? track.instrument ?? track.synth ?? track.type ?? 'synth';
    return { name: track.name, instrument: String(inst), steps };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VoiceStudio() {
  const [tab, setTab] = useState<'tts' | 'stt' | 'music' | 'history' | 'forge'>('tts');
  // Music engine state
  const [musicPrompt,    setMusicPrompt]    = useState('');
  const [musicScript,    setMusicScript]    = useState<ExergyDSPProtocol | null>(null);
  const [musicGenerating, setMusicGenerating] = useState(false);
  const [musicPlaying,   setMusicPlaying]   = useState(false);
  const [musicError,     setMusicError]     = useState('');
  const [seqTracks,      setSeqTracks]      = useState<SeqTrack[]>([]);
  const [currentStep,    setCurrentStep]    = useState(-1);
  const stepTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [forgeRecording, setForgeRecording] = useState(false);
  const [forgeSeconds, setForgeSeconds]   = useState(0);
  const forgeMediaRef = useRef<MediaRecorder | null>(null);
  const forgeChunksRef = useRef<Blob[]>([]);
  const forgeTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // TTS
  const [text,         setText]         = useState('');
  const [voice,        setVoice]        = useState<Voice | null>(null);
  const [model,        setModel]        = useState('lnes-16');
  const [stability,    setStability]    = useState(50);
  const [similarity,   setSimilarity]   = useState(75);
  const [styleEx,      setStyleEx]      = useState(0);
  const [format,       setFormat]       = useState<'mp3_44100' | 'mp3_44100_192' | 'wav'>('mp3_44100');
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [ttsError,     setTtsError]     = useState('');
  const [showPicker,   setShowPicker]   = useState(false);
  const [credits,      setCredits]      = useState(10000);
  const [clips,        setClips]        = useState<Clip[]>([]);
  const [metaLoaded,   setMetaLoaded]   = useState(false);
  const [toast,        setToast]        = useState('');

  // STT
  const [transcribing, setTranscribing] = useState(false);
  const [sttError,     setSttError]     = useState('');
  const [transcripts,  setTranscripts]  = useState<Transcript[]>([]);
  const [dragOver,     setDragOver]     = useState(false);
  const fileRef               = useRef<HTMLInputElement>(null);
  const [recording,    setRecording]    = useState(false);
  const [recSeconds,   setRecSeconds]   = useState(0);
  const mediaRecRef           = useRef<MediaRecorder | null>(null);
  const chunksRef             = useRef<Blob[]>([]);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Init IndexedDB (warm up connection)
    initxLMPDatabase().catch(() => {});

    // Purge old v1 history that stored full base64 URLs in localStorage
    try { localStorage.removeItem('exergynet_voice_history'); } catch {}

    // Load metadata (v2 — no audio URLs)
    try {
      const raw = localStorage.getItem(LS_META_KEY);
      if (raw) setClips(JSON.parse(raw));
    } catch {
      localStorage.removeItem(LS_META_KEY);
    }
    setMetaLoaded(true);
  }, []);

  // Persist metadata only (never audio URLs)
  useEffect(() => {
    if (!metaLoaded) return;
    try {
      localStorage.setItem(LS_META_KEY, JSON.stringify(clips));
    } catch {
      // Metadata itself overflowed — trim to 30 most recent
      try { localStorage.setItem(LS_META_KEY, JSON.stringify(clips.slice(0, 30))); } catch {}
    }
  }, [clips, metaLoaded]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── TTS generate ────────────────────────────────────────────────────────────

  const generate = async () => {
    if (!text.trim())            { setTtsError('Enter some text first.');              return; }
    if (!voice)                  { setTtsError('Select a voice →');                   return; }
    if (text.length > MAX_CHARS) { setTtsError(`Max ${MAX_CHARS.toLocaleString()} chars.`); return; }
    setTtsError(''); setGenerating(true);
    try {
      const res  = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: voice.id, model, settings: { stability, similarity, styleExaggeration: styleEx, outputFormat: format, speakerBoost } }),
      });
      const data = await res.json();
      if (!res.ok) { setTtsError(data.error || 'Generation failed'); return; }

      const clipId = data.id || `lmp-${Date.now()}`;
      const rawUrl = data.url || data.audioUrl || '';

      // Sink heavy audio payload to IndexedDB cold sump
      if (rawUrl) await xLMP_Compress(clipId, rawUrl);

      const clip: Clip = {
        id:        clipId,
        text,
        voice,
        duration:  data.duration ?? Math.ceil(text.length / 15),
        chars:     text.length,
        createdAt: data.createdAt || new Date().toISOString(),
        model,
        format,
      };

      setClips(c => [clip, ...c]);
      if (data.credits_remaining !== undefined) {
        setCredits(data.credits_remaining);
      } else {
        setCredits(m => Math.max(0, m - (data.cost ?? text.length)));
      }
      if (data.creator_credited) {
        console.log(`[Marketplace] Creator received ${data.creator_credited} credits`);
      }
    } catch (e: unknown) {
      setTtsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  // ── Clip operations ─────────────────────────────────────────────────────────

  const deleteClip = (id: string) => setClips(c => c.filter(x => x.id !== id));

  const clearAll = async () => {
    await xLMP_ObliterateAll();
    setClips([]);
    localStorage.removeItem(LS_META_KEY);
    setToast('All generations cleared');
  };

  // ── STT transcribe (FIXED: field key 'file' matches route.ts formData.get('file')) ──

  const transcribe = useCallback(async (file: File) => {
    setSttError(''); setTranscribing(true);
    try {
      if (file.size > 25 * 1024 * 1024) {
        setSttError('File exceeds 25 MB limit.'); return;
      }
      const fd = new FormData();
      fd.append('file', file); // NOTE: route.ts reads formData.get('file')
      const res  = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setSttError(data.error || 'Transcription failed'); return; }
      setTranscripts(t => [{
        id:        crypto.randomUUID(),
        name:      file.name,
        text:      data.text,
        duration:  data.duration ?? null,
        language:  data.language,
        createdAt: new Date().toISOString(),
      }, ...t]);
    } catch (e: unknown) {
      setSttError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setTranscribing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) transcribe(f);
  }, [transcribe]);

  const startRecording = async () => {
    setSttError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        transcribe(new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' }));
      };
      mr.start(100);
      mediaRecRef.current = mr;
      setRecording(true); setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      setSttError('Microphone access denied. Allow mic access and try again.');
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    mediaRecRef.current = null;
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────

  const S = {
    root:    { display: 'flex', flexDirection: 'column' as const, height: 'calc(100vh - 48px)', background: 'var(--bg)', overflow: 'hidden' },
    header:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid var(--border-mid)', flexShrink: 0 as const, height: 52, background: 'var(--bg)' },
    body:    { display: 'flex', flex: 1, overflow: 'hidden' },
    main:    { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', borderRight: '1px solid var(--border-mid)' },
    sidebar: { width: 300, flexShrink: 0 as const, display: 'flex', flexDirection: 'column' as const, overflowY: 'auto' as const, padding: '20px', gap: 20, background: 'var(--bg)' },
    tab:     (a: boolean): React.CSSProperties => ({ padding: '0 18px', height: 52, display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none', background: 'none', color: a ? 'var(--text)' : 'var(--text-faint)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', transition: 'color 0.15s' }),
    label:   { fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', color: 'var(--text-faint)', textTransform: 'uppercase' as const, marginBottom: 8 },
    select:  { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' },
    genBtn:  (d: boolean): React.CSSProperties => ({ background: d ? 'var(--border-mid)' : 'var(--accent)', color: d ? 'var(--text-faint)' : '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: d ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }),
    voiceBtn:(a: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', width: '100%', background: a ? 'rgba(13,148,136,0.08)' : 'var(--bg-surface)', border: `1px solid ${a ? 'var(--accent)' : 'var(--border-mid)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left' as const }),
    textarea:{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none' as const, fontSize: 16, lineHeight: 1.8, color: 'var(--text)', padding: '28px 32px', fontFamily: 'inherit' },
  };

  const nearLimit = text.length > MAX_CHARS * 0.9;

  return (
    <div style={S.root}>
      {showPicker && <VoicePicker selected={voice} onSelect={setVoice} onClose={() => setShowPicker(false)} />}
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* ── Header / Tabs ── */}
      <div style={S.header}>
        <div style={{ display: 'flex' }}>
          <button style={S.tab(tab === 'tts')}     onClick={() => setTab('tts')}>◎ Text to Speech</button>
          <button style={S.tab(tab === 'stt')}     onClick={() => setTab('stt')}>◈ Speech to Text</button>
          <button style={S.tab(tab === 'music')}   onClick={() => setTab('music')}>♫ Music</button>
          <button style={S.tab(tab === 'history')} onClick={() => setTab('history')}>
            ≡ History{clips.length > 0 ? ` (${clips.length})` : ''}
          </button>
          <button style={S.tab(tab === 'forge')} onClick={() => setTab('forge')}>⬡ Voice Forge</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>⚡</span>
          <span style={{ fontSize: 12, color: 'var(--text-soft)', fontFamily: 'monospace' }}>{credits.toLocaleString()} credits</span>
          <button style={{ fontSize: 11, color: 'var(--text-faint)', background: 'none', border: '1px solid var(--border-mid)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Top up</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* ════════ TTS ════════ */}
        {tab === 'tts' && (
          <>
            <div style={S.main}>
              <textarea
                value={text}
                onChange={e => { if (e.target.value.length <= MAX_CHARS) setText(e.target.value); }}
                placeholder="Start typing or paste your script here…"
                style={S.textarea}
                spellCheck
              />

              {/* Inline generations panel — scrollable, all clips */}
              {clips.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-mid)', flexShrink: 0, maxHeight: 280, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px 8px' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Generations ({clips.length})
                    </span>
                    <button onClick={() => setTab('history')} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Manage all →
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 28px 16px' }}>
                    {clips.slice(0, 6).map(clip => (
                      <div key={clip.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                            {clip.voice.name} · {clip.chars.toLocaleString()} chars · {clip.model}
                          </span>
                          <ClipActions clip={clip} onDelete={deleteClip} onToast={setToast} />
                        </div>
                        {(clip as any).edlScript ? (
                  <button
                    onClick={async () => {
                      await compileAndPlayEDL((clip as any).edlScript);
                      setToast(`Playing: ${(clip as any).edlScript.title}`);
                    }}
                    style={{ fontSize: 12, color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 7, padding: '6px 14px', background: 'none', cursor: 'pointer', fontFamily: 'monospace' }}>
                    ▶ PLAY DSP SCRIPT
                  </button>
                ) : (
                  <StoredAudioPlayer clipId={clip.id} label={`~${clip.duration}s`} />
                )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom bar */}
              <div style={{ borderTop: '1px solid var(--border-mid)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, background: 'var(--bg)' }}>
                <button onClick={generate} disabled={generating || !text.trim() || !voice} style={S.genBtn(generating || !text.trim() || !voice)}>
                  {generating
                    ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Generating…</>
                    : '▶ Generate speech'}
                </button>
                {ttsError && <span style={{ fontSize: 12, color: '#ef4444' }}>⚠ {ttsError}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'monospace', color: nearLimit ? '#f59e0b' : 'var(--text-faint)' }}>
                  {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} · ⚡ {text.length}
                </span>
              </div>
            </div>

            {/* Sidebar */}
            <div style={S.sidebar}>
              <div>
                <div style={S.label}>Voice</div>
                <button onClick={() => setShowPicker(true)} style={S.voiceBtn(!!voice)}>
                  {voice ? (
                    <>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: voiceColor(voice.id) + '22', color: voiceColor(voice.id), fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {initials(voice.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{voice.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{voice.accent} · {voice.gender}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border-mid)', color: 'var(--text-faint)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</div>
                      <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>Select a voice</span>
                    </>
                  )}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-faint)', fontSize: 12 }}>›</span>
                </button>
              </div>

              <div>
                <div style={S.label}>Model</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {MODELS.map(m => (
                    <button key={m.id} onClick={() => setModel(m.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: model === m.id ? 'rgba(13,148,136,0.08)' : 'var(--bg-surface)', border: `1px solid ${model === m.id ? 'var(--accent)' : 'var(--border-mid)'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left' as const, width: '100%' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: model === m.id ? 'var(--accent)' : 'var(--text-faint)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{m.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Slider label="Stability"          value={stability}  onChange={setStability}  left="More variable"  right="More stable"   />
                <Slider label="Similarity"          value={similarity} onChange={setSimilarity} left="Low"            right="High"          />
                <Slider label="Style Exaggeration"  value={styleEx}    onChange={setStyleEx}    left="None"           right="Exaggerated"   />
              </div>

              <div>
                <div style={S.label}>Output Format</div>
                <select value={format} onChange={e => setFormat(e.target.value as typeof format)} style={S.select}>
                  <option value="mp3_44100">MP3 44.1 kHz (128 kbps)</option>
                  <option value="mp3_44100_192">MP3 44.1 kHz (192 kbps)</option>
                  <option value="wav">WAV (Lossless)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>Speaker Boost</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>Enhance clarity</div>
                </div>
                <button onClick={() => setSpeakerBoost(b => !b)}
                  style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: speakerBoost ? 'var(--accent)' : 'var(--border-mid)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: speakerBoost ? 21 : 3, transition: 'left 0.2s' }} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ════════ STT ════════ */}
        {tab === 'stt' && (
          <>
            <div style={S.main}>
              <div style={{ padding: '28px 32px 0', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

                {/* ── Waveform bar ── */}
                <div style={{ width: '100%', maxWidth: 480, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginBottom: 20, opacity: recording ? 1 : 0, transition: 'opacity 0.3s' }}>
                  {waveAmps.map((h, i) => (
                    <div key={i} style={{ width: 5, height: h, borderRadius: 3, background: `hsl(${260 + i * 3}, 80%, ${55 + i % 3 * 5}%)`, transition: 'height 0.08s ease' }} />
                  ))}
                </div>

                {/* ── Mic button row ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                  <div style={{ position: 'relative', width: 80, height: 80 }}>
                    {recording && <PulseRing />}
                    <button onClick={recording ? stopRecording : startRecording}
                      style={{ width: 80, height: 80, borderRadius: '50%', background: recording ? '#DC2626' : 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? '0 0 0 4px rgba(220,38,38,0.2)' : '0 0 0 4px rgba(109,40,217,0.15)', transition: 'background 0.2s, box-shadow 0.2s', zIndex: 1, position: 'relative' }}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {recording ? (
                          <rect x="6" y="6" width="12" height="12" rx="2" fill="#fff" stroke="none" />
                        ) : (
                          <>
                            <rect x="9" y="2" width="6" height="13" rx="3" fill="#fff" stroke="none" />
                            <path d="M5 10a7 7 0 0 0 14 0" />
                            <line x1="12" y1="19" x2="12" y2="22" />
                            <line x1="8" y1="22" x2="16" y2="22" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  <div>
                    {recording ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', animation: 'pulse 1s infinite' }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', fontFamily: 'monospace' }}>{fmt(recSeconds)}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Tap mic to stop &amp; transcribe</div>
                      </div>
                    ) : transcribing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>⟳ Transcribing with Whisper…</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Sovereign ASR · no data leaves the network</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Tap to record</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>or drop a file below</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── LIVE transcript stream ── */}
                {recording && (
                  <div style={{ width: '100%', maxWidth: 480, minHeight: 52, padding: '10px 16px', background: 'rgba(109,40,217,0.06)', border: '1px solid rgba(109,40,217,0.2)', borderRadius: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.1em', fontFamily: 'monospace' }}>LIVE</div>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>SPEECH RECOGNITION</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text)', wordBreak: 'break-word' }}>
                      <span>{liveText}</span>
                      <span style={{ color: 'var(--text-soft)', fontStyle: 'italic' }}>{interimText}</span>
                      {!liveText && !interimText && <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Start speaking…</span>}
                    </p>
                  </div>
                )}

                {sttError && <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 8 }}>⚠ {sttError}</div>}
              </div>

              <div style={{ padding: '20px 32px', flexShrink: 0 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-mid)'}`, borderRadius: 12, padding: '20px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(13,148,136,0.04)' : 'var(--bg-surface)', transition: 'all 0.2s' }}>
                  <input ref={fileRef} type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) transcribe(e.target.files[0]); }} />
                  <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>
                    Drop audio / video or <span style={{ color: 'var(--accent)' }}>click to browse</span> · MP3 WAV M4A MP4 WebM
                  </div>
                </div>
              </div>

              {transcripts.length > 0 && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 28px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Transcriptions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {transcripts.map(t => (
                      <div key={t.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</span>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {t.duration != null && <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace' }}>{fmt(t.duration)}</span>}
                            <button onClick={() => navigator.clipboard.writeText(t.text).then(() => setToast('Copied!'))}
                              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Copy</button>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-soft)', lineHeight: 1.7, margin: 0 }}>{t.text}</p>
                        {t.language && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, display: 'block', fontFamily: 'monospace' }}>Detected: {t.language.toUpperCase()}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={S.sidebar}>
              <div>
                <div style={S.label}>Transcription Engine</div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Whisper ASR</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>Sovereign speech recognition · Runs on ExergyNet infrastructure · No data leaves the network</div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                    <span style={{ fontSize: 11, color: 'var(--accent)' }}>Engine online</span>
                  </div>
                </div>
              </div>
              <div>
                <div style={S.label}>Supported formats</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['MP3', 'WAV', 'M4A', 'MP4', 'WebM', 'OGG', 'FLAC'].map(f => (
                    <span key={f} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-soft)' }}>{f}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={S.label}>Language</div>
                <select style={S.select} defaultValue="en">
                  <option value="en">English (auto-detect)</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* ════════ MUSIC — LNES-16 NEUROSYMBOLIC DSP ════════ */}
        {tab === 'music' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Main panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Prompt area */}
              <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
                {/* Genre presets */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Quick Start</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      'Afrobeats 110 BPM, percussive bass, bright pluck melody',
                      'Lo-fi hip hop 85 BPM, warm pad chords, soft piano',
                      'Cyberpunk synthwave 130 BPM, pulsing bass, arpeggiated synth',
                      'Trap 140 BPM, deep 808 bass, hi-hat rolls',
                      'Ambient 70 BPM, lush pads, slow evolving texture',
                      'Jazz 100 BPM, walking bass, piano comping',
                    ].map(preset => (
                      <button key={preset}
                        onClick={() => setMusicPrompt(preset)}
                        style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border-mid)', background: musicPrompt === preset ? 'var(--accent)' : 'var(--bg-surface)', color: musicPrompt === preset ? '#fff' : 'var(--text-soft)', cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.15s' }}>
                        {preset.split(' ').slice(0,2).join(' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Semantic Intent</div>
                  <textarea
                    value={musicPrompt}
                    onChange={e => setMusicPrompt(e.target.value)}
                    placeholder="e.g. Cyberpunk driving synthwave, 120 BPM, escalating tension with a deep bassline..."
                    style={{ width: '100%', height: 100, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10, padding: '14px 16px', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.7, boxSizing: 'border-box' }}
                  />
                </div>

                {/* Now playing indicator */}
                {musicPlaying && musicScript && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(109,40,217,0.08)', border: '1px solid rgba(109,40,217,0.25)', borderRadius: 10 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#6D28D9', animation: 'pulse 1.2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>NOW PLAYING</span>
                    <span style={{ fontSize: 12, color: 'var(--text-soft)', marginLeft: 4 }}>{musicScript.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 'auto', fontFamily: 'monospace' }}>{musicScript.bpm} BPM</span>
                  </div>
                )}

                {/* Active track display */}
                {musicScript && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Active Tracks</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {musicScript.tracks.map((track, i) => (
                        <div key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', fontSize: 11, fontFamily: 'monospace' }}>
                          <span style={{ color: 'var(--accent)', marginRight: 6 }}>
                            {track.instrument === 'synth' ? '⊛' : track.instrument === 'bass' ? '⊕' : track.instrument === 'pad' ? '◈' : '◇'}
                          </span>
                          <span style={{ color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{track.instrument}</span>
                          <span style={{ color: 'var(--text-faint)', marginLeft: 6 }}>{track.sequence?.length ?? 0} notes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step Sequencer grid ── */}
                {seqTracks.length > 0 && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
                      Step Grid — {musicScript?.bpm} BPM
                    </div>
                    <StepSequencer
                      tracks={seqTracks}
                      currentStep={currentStep}
                      onToggle={(ti, si) => setSeqTracks(prev => prev.map((t, i) =>
                        i === ti ? { ...t, steps: t.steps.map((v, j) => j === si ? !v : v) } : t
                      ))}
                    />
                  </div>
                )}

                {/* Script preview (collapsible) */}
                {musicScript && (
                  <details style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10 }}>
                    <summary style={{ padding: '10px 14px', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>
                      EDL Script — {musicScript.title} · {musicScript.bpm} BPM · {musicScript.tracks.length} tracks
                    </summary>
                    <pre style={{ fontSize: 11, color: 'var(--text-soft)', margin: 0, padding: '0 14px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 200, overflowY: 'auto' }}>
                      {JSON.stringify(musicScript, null, 2)}
                    </pre>
                  </details>
                )}

                {musicError && (
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#ef4444', fontFamily: 'monospace' }}>
                    ⚠ {musicError}
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div style={{ borderTop: '1px solid var(--border-mid)', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--bg)' }}>
                <button
                  disabled={musicGenerating || !musicPrompt.trim()}
                  onClick={async () => {
                    setMusicError(''); setMusicGenerating(true); setMusicScript(null); setMusicPlaying(false);
                    try {
                      const res  = await fetch('/api/music/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: musicPrompt }) });
                      const data = await res.json();
                      if (!res.ok) { setMusicError(data.detail || data.error || 'Generation failed'); return; }
                      const script: ExergyDSPProtocol = data.script;
                      setMusicScript(script);
                      setSeqTracks(scriptToSeqTracks(script));
                      setCurrentStep(-1);
                      if (stepTickerRef.current) clearInterval(stepTickerRef.current);
                      await compileAndPlayEDL(script);
                      setMusicPlaying(true);
                      // Step ticker: 16th notes at script.bpm
                      const msPerStep = (60000 / script.bpm) / 4;
                      let step = 0;
                      stepTickerRef.current = setInterval(() => {
                        setCurrentStep(step % 16);
                        step++;
                      }, msPerStep);
                      const clipId = `EDL-${Date.now()}`;
                      setClips(prev => {
                        const entry = {
                          id: clipId, text: musicPrompt, voice: { id: 'lnes16-music', name: 'LNES-16 DSP', description: 'Neurosymbolic', tags: ['Music'], accent: 'N/A', gender: 'N/A' },
                          duration: 8, chars: musicPrompt.length, createdAt: new Date().toISOString(), model: 'lnes-16-music', format: 'edl',
                          edlScript: script,
                        } as any;
                        return [entry, ...prev];
                      });
                    } catch (e: unknown) { setMusicError(e instanceof Error ? e.message : 'Error'); }
                    finally { setMusicGenerating(false); }
                  }}
                  style={{ background: musicGenerating || !musicPrompt.trim() ? 'var(--border-mid)' : '#6D28D9', color: musicGenerating || !musicPrompt.trim() ? 'var(--text-faint)' : '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 600, cursor: musicGenerating || !musicPrompt.trim() ? 'not-allowed' : 'pointer', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                  {musicGenerating ? '⟳ GENERATING SCRIPT…' : '▶ GENERATE DSP SCRIPT'}
                </button>

                {musicScript && (
                  <button
                    onClick={async () => {
                      if (musicPlaying) {
                        stopEDL();
                        if (stepTickerRef.current) { clearInterval(stepTickerRef.current); stepTickerRef.current = null; }
                        setCurrentStep(-1);
                        setMusicPlaying(false);
                      } else if (musicScript) {
                        setCurrentStep(-1);
                        if (stepTickerRef.current) clearInterval(stepTickerRef.current);
                        await compileAndPlayEDL(musicScript);
                        setMusicPlaying(true);
                        const msPerStep = (60000 / musicScript.bpm) / 4;
                        let step = 0;
                        stepTickerRef.current = setInterval(() => { setCurrentStep(step % 16); step++; }, msPerStep);
                      }
                    }}
                    style={{ background: 'var(--bg-surface)', color: musicPlaying ? '#ef4444' : 'var(--accent)', border: `1px solid ${musicPlaying ? 'rgba(239,68,68,0.4)' : 'var(--border-mid)'}`, borderRadius: 10, padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
                    {musicPlaying ? '■ HALT ENGINE' : '▶ REPLAY'}
                  </button>
                )}

                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace' }}>
                  $0 VRAM · EDGE RENDER · TONE.JS
                </span>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ width: 260, flexShrink: 0, borderLeft: '1px solid var(--border-mid)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg)', overflowY: 'auto' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>Architecture</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'LLM', value: 'Qwen Coder 14B', ok: true },
                    { label: 'Engine', value: 'Tone.js / Web Audio', ok: true },
                    { label: 'Protocol', value: 'EDL v1.0 (JSON)', ok: true },
                    { label: 'VRAM cost', value: '$0 (edge render)', ok: true },
                    { label: 'Stems', value: 'LNES-16.5', ok: false },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--text-faint)' }}>{r.label}</span>
                      <span style={{ color: r.ok ? 'var(--text-soft)' : '#6B7280', fontFamily: 'monospace' }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>Instruments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['synth', 'bass', 'pad', 'pluck'].map(i => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', color: 'var(--text-soft)', fontFamily: 'monospace' }}>{i}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>Prompt tips</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {['Specify BPM (e.g. 120 BPM)', 'Name a genre or mood', 'Include key (e.g. in C minor)', 'Describe energy arc'].map(t => (
                    <div key={t} style={{ fontSize: 11, color: 'var(--text-faint)', paddingLeft: 12, borderLeft: '2px solid var(--border-mid)' }}>{t}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ HISTORY ════════ */}
        {tab === 'history' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
            {clips.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>◎</div>
                <div style={{ fontSize: 15, color: 'var(--text-soft)', marginBottom: 8 }}>No generations yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Generate speech on the TTS tab to see history here.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {clips.length} generation{clips.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={clearAll} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {clips.map(clip => {
                    const col = voiceColor(clip.voice.id);
                    return (
                      <div key={clip.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: col + '22', color: col, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {initials(clip.voice.name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{clip.voice.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                              {clip.model} · {clip.chars.toLocaleString()} chars · {new Date(clip.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <ClipActions clip={clip} onDelete={deleteClip} onToast={setToast} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 10, fontStyle: 'italic' }}>
                          "{clip.text.slice(0, 120)}{clip.text.length > 120 ? '…' : ''}"
                        </div>
                        <StoredAudioPlayer clipId={clip.id} label={`~${clip.duration}s`} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {/* ════════ VOICE FORGE (SOVEREIGN ECHO) ════════ */}
        {tab === 'forge' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: 6 }}>[ LNES-16.5 ]</div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 6 }}>SOVEREIGN ECHO</h2>
                <p style={{ fontSize: 13, color: 'var(--text-soft)', margin: 0 }}>Convert your biological acoustic signature into a cryptographic Voice Matrix.</p>
              </div>
              <span style={{ padding: '4px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-soft)', flexShrink: 0 }}>
                MARKET FORGE: ONLINE
              </span>
            </div>

            {/* Declaration + record */}
            <div style={{ border: '1px solid var(--border-mid)', borderRadius: 12, padding: '28px 32px', background: 'var(--bg-surface)', textAlign: 'center', marginBottom: 24 }}>
              <p style={{ fontSize: 14, color: 'var(--text-soft)', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 24, maxWidth: 560, margin: '0 auto 24px' }}>
                "I declare absolute sovereignty over my biological exergy. This acoustic matrix is mathematically bound to my cryptographic identity. I yield my voice to the mesh."
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {forgeRecording && <PulseRing />}
                  <button
                    onClick={() => {
                      if (forgeRecording) {
                        forgeMediaRef.current?.stop();
                        forgeMediaRef.current = null;
                        setForgeRecording(false);
                        if (forgeTimerRef.current) { clearInterval(forgeTimerRef.current); forgeTimerRef.current = null; }
                      } else {
                        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                          const mr = new MediaRecorder(stream);
                          forgeChunksRef.current = [];
                          mr.ondataavailable = e => { if (e.data.size > 0) forgeChunksRef.current.push(e.data); };
                          mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); setToast('Capture complete — Voice Matrix pending Piper fine-tune.'); };
                          mr.start(100);
                          forgeMediaRef.current = mr;
                          setForgeRecording(true);
                          setForgeSeconds(0);
                          forgeTimerRef.current = setInterval(() => setForgeSeconds(s => s + 1), 1000);
                        }).catch(() => setToast('Microphone access denied.'));
                      }
                    }}
                    style={{ width: 80, height: 80, borderRadius: '50%', background: forgeRecording ? '#7C3AED' : 'rgba(124,58,237,0.15)', border: `2px solid ${forgeRecording ? '#7C3AED' : 'rgba(124,58,237,0.4)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, zIndex: 1, position: 'relative', transition: 'all 0.2s' }}>
                    {forgeRecording ? '■' : '●'}
                  </button>
                </div>
                <div style={{ fontSize: 13, fontFamily: 'monospace', color: forgeRecording ? '#A78BFA' : 'var(--text-soft)', fontWeight: 600 }}>
                  {forgeRecording ? `RECORDING — ${fmt(forgeSeconds)}` : '● INITIATE BIOLOGICAL RECORDING'}
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: '18px 20px', border: '1px solid var(--border-dim)', borderRadius: 10, background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.08em', marginBottom: 8 }}>1. CAPTURE</div>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                  Read the sovereign declaration aloud. The system captures your vocal resonances (F0 contour and spectral envelope) directly into a local Blob buffer.
                </p>
              </div>
              <div style={{ padding: '18px 20px', border: '1px solid var(--border-dim)', borderRadius: 10, background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.08em', marginBottom: 8 }}>2. MONETIZE (MARKETPLACE)</div>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                  Mint your completed .ONNX voice model. Lock it for private use, or list it on the ExergyNet Spot Market to earn USDC royalties every time external agents use your voice.
                </p>
              </div>
              <div style={{ padding: '18px 20px', border: '1px solid var(--border-dim)', borderRadius: 10, background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.08em', marginBottom: 8 }}>3. STATUS</div>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                  Piper fine-tuning pipeline: <span style={{ color: '#F59E0B', fontFamily: 'monospace' }}>STAGING</span>. Voice Matrix minting and marketplace listing coming with LNES-16.5 release.
                </p>
              </div>
              <div style={{ padding: '18px 20px', border: '1px solid var(--border-dim)', borderRadius: 10, background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-soft)', letterSpacing: '0.08em', marginBottom: 8 }}>4. PRIVACY</div>
                <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0, lineHeight: 1.6 }}>
                  Raw audio never leaves your device until you explicitly mint. The local Blob buffer is destroyed on session end. Only the final .ONNX matrix is transmitted.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button disabled style={{ padding: '12px 32px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-faint)', cursor: 'not-allowed', letterSpacing: '0.06em' }}>
                MINT VOICE MATRIX — COMING LNES-16.5
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
