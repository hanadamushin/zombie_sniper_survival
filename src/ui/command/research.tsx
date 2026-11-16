// Research tab (07): the tree as a table of five categories by four eras, with the prerequisite
// lines, the state of every node, the allocation sliders, and the confirmation that an exclusive
// branch asks for. Reads GameState, sends `startResearch` / `setAllocation`.

import { useState } from 'preact/hooks';
import { TECH_CATEGORIES, type GameState, type StaticGrid, type TechCategory } from '../../core/types.ts';
import { locksOf, RESEARCH, TECH_LIST, TECHS, type TechDef } from '../../data/techs.ts';
import { categoryShare, daysLeft, eraCount, researchPerDay, startError, techProgress, techStatus } from '../../sim/research/index.ts';
import { victoryProgress } from '../../sim/research/victory.ts';
import { isFit } from '../../sim/colony/survivors.ts';
import { t } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { num, tk } from './format.ts';

// --- layout: ten columns (2 + 3 + 3 + 2 per era), two lanes per category (branch pairs sit one above the other) ---
const COL_W = 124;
const NODE_W = 112;
const NODE_H = 24;
const LANE_H = 28;
const ROW_H = LANE_H * 2 + 8;
const HEAD_H = 22;
const LEFT = 26;
const ERA_COLS = [0, 2, 5, 8, 10] as const;

/** [column, lane] of every node; lane 0.5 centres a node that has no sibling. */
const POS: Record<string, readonly [number, number]> = {
  F1: [0, 0.5], F2: [1, 0.5], F3: [2, 0.5], F4a: [3, 0], F4b: [3, 1], F5: [5, 0.5], F6a: [6, 0], F6b: [6, 1], F7a: [7, 0], F7b: [7, 1], F8: [8, 0.5], F9: [9, 0.5],
  W1: [0, 0.5], W2: [1, 0.5], W3: [2, 0], W4: [3, 0.5], W5a: [4, 0], W5b: [4, 1], W6a: [5, 0], W6b: [5, 1], W7: [6, 0.5], W8: [8, 0.5], W9: [9, 0.5],
  A1: [0, 0.5], A2: [1, 0.5], A3: [2, 0.5], A4a: [3, 0], A4b: [3, 1], A5: [5, 0], A6a: [6, 0], A6b: [6, 1], A7: [8, 0.5], A8: [9, 0.5],
  S1: [0, 0.5], S2: [1, 0.5], S3: [2, 0], S4: [2, 1], S5a: [3, 0], S5b: [3, 1], S6a: [5, 0], S6b: [5, 1], S7a: [6, 0], S7b: [6, 1], S8: [8, 0.5], S9: [9, 0],
  C1: [0, 0.5], C2: [1, 0.5], C3: [2, 0.5], C4a: [3, 0], C4b: [3, 1], C5: [5, 0.5], C6a: [6, 0], C6b: [6, 1], C7: [7, 0.5], C8: [8, 0.5], C9: [9, 0.5],
};
export const TREE_LAYOUT = POS;

function box(t: TechDef): { x: number; y: number } {
  const [col, lane] = POS[t.id] ?? [0, 0];
  const row = TECH_CATEGORIES.indexOf(t.cat);
  return { x: LEFT + col * COL_W + (COL_W - NODE_W) / 2, y: HEAD_H + row * ROW_H + 6 + lane * LANE_H };
}
const WIDTH = LEFT + 10 * COL_W;
const HEIGHT = HEAD_H + TECH_CATEGORIES.length * ROW_H;

const name = (id: string): string => tk(`tech.${id}`);

