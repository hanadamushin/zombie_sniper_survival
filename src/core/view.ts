// What the command layer is looking at and what the build cursor shows. Presentation state shared
// by the UI (which changes it) and the renderer (which draws from it); it is not part of GameState,
// the sim never reads it, and nothing here is saved.

export interface BuildPreviewTile {
  tx: number;
  ty: number;
  ok: boolean;
}

export interface CommandView {
  /** Point on the ground the overhead camera looks at (m); `ready` false until the camera has picked a start. */
  x: number;
  z: number;
  ready: boolean;
  /** Distance of the camera from that point (m) and its heading (radians; 0 looks north). */
  dist: number;
  yaw: number;
  /** Blueprint under the cursor: building id, rotation and the tiles it would occupy (null: nothing). */
  preview: { def: string; rot: number; tiles: BuildPreviewTile[] } | null;
  /** Structure highlighted for removal or inspection. */
  highlight: number | null;
  /** Show the 4 m grid around the cursor. */
  grid: boolean;
  cursor: [number, number] | null;
  /** Screen point -> ground point [x, z], supplied by the camera (null before the first frame). */
  pick: ((clientX: number, clientY: number) => [number, number] | null) | null;
}

export const VIEW_LIMITS = { minDist: 25, maxDist: 420, defaultDist: 140 } as const;

export const commandView: CommandView = { x: 0, z: 0, ready: false, dist: VIEW_LIMITS.defaultDist, yaw: 0, preview: null, highlight: null, grid: false, cursor: null, pick: null };

/** Move the look-at point by (right, forward) metres relative to the camera's heading. */
export function panView(right: number, forward: number): void {
  const s = Math.sin(commandView.yaw), c = Math.cos(commandView.yaw);
  commandView.x += right * c - forward * s;
  commandView.z += -right * s - forward * c;
}
export function zoomView(factor: number): void {
  commandView.dist = Math.min(VIEW_LIMITS.maxDist, Math.max(VIEW_LIMITS.minDist, commandView.dist * factor));
}
export function rotateView(radians: number): void {
  commandView.yaw += radians;
}
