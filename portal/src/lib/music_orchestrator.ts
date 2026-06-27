/**
 * EDL v1.2 Music Orchestrator
 * Three-layer pipeline: MusicIntent → deterministic templates → ExergyDSPProtocol
 */
import type { ExergyDSPProtocol, EDLTrack, EDLNote, MusicIntent } from '@/types/edl';

// ── Genre templates ──────────────────────────────────────────────────────────
const GENRE_TEMPLATES: Record<string, {
  defaultBpm: number;
  swing: number;
  instruments: string[];
  rhythmPatterns: Record<string, string>;
  defaultKey: string;
}> = {
  afrobeat: {
    defaultBpm: 108, swing: 0.22, defaultKey: 'F# minor',
    instruments: ['kick', 'snare', 'hihat', 'bass', 'pad'],
    rhythmPatterns: {
      kick:  'x...x...x...x...',
      snare: '....x.......x...',
      hihat: 'xxxxxxxxxxxxxxxx',
      bass:  'x..x..x.x..x..x.',
    },
  },
  electronic: {
    defaultBpm: 128, swing: 0, defaultKey: 'A minor',
    instruments: ['kick', 'snare', 'hihat', 'bass', 'synth'],
    rhythmPatterns: {
      kick:  'x...x...x...x...',
      snare: '....x.......x...',
      hihat: 'xxxxxxxxxxxxxxxx',
      bass:  'x.x.x.x.x.x.x.x.',
    },
  },
  jazz: {
    defaultBpm: 120, swing: 0.33, defaultKey: 'C major',
    instruments: ['hihat', 'snare', 'bass', 'pad', 'pluck'],
    rhythmPatterns: {
      hihat: 'x.x.x.x.x.x.x.x.',
      snare: '....x.......x...',
      bass:  'x...x...x...x...',
    },
  },
  cinematic: {
    defaultBpm: 80, swing: 0, defaultKey: 'D minor',
    instruments: ['pad', 'synth', 'bass', 'kick', 'hihat'],
    rhythmPatterns: {
      kick:  'x.......x.......',
      hihat: 'x.x.x.x.x.x.x.x.',
      bass:  'x...x...x...x...',
    },
  },
  lofi: {
    defaultBpm: 90, swing: 0.18, defaultKey: 'F major',
    instruments: ['kick', 'snare', 'hihat', 'bass', 'pad'],
    rhythmPatterns: {
      kick:  'x...x...x...x...',
      snare: '....x.......x...',
      hihat: 'x.x.x.x.x.x.x.x.',
      bass:  'x...x...x...x...',
    },
  },
};

// ── Mood templates ───────────────────────────────────────────────────────────
const MOOD_TEMPLATES: Record<string, {
  reverbDecay: number; reverbChar: string; reverbWet: number;
  stereoWidth: number; velocityBase: number; filterCutoff?: number;
}> = {
  dark:       { reverbDecay: 5.0, reverbChar: 'cathedral', reverbWet: 0.45, stereoWidth: 1.4, velocityBase: 0.7 },
  bright:     { reverbDecay: 1.8, reverbChar: 'plate',     reverbWet: 0.22, stereoWidth: 1.2, velocityBase: 0.75 },
  ethereal:   { reverbDecay: 8.0, reverbChar: 'cathedral', reverbWet: 0.60, stereoWidth: 1.8, velocityBase: 0.5 },
  aggressive: { reverbDecay: 1.2, reverbChar: 'room',      reverbWet: 0.18, stereoWidth: 1.1, velocityBase: 0.9 },
  calm:       { reverbDecay: 3.0, reverbChar: 'hall',      reverbWet: 0.35, stereoWidth: 1.3, velocityBase: 0.55 },
  euphoric:   { reverbDecay: 2.5, reverbChar: 'hall',      reverbWet: 0.30, stereoWidth: 1.5, velocityBase: 0.85 },
  melancholic:{ reverbDecay: 4.5, reverbChar: 'cathedral', reverbWet: 0.50, stereoWidth: 1.3, velocityBase: 0.55 },
};

