// Zombies and bodies as instanced boxes: torso, head, face, two arms, two legs per figure — one draw call
// for the living, one for the dead, one for the blob shadows. Poses are computed on the CPU from
// the same numbers the hit shapes use (sim/tactical/zombies.ts hitShapes), so the head you see is
// the head you hit. Kinds read by silhouette: walkers upright with hanging / reaching arms,
// runners thin and bent forward, brutes wide and tall, crawlers flat on the ground.
//
// Facing (07b): a figure looks along its local -z (root = RotY(yaw), the same convention as the
// player's view). The lean, the reaching arms and the dark face plate all point that way. The
// first playtest caught the arms reaching backwards: arm poses are written "negative = forward"
// but were applied with the sign that swings a hanging limb back. See Bodies.add().

import * as THREE from 'three';
import type { GameState, ZombieKind } from '../../core/types.ts';
import { BALANCE } from '../../data/balance.ts';
import { RENDER } from '../../data/render.ts';
import { ZOMBIES } from '../../data/zombies.ts';
import type { RenderContext, SubRenderer } from '../index.ts';

const R = RENDER.zombies;
const PARTS = 7;
const MAX_LIVE = BALANCE.zombie.max;
const MAX_DEAD = BALANCE.combat.corpse.max;
const DOWN = BALANCE.zombie.downSeconds;

interface Pose {
  /** Whole body tipping over about the feet (radians; + = onto the back). */
  tilt: number;
  /** Upper body lean forward about the hips. */
  lean: number;
  /** Arm swing about the shoulder (radians): 0 hangs down, negative reaches forward, -PI points up past the head. */
  armL: number;
  armR: number;
  /** Leg swing about the hip: positive = forward. */
  legL: number;
  legR: number;
  /** Hips lowered by this much (knees giving way). */
  drop: number;
  prone: boolean;
  /** Crawl cycle phase. */
  phase: number;
}

const root = new THREE.Matrix4();
const upper = new THREE.Matrix4();
const a = new THREE.Matrix4();
const b = new THREE.Matrix4();
const out = new THREE.Matrix4();
const color = new THREE.Color();

function pick(list: readonly number[], seed: number): number {
  return list[seed % list.length]!;
}

class Bodies {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;

