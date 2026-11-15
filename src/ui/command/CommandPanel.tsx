// Command layer: who works on what, who can be hired, the books, expeditions, the log.
// Function over form — 08 restyles it. Everything here only reads GameState and dispatches commands.

import { Component } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { RESOURCE_IDS, type CellId, type GameState, type JobId, type StaticGrid, type Survivor } from '../../core/types.ts';
import { toAbsMinutes } from '../../core/time.ts';
import { BALANCE } from '../../data/balance.ts';
import { COLONY, EXPEDITION_WEAPONS, expeditionWeapon } from '../../data/colony.ts';
import { craftingByHand, foodDays, foodNeedPerDay, villageNear, villagePrice } from '../../sim/colony/economy.ts';
import { expeditionTargets, returnChance, weaponAvailable } from '../../sim/colony/expeditions.ts';
import { farmPlots, housingBeds, outputPerHour, seasonFactor } from '../../sim/colony/jobs.ts';
import { playerAtHome } from '../../sim/colony/morale.ts';
import { isFit, isHome, signingFee } from '../../sim/colony/survivors.ts';
import { dangerOf } from '../../sim/world/derive.ts';
import { t, type TextKey } from '../i18n/ja.ts';
import type { UiActions } from '../store.ts';
import { cellName, formatDuration } from '../world/info.ts';
import { BuildTab, type BuildTool } from './build.tsx';
import { logText, logTime, num, statusText, tk } from './format.ts';

interface Props {
  state: GameState;
  actions: UiActions;
  grid: StaticGrid | null;
}
interface PanelProps extends Props {
  tool: BuildTool;
  setTool(next: BuildTool): void;
}

type Tab = 'people' | 'build' | 'hire' | 'economy' | 'expedition' | 'log';
const TABS: readonly Tab[] = ['people', 'build', 'hire', 'economy', 'expedition', 'log'];
const JOBS: readonly JobId[] = ['idle', 'farming', 'defense', 'scavenging', 'construction', 'research', 'crafting', 'medical'];

function Stats({ s }: { s: Survivor }) {
  return <span class="stats" title={t('cmd.statsHelp')}>{t('cmd.stats', { ath: s.ath, kno: s.kno, spd: s.spd, sta: s.sta })}</span>;
}
function Trait({ s }: { s: Survivor }) {
  return <span class="trait" title={tk(`trait.${s.trait}.desc`)}>{tk(`trait.${s.trait}`)}</span>;
}

interface RowProps {
  s: Survivor;
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
  override render({ s, status, actions }: RowProps) {
    return (
      <div class="row-card" data-testid="survivor-row" data-id={s.id} data-status={s.status}>
        <div class="who">
          <b>{s.name}</b> <Trait s={s} />
        </div>
        <Stats s={s} />
        <span class="wage">{s.job === 'farming' ? t('cmd.wageFarmer') : t('cmd.wage', { n: s.wage })}</span>
        <span class="morale" title={t('cmd.morale', { n: Math.round(s.morale) })} data-low={s.morale < COLONY.morale.desertBelow}>
          <span style={{ width: `${Math.round(s.morale)}%` }} />
          <em>{t('cmd.morale', { n: Math.round(s.morale) })}</em>
        </span>
        <span class="status">{status}</span>
        <select
          data-testid={`job-${s.id}`}
          value={s.job}
          onChange={(e) => actions.dispatch({ type: 'assignJob', survivor: s.id, job: (e.target as HTMLSelectElement).value as JobId })}
        >
          {JOBS.map((j) => (
            <option key={j} value={j}>
              {tk(`job.${j}`)}{j !== 'idle' ? ` ${t('cmd.output', { n: num(outputPerHour({ ...s, status: 'ok' }, j)) })}` : ''}
            </option>
          ))}
        </select>
        <button class="chip" disabled={s.location.kind !== 'home'} onClick={() => actions.dispatch({ type: 'dismiss', survivor: s.id })}>{t('cmd.dismiss')}</button>
      </div>
    );
  }
}

