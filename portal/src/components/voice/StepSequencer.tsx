'use client';

import React from 'react';

const TRACK_COLORS = [
  '#0D9488', '#7C3AED', '#D97706', '#DC2626',
  '#0284C7', '#059669', '#DB2777', '#EA580C',
];

function instrIcon(instrument: string): string {
  const i = instrument.toLowerCase();
  if (/kick/.test(i))            return '◉';
  if (/snare|clap/.test(i))     return '◈';
  if (/hi.?hat|hihat/.test(i))  return '◇';
  if (/bass|sub/.test(i))       return '◎';
  if (/chord|pad/.test(i))      return '⬡';
  if (/lead|melody/.test(i))    return '◆';
  return '○';
}

export interface SeqTrack {
  name: string;
  instrument: string;
  steps: boolean[];
}

interface Props {
  tracks: SeqTrack[];
  currentStep: number;
  onToggle: (trackIdx: number, stepIdx: number) => void;
}

export default function StepSequencer({ tracks, currentStep, onToggle }: Props) {
  if (tracks.length === 0) return null;

  return (
    <div style={{ padding: '8px 0', userSelect: 'none' }}>
      {/* Beat markers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 6, paddingLeft: 118 }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{
            width: 28, flexShrink: 0, textAlign: 'center',
            fontSize: 9, color: i % 4 === 0 ? 'var(--text-faint)' : 'transparent',
            fontFamily: 'monospace',
          }}>
            {i % 4 === 0 ? i / 4 + 1 : '·'}
          </div>
        ))}
      </div>

      {tracks.map((track, ti) => {
        const col = TRACK_COLORS[ti % TRACK_COLORS.length];
        return (
          <div key={ti} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            {/* Track label */}
            <div style={{ width: 112, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
              <span style={{ fontSize: 13, color: col, flexShrink: 0 }}>{instrIcon(track.instrument)}</span>
              <span style={{ fontSize: 11, color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {track.name}
              </span>
            </div>

            {/* 16 step pads */}
            <div style={{ display: 'flex', gap: 3 }}>
              {track.steps.slice(0, 16).map((active, si) => {
                const isCurrent = si === currentStep;
                const isBeat    = si % 4 === 0;
                return (
                  <button
                    key={si}
                    onClick={() => onToggle(ti, si)}
                    title={`${track.name} step ${si + 1}`}
                    style={{
                      width: 28, height: 26, borderRadius: 4, flexShrink: 0,
                      border: `1px solid ${isCurrent ? col : isBeat ? '#2D3748' : '#1A2030'}`,
                      background: active
                        ? isCurrent ? col : col + 'CC'
                        : isCurrent ? col + '28' : isBeat ? '#0D1320' : '#090E18',
                      cursor: 'pointer',
                      transition: 'background 0.06s, border-color 0.06s',
                      boxShadow: active && isCurrent ? `0 0 6px ${col}88` : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
