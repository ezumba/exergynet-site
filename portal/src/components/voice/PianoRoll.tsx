'use client';
import React, { useRef, useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PianoNote {
  id: string;
  pitch: number;    // MIDI note number (C2=36 → B5=83)
  start: number;    // 16th-note step index (0-63 for 4 bars)
  duration: number; // in 16th-note steps (1=16th, 2=8th, 4=quarter, 8=half, 16=whole)
  velocity: number; // 0-127
}

export type PianoInstrument = 'synth' | 'bass' | 'pad' | 'lead';

// ── Constants ─────────────────────────────────────────────────────────────────

const CELL_W    = 16;   // px per 16th step
const CELL_H    = 11;   // px per semitone row
const KEY_W     = 44;   // piano key column width
const NOTE_HI   = 83;   // B5 (top of grid)
const NOTE_LO   = 36;   // C2 (bottom of grid)
const NOTE_COUNT = NOTE_HI - NOTE_LO + 1; // 48 rows
const BARS      = 4;
const STEPS     = BARS * 16; // 64 steps

const BLACK_IN_OCT = new Set([1, 3, 6, 8, 10]);  // C#, D#, F#, G#, A#
const NOTE_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function isBlack(midi: number) { return BLACK_IN_OCT.has(midi % 12); }
function midiName(midi: number) { return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`; }

const INSTRUMENTS: { value: PianoInstrument; label: string; color: string }[] = [
  { value: 'synth', label: 'SYNTH', color: '#7C3AED' },
  { value: 'bass',  label: 'BASS',  color: '#0D9488' },
  { value: 'pad',   label: 'PAD',   color: '#0284C7' },
  { value: 'lead',  label: 'LEAD',  color: '#D97706' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  notes: PianoNote[];
  instrument: PianoInstrument;
  currentStep: number;
  onNotesChange: (notes: PianoNote[]) => void;
  onInstrumentChange: (inst: PianoInstrument) => void;
}

export default function PianoRoll({ notes, instrument, currentStep, onNotesChange, onInstrumentChange }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ pitch: number; start: number; end: number } | null>(null);

  const instConfig = INSTRUMENTS.find(i => i.value === instrument) ?? INSTRUMENTS[0];
  const gridRows = Array.from({ length: NOTE_COUNT }, (_, i) => NOTE_HI - i); // high → low

  const getCell = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_W);
    const row = Math.floor((e.clientY - rect.top)  / CELL_H);
    if (col < 0 || col >= STEPS || row < 0 || row >= NOTE_COUNT) return null;
    return { col, pitch: NOTE_HI - row };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const cell = getCell(e);
    if (!cell) return;
    // click existing note → delete
    const hit = notes.find(n =>
      n.pitch === cell.pitch && cell.col >= n.start && cell.col < n.start + n.duration,
    );
    if (hit) { onNotesChange(notes.filter(n => n.id !== hit.id)); return; }
    setDrawing({ pitch: cell.pitch, start: cell.col, end: cell.col });
    e.preventDefault();
  }, [notes, onNotesChange, getCell]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const cell = getCell(e);
    if (!cell || cell.pitch !== drawing.pitch) return;
    setDrawing(d => d ? { ...d, end: Math.max(d.start, cell.col) } : null);
  }, [drawing, getCell]);

  const commitDraw = useCallback(() => {
    if (!drawing) return;
    onNotesChange([...notes, {
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      pitch: drawing.pitch, start: drawing.start,
      duration: drawing.end - drawing.start + 1, velocity: 100,
    }]);
    setDrawing(null);
  }, [drawing, notes, onNotesChange]);

  return (
    <div style={{ fontFamily: 'monospace', userSelect: 'none' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>INSTRUMENT</span>
        {INSTRUMENTS.map(opt => (
          <button key={opt.value} onClick={() => onInstrumentChange(opt.value)}
            style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: `1px solid ${instrument === opt.value ? opt.color : 'var(--border-mid)'}`, background: instrument === opt.value ? opt.color + '22' : 'none', color: instrument === opt.value ? opt.color : 'var(--text-faint)', cursor: 'pointer', letterSpacing: '0.05em' }}>
            {opt.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-faint)' }}>
          {notes.length} notes · click-drag to draw · click note to erase
        </span>
        <button onClick={() => onNotesChange([])}
          style={{ fontSize: 9, padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.3)', background: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}>
          CLEAR
        </button>
      </div>

      {/* Bar ruler */}
      <div style={{ display: 'flex', marginLeft: KEY_W, marginBottom: 1 }}>
        {Array.from({ length: BARS }, (_, b) => (
          <div key={b} style={{ width: CELL_W * 16, fontSize: 8, color: 'var(--text-faint)', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 3, flexShrink: 0, letterSpacing: '0.06em' }}>
            BAR {b + 1}
          </div>
        ))}
      </div>

      {/* Piano + Grid scroll container */}
      <div style={{ display: 'flex', height: 300, overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-mid)', borderRadius: 7 }}>

        {/* Piano keys — sticky left */}
        <div style={{ width: KEY_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, background: '#0d1220' }}>
          {gridRows.map(midi => {
            const black = isBlack(midi);
            const isC   = midi % 12 === 0;
            return (
              <div key={midi} style={{
                height: CELL_H,
                background: black ? '#131825' : '#1e2535',
                borderBottom: isC ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 4, flexShrink: 0,
              }}>
                <span style={{ fontSize: 7, color: isC ? '#ffffffaa' : black ? '#ffffff33' : '#ffffff44', letterSpacing: '0.04em' }}>
                  {isC ? midiName(midi) : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          style={{ position: 'relative', width: STEPS * CELL_W, flexShrink: 0, cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={commitDraw}
          onMouseLeave={commitDraw}
        >
          {/* Background rows */}
          {gridRows.map((midi, rowIdx) => (
            <div key={midi} style={{
              position: 'absolute', top: rowIdx * CELL_H, left: 0,
              width: STEPS * CELL_W, height: CELL_H,
              background: isBlack(midi) ? '#090c16' : '#0d1220',
              borderBottom: midi % 12 === 0 ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(255,255,255,0.02)',
              pointerEvents: 'none',
            }} />
          ))}

          {/* Vertical grid lines (bars = bright, beats = mid, 16ths = faint) */}
          {Array.from({ length: STEPS + 1 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute', top: 0, left: i * CELL_W,
              width: 1, height: NOTE_COUNT * CELL_H, pointerEvents: 'none',
              background: i % 16 === 0 ? 'rgba(255,255,255,0.18)'
                        : i % 4  === 0 ? 'rgba(255,255,255,0.07)'
                        : 'rgba(255,255,255,0.02)',
            }} />
          ))}

          {/* Playhead */}
          {currentStep >= 0 && (
            <div style={{
              position: 'absolute', top: 0, left: currentStep * CELL_W,
              width: 2, height: NOTE_COUNT * CELL_H,
              background: instConfig.color, opacity: 0.75, pointerEvents: 'none', zIndex: 20,
              boxShadow: `0 0 6px ${instConfig.color}`,
            }} />
          )}

          {/* Committed notes */}
          {notes.map(n => {
            const row = NOTE_HI - n.pitch;
            if (row < 0 || row >= NOTE_COUNT) return null;
            return (
              <div key={n.id} style={{
                position: 'absolute',
                top: row * CELL_H + 1,
                left: n.start * CELL_W + 1,
                width: Math.max(n.duration * CELL_W - 2, 4),
                height: CELL_H - 2,
                background: instConfig.color,
                borderRadius: 2,
                opacity: 0.88,
                zIndex: 10,
                boxShadow: `0 0 4px ${instConfig.color}55`,
                pointerEvents: 'none',
              }} />
            );
          })}

          {/* Draw preview */}
          {drawing && (() => {
            const row = NOTE_HI - drawing.pitch;
            return (
              <div style={{
                position: 'absolute',
                top: row * CELL_H + 1,
                left: drawing.start * CELL_W + 1,
                width: (drawing.end - drawing.start + 1) * CELL_W - 2,
                height: CELL_H - 2,
                background: instConfig.color,
                borderRadius: 2,
                opacity: 0.45,
                zIndex: 11,
                pointerEvents: 'none',
              }} />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
