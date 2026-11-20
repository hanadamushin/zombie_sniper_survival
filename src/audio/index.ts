// Sound (08): Web Audio synthesis only, no files. Listens to sim events for one-shot sounds
// (shots, impacts, alarms, completions) and samples the state once a frame for continuous ones
// (footsteps, the heartbeat while holding the breath, zombie moans, wind and insects).
// The AudioContext starts when the first key or button is released (browsers block it before that).
//
// Positions: sounds in the operation area are panned and muffled by where they are relative to
// the listener — the player in the tactical view, the overhead camera in the command layer.

import type { EventBus, GameEvent } from '../core/events.ts';
import { commandView } from '../core/view.ts';
import type { GameState, StaticGrid } from '../core/types.ts';
import { AUDIO } from '../data/audio.ts';
import { TACTICAL } from '../data/tactical.ts';
import { settings, onSettings } from '../settings.ts';
import { heightAt } from '../sim/tactical/collision.ts';
import { mapOf } from '../sim/tactical/area.ts';
import { createSynth, type Place, type Synth } from './synth.ts';

export interface Audio {
  /** Once a frame from the main loop (continuous sounds). */
  frame(state: GameState | null, realDt: number): void;
  /** Button clicks and the like. */
  ui(kind: 'click' | 'open' | 'close' | 'notice' | 'warn'): void;
  /** True once the AudioContext is running. */
  running(): boolean;
}