function Lines({ state }: { state: GameState }) {
  const done = state.research.done;
  const locked = state.research.locked;
  return (
    <svg class="tech-lines" width={WIDTH} height={HEIGHT} aria-hidden="true">
      {ERA_COLS.slice(1, 4).map((c) => <line key={c} class="era" x1={LEFT + c * COL_W} y1={0} x2={LEFT + c * COL_W} y2={HEIGHT} />)}
      {TECH_CATEGORIES.slice(1).map((cat, i) => <line key={cat} class="era" x1={0} y1={HEAD_H + (i + 1) * ROW_H} x2={WIDTH} y2={HEAD_H + (i + 1) * ROW_H} />)}
      {TECH_LIST.flatMap((node) => {
        const to = box(node);
        return [...node.req.map((r) => [r, false] as const), ...(node.any ?? []).map((r) => [r, true] as const)].map(([from, any]) => {
          const src = TECHS[from];
          if (!src) return null;
          const a = box(src);
          const cls = locked.includes(node.id) || locked.includes(from) ? 'dead' : done.includes(from) ? 'met' : '';
          return <line key={`${from}-${node.id}`} class={`${cls}${any ? ' any' : ''}`} x1={a.x + NODE_W} y1={a.y + NODE_H / 2} x2={to.x} y2={to.y + NODE_H / 2} />;
        });
      })}
    </svg>
  );
}

function Node({ state, node, selected, onSelect }: { state: GameState; node: TechDef; selected: boolean; onSelect(id: string): void }) {
  const status = techStatus(state, node.id);
  const { x, y } = box(node);
  const rp = techProgress(state, node.id);
  const pct = status === 'done' ? 100 : Math.min(100, Math.round((rp / node.cost) * 100));
  return (
    <button
      class={`tech-node${selected ? ' selected' : ''}`}
      style={{ left: `${x}px`, top: `${y}px`, width: `${NODE_W}px`, height: `${NODE_H}px` }}
      data-testid={`tech-${node.id}`}
      data-status={status}
      data-branch={node.excludes ? '1' : undefined}
      title={`${name(node.id)}（${tk(`tech.status.${status}`)}）`}
      onClick={() => onSelect(node.id)}
    >
      <span class="bar" style={{ width: `${pct}%` }} />
      <span class="label">{node.excludes ? '⚔' : node.goal ? '★' : ''}{name(node.id)}</span>
    </button>
  );
}

/** Buildings, gear and the like a node opens, as text. */
function unlockList(node: TechDef): string {
  return node.effects
    .filter((e) => e.kind === 'unlock')
    .map((e) => (e.kind !== 'unlock' ? '' : e.what === 'building' ? tk(`bld.${e.id}`) : e.what === 'gear' ? tk(`xweapon.${e.id}`) : e.what === 'job' ? tk(`job.${e.id}`) : tk(`world.outpost.tier.${e.id}`)))
    .join('、');
}

function Detail({ state, node, onStart }: { state: GameState; node: TechDef; onStart(node: TechDef): void }) {
  const status = techStatus(state, node.id);
  const rp = techProgress(state, node.id);
  const error = startError(state, node.id);
  const eta = status === 'active' ? daysLeft(state, node.cat) : Infinity;
  const unlocks = unlockList(node);
  const other = node.excludes ? TECHS[node.excludes] : undefined;
  return (
    <div class="tech-detail" data-testid="tech-detail" data-id={node.id} data-status={status}>
      <h3>
        {name(node.id)}
        <small>{tk(`tech.cat.${node.cat}`)}・{tk(`tech.era.${node.era}`)}・{tk(`tech.status.${status}`)}</small>
      </h3>
      <p>{tk(`tech.${node.id}.desc`)}</p>
      {unlocks && <p class="note">{t('research.unlocks', { list: unlocks })}</p>}
      <p class="note">
        {t('research.cost', { rp: num(status === 'done' ? node.cost : rp), cost: node.cost })}
        {status === 'active' ? `\u3000${Number.isFinite(eta) ? t('research.daysLeft', { d: num(eta) }) : t('research.noEta')}` : ''}
        {node.req.length > 0 ? `\u3000${t('research.requires', { list: node.req.map(name).join('、') })}` : ''}
        {node.any ? `\u3000${t('research.requiresAny', { list: node.any.map(name).join('／') })}` : ''}
      </p>
      {other && status !== 'done' && status !== 'locked' && <p class="warn">{t('research.branch')}: {t('research.branchWarn', { a: name(node.id), b: name(other.id) })}</p>}
      {status === 'active' ? (
        <span class="note">{t('research.inProgress')}</span>
      ) : error === null ? (
        <button class="primary" data-testid="tech-start" onClick={() => onStart(node)}>{t(rp > 0 ? 'research.resume' : 'research.start')}</button>
      ) : (
        <span class="note" data-testid="tech-why">{tk(`research.why.${error}`)}</span>
      )}
    </div>
  );
}