  constructor(capacity: number) {
    const material = new THREE.MeshLambertMaterial();
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, capacity * PARTS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, color.set(0xffffff));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  }

  begin(): void {
    this.n = 0;
  }
  end(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** parent * T(px, py, pz) * Rx(rx) * T(0, cy, cz) * S(sx, sy, sz) */
  private part(parent: THREE.Matrix4, px: number, py: number, pz: number, rx: number, cy: number, cz: number, sx: number, sy: number, sz: number, hex: number, shade: number): void {
    a.makeRotationX(rx).setPosition(px, py, pz);
    b.makeScale(sx, sy, sz).setPosition(0, cy, cz);
    out.multiplyMatrices(parent, a).multiply(b);
    this.mesh.setMatrixAt(this.n, out);
    this.mesh.setColorAt(this.n, color.set(hex).multiplyScalar(shade));
    this.n++;
  }

  add(kind: ZombieKind, x: number, y: number, z: number, yaw: number, pose: Pose, seed: number, shade: number): void {
    const def = ZOMBIES[kind];
    const pal = R[kind];
    const top = pick(pal.top, seed);
    const legs = pick(pal.legs, seed >> 2);
    const skin = pick(R.skin, seed >> 4);
    const armColor = kind === 'brute' ? skin : top;
    root.makeRotationY(yaw).setPosition(x, y, z);
    const W = def.width;
    const scale = def.height / 1.75;
    const armW = (kind === 'brute' ? 0.2 : kind === 'runner' ? 0.085 : 0.1) * 1;
    const armLen = 0.66 * scale;
    const legW = def.legR * 1.25;
    if (pose.prone) {
      // Flat on the ground, head first along the facing direction (local -z).
      const crawl = Math.sin(pose.phase);
      this.part(root, 0, 0.2, -0.24, 0, 0, 0, W, 0.26, 0.62, top, shade);
      this.part(root, 0, 0.25, -0.8, 0, 0, 0, def.headR * 1.8, def.headR * 1.9, def.headR * 2, skin, shade);
      this.part(root, 0, 0.22, -0.8 - def.headR, 0, 0, 0, def.headR * 1.3, def.headR * 1.1, 0.04, R.face, shade);
      this.part(root, -W / 2, 0.14, -0.45, -Math.PI / 2 + 0.25 * crawl, armLen / 2, 0, armW, armLen, armW, armColor, shade);
      this.part(root, W / 2, 0.14, -0.45, -Math.PI / 2 - 0.25 * crawl, armLen / 2, 0, armW, armLen, armW, armColor, shade);
      this.part(root, -W * 0.22, 0.14, 0.2, Math.PI / 2 + 0.08 * crawl, 0.36, 0, legW, 0.72, legW, legs, shade);
      this.part(root, W * 0.22, 0.14, 0.2, Math.PI / 2 - 0.08 * crawl, 0.36, 0, legW, 0.72, legW, legs, shade);
      return;
    }
    const H = def.height;
    const hip = H * 0.5;
    if (pose.tilt !== 0) {
      a.makeRotationX(pose.tilt);
      root.multiply(a);
      // Lying down, the body rests on its back / front rather than sinking into the ground.
      b.makeTranslation(0, 0, 0);
      root.elements[13] = root.elements[13]! + Math.abs(Math.sin(pose.tilt)) * def.torsoR * 0.75;
    }
    const hipY = hip - pose.drop;
    a.makeRotationX(-pose.lean).setPosition(0, hipY, 0);
    upper.multiplyMatrices(root, a);
    const torsoLen = hip - def.headR * 2 - 0.02;
    const depth = def.torsoR * 1.5;
    this.part(upper, 0, 0, 0, 0, torsoLen / 2, 0, W, torsoLen, depth, top, shade);
    this.part(upper, 0, hip - def.headR, 0, 0, 0, 0, def.headR * 1.8, def.headR * 2, def.headR * 1.9, skin, shade);
    // Face: a dark plate on the front (-z) of the head — sunken eyes and mouth, and the way it is looking.
    this.part(upper, 0, hip - def.headR * 1.1, -def.headR * 0.95, 0, 0, 0, def.headR * 1.3, def.headR * 1.1, 0.04, R.face, shade);
    const shoulder = torsoLen - 0.07;
    // Rx(+a) swings a hanging limb towards -z (forward); arm poses are written "negative = forward".
    this.part(upper, -(W + armW) / 2, shoulder, 0, -pose.armL, -armLen / 2, 0, armW, armLen, armW, armColor, shade);
    this.part(upper, (W + armW) / 2, shoulder, 0, -pose.armR, -armLen / 2, 0, armW, armLen, armW, armColor, shade);
    this.part(root, -W * 0.22, hipY, 0, pose.legL, -hipY / 2, 0, legW, hipY, legW, legs, shade);
    this.part(root, W * 0.22, hipY, 0, pose.legR, -hipY / 2, 0, legW, hipY, legW, legs, shade);
  }
}

const ease = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const pose: Pose = { tilt: 0, lean: 0, armL: 0, armR: 0, legL: 0, legR: 0, drop: 0, prone: false, phase: 0 };

/** Final resting pose of a body (also the end of the falling animation). */
function deadPose(kind: ZombieKind, prone: boolean, headshot: boolean, k: number, seed: number): Pose {
  const def = ZOMBIES[kind];
  pose.prone = prone;
  pose.phase = seed;
  pose.lean = 0;
  pose.drop = 0;
  if (prone) return pose;
  if (headshot) {
    // The head snaps back and the body goes over backwards, quickly.
    const f = ease(k / 0.45);
    pose.tilt = f * (Math.PI / 2) * (1 + 0.06 * Math.sin(Math.min(1, k / 0.45) * Math.PI));
    pose.lean = -0.5 * Math.sin(Math.min(1, k / 0.3) * Math.PI);
    // Arms fly up with the jolt, then come to rest beside the body (a little off the ground).
    const fling = Math.sin(Math.min(1, k / 0.7) * Math.PI);
    pose.armL = -1.3 * fling - 0.22 * f;
    pose.armR = -1.0 * fling - 0.08 * f;
    pose.legL = 0.15 * f;
    pose.legR = -0.1 * f;
  } else {
    // Knees give way, then it pitches forward onto its face.
    const f = ease((k - 0.25) / 0.6);
    pose.drop = def.height * 0.12 * Math.sin(Math.min(1, k / 0.5) * Math.PI);
    pose.tilt = -f * (Math.PI / 2);
    pose.lean = 0.5 * Math.sin(Math.min(1, k / 0.6) * Math.PI);
    // Arms thrown out ahead: they end up on the ground beyond the head.
    pose.armL = -3.0 * f;
    pose.armR = -3.3 * f;
    pose.legL = -0.1 * f;
    pose.legR = 0.12 * f;
  }
  return pose;
}