// ── Space templates ───────────────────────────────────────────────────────────
const SPACE_TEMPLATES: Record<string, { reverbDecay: number; preDelay: number; wet: number; stereoWidth: number }> = {
  intimate:  { reverbDecay: 0.8, preDelay: 0.01, wet: 0.12, stereoWidth: 1.0 },
  room:      { reverbDecay: 1.5, preDelay: 0.02, wet: 0.22, stereoWidth: 1.2 },
  hall:      { reverbDecay: 3.0, preDelay: 0.10, wet: 0.35, stereoWidth: 1.4 },
  cathedral: { reverbDecay: 6.0, preDelay: 0.20, wet: 0.50, stereoWidth: 1.8 },
  infinite:  { reverbDecay:10.0, preDelay: 0.50, wet: 0.70, stereoWidth: 2.0 },
};

// ── Energy templates ──────────────────────────────────────────────────────────
const ENERGY_TEMPLATES: Record<string, { velocityMult: number; densityMult: number }> = {
  whisper:   { velocityMult: 0.3, densityMult: 0.5 },
  intimate:  { velocityMult: 0.5, densityMult: 0.7 },
  driving:   { velocityMult: 0.75, densityMult: 1.0 },
  explosive: { velocityMult: 1.0, densityMult: 1.2 },
  fading:    { velocityMult: 0.35, densityMult: 0.6 },
};

// ── Instrument primitives ─────────────────────────────────────────────────────
const SCALE_NOTES: Record<string, string[]> = {
  'A minor': ['A2','C3','D3','E3','G3','A3','C4','D4','E4','G4','A4'],
  'C major': ['C3','D3','E3','G3','A3','C4','D4','E4','G4','A4'],
  'F# minor': ['F#2','A2','B2','C#3','E3','F#3','A3','B3','C#4','E4','F#4'],
  'D minor': ['D2','F2','G2','A2','C3','D3','F3','G3','A3','C4','D4'],
  'F major': ['F2','G2','A2','C3','D3','F3','G3','A3','C4','D4','F4'],
};

function patternToNotes(
  pattern: string, bars: number, baseVelocity: number,
  isDrum: boolean, scaleNotes: string[]
): EDLNote[] {
  const notes: EDLNote[] = [];
  const steps = pattern.length;

  for (let bar = 0; bar < bars; bar++) {
    for (let i = 0; i < steps; i++) {
      if (pattern[i] === 'x') {
        const beat = Math.floor(i / 4);
        const sixteenth = i % 4;
        const velocity = Math.max(0.1, Math.min(1.0,
          baseVelocity + (Math.random() - 0.5) * 0.12
        ));
        const noteIdx = (bar * 3 + i) % scaleNotes.length;
        notes.push({
          time: `${bar}:${beat}:${sixteenth}`,
          note: isDrum ? 'C1' : scaleNotes[noteIdx],
          duration: isDrum ? '16n' : '8n',
          velocity: Math.round(velocity * 100) / 100,
        });
      }
    }
  }
  return notes;
}

function buildDrumTrack(
  name: string, drumType: 'kick' | 'snare' | 'hihat',
  pattern: string, bars: number, velocity: number
): EDLTrack {
  const configs: Record<string, any> = {
    kick:  { pitchDecay: 0.05, octaves: 4, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } },
    snare: { noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0 } },
    hihat: { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } },
  };
  const volumes: Record<string, number> = { kick: 2, snare: -2, hihat: -8 };
  return {
    name: name.toUpperCase(),
    type: 'drum',
    bus: 'drums',
    drumType,
    config: configs[drumType],
    effects: [],
    notes: patternToNotes(pattern, bars, velocity, true, []),
    volume: volumes[drumType],
  };
}

function buildMelodicTrack(
  name: string, synth: 'PolySynth' | 'MonoSynth',
  bus: 'instruments' | 'texture',
  pattern: string, bars: number, velocity: number, scaleNotes: string[],
  reverbChar: string, reverbDecay: number
): EDLTrack {
  const configs: Record<string, any> = {
    bass:  { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 } },
    pad:   { oscillator: { type: 'sine' },     envelope: { attack: 1.5, decay: 0.5, sustain: 1.0, release: 2.0 } },
    synth: { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1.0 } },
    pluck: { oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.3 } },
  };
  return {
    name: name.toUpperCase(),
    type: 'synth',
    bus,
    synth,
    config: configs[name] || configs.synth,
    effects: [
      { type: 'Reverb', decay: reverbDecay, preDelay: 0.05, wet: 0.25, character: reverbChar },
    ],
    notes: patternToNotes(pattern, bars, velocity, false, scaleNotes),
    volume: name === 'bass' ? 2 : name === 'pad' ? -6 : -2,
  };
}

