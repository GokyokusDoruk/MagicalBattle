import * as THREE from 'three';
import { createAppearance, type HeroGear } from './heroModel';

/**
 * Faz 7: karakter ekranı için 3D: portre (sol üstteki yuvarlak resim) ve kendi etrafında dönen büyücü görüntüleyici.
 * Ayrı bir parça olarak yüklenir (three.js oyunun ilk açılışını ağırlaştırmasın).
 */

let portraitRenderer: THREE.WebGLRenderer | null = null;

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4b3b5a, 2.4));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.8);
  key.position.set(2, 4, 5);
  const rim = new THREE.DirectionalLight(0x93c5fd, 1.2);
  rim.position.set(-3, 3, -4);
  scene.add(key, rim);
}

/** Baş ve omuz çekimi (şeffaf zemin), veri adresi olarak. */
export async function renderHeroPortrait(gear: HeroGear, px = 128): Promise<string> {
  const m = await createAppearance({ kind: 'hero', gear });
  try {
    portraitRenderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    const r = portraitRenderer;
    r.setPixelRatio(1);
    r.setSize(px, px, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    lights(scene);
    scene.add(m.root);
    m.actions.get('idle')?.play();
    m.mixer.update(0.4);
    m.root.updateMatrixWorld(true);
    const head = m.root.getObjectByName('head');
    const at = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 2.2, 0);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(at.x + 0.35, at.y + 0.25, at.z + 3.2);
    cam.lookAt(at.x, at.y + 0.1, at.z);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/png');
  } finally {
    m.dispose();
  }
}

/**
 * Tuvalde kendi etrafında yavaşça dönen büyücü. Her karede `onFrame(project)` çağrılır: `project(kemik, yukarı)` kemiğin tuvaldeki
 * yerini (piksel) verir; yuvalardan vücuda çizgi çizmek için. Dönen fonksiyon görüntüleyiciyi durdurur.
 */
export async function startHeroViewer(
  canvas: HTMLCanvasElement,
  gear: HeroGear,
  onFrame: (project: (bone: string, up: number) => { x: number; y: number } | null) => void,
): Promise<() => void> {
  const m = await createAppearance({ kind: 'hero', gear });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  lights(scene);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 40), new THREE.MeshBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor, m.root);
  m.actions.get('idle')?.play();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  cam.position.set(0, 1.8, 9.6);
  cam.lookAt(0, 1.35, 0);
  const v = new THREE.Vector3();
  let raf = 0;
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    }
    m.root.rotation.y += dt * 0.45;
    m.mixer.update(dt);
    renderer.render(scene, cam);
    onFrame((bone, up) => {
      const o = m.root.getObjectByName(bone);
      if (!o) return null;
      o.getWorldPosition(v);
      v.y += up * 0.5;
      v.project(cam);
      return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    m.dispose();
    renderer.dispose();
  };
}

/** Haritadaki karakter görseli: kuşandıklarıyla tam boy, hafif yukarıdan önden (şeffaf zemin). */
export async function renderHeroSprite(gear: HeroGear, px = 96): Promise<HTMLCanvasElement> {
  const m = await createAppearance({ kind: 'hero', gear });
  try {
    portraitRenderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    const r = portraitRenderer;
    r.setPixelRatio(1);
    r.setSize(px, px, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    lights(scene);
    scene.add(m.root);
    m.actions.get('idle')?.play();
    m.mixer.update(0.4);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0.6, 2.9, 5.6);
    cam.lookAt(0, 1.45, 0);
    r.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = px;
    out.height = px;
    out.getContext('2d')!.drawImage(r.domElement, 0, 0);
    return out;
  } finally {
    m.dispose();
  }
}
