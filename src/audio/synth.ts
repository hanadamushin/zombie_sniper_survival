// Small Web Audio toolkit (08): buses, a shared noise buffer, enveloped oscillators and noise
// bursts, and a "place" helper that pans and muffles a sound by where it comes from.
// No audio files — every sound in the game is built from these.

export type Bus = 'sfx' | 'ambience' | 'ui';

/** Where a sound comes from, relative to the listener: pan -1..1, distance in metres. */
export interface Place {
  pan: number;
  dist: number;
}

export interface Synth {
  readonly ctx: AudioContext;
  readonly now: number;
  bus(name: Bus): GainNode;
  setLevels(master: number, levels: Record<Bus, number>): void;
  /** Output for one sound: optional panning, distance gain and air absorption. Returns the node to connect to. */
  out(bus: Bus, gain: number, place?: Place, falloff?: { near: number; far: number }): AudioNode | null;
  tone(dest: AudioNode, o: ToneOpts): void;
  noise(dest: AudioNode, o: NoiseOpts): void;
  /** A looping noise source through a filter (wind, rain): returns the gain to automate and a stop function. */
  loopNoise(bus: Bus, filter: BiquadFilterType, freq: number, q: number): { gain: GainNode; filter: BiquadFilterNode; stop(): void };
}

export interface ToneOpts {
  type?: OscillatorType;
  freq: number;
  /** Frequency at the end (exponential glide). */
  to?: number;
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  /** Optional filter on the tone. */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  detune?: number;
}

export interface NoiseOpts {
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  /** Filter frequency at the end (exponential glide). */
  to?: number;
  q?: number;
}

export function createSynth(): Synth | null {
  const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
  const master = ctx.createGain();
  // A gentle limiter so that a volley of impacts does not clip.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);
  const buses: Record<Bus, GainNode> = { sfx: ctx.createGain(), ambience: ctx.createGain(), ui: ctx.createGain() };
  for (const b of Object.values(buses)) b.connect(master);

  // Two seconds of white noise, shared by every noisy sound.
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const env = (g: AudioParam, at: number, attack: number, decay: number, peak: number): void => {
    g.setValueAtTime(0.0001, at);
    g.linearRampToValueAtTime(peak, at + Math.max(0.001, attack));
    g.exponentialRampToValueAtTime(0.0001, at + Math.max(0.001, attack) + decay);
  };

  const synth: Synth = {
    ctx,
    get now() {
      return ctx.currentTime;
    },
    bus: (name) => buses[name],
    setLevels(m, levels) {
      master.gain.setTargetAtTime(m, ctx.currentTime, 0.03);
      for (const k of Object.keys(buses) as Bus[]) buses[k].gain.setTargetAtTime(levels[k], ctx.currentTime, 0.03);
    },
    out(bus, gain, place, falloff) {
      let g = gain;
      if (place && falloff) {
        if (place.dist > falloff.far) return null;
        g *= Math.min(1, falloff.near / Math.max(falloff.near, place.dist));
      }
      if (g < 0.002) return null;
      const node = ctx.createGain();
      node.gain.value = g;
      let head: AudioNode = node;
      if (place) {
        // Air takes the top off far sounds.
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = Math.max(700, 16000 / (1 + place.dist / 40));
        const pan = ctx.createStereoPanner();
        pan.pan.value = Math.max(-1, Math.min(1, place.pan));
        node.connect(lp).connect(pan).connect(buses[bus]);
        head = node;
      } else node.connect(buses[bus]);
      return head;
    },
    tone(dest, o) {
      const at = o.at ?? ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(o.freq, at);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), at + (o.attack ?? 0.005) + o.decay);
      if (o.detune) osc.detune.value = o.detune;
      const g = ctx.createGain();
      env(g.gain, at, o.attack ?? 0.005, o.decay, o.gain);
      let tail: AudioNode = osc;
      if (o.filter) {
        const f = ctx.createBiquadFilter();
        f.type = o.filter.type;
        f.frequency.value = o.filter.freq;
        f.Q.value = o.filter.q ?? 1;
        tail.connect(f);
        tail = f;
      }
      tail.connect(g).connect(dest);
      osc.start(at);
      osc.stop(at + (o.attack ?? 0.005) + o.decay + 0.05);
    },
    noise(dest, o) {
      const at = o.at ?? ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.freq, at);
      if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + (o.attack ?? 0.002) + o.decay);
      f.Q.value = o.q ?? 0.8;
      const g = ctx.createGain();
      env(g.gain, at, o.attack ?? 0.002, o.decay, o.gain);
      src.connect(f).connect(g).connect(dest);
      src.start(at, Math.random() * 1.5);
      src.stop(at + (o.attack ?? 0.002) + o.decay + 0.05);
    },
    loopNoise(bus, type, freq, q) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(buses[bus]);
      src.start();
      return {
        gain,
        filter,
        stop() {
          try {
            src.stop();
          } catch {
            /* already stopped */
          }
          gain.disconnect();
        },
      };
    },
  };
  return synth;
}
