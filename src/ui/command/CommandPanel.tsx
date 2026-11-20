// Command layer: who works on what, who can be hired, the books, expeditions, the log.
// Function over form — 08 restyles it. Everything here only reads GameState and dispatches commands.

import { Component } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { RESOURCE_IDS, type CellId, type GameState, type JobId, type StaticGrid, type Survivor } from '../../core/types.ts';
import { toAbsMinutes } from '../../core/time.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY, EXPEDITION_WEAPONS, expeditionWeapon } from '../../data/colony.ts';
import { craftingByHand, foodDays, foodNeedPerDay, villageNear, villagePrice, wageDue } from '../../sim/colony/economy.ts';
import { expeditionAmmo, expeditionBonus, expeditionDanger, expeditionRadius, expeditionTargets, returnChance, weaponAvailable } from '../../sim/colony/expeditions.ts';
import { farmPlots, housingBeds, jobMul, outputPerHour, seasonOf } from '../../sim/colony/jobs.ts';
import { JOB_TECH } from '../../sim/colony/index.ts';
import { techUnlocked } from '../../sim/build/structures.ts';
import { hasFlag } from '../../sim/research/modifiers.ts';
import { playerAtHome } from '../../sim/colony/morale.ts';
import { isFit, isHome, populationCap, signingFee } from '../../sim/colony/survivors.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { cellName, formatDuration } from '../world/info.ts';
import { BuildTab, type BuildTool } from './build.tsx';
import { logText, logTime, num, price, statusText, tk } from './format.ts';
import { ResearchTab } from './research.tsx';
import { Delta, HintLine, Objectives, WarningList, readPref, writePref } from '../components/common.tsx';
import { warnings } from '../warnings.ts';

interface Props {
  state: GameState;
  actions: UiActions;
  grid: StaticGrid | null;
}
interface PanelProps extends Props {
  tool: BuildTool;
  setTool(next: BuildTool): void;
}

type Tab = 'people' | 'build' | 'research' | 'hire' | 'economy' | 'expedition' | 'log';
const TABS: readonly Tab[] = ['people', 'build', 'research', 'hire', 'economy', 'expedition', 'log'];
const JOBS: readonly JobId[] = ['idle', 'farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical'];

function Stats({ s }: { s: Survivor }) {
  return <span class="stats" title={t('cmd.statsHelp')}>{t('cmd.stats', { ath: s.ath, kno: s.kno, spd: s.spd, sta: s.sta })}</span>;
}
function Trait({ s }: { s: Survivor }) {
  return <span class="trait" title={tk(`trait.${s.trait}.desc`)}>{tk(`trait.${s.trait}`)}</span>;
}

interface RowProps {
  s: Survivor;
  state: GameState;
  status: string;
  /** Everything the row shows, as one string: the row is re-rendered only when this changes. */
  sig: string;
  actions: UiActions;
}
/** One survivor. Memoised by `sig` — 60 rows with 8 options each are too much to rebuild ten times a second. */
class SurvivorRow extends Component<RowProps> {
  override shouldComponentUpdate(next: RowProps): boolean {
    return next.sig !== this.props.sig;
  }
  override render({ s, state, status, actions }: RowProps) {
    const rec = recommendedJob(state, s);
    return (
      <div class="row-card" data-testid="survivor-row" data-id={s.id} data-status={s.status} data-job={s.job}>
        <div class="who">
          <b>{s.name}</b> <Trait s={s} />
        </div>
        <Stats s={s} />
        <div class="jobsel">
          <select
            data-testid={`job-${s.id}`}
            value={s.job}
            onChange={(e) => actions.dispatch({ type: 'assignJob', survivor: s.id, job: (e.target as HTMLSelectElement).value as JobId })}
          >
            {JOBS.map((j) => {
              const open = techUnlocked(state, JOB_TECH[j]);
              return (
                <option key={j} value={j} disabled={!open}>
                  {j === rec ? '★ ' : ''}{tk(`job.${j}`)}{!open ? t('cmd.jobLocked') : j !== 'idle' ? ` ${t('cmd.output', { n: num(outputPerHour({ ...s, status: 'ok' }, j) * jobMul(state, j)) })}` : ''}
                </option>
              );
            })}
          </select>
          {rec && rec !== s.job && <span class="rec" title={t('cmd.recommendTitle', { job: tk(`job.${rec}`) })}>{t('cmd.recommend')}: {tk(`job.${rec}`)}</span>}
        </div>
        <div class="meta">
          <span class="wage">{s.job === 'farming' ? t('cmd.wageFarmer') : t('cmd.wage', { n: num(wageDue(state, s)) })}</span>
          <span class="morale" title={t('cmd.morale', { n: Math.round(s.morale) })} data-low={s.morale < COLONY.morale.desertBelow}>
            <span style={{ width: `${Math.round(s.morale)}%` }} />
            <em>{t('cmd.morale', { n: Math.round(s.morale) })}</em>
          </span>
          <span class="status">{status}</span>
        </div>
        <div class="act">
          <button class="chip" disabled={s.location.kind !== 'home'} onClick={() => actions.dispatch({ type: 'dismiss', survivor: s.id })}>{t('cmd.dismiss')}</button>
        </div>
      </div>
    );
  }
}