/** The two sides of an exclusive branch, side by side, with what the choice closes off. */
function BranchDialog({ node, state, onConfirm, onCancel }: { node: TechDef; state: GameState; onConfirm(): void; onCancel(): void }) {
  const other = TECHS[node.excludes!]!;
  const lost = locksOf(node.id, state.research.done);
  return (
    <div class="branch-dialog" data-testid="branch-dialog" role="dialog">
      <h3>{t('research.branch')}</h3>
      <div class="sides">
        {[node, other].map((side) => (
          <div key={side.id} class={side === node ? 'side chosen' : 'side lost'}>
            <b>{name(side.id)}</b>
            <p>{tk(`tech.${side.id}.desc`)}</p>
          </div>
        ))}
      </div>
      <p class="warn">{t('research.branchWarn', { a: name(node.id), b: name(other.id) })}</p>
      <p class="warn" data-testid="branch-lose">{t('research.branchLose', { list: lost.map(name).join('、') })}</p>
      <div class="actions">
        <button class="primary" data-testid="branch-confirm" onClick={onConfirm}>{t('research.branchConfirm', { a: name(node.id) })}</button>
        <button data-testid="branch-cancel" onClick={onCancel}>{t('research.cancel')}</button>
      </div>
    </div>
  );
}

function Allocation({ state, actions }: { state: GameState; actions: UiActions }) {
  const alloc = state.research.allocation;
  // Moving one slider takes from / gives to the others in proportion, so the total stays 100.
  const change = (cat: TechCategory, value: number): void => {
    const next = { ...alloc };
    const v = Math.max(0, Math.min(100, value));
    const rest = TECH_CATEGORIES.filter((c) => c !== cat);
    const restSum = rest.reduce((s, c) => s + alloc[c], 0);
    next[cat] = v;
    for (const c of rest) next[c] = restSum > 0 ? (alloc[c] / restSum) * (100 - v) : (100 - v) / rest.length;
    actions.dispatch({ type: 'setAllocation', allocation: next });
  };
  return (
    <div class="tech-alloc" data-testid="tech-alloc">
      <span class="label">{t('research.alloc')}</span>
      {TECH_CATEGORIES.map((cat) => {
        const a = state.research.active[cat];
        const eta = daysLeft(state, cat);
        return (
          <label key={cat} data-cat={cat} data-share={Math.round(alloc[cat])}>
            <span class="cat">{tk(`tech.cat.${cat}`)} <b>{Math.round(alloc[cat])}%</b></span>
            <input type="range" min="0" max="100" step="5" value={Math.round(alloc[cat])} data-testid={`alloc-${cat}`} onInput={(e) => change(cat, Number((e.target as HTMLInputElement).value))} />
            <small>
              {a ? `${name(a.id)} ${Math.round((a.rp / (TECHS[a.id]?.cost ?? 1)) * 100)}%・${Number.isFinite(eta) ? t('research.daysLeft', { d: num(eta) }) : t('research.noEta')}（${Math.round(categoryShare(state, cat) * 100)}%）` : t('research.idleCat')}
            </small>
          </label>
        );
      })}
    </div>
  );
}

