// Canvas 2D map of the cell grid with pan (drag), zoom (wheel) and picking. Presentation only:
// the caller decides the colour of every cell and what the markers mean.

import { useEffect, useRef } from 'preact/hooks';
import type { CellId, StaticGrid } from '../../core/types.ts';
import { SEA } from './palette.ts';

export interface MapMarker {
  cell: CellId;
  kind: 'player' | 'home' | 'target' | 'candidate' | 'source' | 'outpost';
  label?: string;
  active?: boolean;
}

export interface MapFocus {
  /** Change the key to re-apply the focus. */
  key: string | number;
  /** Centre on this cell; omit to fit the whole country. */
  cell?: CellId;
  /** Pixels per cell when centring on a cell. */
  scale?: number;
}

interface Props {
  grid: StaticGrid;
  /** CSS colour of a land cell. */
  paint(cell: CellId): string;
  markers?: MapMarker[];
  path?: CellId[] | null;
  focus: MapFocus;
  /** Draw place names. */
  labels?: boolean;
  onHover?(cell: CellId | null): void;
  onPick?(cell: CellId | null): void;
  testId?: string;
}

interface View {
  scale: number;
  ox: number;
  oy: number;
}

const MAX_SCALE = 48;
const MAJOR = new Set(['札幌', '仙台', '東京', '新潟', '名古屋', '金沢', '大阪', '広島', '高知', '福岡', '鹿児島', '那覇']);
const MARKER_COLOR: Record<MapMarker['kind'], string> = { player: '#ffffff', home: '#c9a24a', target: '#7fd4ff', candidate: '#ffffff', source: '#ff5a4a', outpost: '#8fd48a' };

