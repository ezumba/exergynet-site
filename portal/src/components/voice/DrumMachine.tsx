'use client';
import React, { useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrumCell = 'x' | 'X' | 'o' | '.';

export interface DrumRow {
  key: string;
  name: string;
  pattern: string; // 16 chars of DrumCell
  color: string;
  volume: number;  // dB -20..+6
  swing: number;   // 0..45 %
  human: number;   // 0..25 ms
  muted: boolean;
}

export const DEFAULT_DRUM_ROWS: DrumRow[] = [
  { key: 'kick',    name: 'KICK',    pattern: 'x...x...x...x...', color: '#EF4444', volume: 0,  swing: 0, human: 0, muted: false },
  { key: 'snare',   name: 'SNARE',   pattern: '....x.......x...', color: '#F59E0B', volume: 0,  swing: 0, human: 0, muted: false },
  { key: 'hihat',   name: 'HI-HAT',  pattern: 'x.x.x.x.x.x.x.x.', color: '#22D3EE', volume: -4, swing: 0, human: 0, muted: false },
  { key: 'openhat', name: 'OPEN',    pattern: '................', color: '#10B981', volume: -6, swing: 0, human: 0, muted: false },
];

const PRESETS: Record<string, Partial<Record<string, string>>> = {
  BASIC: {
    kick:    'x...x...x...x...',
    snare:   '....x.......x...',
    hihat:   'x.x.x.x.x.x.x.x.',
    openhat: '................',
  },
  AFROBEAT: {
    kick:    'x..x..x...x..x..',
    snare:   '....x......xx...',
    hihat:   'x.xx.x.xx.xx.x.x',
    openhat: '....x.......x...',
  },
  TRAP: {
    kick:    'x.......x.......',
    snare:   '....X.......X...',
    hihat:   'x.xxx.xxx.x.xxx.',
    openhat: '................',
  },
  BREAKBEAT: {
    kick:    'x...x....x..x...',
    snare:   '....x..x....x...',
    hihat:   'xxxx.xxx.xxx.xxx',
    openhat: '................',
  },
};

// cycle: . → x → X → o → .
function cycleCell(c: DrumCell): DrumCell {
  return c === '.' ? 'x' : c === 'x' ? 'X' : c === 'X' ? 'o' : '.';
}

function setPatternStep(pattern: string, step: number, cell: DrumCell): string {
  const arr = pattern.padEnd(16, '.').split('');
  arr[step] = cell;
  return arr.join('');
}

// ── MixSlider ─────────────────────────────────────────────────────────────────

interface MixSliderProps {
  label: string; value: number; min: number; max: number; step: number; unit: string; color: string;
  onChange: (v: number) => void;
}
function MixSlider({ label, value, min, max, step, unit, color, onChange }: MixSliderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 9, fontFamily: 'monospace', color, letterSpacing: '0.07em', flexShrink: 0, minWidth: 34 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: 60, accentColor: color, cursor: 'pointer' }} />
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-faint)', minWidth: 24, textAlign: 'right' }}>{value}{unit}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface DrumMachineProps {
  rows: DrumRow[];
  currentStep: number;
  onUpdate: (rows: DrumRow[]) => void;
  bpm?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DrumMachine({ rows, currentStep, onUpdate, bpm = 120 }: DrumMachineProps) {
  const [showPreset, setShowPreset] = useState<string | null>(null);

  const updateRow = useCallback((key: string, changes: Partial<DrumRow>) => {
    onUpdate(rows.map(r => r.key === key ? { ...r, ...changes } : r));
  }, [rows, onUpdate]);

  const toggleStep = useCallback((key: string, step: number) => {
    const row = rows.find(r => r.key === key);
    if (!row) return;
    const cell = (row.pattern[step] ?? '.') as DrumCell;
    updateRow(key, { pattern: setPatternStep(row.pattern, step, cycleCell(cell)) });
  }, [rows, updateRow]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = PRESETS[presetName];
    if (!preset) return;
    onUpdate(rows.map(r => preset[r.key] ? { ...r, pattern: preset[r.key]! } : r));
    setShowPreset(null);
  }, [rows, onUpdate]);

  const clearAll = useCallback(() => {
    onUpdate(rows.map(r => ({ ...r, pattern: '................' })));
  }, [rows, onUpdate]);

  const addRow = useCallback(() => {
    const newRow: DrumRow = {
      key: `perc_${Date.now()}`, name: 'PERC',
      pattern: '................',
      color: '#8B5CF6', volume: 0, swing: 0, human: 0, muted: false,
    };
    onUpdate([...rows, newRow]);
  }, [rows, onUpdate]);

  const removeRow = useCallback((key: string) => {
    onUpdate(rows.filter(r => r.key !== key));
  }, [rows, onUpdate]);

  const BEAT_LABELS = ['1', '', '', '', '2', '', '', '', '3', '', '', '', '4', '', '', ''];

  return (
    <div style={{ fontFamily: 'monospace' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>
          PRESETS
        </span>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)}
            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border-mid)', background: 'var(--bg)', color: 'var(--text-soft)', cursor: 'pointer', letterSpacing: '0.05em' }}>
            {name}
          </button>
        ))}
        <button onClick={clearAll}
          style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.35)', background: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer' }}>
          CLEAR
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', fontSize: 10, color: 'var(--text-faint)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { sym: '▪', label: 'rest' },
              { sym: '●', label: 'hit', color: '#fff' },
              { sym: '★', label: 'accent', color: '#FBBF24' },
              { sym: '○', label: 'ghost', color: '#6B7280' },
            ].map(({ sym, label, color }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: color ?? 'var(--text-faint)' }}>{sym}</span>{label}
              </span>
            ))}
          </div>
          <span style={{ color: 'var(--border-mid)' }}>·</span>
          <span>click to cycle</span>
        </div>
      </div>

      {/* Beat header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 4, paddingLeft: 130 }}>
        {BEAT_LABELS.map((label, i) => (
          <div key={i} style={{
            width: 28, textAlign: 'center', fontSize: 9,
            color: i % 4 === 0 ? 'var(--text-faint)' : 'transparent',
            borderLeft: i % 4 === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            paddingTop: 1, paddingBottom: 3,
          }}>
            {label}
          </div>
        ))}
        <div style={{ width: 80 }} />
      </div>

      {/* Rows */}
      {rows.map(row => {
        const cells = row.pattern.padEnd(16, '.').split('') as DrumCell[];
        return (
          <div key={row.key} style={{ marginBottom: 6 }}>
            {/* Step row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {/* Label */}
              <div style={{ width: 90, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8 }}>
                <button onClick={() => updateRow(row.key, { muted: !row.muted })}
                  title="Mute"
                  style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid var(--border-mid)', background: row.muted ? '#ef444430' : 'none', color: row.muted ? '#ef4444' : 'var(--text-faint)', fontSize: 8, cursor: 'pointer', flexShrink: 0, padding: 0 }}>M</button>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: row.muted ? 'var(--text-faint)' : row.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.name}
                </span>
              </div>

              {/* 16 pads */}
              {cells.map((cell, si) => {
                const isCurrent = si === currentStep;
                const isBeat = si % 4 === 0;
                const isActive = cell !== '.';
                const isAccent = cell === 'X';
                const isGhost = cell === 'o';

                let bg = isBeat ? '#0F1420' : '#090D18';
                let border = isBeat ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
                let shadow = 'none';

                if (isActive && !row.muted) {
                  if (isAccent) {
                    bg = row.color;
                    border = row.color;
                    shadow = `0 0 8px ${row.color}66`;
                  } else if (isGhost) {
                    bg = row.color + '30';
                    border = row.color + '50';
                  } else {
                    bg = row.color + 'CC';
                    border = row.color + '80';
                  }
                }

                if (isCurrent) {
                  border = isActive ? row.color : row.color + '60';
                  if (!isActive) bg = row.color + '18';
                }

                return (
                  <button key={si} onClick={() => !row.muted && toggleStep(row.key, si)}
                    title={`${row.name} step ${si + 1}: ${cell === '.' ? 'rest' : cell === 'x' ? 'hit' : cell === 'X' ? 'ACCENT' : 'ghost'}`}
                    style={{
                      width: 28, height: 28, flexShrink: 0,
                      background: bg,
                      border: `1px solid ${border}`,
                      borderLeft: isBeat ? `2px solid ${isBeat && !isActive ? 'rgba(255,255,255,0.12)' : border}` : `1px solid ${border}`,
                      borderRadius: 3,
                      cursor: row.muted ? 'default' : 'pointer',
                      opacity: row.muted ? 0.3 : 1,
                      boxShadow: shadow,
                      transition: 'background 0.05s, box-shadow 0.05s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: 'rgba(255,255,255,0.5)',
                      padding: 0,
                    }}>
                    {isAccent && !row.muted ? '★' : isGhost && !row.muted ? '○' : ''}
                  </button>
                );
              })}

              {/* Remove */}
              <button onClick={() => removeRow(row.key)} title="Remove row"
                style={{ marginLeft: 6, width: 20, height: 20, borderRadius: 3, border: '1px solid rgba(239,68,68,0.2)', background: 'none', color: 'rgba(239,68,68,0.45)', fontSize: 10, cursor: 'pointer', flexShrink: 0, padding: 0 }}>−</button>
            </div>

            {/* Mixer row */}
            <div style={{ display: 'flex', gap: 14, paddingLeft: 96, marginTop: 3 }}>
              <MixSlider label="SWING" value={row.swing} min={0} max={45} step={1} unit="%" color="#A78BFA"
                onChange={v => updateRow(row.key, { swing: v })} />
              <MixSlider label="HUMAN" value={row.human} min={0} max={25} step={1} unit="ms" color={row.color}
                onChange={v => updateRow(row.key, { human: v })} />
              <MixSlider label="VOL" value={row.volume} min={-20} max={6} step={1} unit="dB" color="#22D3EE"
                onChange={v => updateRow(row.key, { volume: v })} />
            </div>
          </div>
        );
      })}

      {/* Add row */}
      <button onClick={addRow}
        style={{ marginTop: 8, fontSize: 10, padding: '5px 14px', borderRadius: 6, border: '1px dashed var(--border-mid)', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', letterSpacing: '0.05em' }}>
        + ADD ROW
      </button>
    </div>
  );
}
