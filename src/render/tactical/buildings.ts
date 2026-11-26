// Buildings, stairs, towers and ladders as instanced boxes (one draw call) plus gable roofs
// (one more). Windows are drawn by the fragment shader from the box-space position, so there are
// no textures and no per-building geometry.

import * as THREE from 'three';
import { RENDER } from '../../data/render.ts';
import type { Building, TacticalMap } from '../../gen/index.ts';
import { hash01 } from '../../gen/noise.ts';
import type { Built } from './terrain.ts';

const B = RENDER.buildings;
/** How far building boxes reach below their floor level (hides gaps on sloping ground). */
const SUNK = 3;
/** Window style per building kind: 0 none, 1 house, 2 apartment grid, 3 office ribbons. */
export const STYLE: Record<Building['kind'], number> = { house: 1, barn: 0, shed: 0, shop: 3, apartment: 2, office: 3, warehouse: 0, tower: 0 };

export function boxMaterial(): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial();
  const glass = new THREE.Color(B.glass);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlass = { value: glass };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aStyle;
        varying vec3 vBox;
        varying vec3 vHalf;
        varying vec3 vBoxNormal;
        varying float vStyle;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 boxScale = vec3( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ), length( instanceMatrix[2].xyz ) );
        #else
          vec3 boxScale = vec3( 1.0 );
        #endif
        vHalf = boxScale * 0.5;
        vBox = vec3( position.x * boxScale.x, ( position.y + 0.5 ) * boxScale.y - ${SUNK.toFixed(1)}, position.z * boxScale.z );
        vBoxNormal = normal;
        vStyle = aStyle;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uGlass;
        varying vec3 vBox;
        varying vec3 vHalf;
        varying vec3 vBoxNormal;
        varying float vStyle;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if ( vStyle > 0.5 ) {
          if ( vBoxNormal.y > 0.5 ) {
            diffuseColor.rgb *= 0.72; // roofing
          } else if ( abs( vBoxNormal.y ) < 0.5 ) {
            bool alongZ = abs( vBoxNormal.x ) > 0.5;
            float u = alongZ ? vBox.z : vBox.x;
            float halfW = alongZ ? vHalf.z : vHalf.x;
            float top = vHalf.y * 2.0 - ${SUNK.toFixed(1)};
            // period (x: bay width, y: storey height) and glazed share of each
            vec2 period = vStyle < 1.5 ? vec2( 2.6, 2.9 ) : vStyle < 2.5 ? vec2( 3.0, 3.0 ) : vec2( 3.4, 3.4 );
            vec2 share = vStyle < 1.5 ? vec2( 0.42, 0.4 ) : vStyle < 2.5 ? vec2( 0.55, 0.5 ) : vec2( 0.86, 0.55 );
            vec2 cell = vec2( ( u + halfW ) / period.x, vBox.y / period.y );
            vec2 f = fract( cell );
            vec2 w = fwidth( cell ) + 1e-4;
            vec2 lo = ( 1.0 - share ) * 0.5;
            vec2 m = smoothstep( lo - w, lo + w, f ) * ( 1.0 - smoothstep( lo + share - w, lo + share + w, f ) );
            float inside = step( 0.5, u + halfW ) * step( u + halfW, halfW * 2.0 - 0.5 ) * step( 0.3, vBox.y ) * step( vBox.y, top - 0.6 );
            float pattern = m.x * m.y;
            // Far away the pattern is finer than a pixel: fade to its average tone instead of shimmering.
            float fade = clamp( max( w.x, w.y ) * 2.2 - 0.3, 0.0, 1.0 );
            float glazed = mix( pattern, share.x * share.y, fade ) * inside;
            diffuseColor.rgb = mix( diffuseColor.rgb, uGlass, glazed * 0.9 );
            // Floor lines on the taller blocks.
            if ( vStyle > 1.5 ) diffuseColor.rgb *= 1.0 - 0.12 * inside * ( 1.0 - fade ) * step( f.y, 0.06 );
          }
        }`);
  };
  return material;
}

/** Unit gable roof: footprint [-0.5, 0.5]², eaves at y = 0, ridge along x at y = 1. */
export function gableGeometry(): THREE.BufferGeometry {
  const a = [-0.5, 0, -0.5], b = [0.5, 0, -0.5], c = [0.5, 0, 0.5], d = [-0.5, 0, 0.5], e = [-0.5, 1, 0], f = [0.5, 1, 0];
  const tris = [a, e, f, a, f, b, d, c, f, d, f, e, a, d, e, b, f, c];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildBuildings(map: TacticalMap): Built {
  const seed = map.params.mapSeed;
  const boxes: { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: number; style: number; shade: number }[] = [];
  const roofs: { b: Building; color: number }[] = [];
  const pickFrom = (list: readonly number[], t: number): number => list[Math.min(list.length - 1, Math.floor(t * list.length))]!;

  for (const b of map.buildings) {
    if (b.kind === 'tower' || b.enter !== undefined) continue; // 07d: enterable ones are drawn by enterables.ts
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    boxes.push({
      x: (b.x0 + b.x1) / 2, y: b.base - SUNK + (b.height + SUNK) / 2, z: (b.z0 + b.z1) / 2,
      sx: w, sy: b.height + SUNK, sz: d,
      color: pickFrom(B.walls[b.kind], b.tint), style: STYLE[b.kind], shade: 0.9 + 0.2 * hash01(b.id, 7, seed),
    });
    if (b.roof === 'gable') roofs.push({ b, color: pickFrom(B.roofs, hash01(b.id, 3, seed)) });
  }
  // 09b: the door steps of the enterable buildings (thousands of small boxes in a town on a slope) are
  // drawn per block of B.stepChunk metres, so that the blocks out of view are culled.
  const steps = new Map<number, typeof boxes>();
  for (const s of map.solids) {
    if (s.kind !== 'stair' && s.kind !== 'prop') continue;
    const solidFlight = s.y1 - s.y0 > 0.6 && s.kind === 'stair';
    let list = boxes;
    if (s.kind === 'stair' && map.buildings[s.ref]?.enter !== undefined) {
      const key = Math.floor((s.z0 + s.z1) / 2 / B.stepChunk) * 64 + Math.floor((s.x0 + s.x1) / 2 / B.stepChunk);
      list = steps.get(key) ?? [];
      steps.set(key, list);
    }
    list.push({
      x: (s.x0 + s.x1) / 2, y: (s.y0 + s.y1) / 2, z: (s.z0 + s.z1) / 2,
      sx: s.x1 - s.x0, sy: s.y1 - s.y0, sz: s.z1 - s.z0,
      color: solidFlight ? B.concrete : B.steel, style: 0, shade: 1,
    });
  }
  for (const l of map.ladders) {
    // Two rails and rungs, flat against the wall the ladder belongs to.
    const cx = (l.x0 + l.x1) / 2;
    const cz = (l.z0 + l.z1) / 2;
    const reach = (Math.abs(l.nx) > 0 ? l.x1 - l.x0 : l.z1 - l.z0) / 2 - 0.12;
    const wx = cx + l.nx * reach;
    const wz = cz + l.nz * reach;
    const tx = -l.nz;
    const tz = l.nx;
    const h = l.y1 - l.y0 + 0.9;
    for (const side of [-0.25, 0.25]) {
      boxes.push({ x: wx + tx * side, y: l.y0 + h / 2 - 0.2, z: wz + tz * side, sx: 0.06, sy: h, sz: 0.06, color: B.steel, style: 0, shade: 0.8 });
    }
    for (let y = l.y0 + 0.3; y < l.y1; y += 0.35) {
      boxes.push({ x: wx, y, z: wz, sx: Math.abs(tx) * 0.5 + 0.04, sy: 0.04, sz: Math.abs(tz) * 0.5 + 0.04, color: B.steel, style: 0, shade: 0.8 });
    }
  }

  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const color = new THREE.Color();

  if (boxes.length > 0 || steps.size > 0) {
    const material = boxMaterial();
    disposables.push(material);
    const add = (list: typeof boxes, name: string, open = false): void => {
      if (list.length === 0) return;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      // Door steps stand in the ground: their underside is never seen (BoxGeometry's faces are in the
      // order +x -x +y -y +z -z, six indices each).
      if (open) geo.setIndex(Array.from(geo.index!.array).filter((_, i) => i < 18 || i >= 24));
      const style = new Float32Array(list.length);
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((bx, i) => {
        m.compose(new THREE.Vector3(bx.x, bx.y, bx.z), q, new THREE.Vector3(bx.sx, bx.sy, bx.sz));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color.setHex(bx.color).multiplyScalar(bx.shade));
        style[i] = bx.style;
      });
      geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 1));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = name;
      group.add(mesh);
      disposables.push(geo, mesh);
    };
    add(boxes, 'boxes');
    for (const list of steps.values()) add(list, 'steps', true);
  }

  if (roofs.length > 0) {
    const geo = gableGeometry();
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, material, roofs.length);
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    roofs.forEach(({ b, color: c }, i) => {
      const w = b.x1 - b.x0 + 0.8;
      const d = b.z1 - b.z0 + 0.8;
      const alongX = w >= d;
      const rise = Math.min(w, d) * 0.3;
      m.compose(
        new THREE.Vector3((b.x0 + b.x1) / 2, b.base + b.height - 0.02, (b.z0 + b.z1) / 2),
        alongX ? q : turn,
        new THREE.Vector3(alongX ? w : d, rise, alongX ? d : w),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.setHex(c).multiplyScalar(0.9 + 0.2 * hash01(b.id, 9, seed)));
    });
    mesh.computeBoundingSphere();
    mesh.name = 'roofs';
    group.add(mesh);
    disposables.push(geo, material, mesh);
  }

  return {
    object: group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