export function MapCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ scale: 4, ox: 0, oy: 0 });
  const latest = useRef(props);
  latest.current = props;
  const appliedFocus = useRef<string | number | null>(null);
  const bounds = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const landBounds = (grid: StaticGrid) => {
    if (bounds.current) return bounds.current;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of grid.landIds) {
      const x = id % grid.gridW;
      const y = Math.floor(id / grid.gridW);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
    }
    return (bounds.current = { x0, y0, x1, y1 });
  };

  const applyFocus = (w: number, h: number): void => {
    const { grid, focus } = latest.current;
    const v = view.current;
    if (focus.cell !== undefined && grid.cells[focus.cell]) {
      v.scale = focus.scale ?? 14;
      v.ox = w / 2 - ((focus.cell % grid.gridW) + 0.5) * v.scale;
      v.oy = h / 2 - (Math.floor(focus.cell / grid.gridW) + 0.5) * v.scale;
    } else {
      const b = landBounds(grid);
      v.scale = Math.max(1, Math.min((w - 16) / (b.x1 - b.x0), (h - 16) / (b.y1 - b.y0)));
      v.ox = (w - (b.x1 + b.x0) * v.scale) / 2;
      v.oy = (h - (b.y1 + b.y0) * v.scale) / 2;
    }
  };

  const draw = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (appliedFocus.current !== null && latest.current.focus.cell === undefined) applyFocus(w, h); // keep "fit" fitted on resize
    }
    const { grid, paint, markers, path, focus, labels } = latest.current;
    if (appliedFocus.current !== focus.key) {
      appliedFocus.current = focus.key;
      applyFocus(w, h);
    }
    const { scale, ox, oy } = view.current;
    canvas.dataset.scale = String(scale);
    canvas.dataset.ox = String(ox);
    canvas.dataset.oy = String(oy);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, w, h);

    const gx0 = Math.max(0, Math.floor(-ox / scale));
    const gx1 = Math.min(grid.gridW - 1, Math.floor((w - ox) / scale));
    const gy0 = Math.max(0, Math.floor(-oy / scale));
    const gy1 = Math.min(grid.gridH - 1, Math.floor((h - oy) / scale));
    const gap = scale >= 10 ? 1 : 0;
    for (let gy = gy0; gy <= gy1; gy++) {
      const y = Math.floor(oy + gy * scale);
      const ch = Math.floor(oy + (gy + 1) * scale) - y - gap;
      for (let gx = gx0; gx <= gx1; gx++) {
        const id = gy * grid.gridW + gx;
        if (!grid.cells[id]) continue;
        const x = Math.floor(ox + gx * scale);
        ctx.fillStyle = paint(id);
        ctx.fillRect(x, y, Math.floor(ox + (gx + 1) * scale) - x - gap, ch);
      }
    }

    const cx = (cell: CellId): number => ox + ((cell % grid.gridW) + 0.5) * scale;
    const cy = (cell: CellId): number => oy + (Math.floor(cell / grid.gridW) + 0.5) * scale;

    // Sea crossings (06): dashed lines between their two ends.
    if (grid.seaLinks && grid.seaLinks.length > 0) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(190, 225, 255, 0.75)';
      ctx.beginPath();
      for (const l of grid.seaLinks) {
        ctx.moveTo(cx(l.a), cy(l.a));
        ctx.lineTo(cx(l.b), cy(l.b));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (path && path.length > 1) {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [color, width] of [['rgba(0,0,0,0.7)', 5], ['#7fd4ff', 2.5]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        path.forEach((cell, i) => (i === 0 ? ctx.moveTo(cx(cell), cy(cell)) : ctx.lineTo(cx(cell), cy(cell))));
        ctx.stroke();
      }
    }

    if (labels) {
      ctx.font = '11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      const all = scale >= 16;
      for (const p of grid.places) {
        if (!all && !(MAJOR.has(p.name) || (scale >= 9 && grid.cells[p.cell]?.hubId !== undefined))) continue;
        const x = cx(p.cell);
        const y = cy(p.cell);
        if (x < -40 || y < -10 || x > w + 10 || y > h + 10) continue;
        ctx.strokeText(p.name, x + scale / 2 + 3, y);
        ctx.fillText(p.name, x + scale / 2 + 3, y);
      }
    }

    for (const m of markers ?? []) {
      if (!grid.cells[m.cell]) continue;
      const x = cx(m.cell);
      const y = cy(m.cell);
      const r = Math.max(5, scale * 0.75) + (m.active ? 3 : 0);
      ctx.lineWidth = m.active ? 3.5 : 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = MARKER_COLOR[m.kind];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      if (m.kind === 'player') {
        ctx.fillStyle = MARKER_COLOR.player;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (m.label) {
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.fillStyle = MARKER_COLOR[m.kind];
        ctx.strokeText(m.label, x + r + 4, y);
        ctx.fillText(m.label, x + r + 4, y);
      }
    }
  };

  // Redraw after every render (the parent re-renders at ~10 Hz while the game runs).
  useEffect(draw);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cellAt = (e: { clientX: number; clientY: number }): CellId | null => {
      const rect = canvas.getBoundingClientRect();
      const { grid } = latest.current;
      const { scale, ox, oy } = view.current;
      const gx = Math.floor((e.clientX - rect.left - ox) / scale);
      const gy = Math.floor((e.clientY - rect.top - oy) / scale);
      if (gx < 0 || gy < 0 || gx >= grid.gridW || gy >= grid.gridH) return null;
      const id = gy * grid.gridW + gx;
      return grid.cells[id] ? id : null;
    };
    let drag: { x: number; y: number; moved: boolean; id: number } | null = null;
    let hover: CellId | null = null;

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent): void => {
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 4) return;
        drag.moved = true;
        drag.x = e.clientX;
        drag.y = e.clientY;
        view.current.ox += dx;
        view.current.oy += dy;
        draw();
        return;
      }
      const cell = cellAt(e);
      if (cell !== hover) {
        hover = cell;
        latest.current.onHover?.(cell);
      }
    };
    const onUp = (e: PointerEvent): void => {
      if (!drag || drag.id !== e.pointerId) return;
      const moved = drag.moved;
      drag = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!moved) latest.current.onPick?.(cellAt(e));
    };
    const onLeave = (): void => {
      if (hover !== null) {
        hover = null;
        latest.current.onHover?.(null);
      }
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = view.current;
      const next = Math.min(MAX_SCALE, Math.max(1.5, v.scale * Math.pow(1.0015, -e.deltaY)));
      v.ox = px - ((px - v.ox) / v.scale) * next;
      v.oy = py - ((py - v.oy) / v.scale) * next;
      v.scale = next;
      draw();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return <canvas ref={canvasRef} class="map-canvas" data-testid={props.testId ?? 'map-canvas'} />;
}
