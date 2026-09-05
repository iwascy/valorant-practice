import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { WEAPON, type Mode } from './model';
import { createMotion, stepMotion, type BotMotion, type BotMode } from './bots';

export interface Target { group: THREE.Group; head: THREE.Mesh; parts: THREE.Mesh[]; hp: number; respawn: number; exposed: boolean;
  motion: BotMotion; anchor: THREE.Vector3; axis: THREE.Vector2; speed: number; generation: number; engagedAt: number | null }
export class RangeScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.04, 150);
  readonly renderer: THREE.WebGLRenderer;
  readonly weapon = new THREE.Group();
  readonly flash = new THREE.Group();
  readonly targets: Target[] = [];
  readonly solids: THREE.Mesh[] = [];
  readonly peekSolids: THREE.Mesh[] = [];
  readonly covers = new THREE.Group();
  readonly botCovers = new THREE.Group();
  readonly botSolids: THREE.Mesh[] = [];
  private botColliders: RAPIER.Collider[] = [];
  botMode: BotMode = 'static';
  private motionBounds: THREE.Box3[] = [];
  world!: RAPIER.World;
  player!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;
  controller!: RAPIER.KinematicCharacterController;
  private coverColliders: RAPIER.Collider[] = [];
  private traces: { mesh: THREE.Object3D; life: number }[] = [];
  private materialCache = new Map<number, THREE.MeshStandardMaterial>();
  mode: Mode = 'stop';
  difficulty = 'normal';
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene.background = new THREE.Color('#c3d8d7');
    this.scene.fog = new THREE.Fog('#c3d8d7', 42, 115);
    this.scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x687264, 2.8));
    const sun = new THREE.DirectionalLight(0xfff3d7, 3.3);
    sun.position.set(-16, 27, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 30, bottom: -35, near: 1, far: 90 });
    sun.shadow.bias = -0.0003; this.scene.add(sun);
    this.scene.add(this.camera); this.camera.rotation.order = 'YXZ';
  }
  private material(color: number) {
    if (!this.materialCache.has(color)) this.materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.12 }));
    return this.materialCache.get(color)!;
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, parent: THREE.Object3D = this.scene, solid = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.material(color));
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    if (solid) {
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z));
      if (parent === this.covers) { this.coverColliders.push(collider); this.peekSolids.push(mesh); }
      else if (parent === this.botCovers) { this.botColliders.push(collider); this.botSolids.push(mesh); }
      else this.solids.push(mesh);
    }
    return mesh;
  }
  private text(text: string, width: number, color = '#25463f', background?: string) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 256); }
    ctx.fillStyle = color; ctx.font = 'bold 150px sans-serif';
    const fontSize = Math.min(150, 150 * 980 / ctx.measureText(text).width); ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 137);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, transparent: !background, side: THREE.DoubleSide, depthWrite: false }));
  }
  async init() {
    await RAPIER.init(); this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); this.world.timestep = 1 / 120;
    this.box(0, -0.3, -10, 38, 0.6, 66, 0xa8b4ac, this.scene, true);
    this.box(0, 5, -38, 38, 10, 1, 0xc9d0c7, this.scene, true);
    this.box(-19, 4.5, -10, 1, 9, 66, 0xc2cdc7, this.scene, true);
    this.box(19, 4.5, -10, 1, 9, 66, 0xb8c3b8, this.scene, true);
    this.box(0, 2.5, 23, 38, 5, 1, 0xa8b7aa, this.scene, true);
    this.box(0, 0.7, -37.35, 37, 1.4, 0.12, 0x6c8075);
    this.box(0, 3.1, -37.3, 37, 0.12, 0.15, 0xc06c47);
    const title = this.text('RANGE / 01', 16); title.position.set(0, 6.5, -37.4); this.scene.add(title);
    const tagline = this.text('PRECISION DEPARTMENT', 10, '#627b70'); tagline.position.set(0, 4.65, -37.4); this.scene.add(tagline);
    for (let z = -34; z <= 18; z += 8) {
      this.box(-18.4, 4.5, z, 0.6, 9, 0.7, 0x778f80); this.box(18.4, 4.5, z, 0.6, 9, 0.7, 0x778f80);
      this.box(0, 0.005, z, 36, 0.008, 0.035, 0x8d9e91);
    }
    for (let x = -16; x <= 16; x += 4) this.box(x, 0.006, -10, 0.025, 0.009, 64, 0x91a297);
    for (const [z, label] of [[-5, '10 M'], [-15, '20 M'], [-25, '30 M']] as const) {
      this.box(0, 0.01, z, 34, 0.012, 0.07, 0xdce0ca);
      const marking = this.text(label, 2, '#dce0ca'); marking.rotation.x = -Math.PI / 2; marking.position.set(9, 0.022, z + 1); this.scene.add(marking);
    }
    this.box(0, 0.01, 5.4, 35, 0.015, 0.13, 0xd28b4b);
    for (let x = -15; x <= 15; x += 6) {
      this.box(x, 0.04, -18, 3.3, 0.08, 4, 0x6e8475);
      this.box(x, 0.09, -19.9, 3.3, 0.06, 0.1, 0xb9d5bc);
    }
    for (const x of [-14, 14]) {
      this.box(x, 1.4, 0, 3, 2.8, 3.4, 0x6c8577, this.scene, true);
      this.box(x, 1.4, 1.73, 2.6, 2.4, 0.08, 0x799688);
      this.box(x, 2.88, 0, 3.2, 0.16, 3.6, 0xa5b5a2);
      for (const offset of [-0.9, 0.9]) this.box(x + offset, 1.4, 1.79, 0.09, 2.6, 0.06, 0x425e52);
    }
    // Open roof beams give the range readable sunlight and architectural shadows.
    for (let z = 10; z >= -30; z -= 10) {
      this.box(0, 9.5, z, 38, 0.65, 0.5, 0x526f62);
      this.box(-18.2, 4.6, z, 0.7, 9.2, 0.7, 0x526f62);
      this.box(18.2, 4.6, z, 0.7, 9.2, 0.7, 0x526f62);
    }
    for (let x = -16; x <= 16; x += 8) this.box(x, 9.9, -9, 0.2, 0.2, 49, 0x829b89);
    this.scene.add(this.covers);
    for (const [x, z] of [[-2, -2], [4, -12], [-3, -22]]) {
      this.box(x, 1.65, z, 5, 3.3, 1.5, 0x708c7f, this.covers, true);
      this.box(x, 3.32, z, 5.1, 0.1, 1.6, 0xd2d6bb, this.covers);
      this.box(x, 1.5, z + 0.76, 4.7, 0.12, 0.03, 0xc78c4b, this.covers);
    }
    for (let i = 0; i < 5; i++) this.createTarget(i);
    this.scene.add(this.botCovers);
    for (let i = 0; i < 5; i++) this.box((i - 2) * 6.5, 1.65, -12 - (i % 2) * 6, 2.8, 3.3, 1.5, 0x708c7f, this.botCovers, true);
    this.botCovers.visible = false; this.botColliders.forEach(c => c.setEnabled(false));
    this.player = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.9, 8));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), this.player);
    this.controller = this.world.createCharacterController(0.02); this.controller.setSlideEnabled(true);
    this.makeWeapon(); this.setMode('stop', 'normal'); this.world.step(); this.lobbyView();
  }
  private createTarget(index: number) {
    const group = new THREE.Group(); this.scene.add(group);
    const parts: THREE.Mesh[] = [];
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), this.material(0xe4ddd0));
    head.position.y = 1.65; head.scale.set(0.9, 1.13, 0.9); head.castShadow = true; group.add(head); parts.push(head);
    const face = this.box(0, 1.65, 0.162, 0.21, 0.075, 0.06, 0xf16d50, group);
    const body = this.box(0, 1.12, 0, 0.55, 0.64, 0.32, 0x3b877e, group); parts.push(body, face);
    this.box(0, 1.15, 0.169, 0.28, 0.34, 0.025, 0xb3dbc1, group);
    for (const x of [-0.37, 0.37]) parts.push(this.box(x, 1.05, 0, 0.14, 0.61, 0.16, 0x55786e, group));
    for (const x of [-0.16, 0.16]) {
      const leg = this.box(x, 0.46, 0, 0.17, 0.7, 0.2, 0x354d46, group);
      leg.userData.leg = true; parts.push(leg);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.09, 24), this.material(0x50695c)); base.position.y = 0.06; group.add(base);
    const target: Target = { group, head, parts, hp: WEAPON.targetHealth, respawn: 0, exposed: false,
      motion: createMotion(), anchor: new THREE.Vector3(), axis: new THREE.Vector2(), speed: 0, generation: 0, engagedAt: null };
    for (const part of parts) { part.userData.target = target; part.userData.head = part === head || part === face; }
    group.position.set((index - 2) * 4, 0, -14 - Math.abs(index - 2) * 2); this.targets.push(target);
  }
  private makeWeapon() {
    const gun = this.weapon;
    this.box(0, 0, 0, 0.115, 0.16, 0.48, 0x25332f, gun);
    this.box(0, 0.028, -0.34, 0.09, 0.12, 0.31, 0x35473e, gun);
    this.box(0, 0.045, -0.62, 0.043, 0.045, 0.28, 0x18271f, gun);
    this.box(0, 0.045, -0.78, 0.06, 0.065, 0.08, 0x273a2e, gun);
    this.box(0, 0.005, 0.36, 0.095, 0.18, 0.32, 0x263a30, gun);
    const mag = this.box(0, -0.18, -0.02, 0.074, 0.28, 0.13, 0x192820, gun); mag.rotation.x = -0.15;
    const grip = this.box(0, -0.16, 0.18, 0.075, 0.22, 0.085, 0x25342b, gun); grip.rotation.x = -0.25;
    this.box(0, 0.105, 0.1, 0.047, 0.07, 0.055, 0x122319, gun);
    this.box(0, 0.12, -0.43, 0.022, 0.08, 0.023, 0x14241c, gun);
    this.box(0.059, 0.015, -0.06, 0.004, 0.015, 0.28, 0xcf8353, gun);
    for (let z = -0.2; z > -0.45; z -= 0.045) this.box(0, 0.096, z, 0.1, 0.018, 0.015, 0x17261e, gun);
    const forearm = this.box(-0.065, -0.19, -0.21, 0.13, 0.14, 0.33, 0x465d4f, gun); forearm.rotation.z = -0.3;
    this.box(0.05, -0.25, 0.19, 0.14, 0.16, 0.3, 0x465d4f, gun);
    this.box(-0.025, -0.1, -0.29, 0.12, 0.11, 0.13, 0x202e26, gun);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 4), flashMaterial); flame.rotation.x = -Math.PI / 2; flame.rotation.z = i * Math.PI / 3; this.flash.add(flame);
    }
    this.flash.position.set(0, 0.045, -0.95); this.flash.visible = false; gun.add(this.flash);
    gun.scale.setScalar(0.72); gun.position.set(0.31, -0.28, -0.65); gun.rotation.y = 0.015;
    gun.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = false; object.receiveShadow = false; object.renderOrder = 10; } });
    this.camera.add(gun); gun.visible = false;
  }
  setMode(mode: Mode, difficulty: string) {
    this.mode = mode; this.difficulty = difficulty;
    this.covers.visible = mode === 'peek'; this.coverColliders.forEach(c => c.setEnabled(mode === 'peek'));
    this.targets.forEach((t, i) => {
      t.hp = WEAPON.targetHealth; t.respawn = 0; t.exposed = false; t.group.visible = true;
      const scale = difficulty === 'easy' ? 1.25 : difficulty === 'hard' ? 0.8 : 1;
      t.group.scale.setScalar(scale); t.group.position.y = 1.65 * (1 - scale);
      if (mode === 'peek') t.group.position.set([-3, 1, 5, -5, 0][i], 1.65 * (1 - scale), [-7, -10, -19, -27, -32][i]);
      else t.group.position.set((i - 2) * 3.4, 1.65 * (1 - scale), -12 - Math.abs(i - 2) * 2 - (difficulty === 'hard' ? 6 : 0));
    });
    this.world.step();
  }
  configureBots(mode: BotMode) {
    this.botMode = mode;
    this.botCovers.visible = mode === 'peek'; this.botColliders.forEach(c => c.setEnabled(mode === 'peek'));
    this.covers.visible = this.mode === 'peek' && mode !== 'peek'; this.coverColliders.forEach(c => c.setEnabled(this.covers.visible));
    this.scene.updateMatrixWorld(true);
    this.motionBounds = this.obstacles().map(mesh => new THREE.Box3().setFromObject(mesh)).filter(box => box.max.y > 0.2);
    this.targets.forEach((target, i) => {
      if (mode !== 'static') { target.group.scale.setScalar(1); target.group.position.y = 0; }
      if (mode === 'peek') target.group.position.set((i - 2) * 6.5, 0, -14.2 - (i % 2) * 6);
      this.resetTargetMotion(target, 0);
    });
  }
  resetTargetMotion(target: Target, now: number) {
    target.anchor.copy(target.group.position); target.axis.set(-target.anchor.x, 8 - target.anchor.z).normalize();
    target.motion = createMotion(); target.motion.nextAt = now + 0.4 + Math.random() * 1.5;
    target.speed = 0; target.generation++; target.engagedAt = null;
  }
  obstacles() { return [...this.solids, ...(this.covers.visible ? this.peekSolids : []), ...(this.botCovers.visible ? this.botSolids : [])]; }
  targetSpaceFree(position: THREE.Vector3, target: Target) {
    const player = this.player.translation();
    return !this.motionBounds.some(box => position.x > box.min.x - 0.4 && position.x < box.max.x + 0.4 && position.z > box.min.z - 0.4 && position.z < box.max.z + 0.4)
      && Math.hypot(position.x - player.x, position.z - player.z) >= 0.85
      && !this.targets.some(other => other !== target && other.group.visible && Math.hypot(position.x - other.group.position.x, position.z - other.group.position.z) < 0.8);
  }
  updateBots(now: number, dt: number, speed: number, range: number) {
    for (const target of this.targets) {
      if (!target.group.visible) continue;
      const before = { ...target.motion };
      stepMotion(target.motion, this.botMode, now, dt, speed, range);
      const motion = target.motion, axis = this.botMode === 'peek' ? new THREE.Vector2(0, 1) : target.axis;
      const next = target.anchor.clone().add(new THREE.Vector3(axis.y * motion.x + axis.x * motion.z, 0, -axis.x * motion.x + axis.y * motion.z));
      const blocked = !this.targetSpaceFree(next, target);
      if (blocked) { motion.x = before.x; motion.z = before.z; motion.vx = motion.vz = 0; motion.goalX = 0; motion.goalZ = 0; motion.nextAt = now + 0.2; if (this.botMode === 'peek') motion.phase = 'return'; target.speed = 0; }
      else { target.speed = next.distanceTo(target.group.position) / dt; target.group.position.copy(next); }
    }
  }
  lobbyView(time = 0) { this.camera.position.set(10 + Math.sin(time * 0.12) * 0.35, 4.1, 13); this.camera.lookAt(-1, 1.6, -14); this.weapon.visible = false; }
  resetPlayer() { this.player.setTranslation({ x: 0, y: 0.9, z: 8 }, true); this.player.setNextKinematicTranslation({ x: 0, y: 0.9, z: 8 }); this.world.step(); this.weapon.visible = true; }
  move(x: number, z: number) {
    this.controller.computeColliderMovement(this.collider, { x, y: -0.02, z });
    const translation = this.player.translation(), correction = this.controller.computedMovement();
    if (this.targets.some(t => t.group.visible && Math.hypot(translation.x + correction.x - t.group.position.x, translation.z + correction.z - t.group.position.z) < 0.85
      && Math.hypot(translation.x + correction.x - t.group.position.x, translation.z + correction.z - t.group.position.z) < Math.hypot(translation.x - t.group.position.x, translation.z - t.group.position.z))) {
      correction.x = correction.z = 0;
    }
    this.player.setNextKinematicTranslation({ x: translation.x + correction.x, y: translation.y + correction.y, z: translation.z + correction.z });
    this.world.step();
    return Math.hypot(correction.x, correction.z);
  }
  collidables() { return [...this.obstacles(), ...this.targets.filter(t => t.group.visible).flatMap(t => t.parts)]; }
  trace(from: THREE.Vector3, to: THREE.Vector3, hit: boolean) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffdf9b, transparent: true, opacity: 0.5 }));
    this.scene.add(mesh); this.traces.push({ mesh, life: 0.045 });
    const impact = new THREE.Mesh(new THREE.SphereGeometry(hit ? 0.035 : 0.025, 6, 6), new THREE.MeshBasicMaterial({ color: hit ? 0xc5fbe0 : 0x3d4b3e }));
    impact.position.copy(to); this.scene.add(impact); this.traces.push({ mesh: impact, life: 6 });
  }
  effects(dt: number) {
    this.traces = this.traces.filter(t => {
      t.life -= dt; if (t.life > 0) return true;
      this.scene.remove(t.mesh); const mesh = t.mesh as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); return false;
    });
  }
  resize(fov: number, active: boolean) {
    this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight;
    // Settings use horizontal FOV at a reference 16:9 aspect, as in tactical shooters.
    this.camera.fov = active ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) / (16 / 9))) : innerWidth < 760 ? 70 : 59;
    this.camera.updateProjectionMatrix();
  }
  render() { this.scene.updateMatrixWorld(true); this.renderer.render(this.scene, this.camera); }
}
