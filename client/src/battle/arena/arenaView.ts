import * as THREE from 'three';
import type { Element } from '../damage/elements';
import type { Stroke } from '../gesture/types';
import { CameraDirector, isPortrait } from './camera';
import { Combatant } from './combatant';
import { layoutTeams, slotKey, type Slot, type SlotRef } from './layout';
import { ELEMENT_COLORS, SHIELD_COLORS, SKY_COLOR } from './palette';
import { ParticleSystem } from './particles';
import { SpellVisual } from './spell';
import { SIGIL_SIZE, strokesToPaths, type PlanePoint } from './strokeMap';
import { Tweens, clamp01, easeInOut, easeOutCubic } from './tween';

export interface CombatantSpec {
  name: string;
  element: Element;
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
}

const UP = new THREE.Vector3(0, 1, 0);
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
  private readonly crystals: THREE.Mesh[] = [];
  private readonly runeMaterial = new THREE.MeshBasicMaterial({ color: 0x8a7cff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  private readonly disposables: { dispose(): void }[] = [];
  private readonly observer: ResizeObserver;
  private time = 0;
  private lastFrame = 0;
  private disposed = false;
  /** Dikey ekranda yakın çekimler biraz uzaktan çekilir (yazılar ve savaşçı sığsın) */
  private closeScale = 1;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.renderer.domElement);

    this.director = new CameraDirector(this.camera);
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 22, 60);
    this.buildEnvironment();
    this.scene.add(this.particles.points, this.impactLight, ...this.teamLights);
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
      const c = new Combatant(spec.name, spec.element);
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

    this.tweens.update(dt);
    this.combatants.forEach((c) => c.update(dt));
    this.particles.update(dt);
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

  /**
   * Saldırı: büyü, çizildiği biçimde havada belirir, sonra rakibe fırlar. Hedefe ulaşınca çözülür;
   * vuruş efektleri için ardından `impact` çağrılır.
   */
  async castSpell(from: SlotRef, to: SlotRef, strokes: readonly Stroke[], element: Element): Promise<void> {
    const caster = this.combatant(from);
    const casterPos = this.position(from);
    const targetPos = this.position(to);
    const colors = ELEMENT_COLORS[element];
    const paths = strokesToPaths(strokes);
    const visual = this.addSpell(new SpellVisual(paths.length > 0 ? paths : DEFAULT_RING, colors.main, colors.glow));

    const dir = targetPos.clone().sub(casterPos).setY(0).normalize();
    const side = UP.clone().cross(dir);
    const hold = casterPos.clone().add(dir.clone().multiplyScalar(1.7)).add(new THREE.Vector3(0, 2.5, 0));
    visual.group.position.copy(hold);
    visual.group.scale.setScalar(0.9);
    visual.setOpacity(0);

    caster.cast(1.6);
    this.director.setShot({
      position: casterPos.clone().add(dir.clone().multiplyScalar(-6.2 * this.closeScale)).add(side.clone().multiplyScalar(3.2 * this.closeScale)).setY(3.8 + (this.closeScale - 1)),
      lookAt: hold.clone().add(dir.clone().multiplyScalar(2.2)).setY(2.1),
    });

    // 1) Havada çizilir
    await this.tweens.add(0.95, (t) => {
      visual.setReveal(easeInOut(t));
      visual.setOpacity(Math.min(1, t * 5));
      const tip = visual.tipWorld();
      if (tip) this.particles.emit(tip, { color: colors.glow, count: 3, speed: 1.6, life: 0.55, gravity: -0.4 });
    });
    // 2) Yüklenir (parlama)
    await this.tweens.add(0.3, (t) => visual.group.scale.setScalar(0.9 + Math.sin(t * Math.PI) * 0.2));

    // 3) Fırlar
    const end = this.shield && slotKey(this.shield.owner) === slotKey(to)
      ? this.shield.visual.group.position.clone()
      : targetPos.clone().add(new THREE.Vector3(0, 1.7, 0));
    const mid = hold.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 1.8, 0));
    await this.tweens.add(0.8, (t) => {
      const k = easeInOut(t);
      const p = quadBezier(hold, mid, end, k);
      visual.group.position.copy(p);
      visual.group.scale.setScalar(0.9 - 0.4 * k);
      this.particles.emit(p, { color: colors.glow, count: 5, speed: 1.1, life: 0.55 });
      // Yatay ekranda yandan geniş çekim, dikeyde düello ekseninin arkasından
      this.director.setShot({
        position: this.closeScale > 1
          ? casterPos.clone().add(dir.clone().multiplyScalar(-9)).setY(4.6)
          : new THREE.Vector3(mid.x * 0.35, 4.4, 11.5),
        lookAt: p.clone().add(new THREE.Vector3(0, 0.2, 0)),
      });
    });
    this.removeSpell(visual);
    caster.endDefend();
  }

  /** Savunma: savunanın çizdiği mühür, saldırının önüne kalkan olarak kurulur ve vuruşa kadar durur. */
  async showShield(owner: SlotRef, attacker: SlotRef, strokes: readonly Stroke[]): Promise<void> {
    this.removeShield();
    const ownerPos = this.position(owner);
    const attackerPos = this.position(attacker);
    const toAttacker = attackerPos.clone().sub(ownerPos).setY(0).normalize();
    const paths = strokesToPaths(strokes);
    const visual = new SpellVisual(paths.length > 0 ? paths : DEFAULT_RING, SHIELD_COLORS.main, SHIELD_COLORS.glow);
    visual.group.position.copy(ownerPos).add(toAttacker.clone().multiplyScalar(1.7)).add(new THREE.Vector3(0, 2.0, 0));
    visual.group.scale.setScalar(0.95);
    visual.setOpacity(0);
    this.scene.add(visual.group);
    this.shield = { owner, visual };

    this.combatant(owner).defend(4);
    this.director.setShot(null);
    await this.tweens.add(0.5, (t) => {
      visual.setReveal(easeOutCubic(t));
      visual.setOpacity(clamp01(t * 3));
      const tip = visual.tipWorld();
      if (tip) this.particles.emit(tip, { color: SHIELD_COLORS.glow, count: 2, speed: 1.2, life: 0.5 });
    });
  }

  /** Vuruş: kıvılcımlar, ışık, savrulma, kamera sarsıntısı ve hasar yazısı. Savunma varsa kalkan karşılar. */
  async impact(target: SlotRef, attacker: SlotRef, info: ImpactInfo): Promise<void> {
    const victim = this.combatant(target);
    const targetPos = this.position(target);
    const attackerPos = this.position(attacker);
    const colors = ELEMENT_COLORS[info.element];
    const blocked = clamp01(info.blockedRatio);
    const damage = Math.max(0, Math.round(info.damage));
    const shield = this.shield && slotKey(this.shield.owner) === slotKey(target) ? this.shield : null;
    const hitPoint = targetPos.clone().add(new THREE.Vector3(0, info.head ? 2.35 : 1.4, 0));

    if (shield && blocked > 0) {
      this.particles.emit(shield.visual.group.position, {
        color: SHIELD_COLORS.glow,
        count: Math.round(14 + 70 * blocked),
        speed: 6,
        life: 0.8,
        gravity: 3,
      });
    }
    if (blocked < 1) {
      const strength = Math.min(120, damage * 1.2) * (1 - blocked);
      this.particles.emit(hitPoint, { color: colors.glow, count: Math.round(18 + strength), speed: 7, life: 0.9, gravity: 4 });
      this.particles.emit(hitPoint, { color: colors.main, count: Math.round(10 + strength * 0.5), speed: 3, life: 0.7 });
    }

    this.impactLight.color.setHex(colors.glow);
    this.impactLight.position.copy(hitPoint).add(new THREE.Vector3(0, 0.8, 0));
    void this.tweens.add(0.45, (t) => (this.impactLight.intensity = (1 - t) * (6 + damage * 0.08)));

    if (damage > 0) victim.hit(damage / 60);
    this.director.shake(damage > 0 ? 0.2 + Math.min(0.8, damage / 110) : blocked > 0 ? 0.12 : 0);

    // Hasar yazısı
    const label = damage > 0 ? `-${damage}` : 'SAVUNULDU';
    const color = info.head && damage > 0 ? '#ffd23f' : damage > 0 ? '#ff6b6b' : '#6ee7b7';
    this.floatPopup(label, color, hitPoint.clone().add(new THREE.Vector3(0, 0.9, 0)));
    if (info.head && damage > 0) this.floatPopup('BAŞ!', '#ffd23f', hitPoint.clone().add(new THREE.Vector3(0, 2.1, 0)));

    // Kamera hedefi gösterir
    const dir = targetPos.clone().sub(attackerPos).setY(0).normalize();
    const side = UP.clone().cross(dir);
    this.director.setShot({
      position: targetPos.clone().add(dir.clone().multiplyScalar(-5.4 * this.closeScale)).add(side.clone().multiplyScalar(2.8 * this.closeScale)).setY(2.9 + (this.closeScale - 1) * 1.2),
      lookAt: targetPos.clone().add(new THREE.Vector3(0, 1.7, 0)),
    });

    // Kalkan: tam savunulduysa sönerek kapanır, değilse parçalanır
    if (shield) {
      const visual = shield.visual;
      if (blocked < 0.95) {
        this.particles.emit(visual.group.position, { color: SHIELD_COLORS.main, count: 60, speed: 5, life: 0.9, gravity: 5 });
      }
      this.shield = null;
      void this.tweens.add(blocked >= 0.95 ? 0.7 : 0.25, (t) => visual.setOpacity(1 - t)).then(() => {
        this.scene.remove(visual.group);
        visual.dispose();
      });
    }
    victim.endDefend();

    await this.tweens.wait(1.1);
    this.director.setShot(null);
  }

  /** Savaşçı yenildi: yere yığılır, kıvılcım saçar. */
  defeat(ref: SlotRef): void {
    const c = this.combatant(ref);
    c.defeat();
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
