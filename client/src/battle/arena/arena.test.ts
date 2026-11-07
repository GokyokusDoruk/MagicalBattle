import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Stroke } from '../gesture/types';
import { CameraDirector, dampFactor, isPortrait, viewDistanceScale } from './camera';
import { TEAM_X, layoutTeams, slotKey } from './layout';
import { ParticleSystem } from './particles';
import { MAX_PATH_POINTS, SIGIL_SIZE, pathLength, strokesToPaths } from './strokeMap';
import { Tweens, clamp01, easeInOut, easeOutCubic } from './tween';

const stroke = (pts: [number, number][]): Stroke => pts.map(([x, y], i) => ({ x, y, t: i * 30 }));

describe('layoutTeams', () => {
  it('1v1: biri solda biri sağda, ortada karşılıklı', () => {
    const s = layoutTeams([1, 1]);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ team: 0, index: 0, position: { x: -TEAM_X, z: 0 } });
    expect(s[1]).toMatchObject({ team: 1, index: 0, position: { x: TEAM_X, z: 0 } });
  });

  it('takımlar birbirine bakar', () => {
    const [a, b] = layoutTeams([1, 1]);
    expect(a.yaw).toBeCloseTo(Math.PI / 2);
    expect(b.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('2v2: dört savaşçı, takım içinde yan yana ve ikinci kişi biraz arkada', () => {
    const s = layoutTeams([2, 2]);
    expect(s).toHaveLength(4);
    const t0 = s.filter((x) => x.team === 0);
    expect(t0[0].position.z).toBeLessThan(0);
    expect(t0[1].position.z).toBeGreaterThan(0);
    expect(t0[1].position.x).toBeLessThan(t0[0].position.x); // arkada = daha dışarıda
  });

  it('1v2 gibi karışık boyutlar çalışır, kimse aynı yerde durmaz', () => {
    const s = layoutTeams([1, 2]);
    expect(s).toHaveLength(3);
    const keys = new Set(s.map((x) => `${x.position.x},${x.position.z}`));
    expect(keys.size).toBe(3);
  });

  it('geçersiz takım boyutunu reddeder', () => {
    expect(() => layoutTeams([0, 1])).toThrow();
    expect(() => layoutTeams([1, 3])).toThrow();
    expect(() => layoutTeams([1.5, 1])).toThrow();
  });

  it('slotKey benzersiz anahtar verir', () => {
    expect(slotKey({ team: 1, index: 0 })).toBe('1:0');
  });
});

describe('strokesToPaths', () => {
  it('tuvalin ortası dünya merkezine, y ekseni yukarıya gelir', () => {
    const [path] = strokesToPaths([stroke([[128, 128], [256, 0]])]);
    expect(path[0].x).toBeCloseTo(0);
    expect(path[0].y).toBeCloseTo(0);
    expect(path[1].x).toBeCloseTo(SIGIL_SIZE / 2); // sağ kenar
    expect(path[1].y).toBeCloseTo(SIGIL_SIZE / 2); // tuvalde üst = dünyada yukarı
  });

  it('tek noktalık dokunuşlar ve bekleme örnekleri atılır', () => {
    expect(strokesToPaths([stroke([[100, 100]])])).toEqual([]);
    expect(strokesToPaths([stroke([[100, 100], [100, 100], [100, 100]])])).toEqual([]);
    const [p] = strokesToPaths([stroke([[10, 10], [10, 10], [10, 10], [200, 200]])]);
    expect(p).toHaveLength(2);
  });

  it('uzun çizgileri en fazla MAX_PATH_POINTS noktaya seyreltir, uçları korur', () => {
    const long = stroke(Array.from({ length: 500 }, (_, i) => [i % 256, (i * 3) % 256] as [number, number]));
    const [p] = strokesToPaths([long]);
    expect(p.length).toBeLessThanOrEqual(MAX_PATH_POINTS);
    expect(p[0].x).toBeCloseTo((long[0].x / 256 - 0.5) * SIGIL_SIZE);
    const last = long[long.length - 1];
    expect(p[p.length - 1].x).toBeCloseTo((last.x / 256 - 0.5) * SIGIL_SIZE);
  });

  it('çok çizgili büyüde sırayı korur ve boyutu ayarlanabilir', () => {
    const paths = strokesToPaths([stroke([[0, 0], [256, 0]]), stroke([[0, 256], [256, 256]])], { size: 10 });
    expect(paths).toHaveLength(2);
    expect(paths[0][0].y).toBeCloseTo(5);
    expect(paths[1][0].y).toBeCloseTo(-5);
    expect(pathLength(paths[0])).toBeCloseTo(10);
  });
});

describe('Tweens', () => {
  it('0 ile başlar, ilerler, bitişte tam 1 ile bir kez çağrılır ve söz çözülür', async () => {
    const tw = new Tweens();
    const seen: number[] = [];
    const done = tw.add(1, (t) => seen.push(t));
    expect(seen).toEqual([0]);
    tw.update(0.5);
    tw.update(0.7); // süreyi aşar: 1'e kırpılır
    await done;
    expect(seen).toEqual([0, 0.5, 1]);
    expect(tw.activeCount).toBe(0);
    tw.update(1); // bitenler bir daha çağrılmaz
    expect(seen).toHaveLength(3);
  });

  it('birden çok işlem birbirinden bağımsız ilerler', async () => {
    const tw = new Tweens();
    let a = 0;
    let b = 0;
    const pa = tw.add(1, (t) => (a = t));
    const pb = tw.add(2, (t) => (b = t));
    tw.update(1);
    await pa;
    expect(a).toBe(1);
    expect(b).toBe(0.5);
    tw.update(1);
    await pb;
    expect(b).toBe(1);
  });

  it('sözler sırayla zincirlenir (await ile akış yazılabilir)', async () => {
    const tw = new Tweens();
    const log: string[] = [];
    const flow = (async () => {
      await tw.add(1, () => {});
      log.push('birinci');
      await tw.wait(1);
      log.push('ikinci');
    })();
    tw.update(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(['birinci']);
    tw.update(1);
    await flow;
    expect(log).toEqual(['birinci', 'ikinci']);
  });

  it('finishAll bekleyenleri son kareyle bitirir', async () => {
    const tw = new Tweens();
    let t = 0;
    const p = tw.add(5, (x) => (t = x));
    tw.finishAll();
    await p;
    expect(t).toBe(1);
    expect(tw.activeCount).toBe(0);
  });

  it('yumuşatma işlevleri 0-1 arasında kalır ve uçları korur', () => {
    for (const f of [easeOutCubic, easeInOut]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
      expect(f(-3)).toBe(0);
      expect(f(9)).toBe(1);
    }
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe('ParticleSystem', () => {
  it('emit parçacık üretir, ömrü dolunca hepsi söner', () => {
    const ps = new ParticleSystem(100);
    ps.emit(new THREE.Vector3(), { color: 0xff0000, count: 30, speed: 3, life: 1 });
    expect(ps.aliveCount).toBe(30);
    ps.update(0.5);
    expect(ps.aliveCount).toBeGreaterThan(0);
    ps.update(2);
    expect(ps.aliveCount).toBe(0);
  });

  it('kapasite dolunca en eskilerin üstüne yazar, kapasiteyi aşmaz', () => {
    const ps = new ParticleSystem(50);
    ps.emit(new THREE.Vector3(), { color: 0xffffff, count: 80, speed: 1, life: 5 });
    expect(ps.aliveCount).toBe(50);
  });

  it('parçacıklar hareket eder, yerçekimiyle aşağı düşer', () => {
    const ps = new ParticleSystem(10, () => 0.5);
    ps.emit(new THREE.Vector3(0, 5, 0), { color: 0xffffff, count: 1, speed: 0, life: 10, gravity: 10 });
    const pos = ps.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    ps.update(1);
    expect(pos.getY(0)).toBeLessThan(5);
  });

  it('yönlü emisyon verilen yöne doğru saçılır', () => {
    const ps = new ParticleSystem(200, () => 0.9);
    ps.emit(new THREE.Vector3(), { color: 0xffffff, count: 50, speed: 4, life: 3, direction: new THREE.Vector3(1, 0, 0), spread: 0 });
    ps.update(0.5);
    const pos = ps.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < 50; i++) expect(pos.getX(i)).toBeGreaterThan(0.5);
  });

  it('sönen parçacıklar görünmez (renk 0) ve clear hepsini temizler', () => {
    const ps = new ParticleSystem(10);
    ps.emit(new THREE.Vector3(), { color: 0xffffff, count: 5, speed: 1, life: 1 });
    ps.clear();
    expect(ps.aliveCount).toBe(0);
    const col = ps.points.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < col.count; i++) expect(col.getX(i)).toBe(0);
  });
});

describe('CameraDirector', () => {
  const make = () => {
    const cam = new THREE.PerspectiveCamera(45, 1.6, 0.1, 100);
    return { cam, dir: new CameraDirector(cam, () => 0.5) }; // rand=0.5 → sarsıntı ofseti 0
  };

  it('yumuşatma katsayısı 0 ile 1 arasındadır ve süreyle artar', () => {
    expect(dampFactor(3, 0)).toBe(0);
    expect(dampFactor(3, 0.1)).toBeLessThan(dampFactor(3, 1));
    expect(dampFactor(3, 100)).toBeLessThanOrEqual(1);
  });

  it('çekim verilince kamera o çekime yumuşakça yaklaşır', () => {
    const { cam, dir } = make();
    dir.setShot({ position: new THREE.Vector3(-8, 3, 4), lookAt: new THREE.Vector3(2, 1, 0) });
    for (let i = 0; i < 300; i++) dir.update(1 / 60, i / 60);
    expect(cam.position.x).toBeCloseTo(-8, 0);
    expect(cam.position.y).toBeCloseTo(3, 0);
    expect(dir.hasShot).toBe(true);
  });

  it('setShot(null) boşta haline (arenayı süzen kadraja) döner', () => {
    const { cam, dir } = make();
    dir.setShot({ position: new THREE.Vector3(-8, 3, 4), lookAt: new THREE.Vector3(2, 1, 0) });
    for (let i = 0; i < 120; i++) dir.update(1 / 60, i / 60);
    dir.setShot(null);
    for (let i = 0; i < 600; i++) dir.update(1 / 60, 10 + i / 60);
    expect(cam.position.z).toBeGreaterThan(12);
    expect(cam.position.y).toBeGreaterThan(5);
  });

  it('sarsıntı zamanla sönüp sıfırlanır, küçük sarsıntı büyüğünü ezmez', () => {
    const { dir } = make();
    dir.shake(0.8);
    dir.shake(0.2);
    expect(dir.currentShake).toBe(0.8);
    for (let i = 0; i < 300; i++) dir.update(1 / 60, i / 60);
    expect(dir.currentShake).toBe(0);
  });

  it('sarsıntı değeri 0-1 aralığına kırpılır', () => {
    const { dir } = make();
    dir.shake(50);
    expect(dir.currentShake).toBe(1);
    dir.shake(-3);
    expect(dir.currentShake).toBe(1);
  });

  it('dar yatay ekranda kamera uzaklaşır, geniş ekranda ve dikeyde çarpan 1', () => {
    expect(viewDistanceScale(2)).toBe(1);
    expect(viewDistanceScale(1.5)).toBe(1);
    expect(viewDistanceScale(1)).toBeGreaterThan(1);
    expect(viewDistanceScale(0.95)).toBeGreaterThan(viewDistanceScale(1.3));
    expect(viewDistanceScale(0.95)).toBeLessThanOrEqual(1.6);
    expect(viewDistanceScale(0.46)).toBe(1); // dikeyde eksen çekimi kullanılır
    expect(viewDistanceScale(Number.NaN)).toBe(1);
  });

  it('dikey ekranı tanır', () => {
    expect(isPortrait(0.46)).toBe(true);
    expect(isPortrait(0.89)).toBe(true);
    expect(isPortrait(0.9)).toBe(false);
    expect(isPortrait(1.6)).toBe(false);
    expect(isPortrait(Number.NaN)).toBe(false);
  });

  it('dikey ekranda boşta kamera oyuncunun arkasında durup düelloya bakar, yatayda yandan', () => {
    const portrait = make();
    portrait.dir.setAspect(0.46);
    const wide = make();
    wide.dir.setAspect(1.8);
    for (let i = 0; i < 600; i++) {
      portrait.dir.update(1 / 60, i / 60);
      wide.dir.update(1 / 60, i / 60);
    }
    expect(portrait.cam.position.x).toBeLessThan(-10);
    expect(Math.abs(wide.cam.position.x)).toBeLessThan(6);
    expect(wide.cam.position.z).toBeGreaterThan(12);
  });
});