/** The job this survivor would do best (abilities and trait), among the jobs open now. */
export function recommendedJob(state: GameState, s: Survivor): JobId | null {
  let best: JobId | null = null;
  let bestOut = 0;
  for (const j of JOBS) {
    if (j === 'idle' || !techUnlocked(state, JOB_TECH[j])) continue;
    const out = outputPerHour({ ...s, status: 'ok' }, j);
    if (out > bestOut * 1.0001) {
      best = j;
      bestOut = out;
    }
  }
  return best;
}

type SortKey = 'name' | 'job' | 'morale' | 'wage' | 'ath' | 'kno';
type Filter = 'all' | 'idle' | 'trouble' | JobId;

function People({ state, actions }: Props) {
  const [sort, setSort] = useState<SortKey>(() => readPref<SortKey>('people.sort', 'job'));
  const [filter, setFilter] = useState<Filter>('all');
  const list = state.colony.survivors;
  if (list.length === 0) return <p class="empty">{t('cmd.noSurvivors')}</p>;
  const counts = new Map<JobId, number>();
  for (const x of list) counts.set(x.job, (counts.get(x.job) ?? 0) + 1);
  const trouble = (x: Survivor): boolean => x.status !== 'ok' || x.morale < COLONY.morale.desertBelow + 10 || x.unpaidDays > 0;
  const shown = list.filter((x) => filter === 'all' || (filter === 'idle' ? x.job === 'idle' : filter === 'trouble' ? trouble(x) : x.job === filter));
  const by: Record<SortKey, (a: Survivor, b: Survivor) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, 'ja'),
    job: (a, b) => JOBS.indexOf(a.job) - JOBS.indexOf(b.job) || a.id - b.id,
    morale: (a, b) => a.morale - b.morale,
    wage: (a, b) => wageDue(state, b) - wageDue(state, a),
    ath: (a, b) => b.ath - a.ath,
    kno: (a, b) => b.kno - a.kno,
  };
  shown.sort(by[sort]);
  return (
    <div class="rows">
      <div class="job-summary" data-testid="job-summary">
        <span class="label">{t('cmd.jobSummary')}</span>
        <button class={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t('cmd.filter.all')} <b>{list.length}</b></button>
        {JOBS.filter((j) => counts.has(j)).map((j) => (
          <button key={j} class={filter === j ? 'active' : ''} data-testid={`job-count-${j}`} onClick={() => setFilter(filter === j ? 'all' : j)}>{tk(`job.${j}`)} <b>{counts.get(j)}</b></button>
        ))}
        <button class={filter === 'trouble' ? 'active' : ''} onClick={() => setFilter(filter === 'trouble' ? 'all' : 'trouble')}>{t('cmd.filter.trouble')} <b>{list.filter(trouble).length}</b></button>
      </div>
      <div class="people-tools">
        <label class="field">
          <span class="label">{t('cmd.sort')}</span>
          <select data-testid="people-sort" value={sort} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as SortKey; setSort(v); writePref('people.sort', v); }}>
            {(['job', 'name', 'morale', 'wage', 'ath', 'kno'] as const).map((k) => <option key={k} value={k}>{t(`cmd.sort.${k}` as TextKey)}</option>)}
          </select>
        </label>
      </div>
      {shown.map((s) => {
        const status = statusText(state, s);
        return <SurvivorRow key={s.id} s={s} state={state} status={status} actions={actions} sig={`${s.job}|${Math.round(s.morale)}|${Math.round(s.hp / 5)}|${s.status}|${s.location.kind}|${status}|${state.research.done.length}|${s.kno}`} />;
      })}
      {state.colony.memorial.length > 0 && (
        <p class="empty" title={state.colony.memorial.map((m) => `${m.name}（${m.day}日目・${tk(`cause.${m.cause}`)}）`).join('\n')}>
          {t('cmd.memorial', { n: state.colony.memorial.length })}
        </p>
      )}
    </div>
  );
}

