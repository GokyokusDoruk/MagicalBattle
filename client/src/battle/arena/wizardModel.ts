import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Element } from '../damage/elements';
import wizardUrl from '../../assets/models/wizard.glb?url';
import wizardTextureUrl from '../../assets/models/wizard_texture.jpg';
import staffTextureUrl from '../../assets/models/wizard_staff_texture.jpg';

/**
 * Büyücü modeli: Quaternius "RPG Characters" paketindeki Wizard (CC0, kamu malı). İskeletli ve animasyonlu:
 * bekleme (Idle_Weapon), büyü (Spell1), savunma duruşu (Idle_Attacking), darbe alma (RecieveHit), ölüm (Death).
 * Kıyafet (dokudaki mavi bölgeler) elementin rengine boyanır: ateş kırmızı, su mavi, toprak kahverengi, hava beyaz.
 * Model bir kez yüklenir; her savaşçıya iskeletiyle birlikte kopyası verilir.
 */

/** Modelin arenadaki boyu (mantıksal birim; eski büyücüyle aynı ölçek) */
export const WIZARD_HEIGHT = 3.05;

export type WizardClip = 'idle' | 'cast' | 'guard' | 'hit' | 'death';
const CLIP_NAMES: Record<WizardClip, string> = {
  idle: 'Idle_Weapon',
  cast: 'Spell1',
  guard: 'Idle_Attacking',
  hit: 'RecieveHit',
  death: 'Death',
};

interface Loaded {
  scene: THREE.Object3D;
  clips: Map<WizardClip, THREE.AnimationClip>;
  scale: number;
}

let loading: Promise<Loaded> | null = null;

/** Modeli (bir kez) yükler. Hata olursa (ağ) reddedilir; arena eski basit büyücüyle devam eder. */
export function loadWizard(): Promise<Loaded> {
  loading ??= new GLTFLoader().loadAsync(wizardUrl).then((gltf) => {
    const clips = new Map<WizardClip, THREE.AnimationClip>();
    for (const [key, name] of Object.entries(CLIP_NAMES) as [WizardClip, string][]) {
      const clip = gltf.animations.find((a) => a.name.endsWith(`|${name}`) || a.name === name);
      if (clip) clips.set(key, clip);
    }
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const h = box.max.y - box.min.y;
    return { scene: gltf.scene, clips, scale: h > 0 ? WIZARD_HEIGHT / h : 1 };
  });
  return loading;
}

// --- Element rengine boyanmış dokular ----------------------------------------------------------

/** Kıyafet rengi (ton derece, doygunluk çarpanı, parlaklık çarpanı); su özgün mavidir */
const ROBE: Record<Element, { hue: number; sat: number; val: number } | null> = {
  fire: { hue: 2, sat: 1.05, val: 1.1 },
  water: null,
  earth: { hue: 28, sat: 0.75, val: 0.85 },
  air: { hue: 210, sat: 0.08, val: 2.1 },
};

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * Dokudaki kıyafet maviğini (ton 195-255°, doygun) elementin rengine çevirir; ten, saç, altın süsler ve deri dokunulmaz.
 * Saf fonksiyon (RGBA dizisi üzerinde), testlenebilir.
 */
export function recolorRobe(data: Uint8ClampedArray, element: Element): void {
  const t = ROBE[element];
  if (!t) return;
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (h < 195 || h > 255 || s < 0.28) continue;
    const [r, g, b] = hsvToRgb(t.hue, Math.min(1, s * t.sat), Math.min(1, v * t.val));
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

const textureCache = new Map<string, Promise<THREE.Texture>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function robeTexture(element: Element): Promise<THREE.Texture> {
  const key = `robe-${element}`;
  let p = textureCache.get(key);
  if (!p) {
    p = loadImage(wizardTextureUrl).then((img) => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      recolorRobe(data.data, element);
      ctx.putImageData(data, 0, 0);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      tex.anisotropy = 4;
      return tex;
    });
    textureCache.set(key, p);
  }
  return p;
}

function staffTexture(): Promise<THREE.Texture> {
  let p = textureCache.get('staff');
  if (!p) {
    p = new THREE.TextureLoader().loadAsync(staffTextureUrl).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = true;
      return tex;
    });
    textureCache.set('staff', p);
  }
  return p;
}

// --- Savaşçı başına kopya ----------------------------------------------------------------------

export interface WizardInstance {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<WizardClip, THREE.AnimationAction>;
  /** Asa ucunun dünyadaki yeri için (element küresi) */
  staff: THREE.Object3D | null;
  dispose(): void;
}

/** Elementin renginde giyinmiş, animasyonlu bir büyücü kopyası. */
export async function createWizard(element: Element): Promise<WizardInstance> {
  const [base, robe, staff] = await Promise.all([loadWizard(), robeTexture(element), staffTexture()]);
  const root = cloneSkinned(base.scene);
  root.scale.setScalar(base.scale);
  const materials: THREE.Material[] = [];
  let staffNode: THREE.Object3D | null = null;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const isStaff = /staff/i.test(mesh.name) || /staff/i.test((mesh.material as THREE.Material)?.name ?? '');
    if (isStaff) staffNode = mesh;
    // Sahnenin diğer nesneleriyle aynı ışık modeli (Lambert); hafif öz ışık arenada karanlıkta kalmasın
    const map = isStaff ? staff : robe;
    // Öz ışık dokunun kendi renginden gelir: renkler solmadan parlar (vuruşta beyaza yakın parlar)
    const m = new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x000000 });
    materials.push(m);
    mesh.material = m;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<WizardClip, THREE.AnimationAction>();
  for (const [key, clip] of base.clips) {
    const a = mixer.clipAction(clip);
    if (key === 'cast' || key === 'hit' || key === 'death') {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(key, a);
  }
  return {
    root,
    mixer,
    actions,
    staff: staffNode,
    dispose: () => {
      mixer.stopAllAction();
      materials.forEach((m) => m.dispose());
    },
  };
}

// --- Harita için küçük görsel ------------------------------------------------------------------

let spriteRenderer: THREE.WebGLRenderer | null = null;

/**
 * Haritada kullanılacak büyücü görseli: aynı model, bekleme duruşunda, hafif yukarıdan önden çekilir (şeffaf zemin).
 * `px` kenar uzunluğu (piksel); harita bunu bir karoya küçültür. WebGL yoksa reddedilir (harita eski çizimle kalır).
 */
export async function renderWizardSprite(element: Element, px = 96): Promise<HTMLCanvasElement> {
  const w = await createWizard(element);
  try {
    spriteRenderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    const r = spriteRenderer;
    r.setPixelRatio(1);
    r.setSize(px, px, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 5, 4);
    scene.add(sun, w.root);
    w.actions.get('idle')?.play();
    w.mixer.update(0.6);
    w.root.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (mat && 'emissive' in mat) mat.emissive.setScalar(0.3);
    });
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0.7, 2.9, 4.9);
    cam.lookAt(0, 1.5, 0);
    r.render(scene, cam);
    const out = document.createElement('canvas');
    out.width = px;
    out.height = px;
    out.getContext('2d')!.drawImage(r.domElement, 0, 0);
    return out;
  } finally {
    w.dispose();
  }
}
