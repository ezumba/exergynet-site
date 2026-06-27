import type { EDLDocument } from '@/types/edl';

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
  tracks: Array<{ name: string; instrument: string; steps: boolean[]; volume?: number; muted?: boolean }>,
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
    const seq = await _buildTrackSequence(Tone, track.instrument, track.steps, track.volume ?? 0);
    if (seq) _globalDisposables.push(seq);
  }

  await Tone.start();
  transport.start();
}

export async function compileOrUpdateDrumTrack(
  track: { name: string; instrument: string; steps: boolean[]; volume?: number },
  bpm: number,
): Promise<void> {
  const Tone = await import('tone');
  // Dispose any existing sequence for this track name
  const key = `track_${track.name}`;
  const existing = (_globalDisposables as any[]).find((d: any) => d.__trackKey === key);
  if (existing) {
    try { existing.dispose(); } catch {}
    _globalDisposables = _globalDisposables.filter((d: any) => d.__trackKey !== key);
  }
  Tone.getTransport().bpm.value = bpm;
  const seq = await _buildTrackSequence(Tone, track.instrument, track.steps, track.volume ?? 0);
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

// Internal helper — build Tone sequence for one track
async function _buildTrackSequence(
  Tone: typeof import('tone'),
  instrument: string,
  steps: boolean[],
  volumeDb: number,
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

  const notes = steps.map((on, i) => on ? `0:${Math.floor(i/4)}:${i%4}` : null).filter(Boolean);

  const part = new Tone.Part((time: number) => {
    if (isPerc && (isSnare || isHihat)) {
      synth.triggerAttackRelease(isHihat ? '32n' : '8n', time);
    } else if (isKick) {
      synth.triggerAttackRelease('C1', '8n', time);
    } else {
      synth.triggerAttackRelease(isBass ? 'C2' : 'C4', '8n', time);
    }
  }, notes);
  part.loop = true;
  part.loopEnd = '1m';
  part.start(0);

  return {
    dispose: () => { try { part.dispose(); synth.dispose(); } catch {} },
    start: (t: number) => part.start(t),
  };
}
