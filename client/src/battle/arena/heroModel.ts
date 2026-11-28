import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Element } from '../damage/elements';
import { ELEMENT_COLORS } from './palette';
import { createWizard, type WizardClip, type WizardInstance } from './wizardModel';
import mageUrl from '../../assets/models/mage.glb?url';
import knightUrl from '../../assets/models/knight.glb?url';
import barbarianUrl from '../../assets/models/barbarian.glb?url';
import rogueUrl from '../../assets/models/rogue_hooded.glb?url';

/**
 * Faz 7: savaşçıların görünümü.
 * - **Oyuncu** (`hero`): KayKit Mage (CC0), parçalı model. Kuşanılan ekipman görünür: şapka ve pelerin (cüppe) yalnızca kuşanılınca
 *   çıkar; cüppe, şapka, eldiven ve pantolon kendi elementinin rengine boyanır, yüksek nadirlikte hafifçe parlar. Asa nadirliğe göre
 *   değnek (Sıradan-Nadir) ya da büyük asa (Destansı ve üstü); ucunda element ışığı.
 * - **Boss**: KayKit Şövalye, Barbar, Kapüşonlu Haydut ya da koyulaştırılmış büyük büyücü; kendi rengi, boyu ve aurası.
 * - **Diğerleri**: Quaternius büyücüsü (elementinin renginde).
 * KayKit modelleri aynı iskeleti paylaşır: animasyonlar yalnız Mage dosyasında durur, hepsine uygulanır.
 */

export interface GearLook {
  element: Element;
  /** 1 Sıradan … 6 Mistik */
  rarity: number;
}

export interface HeroGear {
  robe?: GearLook;
  hat?: GearLook;
  gloves?: GearLook;
  pants?: GearLook;
  necklace?: GearLook;
  wand?: GearLook;
}

export type BossModel = 'knight' | 'barbarian' | 'rogue' | 'darkWizard';

export type Appearance =
  | { kind: 'hero'; gear: HeroGear }
  | { kind: 'boss'; model: BossModel; element: Element; scale: number; aura?: number; robe?: number }
  | { kind: 'wizard'; element: Element };

/** Görünümün yüklenmiş hali: kök nesne, animasyon karıştırıcı ve animasyonlar (WizardInstance ile aynı biçim) */
export type ModelInstance = WizardInstance & { aura?: THREE.Object3D };

// --- Yükleme -----------------------------------------------------------------------------------

const URLS = { mage: mageUrl, knight: knightUrl, barbarian: barbarianUrl, rogue: rogueUrl } as const;
type KayModel = keyof typeof URLS;
const cache = new Map<KayModel, Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>>();

function loadKay(name: KayModel): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
  let p = cache.get(name);
  if (!p) {
    p = new GLTFLoader().loadAsync(URLS[name]).then((g) => ({ scene: g.scene, animations: g.animations }));
    cache.set(name, p);
  }
  return p;
}

const KAY_CLIPS: Record<WizardClip, string[]> = {
  idle: ['Idle'],
  cast: ['Spellcast_Shoot', 'Spellcast_Long'],
  guard: ['Blocking'],
  hit: ['Hit_A'],
  death: ['Death_A'],
};

// --- Kumaş rengi (KayKit dokusundaki mor kumaş elementin rengine) --------------------------------