export function createZombieRenderer(): SubRenderer {
  const live = new Bodies(MAX_LIVE);
  const dead = new Bodies(MAX_DEAD);
  const blobGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: R.blobOpacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAX_LIVE);
  blobs.frustumCulled = false;
  blobs.count = 0;
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.renderOrder = 2;
  let deadKey = '';

  return {
    id: 'zombies',
    init(ctx: RenderContext) {
      ctx.scene.add(live.mesh, dead.mesh, blobs);
    },
    reset() {
      deadKey = '';
    },
    update(state: GameState) {
      const t = state.tactical;
      if (!t) {
        live.mesh.count = 0;
        dead.mesh.count = 0;
        blobs.count = 0;
        deadKey = '';
        return;
      }
      // --- the living (and the falling) ---
      live.begin();
      let nb = 0;
      for (const z of t.zombies) {
        const def = ZOMBIES[z.kind];
        const prone = z.crippled || def.prone;
        const seed = z.id * 7 + 3;
        if (z.state === 'down') {
          deadPose(z.kind, prone, z.headshot, z.t / DOWN, seed);
        } else {
          const hunting = z.state === 'chase' || z.state === 'attack';
          const stride = z.kind === 'runner' ? 2.3 : z.kind === 'brute' ? 1.5 : 1.25;
          const ph = (z.walk / stride) * Math.PI * 2;
          const swing = Math.sin(ph);
          const amp = z.kind === 'runner' && hunting ? 0.85 : z.kind === 'brute' ? 0.35 : 0.42;
          pose.prone = prone;
          pose.phase = ph;
          pose.tilt = 0;
          pose.drop = 0;
          pose.lean = def.lean * (hunting ? 1 : 0.4) - (z.flinch > 0 ? 0.55 * Math.sin((z.flinch / BALANCE.zombie.flinchSeconds) * Math.PI) : 0);
          pose.legL = amp * swing;
          pose.legR = -amp * swing;
          if (z.state === 'attack') {
            // Lunge: both arms thrown forward.
            pose.armL = -1.7;
            pose.armR = -1.5;
            pose.lean += 0.25;
          } else if (z.kind === 'runner') {
            pose.armL = hunting ? -0.3 - 0.9 * swing : 0.2 * swing;
            pose.armR = hunting ? -0.3 + 0.9 * swing : -0.2 * swing;
          } else if (z.kind === 'brute') {
            pose.armL = -0.15 - 0.3 * swing;
            pose.armR = -0.15 + 0.3 * swing;
          } else {
            // Walkers reach out when they have seen something.
            pose.armL = hunting ? -1.25 + 0.12 * swing : -0.12 - 0.3 * swing;
            pose.armR = hunting ? -1.1 - 0.12 * swing : -0.12 + 0.3 * swing;
          }
        }
        live.add(z.kind, z.pos[0], z.pos[1], z.pos[2], z.yaw, pose, seed, 1);
        if (nb < MAX_LIVE) {
          const r = prone ? 0.55 : def.width * 0.8 + 0.12;
          a.makeRotationY(z.yaw);
          b.makeScale(r, 1, prone ? r * 1.9 : r);
          out.multiplyMatrices(a, b).setPosition(z.pos[0], z.pos[1] + 0.05, z.pos[2]);
          blobs.setMatrixAt(nb++, out);
        }
      }
      live.end();
      blobs.count = nb;
      blobs.instanceMatrix.needsUpdate = true;

      // --- the dead: rewritten only when the list changes ---
      const corpses = t.corpses;
      let looted = 0;
      for (const c of corpses) if (c.ears <= 0) looted++;
      const key = `${corpses.length}:${corpses[0]?.id ?? 0}:${corpses[corpses.length - 1]?.id ?? 0}:${looted}`;
      if (key !== deadKey) {
        deadKey = key;
        dead.begin();
        for (const c of corpses) {
          const seed = c.id * 7 + 3;
          dead.add(c.kind, c.pos[0], c.pos[1], c.pos[2], c.yaw, deadPose(c.kind, c.crippled, c.headshot, 1, seed), seed, c.ears > 0 ? 1 : R.lootedShade);
        }
        dead.end();
      }
    },
    dispose() {
      for (const m of [live.mesh, dead.mesh, blobs]) {
        m.removeFromParent();
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    },
  };
}
