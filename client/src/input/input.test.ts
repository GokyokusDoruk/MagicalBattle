import { describe, expect, it } from 'vitest';
import { NO_DIRECTIONS, axisFromDirections, mergeDirections } from './axis';
import { InputManager } from './inputManager';
import { KeyboardSource } from './keyboard';

const dir = (p: Partial<typeof NO_DIRECTIONS>) => ({ ...NO_DIRECTIONS, ...p });

describe('axisFromDirections', () => {
  it('tek yönde tam hız verir', () => {
    expect(axisFromDirections(dir({ right: true }))).toEqual({ x: 1, y: 0 });
    expect(axisFromDirections(dir({ up: true }))).toEqual({ x: 0, y: -1 });
  });

  it('karşıt yönleri iptal eder', () => {
    expect(axisFromDirections(dir({ left: true, right: true }))).toEqual({ x: 0, y: 0 });
  });

  it('çaprazda hızı sabit tutar', () => {
    const a = axisFromDirections(dir({ up: true, right: true }));
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(1);
  });
});

describe('mergeDirections', () => {
  it('kaynakları VEYA ile birleştirir', () => {
    const m = mergeDirections([dir({ up: true }), dir({ left: true })]);
    expect(m).toEqual(dir({ up: true, left: true }));
  });
});

const key = (type: string, code: string) => Object.assign(new Event(type), { code });

describe('KeyboardSource', () => {
  it('WASD ve ok tuşlarını izler, tuş bırakılınca temizler', () => {
    const target = new EventTarget();
    const kb = new KeyboardSource(target);
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(key('keydown', 'ArrowRight'));
    expect(kb.getDirections()).toEqual(dir({ up: true, right: true }));
    target.dispatchEvent(key('keyup', 'KeyW'));
    expect(kb.getDirections()).toEqual(dir({ right: true }));
  });

  it('odak kaybında basılı tuşları bırakır', () => {
    const target = new EventTarget();
    const kb = new KeyboardSource(target);
    target.dispatchEvent(key('keydown', 'KeyA'));
    target.dispatchEvent(new Event('blur'));
    expect(kb.getDirections()).toEqual(NO_DIRECTIONS);
  });

  it('ilgisiz tuşları yok sayar', () => {
    const target = new EventTarget();
    const kb = new KeyboardSource(target);
    target.dispatchEvent(key('keydown', 'KeyQ'));
    expect(kb.getDirections()).toEqual(NO_DIRECTIONS);
  });
});

describe('InputManager', () => {
  it('klavye ve dokunmatik kaynağı tek eksende birleştirir', () => {
    const touch = { getDirections: () => dir({ down: true }) };
    const target = new EventTarget();
    const kb = new KeyboardSource(target);
    const manager = new InputManager([kb, touch]);
    target.dispatchEvent(key('keydown', 'KeyD'));
    const a = manager.getAxis();
    expect(a.x).toBeGreaterThan(0);
    expect(a.y).toBeGreaterThan(0);
  });
});