const FABRIC: Record<Element, { hue: number; sat: number; val: number }> = {
  fire: { hue: 2, sat: 1.15, val: 1.05 },
  water: { hue: 215, sat: 1.1, val: 1.05 },
  earth: { hue: 30, sat: 0.85, val: 0.85 },
  air: { hue: 205, sat: 0.08, val: 1.9 },
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

/** Dokudaki mor kumaşı (ton 235-305°) elementin rengine çevirir; ten, deri, metal dokunulmaz. Saf: RGBA dizisi üzerinde. */
export function recolorFabric(data: Uint8ClampedArray, element: Element): void {
  const t = FABRIC[element];
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, v] = rgbToHsv(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    if (h < 235 || h > 305 || s < 0.18) continue;
    const [r, g, b] = hsvToRgb(t.hue, Math.min(1, s * t.sat), Math.min(1, v * t.val));
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

const fabricCache = new Map<string, THREE.Texture>();

/** Mage dokusunun elementin renginde bir kopyası (bir kez üretilir) */
function fabricTexture(base: THREE.Texture, element: Element): THREE.Texture {
  const key = `${base.uuid}:${element}`;
  const hit = fabricCache.get(key);
  if (hit) return hit;
  const img = base.image as CanvasImageSource & { width: number; height: number };
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  recolorFabric(d.data, element);
  ctx.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = base.flipY;
  tex.colorSpace = THREE.SRGBColorSpace;
  fabricCache.set(key, tex);
  return tex;
}

// --- Kurulum ---------------------------------------------------------------------------------

/** Ekipmanın parçası: hangi model parçası, hangi yuva */
const HERO_PARTS: Record<string, keyof HeroGear | 'always'> = {
  Mage_Hat: 'hat',
  Mage_Cape: 'robe',
  Mage_Body: 'robe',
  Mage_ArmLeft: 'gloves',
  Mage_ArmRight: 'gloves',
  Mage_LegLeft: 'pants',
  Mage_LegRight: 'pants',
  Mage_Head: 'always',
};

/** Parçanın kuşanılmadığında görünüp görünmediği: şapka ve pelerin yalnızca kuşanılınca */
const ONLY_WHEN_EQUIPPED = new Set(['Mage_Hat', 'Mage_Cape']);

function prepareKay(root: THREE.Object3D, height: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const h = box.max.y - box.min.y;
  if (h > 0) root.scale.setScalar(height / h);
}

function mixerFor(root: THREE.Object3D, clips: THREE.AnimationClip[]): { mixer: THREE.AnimationMixer; actions: Map<WizardClip, THREE.AnimationAction> } {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<WizardClip, THREE.AnimationAction>();
  for (const [key, names] of Object.entries(KAY_CLIPS) as [WizardClip, string[]][]) {
    const clip = names.map((n) => clips.find((c) => c.name === n)).find(Boolean);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (key === 'cast' || key === 'hit' || key === 'death') {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(key, a);
  }
  return { mixer, actions };
}

/** Asa ucunda element ışığı (küçük parlayan küre + nokta ışık) */
function tipGlow(holder: THREE.Object3D, element: Element, size: number): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(holder);
  const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
  const top = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).applyMatrix4(inv);
  const g = new THREE.Group();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color: ELEMENT_COLORS[element].glow, transparent: true, opacity: 0.9 }));
  const light = new THREE.PointLight(ELEMENT_COLORS[element].glow, 1.2, 2.5, 2);
  g.add(orb, light);
  g.position.copy(top);
  holder.add(g);
  return g;
}

async function createHero(gear: HeroGear): Promise<ModelInstance> {
  const base = await loadKay('mage');
  const root = cloneSkinned(base.scene);
  root.updateMatrixWorld(true);
  const materials: THREE.Material[] = [];
  const hide: THREE.Object3D[] = [];
  let wandNode: THREE.Object3D | null = null;
  const wantStaff = (gear.wand?.rarity ?? 0) >= 4;
  root.traverse((o) => {
    if (o.name === 'Spellbook' || o.name === 'Spellbook_open') hide.push(o);
    if (o.name === '1H_Wand') (gear.wand && !wantStaff ? (wandNode = o) : hide.push(o));
    if (o.name === '2H_Staff') (gear.wand && wantStaff ? (wandNode = o) : hide.push(o));
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const part = HERO_PARTS[mesh.name] ? mesh.name : (mesh.parent?.name ?? '');
    const slot = HERO_PARTS[part];
    const piece = slot && slot !== 'always' ? gear[slot] : undefined;
    if (ONLY_WHEN_EQUIPPED.has(part) && !piece) {
      hide.push(mesh);
      return;
    }
    const old = mesh.material as THREE.MeshStandardMaterial;
    const map = piece && old.map ? fabricTexture(old.map, piece.element) : old.map;
    const m = new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x000000 });
    // Yüksek nadirlik hafifçe parlar (Destansı ve üstü)
    if (piece && piece.rarity >= 4) m.emissive.setHex(ELEMENT_COLORS[piece.element].glow).multiplyScalar(0.12 * (piece.rarity - 3));
    m.userData.baseEmissive = m.emissive.clone();
    materials.push(m);
    mesh.material = m;
  });
  hide.forEach((o) => (o.visible = false));
  if (wandNode && gear.wand) tipGlow(wandNode, gear.wand.element, wantStaff ? 0.09 : 0.05);
  if (gear.necklace) {
    // Kolye: göğüste element renginde küçük taş
    const chest = root.getObjectByName('chest');
    if (chest) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: ELEMENT_COLORS[gear.necklace.element].glow }));
      gem.position.set(0, 0.25, 0.32);
      chest.add(gem);
    }
  }
  prepareKay(root, 3.0);
  const { mixer, actions } = mixerFor(root, base.animations);
  return {
    root,
    mixer,
    actions,
    staff: wandNode,
    dispose: () => {
      mixer.stopAllAction();
      materials.forEach((mm) => mm.dispose());
    },
  };
}

