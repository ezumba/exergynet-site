import type { EDLDocument } from '@/types/edl';
import type { DrumRow } from '@/components/voice/DrumMachine';
import type { PianoNote, PianoInstrument } from '@/components/voice/PianoRoll';
import type { AudioTrackData } from '@/components/voice/AudioTracks';

export interface TransportHandle {
  play: () => Promise<void>;
  stop: () => void;
  dispose: () => void;
  setOnStep: (cb: (step: number) => void) => void;
}

// Convert Tone.js "bar:beat:sixteenth" time string to a 0–15 step index (1 bar, 16th-note grid)
function timeToStep(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const bar = parts[0] ?? 0;
  const beat = parts[1] ?? 0;
  const sixteenth = parts[2] ?? 0;
  return (bar * 16 + beat * 4 + sixteenth) % 16;
}

// Build a 16-element boolean array for each track from its EDL notes
export function edlToSteps(tracks: EDLDocument['tracks']): boolean[][] {
  return tracks.map(track => {
    const steps = new Array<boolean>(16).fill(false);
    for (const note of track.notes) {
      if (note.time) steps[timeToStep(note.time)] = true;
    }
    return steps;
  });
}

export async function compileEDL(edl: EDLDocument): Promise<TransportHandle> {
  const Tone = await import('tone');

  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.bpm.value = edl.bpm ?? 120;

  const disposables: { dispose: () => void }[] = [];
  let stepCallback: ((step: number) => void) | null = null;

  // Playhead ticker — fires on every 16th note
  const tickSeq = new Tone.Sequence(
    (time: number, step: number) => {
      Tone.getDraw().schedule(() => { stepCallback?.(step); }, time);
    },
    Array.from({ length: 16 }, (_, i) => i),
    '16n',
  );
  tickSeq.loop = true;
  tickSeq.start(0);
  disposables.push(tickSeq);

  for (const track of edl.tracks) {
    const inst = track.instrument.toLowerCase();
    const isKick   = /kick/.test(inst);
    const isSnare  = /snare|clap/.test(inst);
    const isHihat  = /hi.?hat|hihat|cymbal/.test(inst);
    const isBass   = /bass|sub/.test(inst);
    const isPerc   = isKick || isSnare || isHihat;

    type AnyDisposable = { dispose: () => void };

    let synth: AnyDisposable & { triggerAttackRelease: (...a: any[]) => void };

    if (isKick) {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 6,
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
      }).toDestination();
      synth = s;
    } else if (isSnare || isHihat) {
      const s = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: isHihat ? 0.04 : 0.14,
          sustain: 0,
          release: isHihat ? 0.02 : 0.08,
        },
      }).toDestination();
      if (isHihat) s.volume.value = -10;
      synth = s as typeof synth;
    } else if (isBass) {
      synth = new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.5 },
        filterEnvelope: {
          attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.4,
          baseFrequency: 150, octaves: 2,
        },
      }).toDestination();
    } else {
      const ps = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.7 },
      }).toDestination();
      ps.volume.value = -5;
      synth = ps as typeof synth;
    }

    disposables.push(synth);

    const events = track.notes
      .filter(n => n.time && n.duration)
      .map(n => ({
        time: n.time,
        note: n.pitch ?? 'C2',
        duration: n.duration,
        velocity: (n.velocity ?? 80) / 127,
      }));

    if (events.length === 0) continue;

    const part = new Tone.Part((time: number, ev: { note: string; duration: string; velocity: number }) => {
      if (isKick) {
        synth.triggerAttackRelease('C1', ev.duration, time, ev.velocity);
      } else if (isSnare || isHihat) {
        // NoiseSynth: no pitch argument
        (synth as any).triggerAttackRelease(ev.duration, time, ev.velocity);
      } else {
        synth.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity);
      }
    }, events);

    part.loop = true;
    part.loopEnd = '2m';
    part.start(0);
    disposables.push(part);
  }

  return {
    play: async () => {
      await Tone.start();
      transport.start();
    },
    stop: () => transport.stop(),
    dispose: () => {
      transport.stop();
      transport.cancel();
      disposables.forEach(d => d.dispose());
    },
    setOnStep: (cb) => { stepCallback = cb; },
  };
}

// Global state for live-update multi-track management
let _globalDisposables: { dispose: () => void }[] = [];
let _scheduledPlayers: { dispose: () => void; stop: () => void }[] = [];