function People({ state, actions }: Props) {
  const list = state.colony.survivors;
  if (list.length === 0) return <p class="empty">{t('cmd.noSurvivors')}</p>;
  return (
    <div class="rows">
      {list.map((s) => {
        const status = statusText(state, s);
        return <SurvivorRow key={s.id} s={s} status={status} actions={actions} sig={`${s.job}|${Math.round(s.morale)}|${Math.round(s.hp / 5)}|${s.status}|${s.location.kind}|${status}`} />;
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
  return (
    <div class="rows">
      <p class="note">{t('cmd.earsAvail', { n: num(ears), stock: num(colony.stock.ears), carried })}</p>
      {colony.candidates.length === 0 && <p class="empty">{t('cmd.noCandidates')}</p>}
      {colony.candidates.map((s) => (
        <div class="row-card" key={s.id} data-testid="candidate-row">
          <div class="who">
            <b>{s.name}</b> <Trait s={s} />
          </div>
          <Stats s={s} />
          <span class="wage">{t('cmd.wage', { n: s.wage })}</span>
          <span class="status">
            {grid && s.fromCell !== undefined ? t('cmd.from', { place: cellName(grid, s.fromCell) }) : ''}{' '}
            {t('cmd.waits', { n: Math.max(0, (s.waitsUntilDay ?? state.time.day) - state.time.day) })}
          </span>
          <button class="primary" data-testid={`hire-${s.id}`} disabled={ears < signingFee(s)} onClick={() => actions.dispatch({ type: 'hire', candidate: s.id })}>
            {t('cmd.hire', { n: signingFee(s) })}
          </button>
        </div>
      ))}
    </div>
  );
}

function Economy({ state, actions, grid }: Props) {
  const colony = state.colony;
  const E = COLONY.economy;
  const wages = colony.survivors.reduce((sum, s) => sum + (s.job === 'farming' ? 0 : s.wage), 0);
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
        <dd>{t('cmd.perFood', { n: num(colony.foodPrice) })}</dd>
        <dt>{t('cmd.market')}</dt>
        <dd>{num(colony.market.food)}</dd>
        <dt>{t('cmd.need')}</dt>
        <dd>{num(foodNeedPerDay(state))}</dd>
        <dt>{t('cmd.wagesDay')}</dt>
        <dd>{wages}</dd>
        <dt>{t('cmd.plots')}</dt>
        <dd>{t('cmd.plotsN', { n: farmPlots(state), s: seasonFactor(state.time.day) })}</dd>
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
            <button data-testid="buy-food" disabled={lot <= 0 || colony.stock.ears < villagePrice()} onClick={() => actions.dispatch({ type: 'buyFood', amount: lot, source: 'village' })}>
              {t('cmd.villageBuy', { n: lot, cost: num(lot * villagePrice()) })}
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
  const [weapon, setWeapon] = useState('melee');
  const home = state.world.homeCell;
  // Routes only change with the home cell; danger and loot are read live below.
  const targets = useMemo(() => (grid ? expeditionTargets(state, grid) : []), [grid, home]);
  const X = COLONY.expedition;
  const fit = state.colony.survivors.filter(isFit).sort((a, b) => Number(b.job === 'scavenging') - Number(a.job === 'scavenging'));
  const members = picked.filter((id) => fit.some((s) => s.id === id));
  const chosen = targets.find((x) => x.cell === target) ?? targets[0];
  const w = expeditionWeapon(weapon) ?? EXPEDITION_WEAPONS[0]!;
  const now = toAbsMinutes(state.time);
  const ammo = w.ammo * members.length;
  const enoughAmmo = state.colony.stock.ammo >= ammo;
  const sizeOk = members.length >= X.minMembers && members.length <= X.maxMembers;
  const toggle = (id: number): void => setPicked(members.includes(id) ? members.filter((x) => x !== id) : members.length < X.maxMembers ? [...members, id] : members);
  const cells = state.world.cells;
  const dangerNow = (cell: CellId): number => dangerOf(cells.Z[cell] ?? 0);
  const known = (cell: CellId): boolean => (cells.intel[cell] ?? 0) >= 1;
  const chance = chosen && members.length > 0
    ? members.reduce((sum, id) => sum + returnChance(fit.find((s) => s.id === id)!, w, members.length, dangerNow(chosen.cell)), 0) / members.length
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
                {s.name}（{tk(`job.${s.job}`)}・{num(outputPerHour(s, 'scavenging'))}）
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
                  {tk(`xweapon.${x.id}`)}（+{Math.round(x.bonus * 100)}%{x.ammo > 0 ? `・${t('res.ammo')} ${x.ammo}/人` : ''}）
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

export function CommandPanel(props: PanelProps) {
  const { state } = props;
  const [tab, setTabRaw] = useState<Tab>('people');
  // Leaving the build tab puts the tool away (the mouse goes back to looking around).
  const setTab = (next: Tab): void => {
    if (next !== 'build' && (props.tool.def || props.tool.remove)) props.setTool({ ...props.tool, def: null, remove: false });
    setTabRaw(next);
  };
  const colony = state.colony;
  const count: Partial<Record<Tab, number>> = { build: state.build.structures.filter((b) => b.progress < 1).length || undefined, people: colony.survivors.length, hire: colony.candidates.length, expedition: state.world.expeditions.length };
  return (
    <div class="panel command-panel" data-testid="command-panel" data-tab={tab}>
      <div class="stock" data-testid="stock">
        {RESOURCE_IDS.map((r) => (
          <span key={r} data-res={r} data-amount={colony.stock[r]} title={r === 'ears' ? '' : `/ ${colony.capacity[r]}`}>
            {t(`res.${r}` as TextKey)} <b>{num(colony.stock[r])}</b>
            {r === 'food' && colony.survivors.length > 0 ? <small> {t('cmd.foodDays', { d: num(foodDays(state)) })}</small> : null}
          </span>
        ))}
      </div>
      <div class="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x} class={x === tab ? 'chip active' : 'chip'} data-testid={`tab-${x}`} onClick={() => setTab(x)}>
            {t(`cmd.tab.${x}` as TextKey, { n: count[x] ?? '' })}
          </button>
        ))}
      </div>
      <div class="tab-body">
        {tab === 'people' && <People {...props} />}
        {tab === 'build' && <BuildTab state={state} actions={props.actions} tool={props.tool} setTool={props.setTool} />}
        {tab === 'hire' && <Hire {...props} />}
        {tab === 'economy' && <Economy {...props} />}
        {tab === 'expedition' && <Expeditions {...props} />}
        {tab === 'log' && <LogList state={state} grid={props.grid} limit={80} />}
      </div>
    </div>
  );
}