async function createBoss(a: Extract<Appearance, { kind: 'boss' }>): Promise<ModelInstance> {
  if (a.model === 'darkWizard') {
    // Gölge Hükümdarı: büyücü, kıyafeti koyu mor, iri ve karanlık auralı
    const w = await createWizard(a.element);
    w.root.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (mat && 'color' in mat) mat.color.setHex(a.robe ?? 0x6a4c8c);
    });
    w.root.scale.multiplyScalar(a.scale);
    return { ...w, aura: addAura(w.root, a.aura ?? 0x7c3aed) };
  }
  const [base, anim] = await Promise.all([loadKay(a.model), loadKay('mage')]);
  const root = cloneSkinned(base.scene);
  const materials: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const old = mesh.material as THREE.MeshStandardMaterial;
    const m = new THREE.MeshLambertMaterial({ map: old.map, emissiveMap: old.map, emissive: 0x000000 });
    if (a.robe !== undefined) m.color.setHex(a.robe);
    m.userData.baseEmissive = m.emissive.clone();
    materials.push(m);
    mesh.material = m;
  });
  prepareKay(root, 3.0 * a.scale);
  const { mixer, actions } = mixerFor(root, anim.animations);
  return {
    root,
    mixer,
    actions,
    staff: null,
    aura: a.aura !== undefined ? addAura(root, a.aura) : undefined,
    dispose: () => {
      mixer.stopAllAction();
      materials.forEach((mm) => mm.dispose());
    },
  };
}

/** Bossun ayaklarında dönen, renkli bir güç halkası */
function addAura(root: THREE.Object3D, color: number): THREE.Object3D {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.45, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  const s = 1 / (root.scale.x || 1);
  ring.scale.setScalar(s);
  root.add(ring);
  return ring;
}

/** Görünüme göre model kurar (oyuncu, boss ya da büyücü). */
export async function createAppearance(a: Appearance): Promise<ModelInstance> {
  if (a.kind === 'hero') return createHero(a.gear);
  if (a.kind === 'boss') return createBoss(a);
  return createWizard(a.element);
}

// --- Boss görünümleri --------------------------------------------------------------------------

/** Boss adına göre görünüm: generaller şövalye, iri savaşçılar barbar, gölgeler kapüşonlu; Malakor koyu ve dev bir büyücü */
export const BOSS_LOOKS: Record<string, Omit<Extract<Appearance, { kind: 'boss' }>, 'kind'>> = {
  'General Vael': { model: 'knight', element: 'fire', scale: 1.2, aura: 0xff5a1f, robe: 0xffd2c2 },
  'Ambargo Komutanı': { model: 'barbarian', element: 'earth', scale: 1.1 },
  'Tapınak Bekçisi': { model: 'knight', element: 'air', scale: 1.1, robe: 0xe8f1ff },
  'Rüzgâr Çırağı': { model: 'rogue', element: 'air', scale: 1, robe: 0xdbeafe },
  'Soylu Şampiyonu': { model: 'barbarian', element: 'earth', scale: 1.2, aura: 0xd6a76b },
  'General Kaelen': { model: 'knight', element: 'earth', scale: 1.3, aura: 0xc08a4a, robe: 0xe6cfa8 },
  'Cadı Morga': { model: 'rogue', element: 'water', scale: 1.1, aura: 0x34d399, robe: 0x9be7c4 },
  'General Morwenna': { model: 'knight', element: 'water', scale: 1.25, aura: 0x38bdf8, robe: 0xbfe3ff },
  Malakor: { model: 'darkWizard', element: 'fire', scale: 1.35, aura: 0x8b5cf6, robe: 0x5b3a7a },
  Gölge: { model: 'rogue', element: 'fire', scale: 1.05, aura: 0x6d28d9, robe: 0x3b3346 },
};
