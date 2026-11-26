// "What is wrong right now" (08): the problems a player should look at, worst first.
// Read-only selectors over GameState; the HUD shows the count, the command layer the list.

import type { GameState } from '../core/types.ts';
import { BUILD } from '../data/buildings.ts';
import { defOf, isBuilt, maxHp } from '../sim/build/structures.ts';
import { foodDays } from '../sim/colony/economy.ts';
import { isFit } from '../sim/colony/survivors.ts';
import { t } from './i18n/ja.ts';

export interface Warning {
  id: string;
  /** danger: act now; warn: soon. */
  level: 'danger' | 'warn';
  text: string;
  /** Command-layer tab that deals with it. */
  tab?: 'people' | 'build' | 'economy' | 'hire' | 'research';
}

export function warnings(s: GameState): Warning[] {
  if (s.flags.range) return [];
  const out: Warning[] = [];
  const c = s.colony;
  const atHome = c.survivors.filter((x) => x.location.kind === 'home');

  // Food
  if (atHome.length > 0) {
    const days = foodDays(s);
    if (days < 1) out.push({ id: 'food', level: 'danger', text: t('warn.food', { d: (Math.floor(days * 10) / 10).toFixed(1) }), tab: 'economy' });
    else if (days < 2.5) out.push({ id: 'food', level: 'warn', text: t('warn.food', { d: (Math.floor(days * 10) / 10).toFixed(1) }), tab: 'economy' });
  }
  // Wages
  const unpaid = c.survivors.filter((x) => x.unpaidDays > 0).length;
  if (unpaid > 0) out.push({ id: 'unpaid', level: unpaid > 2 ? 'danger' : 'warn', text: t('warn.unpaid', { n: unpaid }), tab: 'economy' });
  // Morale about to break
  const leaving = c.survivors.filter((x) => x.morale < 20).length;
  if (leaving > 0) out.push({ id: 'morale', level: 'warn', text: t('warn.morale', { n: leaving }), tab: 'people' });
  // Walls
  let damaged = 0;
  let clogged = 0;
  for (const st of s.build.structures) {
    if (!isBuilt(st)) continue;
    const def = defOf(st);
    if (def.kind === 'moat') {
      if ((st.corpsesInMoat ?? 0) >= (def.unfillable ? BUILD.waterMoatFill : BUILD.moatFill) * 0.6) clogged++;
    } else if (def.hp > 0 && (def.kind === 'wall' || def.kind === 'gate') && st.hp < maxHp(s, def) * 0.5) damaged++;
  }
  const ruins = s.build.structures.filter((st) => st.ruinUntil !== undefined && defOf(st).kind !== 'moat').length;
  if (damaged > 0 || ruins > 0) out.push({ id: 'walls', level: ruins > 0 ? 'danger' : 'warn', text: t('warn.walls', { n: damaged, broken: ruins }), tab: 'build' });
  if (clogged > 0) out.push({ id: 'moat', level: 'warn', text: t('warn.moat', { n: clogged }), tab: 'build' });
  // Blueprints nobody builds
  const pending = s.build.structures.filter((st) => st.progress < 1).length;
  if (pending > 0 && !c.survivors.some((x) => x.job === 'construction' && isFit(x))) out.push({ id: 'builders', level: 'warn', text: t('warn.builders', { n: pending }), tab: 'people' });
  // Infection
  const sick = c.survivors.filter((x) => x.status === 'infected').length;
  if (s.player.infectedUntil) out.push({ id: 'infected', level: 'danger', text: t('warn.playerInfected'), tab: 'economy' });
  if (sick > 0) out.push({ id: 'sick', level: 'danger', text: t('warn.infected', { n: sick }), tab: 'people' });
  // Ammunition
  const carried = (s.player.inv.ammo ?? 0) + s.player.weapon.mag;
  if (carried <= 20) out.push({ id: 'ammo', level: carried <= 5 ? 'danger' : 'warn', text: t(c.stock.ammo >= 1 ? 'warn.ammoStock' : 'warn.ammo', { n: carried, stock: Math.floor(c.stock.ammo) }) });
  // Idle hands
  const idle = c.survivors.filter((x) => x.job === 'idle' && isFit(x)).length;
  if (idle > 0) out.push({ id: 'idle', level: 'warn', text: t('warn.idle', { n: idle }), tab: 'people' });
  // Research standing still
  if (c.survivors.some((x) => x.job === 'research') && Object.keys(s.research.active).length === 0) out.push({ id: 'research', level: 'warn', text: t('warn.research'), tab: 'research' });
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1));
}