interface Deps {
  events: EventBus;
  getState(): GameState | null;
  getGrid(): StaticGrid | null;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export function createAudio(deps: Deps): Audio {
  let synth: Synth | null = null;
  let started = false;

  const applyLevels = (): void => {
    if (!synth) return;
    const v = settings.volume;
    synth.setLevels(v.master, { sfx: AUDIO.bus.sfx * v.sfx, ambience: AUDIO.bus.ambience * v.ambience, ui: AUDIO.bus.ui * v.ui });
  };
  onSettings(applyLevels);

  const start = (): void => {
    if (started) {
      if (synth && synth.ctx.state === 'suspended') void synth.ctx.resume().catch(() => {});
      return;
    }
    started = true;
    synth = createSynth();
    if (!synth) return;
    applyLevels();
    void synth.ctx.resume().catch(() => {});
  };
  // On the release, not the press: the press may be the one that asks for the pointer lock, and the
  // two are kept apart. The page has been interacted with by then, so the context may play.
  for (const ev of ['pointerup', 'keyup'] as const) window.addEventListener(ev, () => window.setTimeout(start, 0), { capture: true });

  // ---------------------------------------------------------------------------------------------
  // Where the listener is
  // ---------------------------------------------------------------------------------------------
  const listener = { x: 0, z: 0, yaw: 0 };
  const placeOf = (x: number, z: number): Place => {
    const dx = x - listener.x;
    const dz = z - listener.z;
    const dist = Math.hypot(dx, dz);
    const turn = Math.atan2(-dx, -dz) - listener.yaw;
    return { pan: -Math.sin(turn) * Math.min(1, dist / 4), dist };
  };

  // ---------------------------------------------------------------------------------------------
  // One-shot recipes
  // ---------------------------------------------------------------------------------------------
  const S = AUDIO;

  /** Suppressed rifle: a dry crack and a short thump, then the bolt and the spent case. */
  const shot = (scoped: boolean): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.shot.level);
    if (!out) return;
    const t = synth.now;
    synth.noise(out, { at: t, decay: 0.07, gain: 0.9, filter: 'bandpass', freq: 1400, to: 600, q: 0.7 });
    synth.noise(out, { at: t, decay: 0.18, gain: 0.35, filter: 'lowpass', freq: 500, to: 120 });
    synth.tone(out, { at: t, freq: 95, to: 48, decay: 0.12, gain: 0.55 });
    // The suppressor's hiss.
    synth.noise(out, { at: t + 0.01, attack: 0.01, decay: 0.25, gain: 0.12, filter: 'highpass', freq: 3500 });
    void scoped;
  };
  const bolt = (): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.shot.level * 0.6);
    if (!out) return;
    const t = synth.now;
    for (const [i, dt] of S.shot.bolt.entries()) {
      synth.noise(out, { at: t + dt, decay: 0.035, gain: 0.5, filter: 'bandpass', freq: i === 1 ? 2400 : 3200, q: 3 });
      synth.tone(out, { at: t + dt, type: 'square', freq: i === 1 ? 1300 : 1900, decay: 0.03, gain: 0.08, filter: { type: 'bandpass', freq: 2200, q: 4 } });
    }
    // The case lands and bounces.
    for (const [k, dt] of [S.shot.casing, S.shot.casing + 0.13, S.shot.casing + 0.21].entries()) {
      const g = 0.12 / (k + 1);
      synth.tone(out, { at: t + dt, freq: 4200 + rand(-200, 200), decay: 0.09, gain: g });
      synth.tone(out, { at: t + dt, freq: 6900 + rand(-300, 300), decay: 0.05, gain: g * 0.6 });
    }
  };
  const click = (gain = 0.4, freq = 2800): void => {
    if (!synth) return;
    const out = synth.out('sfx', gain);
    if (!out) return;
    synth.noise(out, { decay: 0.03, gain: 0.6, filter: 'bandpass', freq, q: 4 });
  };
  const reload = (seconds: number): void => {
    if (!synth) return;
    const out = synth.out('sfx', 0.35);
    if (!out) return;
    const t = synth.now;
    const marks = [0.1, 0.35, seconds * 0.45, seconds * 0.62, seconds * 0.8, seconds - 0.25];
    for (const [i, dt] of marks.entries()) synth.noise(out, { at: t + dt, decay: 0.04, gain: 0.5, filter: 'bandpass', freq: i % 2 ? 1800 : 2600, q: 3 });
  };

  /** Where the round landed, heard after the sound has travelled back. */
  const impact = (e: Extract<GameEvent, { type: 'bulletHit' }>): void => {
    if (!synth) return;
    const place = placeOf(e.pos[0], e.pos[2]);
    const out = synth.out('sfx', S.impact.level, place, S.falloff);
    if (!out) return;
    const delay = place.dist / S.soundSpeed;
    const t = synth.now + delay;
    if (e.zombie !== null) {
      synth.noise(out, { at: t, decay: 0.12, gain: 0.8, filter: 'lowpass', freq: 900, to: 200 });
      synth.tone(out, { at: t, freq: 140, to: 70, decay: 0.1, gain: 0.5 });
      return;
    }
    switch (e.surface) {
      case 'building':
      case 'stair':
      case 'rock':
      case 'scenery':
      case 'prop':
        synth.noise(out, { at: t, decay: 0.09, gain: 0.9, filter: 'highpass', freq: 1800 });
        synth.tone(out, { at: t, type: 'triangle', freq: 900 + rand(-150, 150), decay: 0.12, gain: 0.15 });
        break;
      case 'tree':
        synth.noise(out, { at: t, decay: 0.1, gain: 0.8, filter: 'bandpass', freq: 650, q: 2 });
        synth.tone(out, { at: t, freq: 320, to: 260, decay: 0.12, gain: 0.25 });
        break;
      default:
        synth.noise(out, { at: t, decay: 0.16, gain: 0.8, filter: 'lowpass', freq: 700, to: 180 });
    }
  };
  /** The confirmation a clean head shot gives through the scope: dull, short, unmistakable. */
  const headshot = (range: number): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.headshot.level);
    if (!out) return;
    const t = synth.now + Math.min(0.12, range / S.soundSpeed / 4);
    synth.tone(out, { at: t, freq: 210, to: 120, decay: 0.16, gain: 0.7, filter: { type: 'lowpass', freq: 900 } });
    synth.noise(out, { at: t, decay: 0.05, gain: 0.35, filter: 'bandpass', freq: 1800, q: 2 });
  };

  const knife = (hit: boolean): void => {
    if (!synth) return;
    const out = synth.out('sfx', 0.45);
    if (!out) return;
    const t = synth.now;
    synth.noise(out, { at: t, attack: 0.02, decay: 0.12, gain: 0.5, filter: 'bandpass', freq: 3000, to: 900, q: 1.5 });
    if (hit) {
      synth.noise(out, { at: t + 0.08, decay: 0.1, gain: 0.8, filter: 'lowpass', freq: 700, to: 150 });
      synth.tone(out, { at: t + 0.08, freq: 110, to: 60, decay: 0.12, gain: 0.5 });
    }
  };

  const moan = (x: number, z: number, chase: boolean, kind: string): void => {
    if (!synth) return;
    const place = placeOf(x, z);
    const out = synth.out('sfx', S.zombies.level, place, { near: 5, far: S.zombies.range });
    if (!out) return;
    const t = synth.now;
    const base = kind === 'brute' ? rand(55, 75) : kind === 'runner' ? rand(120, 160) : rand(80, 115);
    const len = chase ? rand(0.5, 0.9) : rand(1, 1.7);
    // A rough voice: sawtooth through a vowel-like band, sliding down.
    synth.tone(out, { at: t, type: 'sawtooth', freq: base * 1.15, to: base * 0.8, attack: len * 0.35, decay: len * 0.65, gain: 0.5, filter: { type: 'bandpass', freq: rand(450, 750), q: 3 } });
    synth.tone(out, { at: t, type: 'sawtooth', freq: base * 1.16 * 1.01, to: base * 0.78, attack: len * 0.35, decay: len * 0.65, gain: 0.3, filter: { type: 'bandpass', freq: rand(1100, 1500), q: 5 } });
    synth.noise(out, { at: t, attack: len * 0.3, decay: len * 0.7, gain: 0.12, filter: 'bandpass', freq: 900, q: 1 });
  };

  const wallHit = (x: number, z: number, heavy: boolean): void => {
    if (!synth) return;
    const place = placeOf(x, z);
    const out = synth.out('sfx', S.walls.level * (heavy ? 1.6 : 1), place, S.falloff);
    if (!out) return;
    const t = synth.now + place.dist / S.soundSpeed;
    synth.noise(out, { at: t, decay: heavy ? 0.9 : 0.18, gain: 0.9, filter: 'lowpass', freq: heavy ? 1200 : 450, to: heavy ? 90 : 120 });
    synth.tone(out, { at: t, freq: heavy ? 70 : 95, to: 45, decay: heavy ? 0.6 : 0.15, gain: 0.6 });
    if (heavy) for (let i = 0; i < 5; i++) synth.noise(out, { at: t + 0.1 + i * rand(0.05, 0.15), decay: 0.08, gain: 0.3, filter: 'bandpass', freq: rand(800, 2400), q: 2 });
  };

  const defenderShot = (x: number, z: number): void => {
    if (!synth) return;
    const place = placeOf(x, z);
    const out = synth.out('sfx', 0.35, place, S.falloff);
    if (!out) return;
    const t = synth.now + place.dist / S.soundSpeed;
    // Unsuppressed: louder and lower than the player's rifle.
    synth.noise(out, { at: t, decay: 0.25, gain: 0.9, filter: 'lowpass', freq: 2500, to: 300 });
    synth.tone(out, { at: t, freq: 70, to: 40, decay: 0.3, gain: 0.6 });
  };

  /** A struck iron bell: inharmonic partials, long decay, rung `n` times. */
  const bell = (n: number, level: number): void => {
    if (!synth) return;
    const out = synth.out('ui', level);
    if (!out) return;
    for (let i = 0; i < n; i++) {
      const t = synth.now + i * 0.7;
      for (const [r, g] of [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [8.9, 0.05]] as const) synth.tone(out, { at: t, freq: 520 * r, decay: 2.2 / r ** 0.4, gain: g });
    }
  };
  const chime = (notes: readonly number[], level: number, gap = 0.12, type: OscillatorType = 'sine'): void => {
    if (!synth) return;
    const out = synth.out('ui', level);
    if (!out) return;
    notes.forEach((f, i) => synth!.tone(out, { at: synth!.now + i * gap, type, freq: f, decay: 1.1, gain: 0.35 }));
  };
  const knock = (n: number, level: number): void => {
    if (!synth) return;
    const out = synth.out('ui', level);
    if (!out) return;
    for (let i = 0; i < n; i++) {
      synth.noise(out, { at: synth.now + i * 0.16, decay: 0.08, gain: 0.7, filter: 'bandpass', freq: 520, q: 3 });
      synth.tone(out, { at: synth.now + i * 0.16, freq: 240, decay: 0.08, gain: 0.3 });
    }
  };
  const pouch = (): void => {
    if (!synth) return;
    const out = synth.out('ui', 0.5);
    if (!out) return;
    synth.noise(out, { decay: 0.12, attack: 0.03, gain: 0.35, filter: 'bandpass', freq: 1200, q: 0.7 });
    synth.tone(out, { at: synth.now + 0.05, freq: 1320, decay: 0.12, gain: 0.12 });
  };
  const low = (level: number): void => {
    if (!synth) return;
    const out = synth.out('ui', level);
    if (!out) return;
    synth.tone(out, { freq: 98, to: 82, attack: 0.2, decay: 1.6, gain: 0.5 });
    synth.tone(out, { freq: 146.8, to: 123, attack: 0.2, decay: 1.6, gain: 0.25 });
  };
  const gasp = (): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.breath.gasp);
    if (!out) return;
    synth.noise(out, { attack: 0.08, decay: 0.5, gain: 0.7, filter: 'bandpass', freq: 1100, to: 700, q: 1.2 });
  };
  const hurt = (): void => {
    if (!synth) return;
    const out = synth.out('sfx', 0.4);
    if (!out) return;
    synth.noise(out, { decay: 0.2, gain: 0.8, filter: 'lowpass', freq: 600, to: 150 });
    synth.tone(out, { freq: 180, to: 90, decay: 0.25, gain: 0.3, filter: { type: 'lowpass', freq: 600 } });
  };

  // Walls are hit many times a second during a raid: keep it to a pulse.
  let lastWall = 0;

  const onEvent = (e: GameEvent): void => {
    if (!synth) return;
    const st = deps.getState();
    const tactical = st?.mode === 'tactical';
    switch (e.type) {
      case 'shotFired':
        shot(e.scoped === true);
        bolt();
        break;
      case 'dryFire': click(0.5, 2400); break;
      case 'reloadStarted': reload(e.seconds); break;
      case 'bulletHit':
        if ((e.range ?? 0) >= S.impact.minRange || e.zombie !== null) impact(e);
        break;
      case 'zombieKilled':
        if (e.by === 'player' && e.headshot && !e.knife) {
          const dx = e.pos[0] - listener.x;
          const dz = e.pos[2] - listener.z;
          headshot(Math.hypot(dx, dz));
        }
        break;
      case 'knifeSwing': knife(e.hit !== null); break;
      case 'earsCollected': pouch(); break;
      case 'playerHurt': if (tactical) hurt(); break;
      case 'playerInfected': low(0.25); break;
      case 'playerDied': low(0.6); break;
      case 'structureDamaged':
      case 'structureDestroyed': {
        const b = st?.build.structures.find((s) => s.id === e.id);
        if (!b || !st || mapOf(st)?.params.isHome !== true) break;
        const now = synth.now;
        if (e.type === 'structureDamaged' && now - lastWall < S.walls.minGap) break;
        lastWall = now;
        wallHit(b.tx * TACTICAL.tile + 2, b.ty * TACTICAL.tile + 2, e.type === 'structureDestroyed');
        break;
      }
      case 'defenderFired': defenderShot(e.pos[0], e.pos[2]); break;
      case 'hordeWarning': bell(S.alarm.rings, S.alarm.level); break;
      case 'raidStarted': if (!e.away) bell(e.kind === 'horde' ? S.alarm.rings + 1 : 2, S.alarm.level); break;
      case 'raidEnded': if (!e.away && e.repelled) chime([392, 523.3], 0.3, 0.25, 'triangle'); break;
      case 'structureBuilt': knock(2, 0.4); chime([523.3, 659.3], 0.18, 0.14); break;
      case 'blueprintPlaced': ui('click'); break;
      case 'techCompleted': chime([587.3, 740, 880], 0.3); break;
      case 'eraAdvanced': chime([293.7, 440, 587.3, 740, 880], 0.4, 0.22, 'triangle'); break;
      case 'victory': chime([261.6, 392, 523.3, 659.3, 784, 1046.5], 0.45, 0.3, 'triangle'); break;
      case 'defeat': low(0.6); break;
      case 'survivorHired': chime([440, 554.4], 0.22, 0.12, 'triangle'); break;
      case 'survivorDied': low(0.35); break;
      case 'survivorLeft': low(0.2); break;
      case 'candidateFound': chime([392, 493.9], 0.2, 0.15, 'triangle'); break;
      case 'expeditionReturned': knock(3, 0.3); break;
      case 'resupplied': click(0.4, 1800); click(0.3, 2600); break;
      case 'outpostFounded': chime([392, 523.3, 659.3], 0.3, 0.16, 'triangle'); break;
      case 'outpostLost': bell(1, 0.35); low(0.3); break;
      case 'wagesPaid': if (e.unpaid > 0) ui('warn'); break;
      case 'commandRejected': if (e.command !== 'markSeen' && e.command !== 'setMode') ui('warn'); break;
      default: break;
    }
  };
  deps.events.onAny(onEvent);

  function ui(kind: 'click' | 'open' | 'close' | 'notice' | 'warn'): void {
    if (!synth) return;
    const out = synth.out('ui', kind === 'click' ? 0.25 : 0.35);
    if (!out) return;
    switch (kind) {
      case 'click': synth.noise(out, { decay: 0.02, gain: 0.5, filter: 'bandpass', freq: 2600, q: 3 }); break;
      case 'open': synth.tone(out, { freq: 660, to: 880, decay: 0.08, gain: 0.25, type: 'triangle' }); break;
      case 'close': synth.tone(out, { freq: 880, to: 620, decay: 0.08, gain: 0.25, type: 'triangle' }); break;
      case 'notice': synth.tone(out, { freq: 784, decay: 0.25, gain: 0.25, type: 'triangle' }); break;
      case 'warn': synth.tone(out, { freq: 220, to: 196, decay: 0.2, gain: 0.35, type: 'square', filter: { type: 'lowpass', freq: 1200 } }); break;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Continuous sounds, sampled each frame
  // ---------------------------------------------------------------------------------------------
  let stepT = 0;
  let beatT = 0;
  let wasHolding = false;
  let moanT = 1;
  let birdT = 3;
  let wind: ReturnType<Synth['loopNoise']> | null = null;
  let insects: { gain: GainNode; stop(): void } | null = null;
  let drone: { gain: GainNode; stop(): void } | null = null;

  const startBeds = (s: Synth): void => {
    wind = s.loopNoise('ambience', 'lowpass', 380, 0.6);
    // Insects: a high band of noise, amplitude-modulated into a shimmer.
    {
      const bed = s.loopNoise('ambience', 'bandpass', 5200, 6);
      const lfo = s.ctx.createOscillator();
      lfo.frequency.value = 23;
      const depth = s.ctx.createGain();
      depth.gain.value = 0.5;
      const am = s.ctx.createGain();
      am.gain.value = 0.5;
      lfo.connect(depth).connect(am.gain);
      bed.gain.disconnect();
      bed.gain.connect(am).connect(s.bus('ambience'));
      lfo.start();
      insects = { gain: bed.gain, stop: () => { bed.stop(); lfo.stop(); am.disconnect(); } };
    }
    // The base drone: two slow, slightly detuned low tones.
    {
      const g = s.ctx.createGain();
      g.gain.value = 0;
      const lp = s.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const a = s.ctx.createOscillator();
      const b = s.ctx.createOscillator();
      a.type = 'triangle';
      b.type = 'triangle';
      a.frequency.value = 55;
      b.frequency.value = 82.6;
      b.detune.value = 7;
      a.connect(lp);
      b.connect(lp);
      lp.connect(g).connect(s.bus('ambience'));
      a.start();
      b.start();
      drone = { gain: g, stop: () => { a.stop(); b.stop(); g.disconnect(); } };
    }
  };

  const setLevel = (g: GainNode | undefined, v: number): void => {
    if (g && synth) g.gain.setTargetAtTime(v, synth.now, 0.6);
  };

  const footstep = (state: GameState): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.footsteps.level * (state.player.stance === 'stand' ? 1 : 0.5));
    if (!out) return;
    const map = mapOf(state);
    const p = state.player;
    const raised = map ? p.pos[1] - heightAt(map, p.pos[0], p.pos[2]) > 0.5 : false;
    const land = map?.params.land;
    if (raised) {
      // Planks of a tower or a roof.
      synth.noise(out, { decay: 0.06, gain: 0.6, filter: 'bandpass', freq: 450, q: 2 });
      synth.tone(out, { freq: 160, decay: 0.06, gain: 0.25 });
    } else if (land === 'urban' || land === 'suburb') {
      synth.noise(out, { decay: 0.05, gain: 0.6, filter: 'bandpass', freq: 2200, q: 1.2 });
    } else {
      // Grass and earth: a soft brush with a little crunch.
      synth.noise(out, { attack: 0.01, decay: 0.09, gain: 0.6, filter: 'lowpass', freq: 1000 });
      synth.noise(out, { decay: 0.03, gain: 0.15, filter: 'bandpass', freq: 3500, q: 2 });
    }
  };

  const heartbeat = (): void => {
    if (!synth) return;
    const out = synth.out('sfx', S.breath.level);
    if (!out) return;
    const t = synth.now;
    synth.tone(out, { at: t, freq: 58, to: 40, decay: 0.12, gain: 0.9 });
    synth.tone(out, { at: t + 0.22, freq: 52, to: 38, decay: 0.1, gain: 0.6 });
  };

  const bird = (): void => {
    if (!synth) return;
    const place = { pan: rand(-0.9, 0.9), dist: rand(30, 120) };
    const out = synth.out('ambience', S.ambience.birds.level, place, { near: 30, far: 400 });
    if (!out) return;
    const f = rand(2400, 3800);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) synth.tone(out, { at: synth.now + i * rand(0.09, 0.16), freq: f, to: f * rand(0.75, 1.3), decay: 0.08, gain: 0.5 });
  };

  return {
    ui,
    running: () => synth?.ctx.state === 'running',
    frame(state, realDt) {
      if (!synth) return;
      if (!wind) startBeds(synth);
      const dt = Math.min(0.1, Math.max(0, realDt));
      const active = state !== null && state.mode !== 'menu' && !state.world.travel;
      const tactical = active && state!.mode === 'tactical';
      if (state && state.mode === 'tactical') {
        listener.x = state.player.pos[0];
        listener.z = state.player.pos[2];
        listener.yaw = state.player.yaw;
      } else if (state && state.mode === 'command') {
        listener.x = commandView.x;
        listener.z = commandView.z;
        listener.yaw = commandView.yaw;
      }

      // --- ambience: wind always, insects at night, birds by day, the base drone in the command layer ---
      const hour = state ? state.time.minute / 60 : 12;
      const night = hour < 5 || hour >= 19;
      const land = state ? mapOf(state)?.params.land : undefined;
      const urban = land === 'urban' || land === 'suburb';
      const A = S.ambience;
      const windLevel = !active ? 0 : (urban ? A.wind.urban : 1) * (night ? A.wind.night : A.wind.day);
      setLevel(wind?.gain, windLevel);
      // Gusts: the filter wanders slowly.
      if (wind) wind.filter.frequency.setTargetAtTime(300 + 220 * (0.5 + 0.5 * Math.sin(synth.now * 0.21) * Math.sin(synth.now * 0.077)), synth.now, 1.5);
      setLevel(insects?.gain, active && night && !urban ? A.insects : 0);
      setLevel(drone?.gain, active && state!.mode === 'command' ? A.drone : 0);
      if (active && !night && !urban && tactical) {
        birdT -= dt;
        if (birdT <= 0) {
          birdT = rand(0.5, 1.5) * A.birds.interval;
          bird();
        }
      }
      if (!tactical || !state) {
        wasHolding = false;
        return;
      }

      // --- footsteps ---
      const p = state.player;
      const speed = Math.hypot(p.vel[0], p.vel[2]);
      const F = S.footsteps;
      if (speed > F.minSpeed && p.aim.deadT <= 0) {
        const interval = (speed > 2.6 ? F.runInterval : F.walkInterval) * (p.stance === 'stand' ? 1 : F.crouchFactor);
        stepT -= dt * state.time.speed;
        if (stepT <= 0) {
          stepT = interval;
          footstep(state);
        }
      } else stepT = Math.min(stepT, 0.1);

      // --- holding the breath: the heartbeat; a gasp when it runs out ---
      const holding = p.aim.holding && p.aim.scopeT > 0.5;
      if (holding) {
        beatT -= dt;
        if (beatT <= 0) {
          beatT = 60 / S.breath.bpm;
          heartbeat();
        }
      } else beatT = 0;
      if (wasHolding && !holding && p.aim.breathLock > 0) gasp();
      wasHolding = holding;

      // --- zombies: now and then one of the near ones moans ---
      moanT -= dt;
      if (moanT <= 0) {
        const Z = S.zombies;
        let chase = false;
        const near: { x: number; z: number; d: number; chase: boolean; kind: string }[] = [];
        for (const z of state.tactical?.zombies ?? []) {
          if (z.state === 'down' || z.dummy) continue;
          const d = Math.hypot(z.pos[0] - p.pos[0], z.pos[2] - p.pos[2]);
          if (d > Z.range) continue;
          const c = z.state === 'chase' || z.state === 'attack';
          chase ||= c;
          near.push({ x: z.pos[0], z: z.pos[2], d, chase: c, kind: z.kind });
        }
        moanT = (chase ? Z.chaseInterval : Z.interval) * rand(0.6, 1.4);
        if (near.length > 0) {
          near.sort((a, b) => a.d - b.d);
          const voices = Math.min(Z.maxVoices, near.length, 1 + Math.floor(Math.random() * Z.maxVoices));
          for (let i = 0; i < voices; i++) {
            const pick = near[Math.floor(Math.random() * Math.min(near.length, 6))]!;
            moan(pick.x, pick.z, pick.chase, pick.kind);
          }
        }
      }
    },
  };
}
