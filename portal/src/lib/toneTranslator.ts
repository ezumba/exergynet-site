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
