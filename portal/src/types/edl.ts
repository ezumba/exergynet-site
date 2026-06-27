export type EDLSynthType =
  | 'synth' | 'fm' | 'am' | 'piano' | 'lead'
  | 'bass' | 'sub'
  | 'kick' | 'snare' | 'hihat' | 'clap' | 'perc';

export interface EDLNote {
  time: string;
  pitch?: string | null;   // EDLDocument compat
  note?: string | null;    // ExergyDSPProtocol compat
  duration: string;
  velocity: number;
}

export interface EDLEffect {
  type: string;
  [key: string]: unknown;
}

export interface EDLHumanize {
  timing?: number;
  velocity?: number;
  swing?: number;
  groove?: string;
}

export interface EDLTrack {
  name: string;
  instrument?: EDLSynthType | string;
  type?: string;
  bus?: string;
  drumType?: 'kick' | 'snare' | 'hihat';
  config?: Record<string, unknown>;
  effects?: EDLEffect[];
  notes: EDLNote[];
  volume?: number;
  synth?: string;
  layers?: unknown[];
  model?: string;
  sequence?: unknown[];
}

export interface EDLDocument {
  title: string;
  bpm: number;
  key: string;
  tracks: EDLTrack[];
}

export interface ExergyDSPProtocol {
  version?: string;
  title: string;
  bpm: number;
  loopEnd?: string;
  humanize?: EDLHumanize;
  master?: {
    reverb?: { decay?: number; preDelay?: number; wet?: number; character?: string };
    compressor?: { threshold?: number; ratio?: number; attack?: number; release?: number };
    limiter?: number;
    stereoWidth?: number;
  };
  buses?: Record<string, { effects?: EDLEffect[] }>;
  tracks: EDLTrack[];
}

export interface MusicIntent {
  genre?: string;
  mood?: string;
  energy?: string;
  space?: string;
  bpm?: number;
  key?: string;
  title?: string;
  humanization?: {
    timing?: number;
    velocity?: number;
    swing?: number;
  };
}