function Hire({ state, actions, grid }: Props) {
  const colony = state.colony;
  const carried = state.player.inv.ears ?? 0;
  const ears = colony.stock.ears + carried;
  const cap = populationCap(state);
  const full = colony.survivors.length >= cap;
  const showStats = hasFlag(state, 'hire.stats') || state.flags.unlockAll === true; // recruiting (C2)
  return (
    <div class="rows">
      <p class="note">
        {t('cmd.earsAvail', { n: num(ears), stock: num(colony.stock.ears), carried })}
        {cap < 1000 ? `\u3000${t('cmd.popCap', { n: colony.survivors.length, cap })}` : ''}
      </p>
      {colony.candidates.length === 0 && <p class="empty">{t('cmd.noCandidates')}</p>}
      {colony.candidates.map((s) => (
        <div class="row-card" key={s.id} data-testid="candidate-row">
          <div class="who">
            <b>{s.name}</b> <Trait s={s} />
          </div>
          {showStats ? <Stats s={s} /> : <span class="stats" data-testid="stats-hidden">{t('cmd.statsHidden')}</span>}
          <span class="wage">{t('cmd.wage', { n: s.wage })}</span>
          <span class="status">
            {grid && s.fromCell !== undefined ? t('cmd.from', { place: cellName(grid, s.fromCell) }) : ''}{' '}
            {t('cmd.waits', { n: Math.max(0, (s.waitsUntilDay ?? state.time.day) - state.time.day) })}
          </span>
          <button class="primary" data-testid={`hire-${s.id}`} disabled={full || ears < signingFee(s, state)} onClick={() => actions.dispatch({ type: 'hire', candidate: s.id })}>
            {t('cmd.hire', { n: signingFee(s, state) })}
          </button>
        </div>
      ))}
    </div>
  );
}

