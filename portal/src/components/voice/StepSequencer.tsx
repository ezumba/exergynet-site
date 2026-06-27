'use client';
import React, { useState } from 'react';

const TRACK_COLORS = [
  '#0D9488','#7C3AED','#D97706','#DC2626',
  '#0284C7','#059669','#DB2777','#EA580C',
];

function instrIcon(instrument: string): string {
  const i = instrument.toLowerCase();
  if (/kick/.test(i))           return '◉';
  if (/snare|clap/.test(i))    return '◈';
  if (/hi.?hat|hihat/.test(i)) return '◇';
  if (/bass|sub/.test(i))      return '◎';
  if (/chord|pad/.test(i))     return '⬡';
  if (/lead|melody/.test(i))   return '◆';
  return '○';
}

export interface SeqTrack {
  name: string;
  instrument: string;
  steps: boolean[];
  muted?: boolean;
  volume?: number;  // -20 to +6 dB
  swing?: number;   // 0–45 %
  human?: number;   // 0–25 ms timing jitter
}

const PRESETS: Record<string, boolean[]> = {
  BASIC:    [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0].map(Boolean),
  AFROBEAT: [1,0,0,1, 0,0,1,0, 0,1,0,0, 1,0,0,0].map(Boolean),
  TRAP:     [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean),
  BREAKBEAT:[1,0,0,0, 0,0,1,0, 0,0,1,0, 0,1,0,0].map(Boolean),
};

interface MixSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
}

function MixSlider({ label, value, min, max, step, unit, color, onChange }: MixSliderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 70 }}>
      <span style={{ fontSize: 9, fontFamily: 'monospace', color, letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 52, accentColor: color, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-faint)', flexShrink: 0, minWidth: 24, textAlign: 'right' }}>
        {value}{unit}
      </span>
    </div>
  );
}

interface Props {
  tracks: SeqTrack[];
  currentStep: number;
  onToggle: (trackIdx: number, stepIdx: number) => void;
  onUpdate?: (trackIdx: number, changes: Partial<SeqTrack>) => void;
  onMute?: (trackIdx: number) => void;
  onRemove?: (trackIdx: number) => void;
  onRename?: (trackIdx: number, name: string) => void;
  onAddTrack?: () => void;
  onClear?: (trackIdx: number) => void;
  onPreset?: (trackIdx: number, steps: boolean[]) => void;
  swing?: number;
}