export async function setBPM(bpm: number): Promise<void> {
  const Tone = await import('tone');
  Tone.getTransport().bpm.value = bpm;
}

export async function startTransport(): Promise<void> {
  const Tone = await import('tone');
  await Tone.start();
  Tone.getTransport().start();
}

export function stopTransport(): void {
  import('tone').then(Tone => Tone.getTransport().stop());
}

export function disposeAllSequences(): void {
  _globalDisposables.forEach(d => { try { d.dispose(); } catch {} });
  _globalDisposables = [];
  _scheduledPlayers.forEach(p => { try { p.stop(); p.dispose(); } catch {} });
  _scheduledPlayers = [];
}

export async function compileAllTracks(
  tracks: Array<{ name: string; instrument: string; steps: boolean[]; volume?: number; muted?: boolean; swing?: number; human?: number }>,
  bpm: number,
  onStep?: (step: number) => void,
): Promise<void> {
  const Tone = await import('tone');
  disposeAllSequences();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.bpm.value = bpm;

  let stepCb = onStep ?? null;

  const tickSeq = new Tone.Sequence(
    (time: number, step: number) => {
      Tone.getDraw().schedule(() => { stepCb?.(step); }, time);
    },
    Array.from({ length: 16 }, (_, i) => i),
    '16n',
  );
  tickSeq.loop = true;
  tickSeq.start(0);
  _globalDisposables.push(tickSeq);

  for (const track of tracks) {
    if (track.muted) continue;
    const seq = await _buildTrackSequence(Tone, track.instrument, track.steps, track.volume ?? 0, track.swing ?? 0, track.human ?? 0);
    if (seq) _globalDisposables.push(seq);
  }

  await Tone.start();
  transport.start();
}

export async function compileOrUpdateDrumTrack(
  track: { name: string; instrument: string; steps: boolean[]; volume?: number; swing?: number; human?: number },
  bpm: number,
): Promise<void> {
  const Tone = await import('tone');
  const key = `track_${track.name}`;
  const existing = (_globalDisposables as any[]).find((d: any) => d.__trackKey === key);
  if (existing) {
    try { existing.dispose(); } catch {}
    _globalDisposables = _globalDisposables.filter((d: any) => d.__trackKey !== key);
  }
  Tone.getTransport().bpm.value = bpm;
  const seq = await _buildTrackSequence(Tone, track.instrument, track.steps, track.volume ?? 0, track.swing ?? 0, track.human ?? 0);
  if (seq) {
    (seq as any).__trackKey = key;
    _globalDisposables.push(seq);
    seq.start(0);
  }
}

// Returns scheduled players array for cleanup
export async function scheduleLyricsTrack(
  blobs: Blob[],
  barsPerLine: number,
  bpm: number,
): Promise<void> {
  const Tone = await import('tone');
  const secPerBar = (60 / bpm) * 4;

  for (let i = 0; i < blobs.length; i++) {
    const url = URL.createObjectURL(blobs[i]);
    const player = new Tone.Player(url).toDestination();
    await player.load(url);
    const startTime = i * barsPerLine * secPerBar;
    player.start(Tone.now() + startTime);
    _scheduledPlayers.push(player as { dispose: () => void; stop: () => void });
  }
}

// ── Piano Roll compiler ────────────────────────────────────────────────────────

export function midiToNote(midi: number): string {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function stepsToDuration(steps: number): string {
  if (steps >= 16) return '1m';
  if (steps >= 8)  return '2n';
  if (steps >= 4)  return '4n';
  if (steps >= 2)  return '8n';
  return '16n';
}

export async function compilePianoRoll(
  notes: PianoNote[],
  instrument: PianoInstrument,
  bars = 4,
): Promise<void> {
  if (notes.length === 0) return;
  const Tone = await import('tone');

  _globalDisposables = _globalDisposables.filter((d: any) => {
    if (d.__isPianoRoll) { try { d.dispose(); } catch {} return false; }
    return true;
  });

  let synth: any;
  if (instrument === 'bass') {
    synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.4, baseFrequency: 200, octaves: 2 },
    }).toDestination();
  } else if (instrument === 'pad') {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.5, sustain: 0.8, release: 1.5 },
    }).toDestination();
    synth.volume.value = -6;
  } else if (instrument === 'lead') {
    synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.3 },
    }).toDestination();
  } else {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.5 },
    }).toDestination();
    synth.volume.value = -4;
  }

  const toneEvents = notes.map(n => ({
    time: `${Math.floor(n.start / 16)}:${Math.floor((n.start % 16) / 4)}:${n.start % 4}`,
    note: midiToNote(n.pitch),
    duration: stepsToDuration(n.duration),
    velocity: n.velocity / 127,
  }));

  const part = new Tone.Part((time: number, ev: any) => {
    synth.triggerAttackRelease(ev.note, ev.duration, time, ev.velocity);
  }, toneEvents);

  part.loop = true;
  part.loopEnd = `${bars}m`;
  part.start(0);

  const disposable: any = {
    __isPianoRoll: true,
    dispose: () => { try { part.dispose(); synth.dispose(); } catch {} },
  };
  _globalDisposables.push(disposable);
}

