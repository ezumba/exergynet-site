'use client';
import React, { useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AudioTrackData {
  id: string;
  name: string;
  file: File;
  volume: number;     // dB, -20 to +6
  muted: boolean;
  loop: boolean;
  offsetBars: number; // delay before playback starts (bars)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  tracks: AudioTrackData[];
  onChange: (tracks: AudioTrackData[]) => void;
  bpm: number;
}

export default function AudioTracks({ tracks, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newTracks: AudioTrackData[] = Array.from(files).map(file => ({
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      file, volume: 0, muted: false, loop: false, offsetBars: 0,
    }));
    onChange([...tracks, ...newTracks]);
  };

  const update = (id: string, changes: Partial<AudioTrackData>) =>
    onChange(tracks.map(t => t.id === id ? { ...t, ...changes } : t));

  const remove = (id: string) => onChange(tracks.filter(t => t.id !== id));

  return (
    <div style={{ fontFamily: 'monospace' }}>
      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1px dashed var(--border-mid)', borderRadius: 8, padding: '14px 18px',
          textAlign: 'center', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 11,
          marginBottom: tracks.length ? 10 : 0, transition: 'border-color 0.15s',
        }}>
        + DROP AUDIO FILES HERE  ·  OR CLICK TO BROWSE  (MP3, WAV, OGG, M4A)
        <input ref={fileRef} type="file" multiple accept="audio/*" style={{ display: 'none' }}
          onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* Track list */}
      {tracks.map(track => (
        <div key={track.id} style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 12px', background: 'var(--bg)',
          border: `1px solid ${track.muted ? 'var(--border-dim)' : 'var(--border-mid)'}`,
          borderRadius: 7, marginBottom: 6, opacity: track.muted ? 0.55 : 1,
        }}>
          {/* Mute */}
          <button
            onClick={() => update(track.id, { muted: !track.muted })}
            title={track.muted ? 'Unmute' : 'Mute'}
            style={{ width: 22, height: 22, borderRadius: 3, border: `1px solid ${track.muted ? '#ef4444' : 'var(--border-mid)'}`, background: track.muted ? '#ef444418' : 'none', color: track.muted ? '#ef4444' : 'var(--text-faint)', fontSize: 8, cursor: 'pointer', padding: 0, flexShrink: 0, letterSpacing: 0 }}>
            M
          </button>

          {/* Waveform icon */}
          <span style={{ fontSize: 13, color: 'var(--accent)', flexShrink: 0 }}>♫</span>

          {/* Name */}
          <span style={{ fontSize: 11, color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 80 }}>
            {track.name}
          </span>

          {/* Offset in bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>START BAR</span>
            <input
              type="number" min={0} max={64} value={track.offsetBars}
              onChange={e => update(track.id, { offsetBars: Math.max(0, parseInt(e.target.value) || 0) })}
              style={{ width: 40, fontSize: 11, padding: '2px 5px', background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 4, color: 'var(--text)', outline: 'none', textAlign: 'center' }}
            />
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, color: '#22D3EE', letterSpacing: '0.06em' }}>VOL</span>
            <input
              type="range" min={-20} max={6} step={1} value={track.volume}
              onChange={e => update(track.id, { volume: parseInt(e.target.value) })}
              style={{ width: 64, accentColor: '#22D3EE', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-faint)', minWidth: 26, textAlign: 'right' }}>{track.volume}dB</span>
          </div>

          {/* Loop */}
          <button
            onClick={() => update(track.id, { loop: !track.loop })}
            style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, border: `1px solid ${track.loop ? '#0D9488' : 'var(--border-dim)'}`, background: track.loop ? 'rgba(13,148,136,0.1)' : 'none', color: track.loop ? '#0D9488' : 'var(--text-faint)', cursor: 'pointer', letterSpacing: '0.04em' }}>
            ↺ LOOP
          </button>

          {/* Remove */}
          <button
            onClick={() => remove(track.id)}
            title="Remove track"
            style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)', background: 'none', color: 'rgba(239,68,68,0.5)', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0, lineHeight: 1 }}>
            ×
          </button>
        </div>
      ))}

      {tracks.length > 0 && (
        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginTop: 4 }}>
          {tracks.length} track{tracks.length !== 1 ? 's' : ''} · audio plays in sync when you hit PLAY
        </div>
      )}
    </div>
  );
}
