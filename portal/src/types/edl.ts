export type EDLSynthType =
  | 'synth' | 'fm' | 'am' | 'piano' | 'lead'
  | 'bass' | 'sub'
  | 'kick' | 'snare' | 'hihat' | 'clap' | 'perc';

export interface EDLNote {
  time: string;
  pitch: string | null;
  duration: string;
  velocity: number;
}

export interface EDLTrack {
  name: string;
  instrument: EDLSynthType | string;
  notes: EDLNote[];
}

export interface EDLDocument {
  title: string;
  bpm: number;
  key: string;
  tracks: EDLTrack[];
}
