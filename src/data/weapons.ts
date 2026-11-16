// Weapon definitions (docs/02_systems_spec.md §3.2). Owner: 04 sniping; 07 adds tech variants.
//
// A weapon is a plain record. Technology changes it through modifiers (data/techs.ts `weapon.*`):
// sim/tactical/weapon.ts `weaponOf(state)` returns the definition with them applied — large calibre
// or semi-automatic (W5), optics or ammunition engineering (W6).

export interface WeaponDef {
  id: string;
  /** Muzzle velocity (m/s). */
  muzzleVelocity: number;
  /** Simple air drag: the speed decays by this factor per km travelled (v = v0 * exp(-drag * km)). */
  dragPerKm: number;
  gravity: number;
  magSize: number;
  /** Seconds to cycle the bolt after a shot (0 for semi-automatic). */
  boltTime: number;
  reloadTime: number;
  /** Scope magnification range and the factor of one wheel notch. */
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  /** Selectable zero distances (m). */
  zeroes: readonly number[];
  /** Bodies one bullet can pass through, and the damage factor after each one. */
  pierce: number;
  pierceFactor: number;
  /** Multiplies the damage table of data/zombies.ts; torsoMul on top for torso hits. */
  damageMul: number;
  torsoMul: number;
  /** Rounds of stock ammunition one cartridge costs (large calibre: 3). */
  ammoPerShot: number;
  /** Bullets are removed after flying this far (m). */
  maxRange: number;
  /** Recoil kick in mil (up) and random sideways share, hip-fire spread (mil, 1 sigma). */
  recoilMil: number;
  recoilSideMil: number;
  hipSpreadMil: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  rifle: {
    id: 'rifle',
    muzzleVelocity: 800,
    dragPerKm: 0.6,
    gravity: 9.81,
    magSize: 5,
    boltTime: 1.2,
    reloadTime: 2.8,
    zoomMin: 4,
    zoomMax: 12,
    zoomStep: 1.15,
    zeroes: [100, 200, 300, 400],
    pierce: 2,
    pierceFactor: 0.6,
    damageMul: 1,
    torsoMul: 1,
    ammoPerShot: 1,
    maxRange: 800,
    recoilMil: 14,
    recoilSideMil: 3,
    hipSpreadMil: 35,
  },
};