function Economy({ state, actions, grid }: Props) {
  const colony = state.colony;
  const E = COLONY.economy;
  const wages = colony.survivors.reduce((sum, s) => sum + (s.job === 'farming' ? 0 : wageDue(state, s)), 0);
  const village = villageNear(state, grid);
  const left = Math.max(0, E.villageDailyCap - colony.villageBought);
  const lot = Math.min(4, left);
  const atHome = playerAtHome(state);
  const carriedAmmo = state.player.inv.ammo ?? 0;
  const ledger = [...colony.ledger].reverse();
  return (
    <div class="economy">
      <dl>
        <dt>{t('cmd.foodPrice')}</dt>
        <dd>{t('cmd.perFood', { n: price(colony.foodPrice) })}</dd>
        <dt>{t('cmd.market')}</dt>
        <dd>{num(colony.market.food)}</dd>
        <dt>{t('cmd.need')}</dt>
        <dd>{num(foodNeedPerDay(state))}</dd>
        <dt>{t('cmd.wagesDay')}</dt>
        <dd>{num(wages)}</dd>
        <dt>{t('cmd.plots')}</dt>
        <dd>{t('cmd.plotsN', { n: farmPlots(state), s: seasonOf(state, state.time.day) })}</dd>
        <dt>{t('cmd.beds')}</dt>
        <dd>{t('cmd.bedsN', { used: colony.survivors.filter(isHome).length, n: housingBeds(state) })}</dd>
        <dt>{t('cmd.research')}</dt>
        <dd>{num(colony.work.research)}</dd>
      </dl>
      {craftingByHand(state) && <p class="note">{t('cmd.craftHand')}</p>}
      <div class="actions">
        <span class="label">{t('cmd.village')}</span>
        {village ? (
          <>
            <button data-testid="buy-food" disabled={lot <= 0 || colony.stock.ears < villagePrice(state)} onClick={() => actions.dispatch({ type: 'buyFood', amount: lot, source: 'village' })}>
              {t('cmd.villageBuy', { n: lot, cost: num(lot * villagePrice(state)) })}
            </button>
            <span class="note">{t('cmd.villageLeft', { n: num(left) })}</span>
            <label class="check">
              <input type="checkbox" checked={colony.policy.autoBuyFood} onChange={(e) => actions.dispatch({ type: 'setPolicy', autoBuyFood: (e.target as HTMLInputElement).checked })} />
              {t('cmd.autoBuy')}
            </label>
          </>
        ) : (
          <span class="note">{t('cmd.noVillage')}</span>
        )}
      </div>
      <div class="actions">
        <button data-testid="resupply" disabled={!atHome || colony.stock.ammo < 1 || carriedAmmo >= BALANCE.player.maxAmmo} onClick={() => actions.dispatch({ type: 'resupply' })}>
          {t('cmd.resupply', { have: carriedAmmo, max: BALANCE.player.maxAmmo, stock: Math.floor(colony.stock.ammo) })}
        </button>
        {!atHome && <span class="note">{t('cmd.resupplyAway')}</span>}
      </div>
      <h3>{t('cmd.ledger')}</h3>
      <div class="table-wrap">
        <table data-testid="ledger">
          <thead>
            <tr>
              {(['day', 'income', 'wages', 'food', 'other', 'net'] as const).map((k) => <th key={k}>{t(`cmd.ledger.${k}` as TextKey)}</th>)}
            </tr>
          </thead>
          <tbody>
            {ledger.map((d) => {
              const net = d.income - d.wages - d.food - d.other;
              return (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{num(d.income)}</td>
                  <td>{num(d.wages)}</td>
                  <td>{num(d.food)}</td>
                  <td>{num(d.other)}</td>
                  <td class={net < 0 ? 'neg' : 'pos'}>{num(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Expeditions({ state, actions, grid }: Props) {
  const [picked, setPicked] = useState<number[]>([]);
  const [target, setTarget] = useState<CellId | null>(null);
  const [weapon, setWeapon] = useState(() => [...EXPEDITION_WEAPONS].reverse().find((x) => x.ammo === 0 && weaponAvailable(state, x))?.id ?? 'unarmed');
  const home = state.world.homeCell;
  // Routes only change with the home cell; danger and loot are read live below.
  const targets = useMemo(() => (grid ? expeditionTargets(state, grid) : []), [grid, home, expeditionRadius(state), state.research.done.length]);
  const X = COLONY.expedition;
  const fit = state.colony.survivors.filter(isFit).sort((a, b) => Number(b.job === 'scavenging') - Number(a.job === 'scavenging'));
  const members = picked.filter((id) => fit.some((s) => s.id === id));
  const chosen = targets.find((x) => x.cell === target) ?? targets[0];
  const picked0 = expeditionWeapon(weapon);
  const w = picked0 && weaponAvailable(state, picked0) ? picked0 : EXPEDITION_WEAPONS[0]!;
  const now = toAbsMinutes(state.time);
  const ammo = expeditionAmmo(state, w, members.length);
  const enoughAmmo = state.colony.stock.ammo >= ammo;
  const sizeOk = members.length >= X.minMembers && members.length <= X.maxMembers;
  const toggle = (id: number): void => setPicked(members.includes(id) ? members.filter((x) => x !== id) : members.length < X.maxMembers ? [...members, id] : members);
  const cells = state.world.cells;
  const dangerNow = (cell: CellId): number => expeditionDanger(state, cell);
  const known = (cell: CellId): boolean => (cells.intel[cell] ?? 0) >= 1;
  const chance = chosen && members.length > 0
    ? members.reduce((sum, id) => sum + returnChance(fit.find((s) => s.id === id)!, w, members.length, dangerNow(chosen.cell), expeditionBonus(state)), 0) / members.length
    : 0;
  const send = (): void => {
    if (!chosen) return;
    actions.dispatch({ type: 'sendExpedition', members, target: chosen.cell, weapon: w.id });
    setPicked([]);
  };
  return (
    <div class="expedition">
      <div class="running">
        {state.world.expeditions.length === 0 && <p class="empty">{t('cmd.exp.none')}</p>}
        {state.world.expeditions.map((e) => (
          <p key={e.id} data-testid="expedition-running">
            {t('cmd.exp.running', {
              n: e.members.length,
              name: grid ? cellName(grid, e.target) : e.target,
              weapon: tk(`xweapon.${e.weapon}`),
              time: formatDuration(e.returnDay * 1440 + e.returnMinute - now),
            })}
          </p>
        ))}
      </div>
      {fit.length < X.minMembers ? (
        <p class="empty">{t('cmd.exp.needPeople')}</p>
      ) : !grid || targets.length === 0 ? (
        <p class="empty">{t('cmd.exp.noTargets')}</p>
      ) : (
        <>
          <span class="label">{t('cmd.exp.members')}</span>
          <div class="members">
            {fit.map((s) => (
              <label key={s.id} class={members.includes(s.id) ? 'check on' : 'check'}>
                <input type="checkbox" data-testid={`member-${s.id}`} checked={members.includes(s.id)} onChange={() => toggle(s.id)} />
                {s.name}（{tk(`job.${s.job}`)}・{num(outputPerHour(s, 'scavenging') * jobMul(state, 'scavenging'))}）
              </label>
            ))}
          </div>
          <label class="field">
            <span class="label">{t('cmd.exp.target')}</span>
            <select data-testid="exp-target" value={chosen?.cell} onChange={(e) => setTarget(Number((e.target as HTMLSelectElement).value))}>
              {targets.map((x) => (
                <option key={x.cell} value={x.cell}>
                  {t('cmd.exp.targetInfo', {
                    name: cellName(grid, x.cell),
                    land: t(`land.${grid.cells[x.cell]!.land}` as TextKey),
                    time: formatDuration(x.travelMinutes),
                    danger: known(x.cell) ? `${Math.round(dangerNow(x.cell) * 100)}%` : t('cmd.unknown'),
                    loot: known(x.cell) ? `${Math.round((cells.loot[x.cell] ?? 0) * 100)}%` : t('cmd.unknown'),
                  })}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span class="label">{t('cmd.exp.weapon')}</span>
            <select data-testid="exp-weapon" value={w.id} onChange={(e) => setWeapon((e.target as HTMLSelectElement).value)}>
              {EXPEDITION_WEAPONS.filter((x) => weaponAvailable(state, x)).map((x) => (
                <option key={x.id} value={x.id}>
                  {tk(`xweapon.${x.id}`)}（+{Math.round(x.bonus * 100)}%{x.ammo > 0 ? `・${t('res.ammo')} ${num(expeditionAmmo(state, x, 1))}/人` : ''}）
                </option>
              ))}
            </select>
          </label>
          {chosen && members.length > 0 && (
            <p class="note" data-testid="exp-estimate">
              {t('cmd.exp.estimate', { time: formatDuration(chosen.totalMinutes), p: known(chosen.cell) ? Math.round(chance * 100) : '?' })}
              {ammo > 0 ? ` ／ ${t(enoughAmmo ? 'cmd.exp.ammo' : 'cmd.exp.noAmmo', { n: ammo })}` : ''}
            </p>
          )}
          <button class="primary" data-testid="exp-send" disabled={!sizeOk || !chosen || !enoughAmmo} onClick={send}>{t('cmd.exp.send')}</button>
        </>
      )}
    </div>
  );
}

export function LogList({ state, grid, limit }: { state: GameState; grid: StaticGrid | null; limit: number }) {
  const log = state.colony.log;
  if (log.length === 0) return <p class="empty">{t('log.empty')}</p>;
  return (
    <ul class="log" data-testid="colony-log">
      {log.slice(-limit).reverse().map((e, i) => (
        <li key={log.length - i} data-kind={e.kind}>
          <time>{logTime(e)}</time> {logText(e, grid)}
        </li>
      ))}
    </ul>
  );
}

/** The stores, with a short "+n" where a number just changed. */
function StockStrip({ state }: { state: GameState }) {
  const colony = state.colony;
  return (
    <div class="stock-strip" data-testid="stock">
      {RESOURCE_IDS.map((r) => (
        <span key={r} class="delta-host" data-res={r} data-amount={colony.stock[r]} data-low={r === 'food' && colony.survivors.length > 0 && foodDays(state) < 2} title={r === 'ears' ? '' : `/ ${colony.capacity[r]}`}>
          {t(`res.${r}` as TextKey)} <b>{num(colony.stock[r])}</b>
          {r === 'food' && colony.survivors.length > 0 ? <small> {t('cmd.foodDays', { d: num(foodDays(state)) })}</small> : null}
          <Delta value={colony.stock[r]} format={num} />
        </span>
      ))}
    </div>
  );
}

export function CommandPanel(props: PanelProps) {
  const { state } = props;
  const [tab, setTabRaw] = useState<Tab>('people');
  const [collapsed, setCollapsed] = useState(false);
  const [dock, setDock] = useState<'left' | 'right'>(() => readPref<'left' | 'right'>('dock', 'left'));
  // Leaving the build tab puts the tool away (the mouse goes back to looking around).
  const setTab = (next: Tab): void => {
    if (next !== 'build' && (props.tool.def || props.tool.remove)) props.setTool({ ...props.tool, def: null, remove: false });
    setCollapsed(false);
    setTabRaw(next);
  };
  const colony = state.colony;
  const count: Partial<Record<Tab, number>> = { research: Object.keys(state.research.active).length || undefined, build: state.build.structures.filter((b) => b.progress < 1).length || undefined, people: colony.survivors.length, hire: colony.candidates.length, expedition: state.world.expeditions.length };
  // Building wants the base in view: its panel sits on the right, the others where the player put them.
  const side = tab === 'build' ? 'right' : dock;
  const problems = warnings(state);
  return (
    <>
      <StockStrip state={state} />
      <div class="panel command-panel" data-testid="command-panel" data-tab={tab} data-dock={side} data-collapsed={collapsed}>
        <div class="panel-head">
          <h2>{t(`cmd.tab.${tab}` as TextKey, { n: '' })}</h2>
        </div>
        <HintLine state={state} actions={props.actions} where="command" />
        <div class="tab-body">
          {tab === 'people' && <People {...props} />}
          {tab === 'build' && <BuildTab state={state} actions={props.actions} tool={props.tool} setTool={props.setTool} />}
          {tab === 'research' && <ResearchTab state={state} actions={props.actions} grid={props.grid} />}
          {tab === 'hire' && <Hire {...props} />}
          {tab === 'economy' && <Economy {...props} />}
          {tab === 'expedition' && <Expeditions {...props} />}
          {tab === 'log' && <LogList state={state} grid={props.grid} limit={80} />}
        </div>
      </div>
      {tab !== 'research' && (
        <div class="cmd-side" data-side={side === 'left' ? 'right' : 'left'}>
          <Objectives state={state} grid={props.grid} inline />
          {problems.length > 0 && (
            <div class="panel" data-testid="cmd-warnings">
              <span class="stamp">{t('warn.title')}</span>
              <WarningList list={problems} onOpen={(x) => setTab(x)} />
            </div>
          )}
        </div>
      )}
      <div class="cmd-bar" role="tablist" data-testid="cmd-bar">
        {TABS.map((x) => (
          <button key={x} class={x === tab ? 'tab active' : 'tab'} data-testid={`tab-${x}`} onClick={() => setTab(x)}>
            {t(`cmd.tab.${x}` as TextKey, { n: '' }).trim()}
            {count[x] !== undefined && <span class="n">{count[x]}</span>}
          </button>
        ))}
        <span class="spacer" />
        <button class="icon-btn" data-testid="cmd-dock" title={t('bar.dock')} aria-label={t('bar.dock')} onClick={() => { const d = dock === 'left' ? 'right' : 'left'; setDock(d); writePref('dock', d); }}>⇆</button>
        <button class="icon-btn" data-testid="cmd-collapse" title={collapsed ? t('bar.expand') : t('bar.collapse')} aria-label={collapsed ? t('bar.expand') : t('bar.collapse')} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▴' : '▾'}</button>
      </div>
    </>
  );
}