function Victory({ state, grid }: { state: GameState; grid: StaticGrid | null }) {
  const p = victoryProgress(state, grid);
  const V = RESEARCH.victory;
  const won = state.research.victory;
  const item = (ok: boolean, text: string, key: string) => <li key={key} data-ok={ok} data-key={key}>{ok ? '✔' : '・'} {text}</li>;
  return (
    <div class="tech-victory" data-testid="victory-progress" data-ready={p.ready} data-won={!!won}>
      <b title={t('research.victory.lead')}>{t('research.victory')}</b>
      {won ? (
        <span class="note"> {t('research.victory.done', { day: won.day })}</span>
      ) : (
        <ul>
          {item(p.met.era, t('research.victory.era'), 'era')}
          {item(p.met.population, t('research.victory.population', { n: p.population, need: V.population }), 'population')}
          {item(p.met.outposts, t('research.victory.outposts', { n: p.outposts, need: V.outposts }), 'outposts')}
          {item(p.met.regions, t('research.victory.regions', { n: p.regions, need: V.regions }), 'regions')}
          {item(p.met.goal, t('research.victory.goal', { name: p.goal ? `: ${name(p.goal)}` : '' }), 'goal')}
          {item(p.met.capitol, t('research.victory.capitol'), 'capitol')}
        </ul>
      )}
    </div>
  );
}

export function ResearchTab({ state, actions, grid }: { state: GameState; actions: UiActions; grid: StaticGrid | null }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const r = state.research;
  const researchers = state.colony.survivors.filter((s) => s.job === 'research' && isFit(s)).length;
  const node = selected ? TECHS[selected] : undefined;
  const pending = confirm ? TECHS[confirm] : undefined;
  const start = (n: TechDef): void => {
    // An exclusive branch is only started after the player has seen both sides and what is lost.
    if (n.excludes && techStatus(state, n.id) !== 'active') setConfirm(n.id);
    else actions.dispatch({ type: 'startResearch', id: n.id });
  };
  return (
    <div class="research" data-testid="research-tab" data-era={r.era}>
      <p class="note">
        {researchers > 0 ? t('research.rpDay', { n: num(researchPerDay(state)), people: researchers }) : t('research.noResearchers')}
        {'\u3000'}
        {r.era < 3
          ? t('research.era', { era: tk(`tech.era.${r.era}`), n: eraCount(state, r.era), need: RESEARCH.nodesPerEra })
          : t('research.eraMax', { era: tk(`tech.era.${r.era}`) })}
      </p>
      <Allocation state={state} actions={actions} />
      <div class="tech-scroll">
        <div class="tech-tree" style={{ width: `${WIDTH}px`, height: `${HEIGHT}px` }}>
          <Lines state={state} />
          {ERA_COLS.slice(0, 4).map((c, era) => (
            <span key={era} class="era-head" data-current={era === r.era} data-open={era <= r.era} style={{ left: `${LEFT + c * COL_W}px`, width: `${(ERA_COLS[era + 1]! - c) * COL_W}px` }}>
              {tk(`tech.era.${era}`)}
            </span>
          ))}
          {TECH_CATEGORIES.map((cat, row) => (
            <span key={cat} class="cat-head" style={{ top: `${HEAD_H + row * ROW_H}px`, height: `${ROW_H}px` }}>{tk(`tech.cat.${cat}`)}</span>
          ))}
          {TECH_LIST.map((n) => <Node key={n.id} state={state} node={n} selected={n.id === selected} onSelect={setSelected} />)}
        </div>
      </div>
      {pending ? (
        <BranchDialog
          node={pending}
          state={state}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            actions.dispatch({ type: 'startResearch', id: pending.id });
            setConfirm(null);
          }}
        />
      ) : node ? (
        <Detail state={state} node={node} onStart={start} />
      ) : (
        <p class="empty">{t('research.pick')}</p>
      )}
      <Victory state={state} grid={grid} />
    </div>
  );
}