// ── Audio Track scheduler ──────────────────────────────────────────────────────

export async function playAudioTracks(tracks: AudioTrackData[], bpm: number): Promise<void> {
  if (tracks.length === 0) return;
  const Tone = await import('tone');
  const secPerBar = (60 / bpm) * 4;
  for (const track of tracks) {
    if (track.muted) continue;
    const url = URL.createObjectURL(track.file);
    const player = new Tone.Player({ url, loop: track.loop, volume: track.volume }).toDestination();
    await player.load(url);
    player.start(Tone.now() + track.offsetBars * secPerBar);
    _scheduledPlayers.push(player as any);
  }
}

// ── Mixdown recording ──────────────────────────────────────────────────────────

let _recorder: any = null;

export async function startMixdownRecording(): Promise<void> {
  const Tone = await import('tone');
  if (_recorder) { try { _recorder.dispose(); } catch {} _recorder = null; }
  _recorder = new Tone.Recorder();
  Tone.getDestination().connect(_recorder);
  await _recorder.start();
}

export async function stopMixdownRecording(): Promise<Blob> {
  if (!_recorder) throw new Error('No active recording');
  const blob = await _recorder.stop();
  try { _recorder.dispose(); } catch {}
  _recorder = null;
  return blob;
}

// Internal helper — build Tone sequence for one track
// swingPct: 0–45% pushes every odd 16th note late
// humanMs: 0–25ms adds random timing jitter per hit
async function _buildTrackSequence(
  Tone: typeof import('tone'),
  instrument: string,
  steps: boolean[],
  volumeDb: number,
  swingPct = 0,
  humanMs = 0,
): Promise<{ dispose: () => void; start: (t: number) => void } | null> {
  if (steps.every(s => !s)) return null;
  const inst = instrument.toLowerCase();
  const isKick  = /kick/.test(inst);
  const isSnare = /snare|clap/.test(inst);
  const isHihat = /hi.?hat|hihat|cymbal/.test(inst);
  const isBass  = /bass|sub/.test(inst);
  const isPerc  = isKick || isSnare || isHihat;

  let synth: any;
  if (isKick) {
    synth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 } }).toDestination();
  } else if (isSnare || isHihat) {
    synth = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: isHihat ? 0.04 : 0.14, sustain: 0, release: isHihat ? 0.02 : 0.08 } }).toDestination();
    if (isHihat) synth.volume.value = -10;
  } else if (isBass) {
    synth = new Tone.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.5 } }).toDestination();
  } else {
    synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.7 } }).toDestination();
    synth.volume.value = -5;
  }
  synth.volume.value += volumeDb;

  // Build event list with swing offset on odd 16th steps
  const secPer16th = Tone.getTransport().toSeconds('16n');
  const swingOffset = secPer16th * (swingPct / 100) * 0.667; // standard swing formula
  const humanSec = humanMs / 1000;

  const events: Array<{ time: string; stepIdx: number }> = [];
  steps.forEach((on, i) => {
    if (on) events.push({ time: `0:${Math.floor(i / 4)}:${i % 4}`, stepIdx: i });
  });

  const part = new Tone.Part((time: number, ev: { stepIdx: number }) => {
    const isOddStep = ev.stepIdx % 2 === 1;
    const swing = isOddStep ? swingOffset : 0;
    const jitter = humanMs > 0 ? (Math.random() * 2 - 1) * humanSec : 0;
    const t = time + swing + jitter;

    if (isPerc && (isSnare || isHihat)) {
      synth.triggerAttackRelease(isHihat ? '32n' : '8n', t);
    } else if (isKick) {
      synth.triggerAttackRelease('C1', '8n', t);
    } else {
      synth.triggerAttackRelease(isBass ? 'C2' : 'C4', '8n', t);
    }
  }, events);
  part.loop = true;
  part.loopEnd = '1m';
  part.start(0);

  return {
    dispose: () => { try { part.dispose(); synth.dispose(); } catch {} },
    start: (t: number) => part.start(t),
  };
}

