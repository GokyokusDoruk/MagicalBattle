import * as THREE from 'three';
import type { Element } from '../damage/elements';
import type { Stroke } from '../gesture/types';
import { CameraDirector, isPortrait } from './camera';
import { Combatant } from './combatant';
import { layoutTeams, slotKey, type Slot, type SlotRef } from './layout';
import type { ArenaSounds } from './sounds';
import { ELEMENT_COLORS, SHIELD_COLORS, SKY_COLOR } from './palette';
import { ParticleSystem } from './particles';
import { SpellVisual } from './spell';
import { SIGIL_SIZE, strokesToPaths, type PlanePoint } from './strokeMap';
import { Tweens, clamp01, easeInOut, easeOutCubic } from './tween';
import { FirstPersonHand } from './firstPersonHand';
import type { Appearance } from './heroModel';
import { GRID } from '../gesture/config';

export interface CombatantSpec {
  name: string;
  element: Element;
  /** Faz 7: görünüm (oyuncu ekipmanıyla, boss kendi modeliyle) */
  appearance?: Appearance;
}

export interface ImpactInfo {
  /** Oyuncudan düşecek hasar (0 olabilir) */
  damage: number;
  /** Saldırının savunulan oranı (0-1) */
  blockedRatio: number;
  /** Savunulmayan kısım başa mı düştü */
  head: boolean;
  /** Saldırının elementi */
  element: Element;
  /** Faz 5: son büyü (rakibin canını bitirdi): rakip vuruşla arkaya devrilip yere yığılır */
  fatal?: boolean;
}

/** castSpell için isteğe bağlı kancalar */
export interface CastHooks {
  /** Saldırı ile savunma çarpıştığı an */
  onClash?: () => void;
  /** Faz 5: saldırının savunulan oranı (0-1). Bu kadarlık parçası kalkana çarpınca saçılır, kalanı rakibe devam eder. */
  blockedRatio?: number;
  /** Faz 6: alan büyüsünün doldurulan hücreleri (32×32 ızgara): büyünün içi dolu görünür */
  areaCells?: readonly number[];
}

const UP = new THREE.Vector3(0, 1, 0);
/** Çizim yoğunluk ızgarasının kenarı (alan büyüsü hücreleri) */
const AREA_GRID = GRID;
const MAX_DT = 0.1;

/** Çizim yoksa (ya da hiç geçerli çizgi çıkmadıysa) gösterilecek yedek mühür: halka. */
const DEFAULT_RING: PlanePoint[][] = [
  Array.from({ length: 25 }, (_, i) => ({
    x: Math.cos((i / 24) * Math.PI * 2) * SIGIL_SIZE * 0.35,
    y: Math.sin((i / 24) * Math.PI * 2) * SIGIL_SIZE * 0.35,
  })),
];

function quadBezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number): THREE.Vector3 {
  const u = 1 - t;
  return a.clone().multiplyScalar(u * u).add(b.clone().multiplyScalar(2 * u * t)).add(c.clone().multiplyScalar(t * t));
}

function popupSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  let size = 76;
  g.font = `bold ${size}px system-ui, sans-serif`;
  while (g.measureText(text).width > 236 && size > 28) {
    size -= 4;
    g.font = `bold ${size}px system-ui, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.strokeText(text, 128, 64);
  g.fillStyle = color;
  g.fillText(text, 128, 64);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
  sprite.scale.set(2.6, 1.3, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * 3D düello arenası (Three.js). Savaş akışı bunu şu çağrılarla yönetir:
 * `setTeams` → `castSpell` (saldırı havada çizilip fırlatılır) → `showShield` (savunma) → `impact` (vuruş efektleri).
 * Hepsi koda çizilir; düşük poligonlu ve az parçacıklı olduğu için telefonda da hafiftir.
 */
export class ArenaView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 220);
  private readonly director: CameraDirector;
  private readonly particles = new ParticleSystem(700);
  private readonly tweens = new Tweens();
  private readonly combatants = new Map<string, Combatant>();
  private slots: Slot[] = [];
  private shield: { owner: SlotRef; visual: SpellVisual } | null = null;
  private readonly spells = new Set<SpellVisual>();
  private readonly popups = new Set<THREE.Sprite>();
  private readonly teamLights = [new THREE.PointLight(0xffffff, 2.2, 22, 1.6), new THREE.PointLight(0xffffff, 2.2, 22, 1.6)];
  private readonly impactLight = new THREE.PointLight(0xffffff, 0, 18, 1.6);
  /** Faz 5: birinci kişi bakışta oyuncunun eli ve asası (kameraya bağlı) */
  private readonly hand = new FirstPersonHand();
  private firstPersonRef: SlotRef | null = null;
  private readonly crystals: THREE.Mesh[] = [];
  private readonly runeMaterial = new THREE.MeshBasicMaterial({ color: 0x8a7cff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  private readonly disposables: { dispose(): void }[] = [];
  private readonly observer: ResizeObserver;
  private time = 0;
  private lastFrame = 0;
  /** Oyun zamanı çarpanı (çarpışmada yavaş çekim için 0.2); gerçek zamanlı kamera etkilenmez */
  private timeScale = 1;
  private disposed = false;
  /** Dikey ekranda yakın çekimler biraz uzaktan çekilir (yazılar ve savaşçı sığsın) */
  private closeScale = 1;

  constructor(
    private readonly container: HTMLElement,
    private readonly sounds?: ArenaSounds,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.renderer.domElement);

    this.director = new CameraDirector(this.camera);
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 22, 60);
    this.buildEnvironment();
    this.scene.add(this.particles.points, this.impactLight, ...this.teamLights);
    // El kameraya bağlıdır: kamera sahneye eklenince çocukları da çizilir
    this.camera.add(this.hand.group);
    this.scene.add(this.camera);
    this.teamLights[0].position.set(-8, 4.5, 0);
    this.teamLights[1].position.set(8, 4.5, 0);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.camera.position.set(0, 6.8, 15.5);
    this.camera.lookAt(0, 1.7, 0);

    this.renderer.setAnimationLoop((now: number) => this.frame(now));
  }

  // --- Kurulum ----------------------------------------------------------------------------

  private track<T extends { dispose(): void }>(x: T): T {
    this.disposables.push(x);
    return x;
  }

  private buildEnvironment(): void {
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, x = 0, z = 0): THREE.Mesh => {
      const m = new THREE.Mesh(this.track(geo), this.track(mat));
      m.position.set(x, y, z);
      this.scene.add(m);
      return m;
    };

    this.scene.add(new THREE.AmbientLight(0x6670a8, 1.0), this.directional());

    // Düello platformu: taş zemin, rün halkaları, orta çizgi
    add(new THREE.CylinderGeometry(9.4, 10, 0.9, 12), new THREE.MeshLambertMaterial({ color: 0x3a3f5c, flatShading: true }), -0.45);
    add(new THREE.CylinderGeometry(8.4, 8.4, 0.06, 12), new THREE.MeshLambertMaterial({ color: 0x4a5072, flatShading: true }), 0.02);
    for (const r of [[7.6, 7.8], [4.2, 4.35]] as const) {
      const ring = add(new THREE.RingGeometry(r[0], r[1], 56), this.runeMaterial, 0.07);
      ring.rotation.x = -Math.PI / 2;
    }
    const line = add(new THREE.PlaneGeometry(0.12, 12), this.runeMaterial, 0.075);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = Math.PI / 2;

    // Çevre sütunları ve süzülen kristaller
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2a2e48, flatShading: true });
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x9d8cff });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * 11.5;
      const z = Math.sin(a) * 11.5;
      if (z > 8) continue; // kameranın önündeki sütunlar görüşü kapatmasın
      add(new THREE.BoxGeometry(1, 5.2, 1), pillarMat, 2.6, x, z);
      this.crystals.push(add(new THREE.OctahedronGeometry(0.55), crystalMat, 6.3, x, z));
    }

    // Uzak zemin ve yıldızlar
    add(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: 0x070914 }), -0.95).rotation.x = -Math.PI / 2;
    const starPositions: number[] = [];
    for (let i = 0; i < 260; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 0.9 + 0.05); // gökyüzü yarım küresi
      const r = 95;
      starPositions.push(r * Math.sin(v) * Math.cos(u), r * Math.cos(v) + 4, r * Math.sin(v) * Math.sin(u));
    }
    const starGeo = this.track(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.scene.add(new THREE.Points(starGeo, this.track(new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: false, fog: false }))));
  }

  private directional(): THREE.DirectionalLight {
    const l = new THREE.DirectionalLight(0xdfe6ff, 1.1);
    l.position.set(6, 14, 8);
    return l;
  }

  /** Takımları kurar; önceki savaşçılar kaldırılır. 1v1 için [[a],[b]], 2v2 için [[a,b],[c,d]]. */
  setTeams(teams: readonly [readonly CombatantSpec[], readonly CombatantSpec[]]): void {
    this.clearEffects();
    this.combatants.forEach((c) => {
      this.scene.remove(c.group);
      c.dispose();
    });
    this.combatants.clear();

    this.slots = layoutTeams([teams[0].length, teams[1].length]);
    for (const slot of this.slots) {
      const spec = teams[slot.team][slot.index];
      const c = new Combatant(spec.name, spec.element, spec.appearance);
      c.group.position.set(slot.position.x, slot.position.y, slot.position.z);
      c.group.rotation.y = slot.yaw;
      this.scene.add(c.group);
      this.combatants.set(slotKey(slot), c);
    }
    this.teamLights[0].color.setHex(ELEMENT_COLORS[teams[0][0].element].main);
    this.teamLights[1].color.setHex(ELEMENT_COLORS[teams[1][0].element].main);
  }

  get slotRefs(): SlotRef[] {
    return this.slots.map((s) => ({ team: s.team, index: s.index }));
  }

  private combatant(ref: SlotRef): Combatant {
    const c = this.combatants.get(slotKey(ref));
    if (!c) throw new Error(`Savaşçı yok: ${slotKey(ref)}`);
    return c;
  }

  private position(ref: SlotRef): THREE.Vector3 {
    const s = this.slots.find((x) => x.team === ref.team && x.index === ref.index);
    if (!s) throw new Error(`Yer yok: ${slotKey(ref)}`);
    return new THREE.Vector3(s.position.x, s.position.y, s.position.z);
  }

  // --- Döngü ------------------------------------------------------------------------------

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.director.setAspect(this.camera.aspect);
    this.closeScale = isPortrait(this.camera.aspect) ? 1.8 : 1;
  }

  private frame(now: number): void {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min(MAX_DT, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    this.time += dt;

    // Çarpışma anında oyun zamanı yavaşlar (kamera ve ışık gerçek zamanda kalır)
    const sdt = dt * this.timeScale;
    this.tweens.update(sdt);
    this.combatants.forEach((c) => c.update(sdt));
    this.hand.update(dt);
    this.particles.update(sdt);
    this.crystals.forEach((c, i) => {
      c.rotation.y += dt * 0.8;
      c.position.y = 6.3 + Math.sin(this.time * 1.4 + i) * 0.25;
    });
    this.runeMaterial.opacity = 0.42 + Math.sin(this.time * 1.8) * 0.12;
    // Büyü mühürleri her zaman kameraya dönük (okunaklı)
    this.spells.forEach((s) => s.group.quaternion.copy(this.camera.quaternion));
    if (this.shield) this.shield.visual.group.quaternion.copy(this.camera.quaternion);
    this.popups.forEach((p) => p.quaternion.copy(this.camera.quaternion));

    this.director.update(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }

  // --- Büyü akışı -------------------------------------------------------------------------

  /** Rakip takımın ortası (göz hizasından bakılacak yer) */
  private enemyCenter(ref: SlotRef): THREE.Vector3 {
    const foes = this.slots.filter((x) => x.team !== ref.team).map((x) => this.position(x));
    const c = new THREE.Vector3();
    foes.forEach((f) => c.add(f));
    return foes.length > 0 ? c.multiplyScalar(1 / foes.length) : new THREE.Vector3();
  }

  /**
   * Faz 5: oyuncu çizmeden önce kamera önce büyücünün omzunun üstünden rakibe bakar, sonra göz hizasına (birinci kişi) geçer.
   * Büyücünün gövdesi gizlenir, ekranda eli ve kuşanılı asası belirir. Bitince `exitFirstPerson` çağrılır.
   */
  async enterFirstPerson(ref: SlotRef, element: Element): Promise<void> {
    if (this.disposed) return;
    const me = this.combatant(ref);
    const pos = this.position(ref);
    const foe = this.enemyCenter(ref);
    const dir = foe.clone().sub(pos).setY(0).normalize();
    const side = UP.clone().cross(dir);
    this.firstPersonRef = ref;
    me.cast(0.9);
    // 1) Omzun üstünden: büyücü ve karşıda rakip
    this.director.setShot({
      position: pos.clone().add(dir.clone().multiplyScalar(-3.2)).add(side.clone().multiplyScalar(-1.15)).setY(3.1),
      lookAt: foe.clone().setY(1.7),
      exact: true,
      speed: 4.5,
    });
    await this.tweens.wait(0.7);
    // 2) Göz hizası: gövde gizlenir, el ve asa ekrana girer
    this.director.setShot({ position: pos.clone().add(dir.clone().multiplyScalar(0.35)).setY(2.25), lookAt: foe.clone().setY(1.8), exact: true, speed: 6 });
    await this.tweens.wait(0.25);
    me.setVisible(false);
    this.hand.setElement(element);
    this.hand.show(true);
    await this.tweens.wait(0.3);
  }

  /** Çizim ekranındaki parmağın/farenin yeri (-1..1) ve çizim sürüyor mu: el oraya uzanır. */
  aimHand(nx: number, ny: number, down: boolean): void {
    this.hand.setAim(nx, ny, down);
  }

  /** Birinci kişi bakıştan çıkar: el iner, gövde görünür. */
  exitFirstPerson(): void {
    this.hand.show(false);
    if (this.firstPersonRef) this.combatant(this.firstPersonRef).setVisible(true);
    this.firstPersonRef = null;
    this.director.setShot(null);
  }


  /**
   * Faz 5: saldırı büyüsü. Çizildiği biçimde asanın önünde belirir ve **beklemeden** rakibe fırlar; kamera büyünün arkasından onunla
   * birlikte ilerler. Kalkan varsa büyü ona çarpar: savunulan parçalar (`blockedRatio`) dört bir yana saçılıp söner, kalan kısım
   * küçülerek rakibe devam eder. Vuruş efektleri için ardından `impact` çağrılır.
   */
  async castSpell(from: SlotRef, to: SlotRef, strokes: readonly Stroke[], element: Element, hooks: CastHooks = {}): Promise<void> {
    const caster = this.combatant(from);
    caster.setVisible(true);
    const casterPos = this.position(from);
    const targetPos = this.position(to);
    const colors = ELEMENT_COLORS[element];
    const paths = strokesToPaths(strokes);
    const shape = paths.length > 0 ? paths : DEFAULT_RING;
    const visual = this.addSpell(new SpellVisual(shape, colors.main, colors.glow));
    if (hooks.areaCells?.length) visual.setFill(hooks.areaCells, AREA_GRID, colors.glow, SIGIL_SIZE);
    const blocked = clamp01(hooks.blockedRatio ?? 0);

    const dir = targetPos.clone().sub(casterPos).setY(0).normalize();
    const side = UP.clone().cross(dir);
    const hold = casterPos.clone().add(dir.clone().multiplyScalar(1.5)).add(new THREE.Vector3(0, 2.3, 0));
    const hitPoint = targetPos.clone().add(new THREE.Vector3(0, 1.6, 0));
    visual.group.position.copy(hold);
    visual.group.scale.setScalar(0.75);
    visual.setOpacity(0);
    caster.cast(1.0);

    const chase = (p: THREE.Vector3, speed = 9): void =>
      this.director.setShot({
        position: p.clone().add(dir.clone().multiplyScalar(-3.4)).add(side.clone().multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.9, 0)),
        lookAt: p.clone().add(dir.clone().multiplyScalar(3.5)),
        exact: true,
        speed,
      });

    // 1) Asanın önünde bir anda belirir (çizim zaten yapıldı: tekrar çizdirmeye gerek yok)
    this.sounds?.charge(element);
    chase(hold, 7);
    await this.tweens.add(0.32, (t) => {
      visual.setReveal(Math.min(1, t * 1.6));
      visual.setOpacity(Math.min(1, t * 4));
      visual.group.scale.setScalar(0.75 + Math.sin(t * Math.PI) * 0.12);
    });

    // 2) Fırlar: kamera büyünün arkasından takip eder
    this.sounds?.launch(element);
    const shield = this.shield && slotKey(this.shield.owner) === slotKey(to) ? this.shield : null;
    const end = shield ? shield.visual.group.position.clone() : hitPoint;
    const mid = hold.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.9, 0));
    await this.tweens.add(0.62, (t) => {
      const k = easeInOut(t);
      const p = quadBezier(hold, mid, end, k);
      visual.group.position.copy(p);
      visual.group.scale.setScalar(0.75 - 0.15 * k);
      this.particles.emit(p, { color: colors.glow, count: 5, speed: 1.1, life: 0.45 });
      chase(p);
    });

    if (shield) {
      // 3) Çarpışma: kısa bir duraksama (ağırlık hissi), kıvılcımlar; savunulan parçalar saçılır
      hooks.onClash?.();
      this.director.shake(0.25 + blocked * 0.35);
      this.director.setShot({ position: end.clone().add(side.clone().multiplyScalar(3.4)).add(dir.clone().multiplyScalar(-2.2)).add(new THREE.Vector3(0, 0.8, 0)), lookAt: end.clone(), exact: true, speed: 8 });
      this.timeScale = 0.35;
      this.particles.emit(end, { color: colors.glow, count: Math.round(20 + blocked * 60), speed: 5, life: 0.8, gravity: 3 });
      this.particles.emit(end, { color: SHIELD_COLORS.glow, count: Math.round(10 + blocked * 40), speed: 4, life: 0.8, gravity: 3 });
      await this.tweens.add(0.16, (t) => visual.group.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.08));
      this.timeScale = 1;
      void this.scatter(shape, end, dir, blocked, colors.main, colors.glow);
      // Kalkan: tam tuttuysa sönerek, değilse parçalanarak kaybolur
      const sv = shield.visual;
      this.shield = null;
      if (blocked < 0.95) {
        this.sounds?.shieldBreak();
        this.particles.emit(sv.group.position, { color: SHIELD_COLORS.main, count: 50, speed: 5, life: 0.9, gravity: 5 });
      } else this.sounds?.shieldBlock(blocked);
      void this.tweens.add(blocked >= 0.95 ? 0.5 : 0.22, (t) => sv.setOpacity(1 - t)).then(() => {
        this.scene.remove(sv.group);
        sv.dispose();
      });
      this.combatant(to).endDefend();

      if (blocked >= 0.97) {
        // Tamamı savunuldu: büyü kalkanda dağılır
        await this.tweens.add(0.22, (t) => {
          visual.setOpacity(1 - t);
          visual.group.scale.setScalar(0.6 + t * 0.4);
        });
        this.removeSpell(visual);
        caster.endDefend();
        return;
      }
      // 4) Geçen kısım küçülerek rakibe devam eder
      const remain = Math.sqrt(1 - blocked);
      await this.tweens.add(0.24, (t) => {
        const p = end.clone().lerp(hitPoint, easeOutCubic(t));
        visual.group.position.copy(p);
        visual.group.scale.setScalar(0.6 * remain);
        visual.setOpacity(0.6 + 0.4 * remain);
        this.particles.emit(p, { color: colors.glow, count: 3, speed: 1, life: 0.4 });
      });
    }
    this.removeSpell(visual);
    caster.endDefend();
  }

  /** Savunulan parçalar: büyünün çizgilerinden kopan parçalar çarpışma noktasından dört bir yana savrulur, döner ve söner. */
  private async scatter(shape: PlanePoint[][], at: THREE.Vector3, dir: THREE.Vector3, blocked: number, main: number, glow: number): Promise<void> {
    const pieces: PlanePoint[][] = [];
    for (const path of shape) {
      const step = Math.max(3, Math.floor(path.length / 4));
      for (let i = 0; i + 1 < path.length; i += step) pieces.push(path.slice(i, Math.min(path.length, i + step + 1)));
    }
    const n = Math.min(pieces.length, Math.max(blocked > 0.02 ? 2 : 0, Math.round(blocked * 14)));
    if (n === 0) return;
    const chosen = pieces.sort(() => Math.random() - 0.5).slice(0, n);
    const side = UP.clone().cross(dir);
    const frags = chosen.map((p) => {
      const v = this.addSpell(new SpellVisual([p], main, glow));
      v.group.position.copy(at);
      v.group.scale.setScalar(0.6);
      v.setReveal(1);
      const a = Math.random() * Math.PI * 2;
      // Yanlara, yukarı-aşağı ve biraz geriye (geldiği yöne) savrulur
      const vel = side.clone().multiplyScalar(Math.cos(a) * (2.5 + Math.random() * 2)).add(new THREE.Vector3(0, Math.sin(a) * (2 + Math.random() * 2), 0)).add(dir.clone().multiplyScalar(-(0.5 + Math.random() * 1.5)));
      return { v, vel };
    });
    await this.tweens.add(0.75, (t) => {
      for (const f of frags) {
        f.v.group.position.copy(at).addScaledVector(f.vel, t).add(new THREE.Vector3(0, -2.5 * t * t, 0));
        f.v.group.scale.setScalar(0.6 * (1 - t * 0.6));
        f.v.setOpacity(1 - t);
        if (Math.random() < 0.3) this.particles.emit(f.v.group.position, { color: glow, count: 1, speed: 0.6, life: 0.35 });
      }
    });
    frags.forEach((f) => this.removeSpell(f.v));
  }

  /** Savunma: savunanın çizdiği mühür, saldırının önüne kalkan olarak kurulur ve vuruşa kadar durur. */
  async showShield(owner: SlotRef, attacker: SlotRef, strokes: readonly Stroke[], element?: Element, areaCells?: readonly number[]): Promise<void> {
    this.removeShield();
    const ownerPos = this.position(owner);
    const attackerPos = this.position(attacker);
    const toAttacker = attackerPos.clone().sub(ownerPos).setY(0).normalize();
    const paths = strokesToPaths(strokes);
    const visual = new SpellVisual(paths.length > 0 ? paths : DEFAULT_RING, element ? ELEMENT_COLORS[element].main : SHIELD_COLORS.main, element ? ELEMENT_COLORS[element].glow : SHIELD_COLORS.glow);
    visual.group.position.copy(ownerPos).add(toAttacker.clone().multiplyScalar(1.7)).add(new THREE.Vector3(0, 2.0, 0));
    visual.group.scale.setScalar(0.95);
    if (areaCells?.length) visual.setFill(areaCells, AREA_GRID, element ? ELEMENT_COLORS[element].glow : SHIELD_COLORS.glow, SIGIL_SIZE);
    visual.setOpacity(0);
    this.scene.add(visual.group);
    this.shield = { owner, visual };

    this.combatant(owner).defend(4);
    this.sounds?.shieldUp();
    this.director.setShot(null);
    await this.tweens.add(0.5, (t) => {
      visual.setReveal(easeOutCubic(t));
      visual.setOpacity(clamp01(t * 3));
      const tip = visual.tipWorld();
      if (tip) this.particles.emit(tip, { color: SHIELD_COLORS.glow, count: 2, speed: 1.2, life: 0.5 });
    });
  }

  /**
   * Vuruş: büyü rakibe değdiği an kıvılcımlar, ışık, savrulma, kamera sarsıntısı ve hasar yazısı. Kalkan, büyü ona çarptığında
   * (`castSpell`) zaten saçılmıştır. `fatal` ise rakip vuruşun etkisiyle arkaya devrilip yere yığılır. Beklemez: sonuç yazısı
   * ve Detay/Tamam ekranı aynı anda gelir.
   */
  async impact(target: SlotRef, attacker: SlotRef, info: ImpactInfo): Promise<void> {
    this.timeScale = 1;
    const victim = this.combatant(target);
    const targetPos = this.position(target);
    const attackerPos = this.position(attacker);
    const colors = ELEMENT_COLORS[info.element];
    const blocked = clamp01(info.blockedRatio);
    const damage = Math.max(0, Math.round(info.damage));
    const hitPoint = targetPos.clone().add(new THREE.Vector3(0, info.head ? 2.35 : 1.4, 0));
    // Kalkan hâlâ duruyorsa (eski akış) kaldırılır
    this.removeShield();

    if (blocked < 1 && damage > 0) {
      this.sounds?.impact(info.element, Math.min(1, damage / 100), info.head);
      const strength = Math.min(120, damage * 1.2) * (1 - blocked);
      this.particles.emit(hitPoint, { color: colors.glow, count: Math.round(18 + strength), speed: 7, life: 0.9, gravity: 4 });
      this.particles.emit(hitPoint, { color: colors.main, count: Math.round(10 + strength * 0.5), speed: 3, life: 0.7 });
    }

    this.impactLight.color.setHex(colors.glow);
    this.impactLight.position.copy(hitPoint).add(new THREE.Vector3(0, 0.8, 0));
    void this.tweens.add(0.45, (t) => (this.impactLight.intensity = (1 - t) * (6 + damage * 0.08)));

    if (damage > 0) victim.hit(damage / 60);
    this.director.shake(info.fatal ? 0.9 : damage > 0 ? 0.2 + Math.min(0.8, damage / 110) : blocked > 0 ? 0.12 : 0);

    const label = damage > 0 ? `-${damage}` : 'SAVUNULDU';
    const color = damage > 0 ? '#ff6b6b' : '#6ee7b7';
    this.floatPopup(label, color, hitPoint.clone().add(new THREE.Vector3(0, 0.9, 0)));

    const dir = targetPos.clone().sub(attackerPos).setY(0).normalize();
    const side = UP.clone().cross(dir);
    this.director.setShot({
      position: targetPos.clone().add(dir.clone().multiplyScalar(-5.4 * this.closeScale)).add(side.clone().multiplyScalar(2.8 * this.closeScale)).setY(2.9 + (this.closeScale - 1) * 1.2),
      lookAt: targetPos.clone().add(new THREE.Vector3(0, 1.4, 0)),
    });
    victim.endDefend();

    if (info.fatal) {
      // Son büyü: rakip arkaya devrilir ve yere yığılır; zaman bir an yavaşlar
      this.timeScale = 0.45;
      victim.defeat('backward');
      this.sounds?.defeat();
      this.particles.emit(hitPoint, { color: 0xffffff, count: 60, speed: 6, life: 1.1, gravity: 3 });
      await this.tweens.wait(0.5);
      this.timeScale = 1;
      await this.tweens.wait(0.5);
      this.particles.emit(targetPos.clone().add(dir.clone().multiplyScalar(1.3)).setY(0.3), { color: 0xb6a88f, count: 40, speed: 2.5, life: 0.9, gravity: 2 });
      return;
    }
    await this.tweens.wait(0.35);
  }

  /** Büyü yapılamadı: asa kalkar ama büyü oluşmaz, gri duman tüter. */
  async fizzle(ref: SlotRef): Promise<void> {
    const caster = this.combatant(ref);
    const pos = this.position(ref);
    const facing = this.slots.find((x) => x.team === ref.team && x.index === ref.index)!;
    const forward = new THREE.Vector3(Math.sin(facing.yaw), 0, Math.cos(facing.yaw));
    const orb = pos.clone().add(forward.multiplyScalar(0.8)).add(new THREE.Vector3(0, 2.6, 0));
    caster.cast(0.9);
    this.sounds?.fizzle();
    this.director.setShot({
      position: pos.clone().add(new THREE.Vector3(0, 3.2, 0)).add(forward.clone().multiplyScalar(-5.5 * this.closeScale)).add(new THREE.Vector3(0, 0, 3 * this.closeScale)),
      lookAt: pos.clone().add(new THREE.Vector3(0, 2, 0)),
    });
    await this.tweens.add(0.8, (t) => {
      if (t < 0.9) this.particles.emit(orb, { color: 0x8a8fa8, count: 2, speed: 1.1, life: 0.9, gravity: -0.7 });
    });
    this.director.setShot(null);
  }

  /** Savaşçı yenildi: yere yığılır, kıvılcım saçar. */
  defeat(ref: SlotRef): void {
    const c = this.combatant(ref);
    c.defeat();
    this.sounds?.defeat();
    this.particles.emit(this.position(ref).add(new THREE.Vector3(0, 1.5, 0)), {
      color: 0xffffff,
      count: 40,
      speed: 4,
      life: 1.2,
      gravity: 2,
    });
  }

  /** Tüm savaşçıları ayağa kaldırır, efektleri temizler. */
  resetCombatants(): void {
    this.combatants.forEach((c) => c.reset());
    this.clearEffects();
  }

  // --- Yardımcılar ------------------------------------------------------------------------

  private addSpell(v: SpellVisual): SpellVisual {
    this.spells.add(v);
    this.scene.add(v.group);
    return v;
  }

  private removeSpell(v: SpellVisual): void {
    this.spells.delete(v);
    this.scene.remove(v.group);
    v.dispose();
  }

  private removeShield(): void {
    if (!this.shield) return;
    this.scene.remove(this.shield.visual.group);
    this.shield.visual.dispose();
    this.shield = null;
  }

  private floatPopup(text: string, color: string, at: THREE.Vector3): void {
    const sprite = popupSprite(text, color);
    sprite.position.copy(at);
    this.scene.add(sprite);
    this.popups.add(sprite);
    const material = sprite.material as THREE.SpriteMaterial;
    void this.tweens.add(1.3, (t) => {
      sprite.position.y = at.y + easeOutCubic(t) * 1.6;
      material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    }).then(() => {
      this.popups.delete(sprite);
      this.scene.remove(sprite);
      material.map?.dispose();
      material.dispose();
    });
  }

  /** Havada kalan mühür, kalkan ve parçacıkları temizler. */
  clearEffects(): void {
    this.spells.forEach((s) => {
      this.scene.remove(s.group);
      s.dispose();
    });
    this.spells.clear();
    this.removeShield();
    this.particles.clear();
    this.impactLight.intensity = 0;
    this.director.setShot(null);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.tweens.finishAll();
    this.clearEffects();
    this.combatants.forEach((c) => c.dispose());
    this.combatants.clear();
    this.particles.dispose();
    this.runeMaterial.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
