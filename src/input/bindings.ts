// Key bindings (docs/02_systems_spec.md §3.1). Values are KeyboardEvent.code.

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprintOrBreath: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  crouch: ['KeyC'],
  prone: ['KeyZ'],
  zeroUp: ['PageUp'],
  zeroDown: ['PageDown'],
  knife: ['KeyV'],
  interact: ['KeyE'],
  toggleCommand: ['Tab'],
  toggleWorld: ['KeyM'],
  pause: ['Space'],
  speed1: ['Digit1', 'Numpad1'],
  speed2: ['Digit2', 'Numpad2'],
  speed3: ['Digit3', 'Numpad3'],
  menu: ['Escape'],
} as const;

export type Action = keyof typeof KEYS;

const lookup = new Map<string, Action>();
for (const action of Object.keys(KEYS) as Action[]) for (const code of KEYS[action]) lookup.set(code, action);

export function actionForCode(code: string): Action | undefined {
  return lookup.get(code);
}

/** Speeds selected by the 1 / 2 / 3 keys. */
export const SPEED_KEYS = { speed1: 1, speed2: 3, speed3: 10 } as const;