// ── Main orchestrator ─────────────────────────────────────────────────────────
export function orchestrate(intent: MusicIntent): ExergyDSPProtocol {
  const genreKey = Object.keys(GENRE_TEMPLATES).find(k =>
    intent.genre?.toLowerCase().includes(k)
  ) ?? 'electronic';
  const moodKey = Object.keys(MOOD_TEMPLATES).find(k =>
    intent.mood?.toLowerCase().includes(k)
  ) ?? 'dark';
  const energyKey = Object.keys(ENERGY_TEMPLATES).find(k =>
    (intent.energy ?? '').toLowerCase().includes(k)
  ) ?? 'driving';
  const spaceKey = Object.keys(SPACE_TEMPLATES).find(k =>
    (intent.space ?? '').toLowerCase().includes(k)
  ) ?? 'hall';

  const genre = GENRE_TEMPLATES[genreKey];
  const mood  = MOOD_TEMPLATES[moodKey];
  const energy = ENERGY_TEMPLATES[energyKey];
  const space  = SPACE_TEMPLATES[spaceKey];

  const bpm = intent.bpm ?? genre.defaultBpm;
  const key = intent.key ?? genre.defaultKey;
  const scaleNotes = SCALE_NOTES[key] ?? SCALE_NOTES['A minor'];
  const bars = 4;
  const baseVelocity = mood.velocityBase * energy.velocityMult;

  const tracks: EDLTrack[] = [];

  for (const inst of genre.instruments) {
    const pattern = genre.rhythmPatterns[inst];
    if (!pattern) continue;

    if (inst === 'kick') {
      tracks.push(buildDrumTrack('kick', 'kick', pattern, bars, baseVelocity));
    } else if (inst === 'snare') {
      tracks.push(buildDrumTrack('snare', 'snare', pattern, bars, baseVelocity * 0.85));
    } else if (inst === 'hihat') {
      tracks.push(buildDrumTrack('hihat', 'hihat', pattern, bars, baseVelocity * 0.7));
    } else if (inst === 'bass') {
      tracks.push(buildMelodicTrack('bass', 'MonoSynth', 'instruments', pattern, bars, baseVelocity * 0.9, scaleNotes, mood.reverbChar, mood.reverbDecay * 0.4));
    } else if (inst === 'pad') {
      tracks.push(buildMelodicTrack('pad', 'PolySynth', 'texture', pattern, bars, baseVelocity * 0.6, scaleNotes, mood.reverbChar, mood.reverbDecay));
    } else if (inst === 'synth' || inst === 'pluck') {
      tracks.push(buildMelodicTrack(inst, 'PolySynth', 'instruments', pattern, bars, baseVelocity * 0.8, scaleNotes, mood.reverbChar, mood.reverbDecay * 0.6));
    }
  }

  const masterReverb = {
    decay: (mood.reverbDecay + space.reverbDecay) / 2,
    preDelay: space.preDelay,
    wet: (mood.reverbWet + space.wet) / 2,
    character: mood.reverbChar as any,
  };

  return {
    version: '1.2',
    title: intent.title ?? `${intent.mood ?? 'Deep'} ${intent.genre ?? 'Track'}`,
    bpm,
    loopEnd: '4m',
    humanize: {
      timing: intent.humanization?.timing ?? 0.015,
      velocity: intent.humanization?.velocity ?? 0.08,
      swing: intent.humanization?.swing ?? genre.swing,
      groove: genreKey,
    },
    master: {
      reverb: masterReverb,
      compressor: { threshold: -14, ratio: 3, attack: 0.003, release: 0.25 },
      limiter: -1,
      stereoWidth: (mood.stereoWidth + space.stereoWidth) / 2,
    },
    buses: {
      drums: { effects: [{ type: 'Compressor', threshold: -18, ratio: 6, attack: 0.001, release: 0.08 }] },
      instruments: { effects: [{ type: 'Reverb', decay: masterReverb.decay, preDelay: masterReverb.preDelay, wet: masterReverb.wet * 0.7 }] },
      texture: { effects: [{ type: 'Chorus', frequency: 3, delayTime: 2.5, depth: 0.4, wet: 0.25 }] },
    },
    tracks,
  };
}
