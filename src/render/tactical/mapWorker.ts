// Background generation of operation areas (07c): the neighbours of the current cell are made
// here so that walking into them does not stall a frame. The map generator and the ground
// pixels are pure functions, so the result is exactly what the main thread would have built.

import { generateTacticalMap, type GenParams } from '../../gen/index.ts';
import { buildGroundPixels } from './groundPixels.ts';

interface Request {
  id: number;
  params: GenParams;
}

self.onmessage = (e: MessageEvent<Request>): void => {
  const { id, params } = e.data;
  const map = generateTacticalMap(params);
  const pixels = buildGroundPixels(map);
  (self as unknown as Worker).postMessage({ id, map, pixels }, [pixels.buffer]);
};
