"use client";
import * as Tone from 'tone';
import type { ExergyDSPProtocol, EDLTrack, EDLHumanize } from '@/types/edl';

type AnyToneInstrument = Tone.PolySynth | Tone.MonoSynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;

let activeSynths: AnyToneInstrument[] = [];
let activeParts: Tone.Part[] = [];
let masterReverb: Tone.Reverb | null = null;
let masterCompressor: Tone.Compressor | null = null;

function humanizeVelocity(v: number, h?: EDLHumanize): number {
  if (!h) return v;
  const variation = (Math.random() - 0.5) * 2 * (h.velocity ?? 0.08);
  return Math.max(0.05, Math.min(1.0, v + variation));
}

function humanizeTime(time: string, h?: EDLHumanize): number {
  const base = Tone.Time(time).toSeconds();
  if (!h) return base;
  return base + (Math.random() - 0.5) * 2 * (h.timing ?? 0.015);
}

function buildSynth(track: EDLTrack): AnyToneInstrument {
  const cfg = track.config ?? {};
  switch (track.drumType) {
    case 'kick':
      return new Tone.MembraneSynth({
        pitchDecay: cfg.pitchDecay ?? 0.05,
        octaves: cfg.octaves ?? 4,
        oscillator: cfg.oscillator ?? { type: 'sine' },
        envelope: cfg.envelope ?? { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
      });
    case 'hihat':
    case 'snare':
      return new Tone.NoiseSynth({
        noise: cfg.noise ?? { type: 'white' },
        envelope: cfg.envelope ?? { attack: 0.001, decay: track.drumType === 'snare' ? 0.2 : 0.05, sustain: 0 },
      });
  }

  // Physical model: modal resonator via oscillator bank
  if (track.type === 'physical' && track.model === 'modal_resonator') {
    const freqs: number[] = cfg.frequencies ?? [82, 164, 246];
    const poly = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: cfg.decays?.[0] ?? 0.8, sustain: 0, release: 1.0 },
    });
    return poly;
  }

  // Hybrid: use first synth layer
  if (track.type === 'hybrid') {
    const synthLayer = track.layers?.find(l => l.type === 'synth' || l.type === 'physical');
    const synthName = (track.synth ?? synthLayer?.synth ?? 'PolySynth') as string;
    return synthName === 'MonoSynth'
      ? new Tone.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 } })
      : new Tone.PolySynth(Tone.Synth, cfg);
  }

  // Regular synth
  const synthName = (track.synth ?? 'PolySynth') as string;
  if (synthName === 'MonoSynth') {
    return new Tone.MonoSynth({
      oscillator: cfg.oscillator ?? { type: 'sawtooth' },
      envelope: cfg.envelope ?? { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 },
    });
  }
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: cfg.oscillator ?? { type: 'sawtooth' },
    envelope: cfg.envelope ?? { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1.0 },
  });
}

function applyEffects(synth: AnyToneInstrument, track: EDLTrack, masterOut: Tone.ToneAudioNode): void {
  const isDrum = !!track.drumType;
  let current: Tone.ToneAudioNode = synth as any;

  for (const fx of (track.effects ?? [])) {
    let node: Tone.ToneAudioNode | null = null;
    if (fx.type === 'Reverb') node = new Tone.Reverb({ decay: fx.decay ?? 2, wet: fx.wet ?? 0.3 });
    else if (fx.type === 'Delay') node = new Tone.FeedbackDelay({ delayTime: fx.time ?? '8n', feedback: fx.feedback ?? 0.3, wet: fx.wet ?? 0.2 });
    else if (fx.type === 'Chorus') node = new Tone.Chorus({ frequency: fx.frequency ?? 4, delayTime: fx.delayTime ?? 2.5, depth: fx.depth ?? 0.5, wet: fx.wet ?? 0.3 }).start();
    else if (fx.type === 'Filter') node = new Tone.Filter({ type: fx.filterType ?? 'lowpass', frequency: fx.frequency ?? 800, rolloff: fx.rolloff ?? -24 });
    else if (fx.type === 'Compressor') node = new Tone.Compressor({ threshold: fx.threshold ?? -18, ratio: fx.ratio ?? 4, attack: fx.attack ?? 0.003, release: fx.release ?? 0.1 });
    else if (fx.type === 'Panner') node = new Tone.Panner(fx.position ?? 0);

    if (node) {
      current.connect(node as any);
      current = node;
    }
  }

  // Drums bypass master reverb; melodic routes through it
  if (isDrum || !masterOut) {
    current.toDestination();
  } else {
    current.connect(masterOut as any);
  }
}

export const compileAndPlayEDL = async (script: ExergyDSPProtocol): Promise<void> => {
  await Tone.start();
  Tone.getTransport().stop();
  Tone.getTransport().cancel();

  activeParts.forEach(p => p.dispose());
  activeParts = [];
  activeSynths.forEach(s => s.dispose());
  activeSynths = [];
  masterReverb?.dispose();
  masterCompressor?.dispose();

  Tone.getTransport().bpm.value = script.bpm;

  // Build master chain
  masterCompressor = new Tone.Compressor({
    threshold: script.master?.compressor?.threshold ?? -14,
    ratio: script.master?.compressor?.ratio ?? 3,
    attack: script.master?.compressor?.attack ?? 0.003,
    release: script.master?.compressor?.release ?? 0.25,
  }).toDestination();

  masterReverb = new Tone.Reverb({
    decay: script.master?.reverb?.decay ?? 2.5,
    wet: script.master?.reverb?.wet ?? 0.3,
  });
  masterReverb.connect(masterCompressor);
  await masterReverb.generate();

  const loopLength = script.loopEnd ?? '4m';
  const humanize = script.humanize;

  for (const track of script.tracks) {
    const synth = buildSynth(track);
    synth.volume.value = track.volume ?? -2;
    applyEffects(synth, track, masterReverb);
    activeSynths.push(synth);

    const isDrum = !!track.drumType;
    const part = new Tone.Part((time: number, value: any) => {
      const t = humanizeVelocity(value.velocity ?? 0.8, humanize);
      const when = humanize ? humanizeTime(value.time, humanize) + (time - Tone.Time(value.time).toSeconds()) : time;
      try {
        if (isDrum) {
          (synth as Tone.MembraneSynth | Tone.NoiseSynth).triggerAttackRelease(value.duration, when, t);
        } else {
          (synth as Tone.PolySynth | Tone.MonoSynth).triggerAttackRelease(value.note, value.duration, when, t);
        }
      } catch (_) {}
    }, track.notes).start(0);

    part.loop = true;
    part.loopEnd = loopLength;
    activeParts.push(part);
  }

  Tone.getTransport().start();
};

export const stopEDL = (): void => {
  Tone.getTransport().stop();
  activeParts.forEach(p => p.dispose());
  activeParts = [];
  activeSynths.forEach(s => s.dispose());
  activeSynths = [];
  masterReverb?.dispose();
  masterCompressor?.dispose();
  masterReverb = null;
  masterCompressor = null;
};

export const isEDLPlaying = (): boolean => Tone.getTransport().state === 'started';
