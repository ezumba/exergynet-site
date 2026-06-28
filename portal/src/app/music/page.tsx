'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Drop {
  id: string;
  artist: string;
  title: string;
  genre: string;
  description: string;
  audio_url: string;
  video_url: string | null;
  cover_url: string | null;
  plays: number;
  likes: number;
  spaces_ready: boolean;
  published_at: string;
  source: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const GENRES = ['All', 'Hip-Hop', 'R&B', 'Afrobeats', 'Pop', 'Trap', 'Electronic', 'Soul', 'Jazz', 'Other'];

const ACCENT = '#0D9488';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MusicDropsPage() {
  return <Suspense><MusicDropsInner /></Suspense>;
}

function MusicDropsInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [drops, setDrops]           = useState<Drop[]>([]);
  const [genre, setGenre]           = useState('All');
  const [loading, setLoading]       = useState(true);
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const [videoId, setVideoId]       = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(searchParams.get('publish') === '1');

  // publish form state
  const [pTitle, setPTitle]         = useState('');
  const [pArtist, setPArtist]       = useState('');
  const [pGenre, setPGenre]         = useState('Hip-Hop');
  const [pDesc, setPDesc]           = useState('');
  const [pAudio, setPAudio]         = useState<File | null>(null);
  const [pVideo, setPVideo]         = useState<File | null>(null);
  const [pCover, setPCover]         = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError]     = useState('');
  const [pubSuccess, setPubSuccess] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Fetch drops ─────────────────────────────────────────────────────────────
  const fetchDrops = useCallback(async (g: string) => {
    setLoading(true);
    const q = g === 'All' ? '' : `?genre=${encodeURIComponent(g)}`;
    const res = await fetch(`/api/music/drops${q}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({ drops: [] }));
    setDrops(data.drops ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDrops(genre); }, [genre, fetchDrops]);

  // ── Play / pause ─────────────────────────────────────────────────────────────
  const handlePlay = useCallback(async (drop: Drop) => {
    if (playingId === drop.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    const audio = new Audio(drop.audio_url);
    audioRef.current = audio;
    audio.volume = 0.85;
    audio.onended = () => setPlayingId(null);
    await audio.play().catch(() => {});
    setPlayingId(drop.id);
    // increment play count
    fetch(`/api/music/drops/${drop.id}/play`, { method: 'POST' }).catch(() => {});
  }, [playingId]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ── Publish ──────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!session) { router.push('/'); return; }
    setPubError(''); setPubSuccess('');
    if (!pTitle.trim())  return setPubError('Title required');
    if (!pAudio)         return setPubError('Audio file required');

    setPublishing(true);
    const form = new FormData();
    form.append('title', pTitle.trim());
    form.append('artist', pArtist.trim() || session.user?.name || 'Artist');
    form.append('genre', pGenre);
    form.append('description', pDesc.trim());
    form.append('audio', pAudio, pAudio.name);
    if (pVideo) form.append('video', pVideo, pVideo.name);
    if (pCover) form.append('cover', pCover, pCover.name);

    const res = await fetch('/api/music/drops', { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    setPublishing(false);

    if (!res.ok) { setPubError(data.error ?? 'Publish failed'); return; }
    setPubSuccess('Your drop is live!');
    setPTitle(''); setPArtist(''); setPDesc('');
    setPAudio(null); setPVideo(null); setPCover(null);
    setTimeout(() => { setPublishOpen(false); setPubSuccess(''); fetchDrops(genre); }, 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #070E1B; color: #F8FAFC; font-family: 'Inter', sans-serif; }

        .drops-page { min-height: 100vh; background: #070E1B; }

        /* Hero */
        .hero {
          position: relative; overflow: hidden;
          padding: 72px 24px 60px;
          text-align: center;
          background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(13,148,136,0.18) 0%, transparent 70%);
          border-bottom: 1px solid rgba(13,148,136,0.12);
        }
        .hero h1 {
          font-size: clamp(2.4rem, 6vw, 4.5rem);
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.05;
          background: linear-gradient(135deg, #F8FAFC 30%, ${ACCENT} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero p {
          margin-top: 14px;
          font-size: 1.05rem;
          color: #94A3B8;
          max-width: 480px;
          margin-left: auto; margin-right: auto;
          line-height: 1.6;
        }
        .hero-btns { display: flex; gap: 12px; justify-content: center; margin-top: 28px; flex-wrap: wrap; }
        .btn-primary {
          padding: 11px 28px; border-radius: 8px; border: none; cursor: pointer;
          background: ${ACCENT}; color: #fff;
          font-weight: 700; font-size: 0.9rem; letter-spacing: 0.01em;
          transition: opacity 0.15s, transform 0.1s;
        }
        .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-outline {
          padding: 11px 28px; border-radius: 8px; cursor: pointer;
          border: 1px solid rgba(13,148,136,0.4);
          background: transparent; color: ${ACCENT};
          font-weight: 600; font-size: 0.9rem;
          transition: background 0.15s;
        }
        .btn-outline:hover { background: rgba(13,148,136,0.08); }

        /* Genre tabs */
        .genre-bar {
          display: flex; gap: 8px; padding: 20px 24px 0;
          overflow-x: auto; scrollbar-width: none;
          border-bottom: 1px solid #1E293B;
          padding-bottom: 0;
        }
        .genre-bar::-webkit-scrollbar { display: none; }
        .genre-tab {
          padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
          font-size: 0.82rem; font-weight: 600; white-space: nowrap;
          transition: all 0.15s;
          background: transparent; color: #64748B;
        }
        .genre-tab:hover { color: #CBD5E1; }
        .genre-tab.active {
          background: rgba(13,148,136,0.15);
          color: ${ACCENT};
          border: 1px solid rgba(13,148,136,0.3);
        }

        /* Grid */
        .drops-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Drop card */
        .drop-card {
          background: #0D1B2E;
          border: 1px solid #1E293B;
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
        }
        .drop-card:hover {
          border-color: rgba(13,148,136,0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .drop-cover {
          width: 100%; aspect-ratio: 1;
          background: linear-gradient(135deg, #0F2240 0%, #0a1a30 100%);
          position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .drop-cover img { width: 100%; height: 100%; object-fit: cover; }
        .drop-cover-placeholder {
          width: 64px; height: 64px; opacity: 0.25;
        }
        .play-btn {
          position: absolute;
          width: 52px; height: 52px; border-radius: 50%;
          background: ${ACCENT};
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
          transition: transform 0.15s, opacity 0.15s;
          box-shadow: 0 4px 20px rgba(13,148,136,0.5);
        }
        .play-btn:hover { transform: scale(1.1); }
        .has-video-badge {
          position: absolute; top: 10px; right: 10px;
          background: rgba(0,0,0,0.7); border-radius: 6px;
          padding: 3px 8px; font-size: 0.7rem; color: #fff; font-weight: 600;
        }
        .mobile-badge {
          position: absolute; bottom: 10px; left: 10px;
          background: rgba(13,148,136,0.85); border-radius: 6px;
          padding: 3px 8px; font-size: 0.68rem; color: #fff; font-weight: 700;
          letter-spacing: 0.04em;
        }
        .drop-info { padding: 14px 16px 16px; }
        .drop-title { font-weight: 700; font-size: 0.95rem; line-height: 1.3; color: #F1F5F9; }
        .drop-artist { font-size: 0.78rem; color: ${ACCENT}; margin-top: 3px; font-weight: 600; }
        .drop-genre {
          display: inline-block; margin-top: 6px;
          background: rgba(13,148,136,0.1); color: ${ACCENT};
          border: 1px solid rgba(13,148,136,0.2);
          border-radius: 4px; padding: 2px 7px; font-size: 0.7rem; font-weight: 600;
        }
        .drop-desc {
          margin-top: 8px; font-size: 0.78rem; color: #64748B; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .drop-meta {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 12px; padding-top: 10px; border-top: 1px solid #1E293B;
          font-size: 0.73rem; color: #475569;
        }
        .drop-meta-left { display: flex; gap: 12px; }
        .spaces-pill {
          display: flex; align-items: center; gap: 4px;
          background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25);
          border-radius: 20px; padding: 3px 8px;
          font-size: 0.68rem; font-weight: 700; color: #60A5FA; cursor: pointer;
          transition: background 0.15s;
        }
        .spaces-pill:hover { background: rgba(59,130,246,0.2); }

        /* Empty state */
        .empty { text-align: center; padding: 80px 24px; color: #475569; }
        .empty h3 { font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; color: #64748B; }

        /* Video modal */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.88);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .modal-video { width: 100%; max-width: 900px; border-radius: 12px; overflow: hidden; background: #000; }
        .modal-video video { width: 100%; display: block; }
        .modal-close {
          position: fixed; top: 20px; right: 24px;
          background: rgba(255,255,255,0.1); border: none; color: #fff;
          width: 40px; height: 40px; border-radius: 50%; font-size: 20px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }

        /* Publish modal */
        .modal-panel {
          background: #0D1B2E; border: 1px solid rgba(13,148,136,0.2);
          border-radius: 16px; padding: 32px;
          width: 100%; max-width: 540px;
          max-height: 90vh; overflow-y: auto;
        }
        .modal-panel h2 { font-size: 1.3rem; font-weight: 800; margin-bottom: 22px; }
        .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .field label { font-size: 0.78rem; font-weight: 600; color: #94A3B8; }
        .field input, .field textarea, .field select {
          background: #0A1220; border: 1px solid #253045; border-radius: 8px;
          color: #F8FAFC; padding: 10px 12px; font-size: 0.88rem;
          font-family: inherit; resize: vertical;
          transition: border-color 0.15s;
        }
        .field input:focus, .field textarea:focus, .field select:focus {
          outline: none; border-color: ${ACCENT};
        }
        .field-file {
          border: 1px dashed #253045; border-radius: 8px;
          padding: 18px; text-align: center; cursor: pointer;
          background: #0A1220; color: #64748B; font-size: 0.82rem;
          transition: border-color 0.15s;
        }
        .field-file:hover { border-color: ${ACCENT}; color: ${ACCENT}; }
        .field-file input { display: none; }
        .alert { padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 14px; }
        .alert-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #F87171; }
        .alert-success { background: rgba(13,148,136,0.1); border: 1px solid rgba(13,148,136,0.25); color: ${ACCENT}; }
        .pub-hint { font-size: 0.75rem; color: #475569; margin-bottom: 20px; line-height: 1.5; }
        .pub-hint strong { color: #60A5FA; }

        @media (max-width: 600px) {
          .drops-grid { grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
          .hero { padding: 48px 16px 40px; }
          .modal-panel { padding: 20px; }
        }
      `}</style>

      <div className="drops-page">
        {/* ── Hero ── */}
        <div className="hero">
          <h1>DROPS</h1>
          <p>Community music — published from the portal, the mobile app, and Spaces sessions.</p>
          <div className="hero-btns">
            <button className="btn-primary" onClick={() => {
              if (!session) { router.push('/'); return; }
              setPublishOpen(true);
            }}>
              + Publish a Drop
            </button>
            <button className="btn-outline" onClick={() => router.push('/dashboard/voice')}>
              Open Music Studio
            </button>
          </div>
        </div>

        {/* ── Genre bar ── */}
        <div className="genre-bar">
          {GENRES.map(g => (
            <button
              key={g}
              className={`genre-tab${genre === g ? ' active' : ''}`}
              onClick={() => setGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="empty">
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: ACCENT, opacity: 0.4,
                  animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite alternate`,
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse { to { opacity: 1; transform: scale(1.4); } }`}</style>
            <p style={{ fontSize: '0.85rem' }}>Loading drops…</p>
          </div>
        ) : drops.length === 0 ? (
          <div className="empty">
            <h3>No drops yet</h3>
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Be first — publish your track from the Music Studio or the mobile app.
            </p>
          </div>
        ) : (
          <div className="drops-grid">
            {drops.map(drop => (
              <DropCard
                key={drop.id}
                drop={drop}
                isPlaying={playingId === drop.id}
                onPlay={handlePlay}
                onVideo={() => setVideoId(drop.id)}
              />
            ))}
          </div>
        )}

        {/* ── Video modal ── */}
        {videoId && (() => {
          const drop = drops.find(d => d.id === videoId);
          if (!drop?.video_url) return null;
          return (
            <div className="modal-overlay" onClick={() => setVideoId(null)}>
              <button className="modal-close" onClick={() => setVideoId(null)}>✕</button>
              <div className="modal-video" onClick={e => e.stopPropagation()}>
                <video src={drop.video_url} controls autoPlay style={{ maxHeight: '80vh' }} />
              </div>
            </div>
          );
        })()}

        {/* ── Publish modal ── */}
        {publishOpen && (
          <div className="modal-overlay" onClick={() => setPublishOpen(false)}>
            <div className="modal-panel" onClick={e => e.stopPropagation()}>
              <h2>Publish a Drop</h2>

              <p className="pub-hint">
                Upload from the portal here, or use the <strong>ExergyNet mobile app</strong> to record and publish directly from your phone. When your portal and app accounts share the same email, drops appear on both.{' '}
                <strong>Mark &quot;Bring to Spaces&quot;</strong> to make your track available in live audio rooms.
              </p>

              {pubError  && <div className="alert alert-error">{pubError}</div>}
              {pubSuccess && <div className="alert alert-success">{pubSuccess}</div>}

              <div className="field">
                <label>TRACK TITLE *</label>
                <input value={pTitle} onChange={e => setPTitle(e.target.value)} placeholder="Your track name" maxLength={120} />
              </div>

              <div className="field">
                <label>ARTIST NAME</label>
                <input value={pArtist} onChange={e => setPArtist(e.target.value)} placeholder={session?.user?.name ?? 'Your stage name'} maxLength={80} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>GENRE</label>
                  <select value={pGenre} onChange={e => setPGenre(e.target.value)}>
                    {GENRES.filter(g => g !== 'All').map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>DESCRIPTION</label>
                <textarea value={pDesc} onChange={e => setPDesc(e.target.value)} rows={2} maxLength={500} placeholder="What's this track about?" />
              </div>

              <div className="field">
                <label>AUDIO FILE * (MP3 / WAV / WebM, max 30 MB)</label>
                <label className="field-file">
                  <input type="file" accept="audio/*" onChange={e => setPAudio(e.target.files?.[0] ?? null)} />
                  {pAudio ? `✓ ${pAudio.name}` : 'Click to upload audio'}
                </label>
              </div>

              <div className="field">
                <label>VIDEO CLIP (optional, max 200 MB)</label>
                <label className="field-file">
                  <input type="file" accept="video/*" onChange={e => setPVideo(e.target.files?.[0] ?? null)} />
                  {pVideo ? `✓ ${pVideo.name}` : 'Click to upload video'}
                </label>
              </div>

              <div className="field">
                <label>COVER ART (optional)</label>
                <label className="field-file">
                  <input type="file" accept="image/*" onChange={e => setPCover(e.target.files?.[0] ?? null)} />
                  {pCover ? `✓ ${pCover.name}` : 'Click to upload cover'}
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handlePublish} disabled={publishing}>
                  {publishing ? 'Publishing…' : 'Publish Drop'}
                </button>
                <button className="btn-outline" onClick={() => setPublishOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Drop Card ──────────────────────────────────────────────────────────────────
function DropCard({ drop, isPlaying, onPlay, onVideo }: {
  drop: Drop;
  isPlaying: boolean;
  onPlay: (drop: Drop) => void;
  onVideo: () => void;
}) {
  return (
    <div className="drop-card">
      <div className="drop-cover">
        {drop.cover_url
          ? <img src={drop.cover_url} alt={drop.title} />
          : <WaveformPlaceholder color={isPlaying ? '#0D9488' : '#1E3A5F'} />
        }
        <button className="play-btn" onClick={() => onPlay(drop)} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        {drop.video_url && (
          <button className="has-video-badge" onClick={onVideo}>📽 VIDEO</button>
        )}
        {drop.source === 'mobile' && (
          <span className="mobile-badge">📱 MOBILE</span>
        )}
      </div>

      <div className="drop-info">
        <div className="drop-title">{drop.title}</div>
        <div className="drop-artist">{drop.artist}</div>
        {drop.genre && <span className="drop-genre">{drop.genre}</span>}
        {drop.description && <p className="drop-desc">{drop.description}</p>}

        <div className="drop-meta">
          <div className="drop-meta-left">
            <span>▶ {drop.plays.toLocaleString()}</span>
            <span>♡ {drop.likes.toLocaleString()}</span>
            <span>{timeAgo(drop.published_at)}</span>
          </div>
          {drop.spaces_ready && (
            <span className="spaces-pill">🔊 Spaces</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Waveform Placeholder SVG ──────────────────────────────────────────────────
function WaveformPlaceholder({ color }: { color: string }) {
  const bars = [18, 32, 44, 28, 50, 38, 24, 46, 34, 22, 42, 30, 48, 20, 36];
  return (
    <svg viewBox="0 0 120 80" className="drop-cover-placeholder" style={{ width: 80, height: 80 }}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 8 + 2}
          y={(80 - h) / 2}
          width={5}
          height={h}
          rx={2.5}
          fill={color}
          opacity={0.6 + (i % 3) * 0.13}
        />
      ))}
    </svg>
  );
}