export default function StepSequencer({
  tracks, currentStep, onToggle, onUpdate,
  onMute, onRemove, onRename, onAddTrack, onClear, onPreset,
  swing = 0,
}: Props) {
  const [editingName, setEditingName] = useState<number | null>(null);
  const [nameVal, setNameVal] = useState('');
  const [showPreset, setShowPreset] = useState<number | null>(null);

  if (tracks.length === 0) return null;

  return (
    <div style={{ padding: '8px 0', userSelect: 'none' }}>
      {/* Beat markers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6, paddingLeft: 160 }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{ width: 26, flexShrink: 0, textAlign: 'center', fontSize: 9, color: i % 4 === 0 ? 'var(--text-faint)' : 'transparent', fontFamily: 'monospace' }}>
            {i % 4 === 0 ? i / 4 + 1 : '·'}
          </div>
        ))}
        {/* CLEAR + PRESET for row header */}
        <div style={{ width: 80, flexShrink: 0 }} />
      </div>

      {tracks.map((track, ti) => {
        const col = TRACK_COLORS[ti % TRACK_COLORS.length];
        return (
          <div key={ti} style={{ marginBottom: 10 }}>
            {/* Track label — editable */}
            <div style={{ width: 96, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: col, flexShrink: 0 }}>{instrIcon(track.instrument)}</span>
              {editingName === ti ? (
                <input
                  autoFocus
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onBlur={() => { onRename?.(ti, nameVal); setEditingName(null); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onRename?.(ti, nameVal); setEditingName(null); } }}
                  style={{ width: 70, fontSize: 10, fontFamily: 'monospace', background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 3, color: 'var(--text)', padding: '1px 4px', outline: 'none' }}
                />
              ) : (
                <span
                  onDoubleClick={() => { setEditingName(ti); setNameVal(track.name); }}
                  style={{ fontSize: 10, color: track.muted ? 'var(--text-faint)' : 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', fontFamily: 'monospace', opacity: track.muted ? 0.5 : 1 }}
                  title="Double-click to rename"
                >
                  {track.name}
                </span>
              )}
            </div>

            {/* Mute */}
            {onMute && (
              <button onClick={() => onMute(ti)} title="Mute" style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid var(--border-mid)', background: track.muted ? '#ef444420' : 'var(--bg-surface)', color: track.muted ? '#ef4444' : 'var(--text-faint)', fontSize: 9, cursor: 'pointer', flexShrink: 0, padding: 0, fontFamily: 'monospace' }}>M</button>
            )}

            {/* 16 step pads */}
            <div style={{ display: 'flex', gap: 3 }}>
              {track.steps.slice(0, 16).map((active, si) => {
                const isCurrent = si === currentStep;
                const isBeat = si % 4 === 0;
                return (
                  <button key={si} onClick={() => onToggle(ti, si)} title={`${track.name} step ${si + 1}`}
                    style={{
                      width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                      border: `1px solid ${isCurrent ? col : isBeat ? '#2D3748' : '#1A2030'}`,
                      background: active
                        ? isCurrent ? col : col + 'CC'
                        : isCurrent ? col + '28' : isBeat ? '#0D1320' : '#090E18',
                      cursor: 'pointer', opacity: track.muted ? 0.35 : 1,
                      transition: 'background 0.06s, border-color 0.06s',
                      boxShadow: active && isCurrent ? `0 0 6px ${col}88` : 'none',
                    }}
                  />
                );
              })}
            </div>

            {/* Per-track controls */}
            <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
              {/* Preset picker */}
              {onPreset && (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowPreset(showPreset === ti ? null : ti)} title="Pattern preset"
                    style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid var(--border-mid)', background: 'var(--bg-surface)', color: 'var(--text-faint)', fontSize: 9, cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>P</button>
                  {showPreset === ti && (
                    <div style={{ position: 'absolute', top: 26, left: 0, zIndex: 50, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 }}>
                      {Object.entries(PRESETS).map(([name, pattern]) => (
                        <button key={name} onClick={() => { onPreset(ti, pattern); setShowPreset(null); }}
                          style={{ fontSize: 10, fontFamily: 'monospace', padding: '3px 8px', background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', textAlign: 'left', borderRadius: 3 }}>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Clear */}
              {onClear && (
                <button onClick={() => onClear(ti)} title="Clear track"
                  style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid var(--border-mid)', background: 'var(--bg-surface)', color: 'var(--text-faint)', fontSize: 9, cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>✕</button>
              )}
              {/* Remove track */}
              {onRemove && (
                <button onClick={() => onRemove(ti)} title="Remove track"
                  style={{ width: 22, height: 22, borderRadius: 3, border: '1px solid rgba(239,68,68,0.3)', background: 'none', color: 'rgba(239,68,68,0.6)', fontSize: 10, cursor: 'pointer', padding: 0 }}>−</button>
              )}
            </div>

            {/* Mixer row — SWING / HUMAN / VOL per track */}
            {onUpdate && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingLeft: 128, marginTop: 3, marginBottom: 2 }}>
                <MixSlider
                  label="SWING" value={track.swing ?? 0} min={0} max={45} step={1} unit="%" color="#A78BFA"
                  onChange={v => onUpdate(ti, { swing: v })}
                />
                <MixSlider
                  label="HUMAN" value={track.human ?? 0} min={0} max={25} step={1} unit="ms" color={col}
                  onChange={v => onUpdate(ti, { human: v })}
                />
                <MixSlider
                  label="VOL" value={track.volume ?? 0} min={-20} max={6} step={1} unit="dB" color="#22D3EE"
                  onChange={v => onUpdate(ti, { volume: v })}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add track + swing info row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-dim)' }}>
        {onAddTrack && (
          <button onClick={onAddTrack}
            style={{ fontSize: 11, fontFamily: 'monospace', padding: '4px 12px', borderRadius: 6, border: '1px dashed var(--border-mid)', background: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
            + ADD TRACK
          </button>
        )}
        {swing > 0 && (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-faint)' }}>SWING {swing}%</span>
        )}
      </div>
    </div>
  );
}