// ── DrumMachine compiler ───────────────────────────────────────────────────────
// Accepts DrumRow[] (string patterns with x/X/o/. cells) and compiles to Tone.js
// X = accent (velocity 1.0), x = normal (0.75), o = ghost (0.35), . = rest

export async function compileDrumMachine(
  rows: DrumRow[],
  bpm: number,
  onStep?: (step: number) => void,
): Promise<void> {
  const Tone = await import('tone');
  disposeAllSequences();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.bpm.value = bpm;

  let stepCb = onStep ?? null;

  // Playhead ticker
  const tickSeq = new Tone.Sequence(
    (time: number, step: number) => {
      Tone.getDraw().schedule(() => { stepCb?.(step); }, time);
    },
    Array.from({ length: 16 }, (_, i) => i),
    '16n',
  );
  tickSeq.loop = true;
  tickSeq.start(0);
  _globalDisposables.push(tickSeq);

  for (const row of rows) {
    if (row.muted) continue;
    const key = row.key.toLowerCase();
    const isKick    = /kick/.test(key);
    const isSnare   = /snare|clap/.test(key);
    const isHihat   = /hi.?hat|hihat/.test(key);
    const isOpenHat = /open/.test(key);
    const isBass    = /bass|sub/.test(key);

    let synth: any;
    if (isKick) {
      synth = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 10,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4, attackCurve: 'exponential' },
      }).toDestination();
    } else if (isSnare) {
      synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
      }).toDestination();
    } else if (isOpenHat) {
      synth = new Tone.MetalSynth({
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.3, release: 0.05 },
        volume: -12 + (row.volume ?? 0),
      }).toDestination();
    } else if (isHihat) {
      synth = new Tone.MetalSynth({
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
        volume: -10 + (row.volume ?? 0),
      }).toDestination();
    } else if (isBass) {
      synth = new Tone.MonoSynth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.4, release: 0.5 },
      }).toDestination();
      synth.volume.value = row.volume ?? 0;
    } else {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.7 },
      }).toDestination();
      synth.volume.value = -5 + (row.volume ?? 0);
    }

    const secPer16th = Tone.getTransport().toSeconds('16n');
    const swingOffset = secPer16th * ((row.swing ?? 0) / 100) * 0.667;
    const humanSec = (row.human ?? 0) / 1000;

    // Parse string pattern into events
    const events: Array<{ stepIdx: number; velocity: number }> = [];
    const pat = row.pattern.padEnd(16, '.');
    for (let i = 0; i < 16; i++) {
      const cell = pat[i];
      if (cell === 'x') events.push({ stepIdx: i, velocity: 0.75 });
      else if (cell === 'X') events.push({ stepIdx: i, velocity: 1.0 });
      else if (cell === 'o') events.push({ stepIdx: i, velocity: 0.35 });
    }

    if (events.length === 0) continue;

    const toneEvents = events.map(e => ({ time: `0:${Math.floor(e.stepIdx / 4)}:${e.stepIdx % 4}`, ...e }));

    const part = new Tone.Part((time: number, ev: { stepIdx: number; velocity: number }) => {
      const isOdd = ev.stepIdx % 2 === 1;
      const swing = isOdd ? swingOffset : 0;
      const jitter = humanSec > 0 ? (Math.random() * 2 - 1) * humanSec : 0;
      const t = time + swing + jitter;

      if (isKick) {
        synth.triggerAttackRelease('C1', '8n', t, ev.velocity);
      } else if (isSnare) {
        synth.triggerAttackRelease('16n', t, ev.velocity);
      } else if (isHihat || isOpenHat) {
        synth.triggerAttackRelease(isOpenHat ? '8n' : '32n', t, ev.velocity);
      } else {
        synth.triggerAttackRelease(isBass ? 'C2' : 'C4', '8n', t, ev.velocity);
      }
    }, toneEvents);

    part.loop = true;
    part.loopEnd = '1m';
    part.start(0);
    (part as any).__trackKey = `dm_${row.key}`;
    (synth as any).__trackKey = `dm_synth_${row.key}`;

    _globalDisposables.push({
      dispose: () => { try { part.dispose(); synth.dispose(); } catch {} },
    });
  }

  await Tone.start();
  transport.start();
}
