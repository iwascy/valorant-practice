import * as THREE from 'three';
import { RangeScene, type Target } from './scene';
import { GunAudio } from './audio';
import { WEAPON, moveVelocity, spreadAngle, type Mode, type Session, type Settings } from './model';
import { ShotCadence, VandalRecoil, sampleSpread } from './vandal';
import { FlashTrial, FLASH } from './flash';

export class Game {
  session: Session | null = null;
  running = false;
  yaw = 0; pitch = 0;
  readonly recoil = new VandalRecoil();
  readonly flashTrial = new FlashTrial();
  readonly flashSource = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshBasicMaterial({ color: 0xffba68 }));
  private cadence = new ShotCadence();
  get recoilX() { return this.recoil.x; }
  get recoilY() { return this.recoil.y; }
  ammo = WEAPON.magazine;
  reloading = 0;
  speed = 0;
  get heat() { return this.recoil.heat; }
  walking = false;
  muted = false;
  private velocity = new THREE.Vector2();
  private keys = new Set<string>();
  private trigger = false;
  private stopAt: number | null = null;
  private distanceSinceShot = 0;
  private flashTime = 0;
  private ray = new THREE.Raycaster();
  private accumulator = 0;
  private previousTime = performance.now();
  private ready = false;
  private shotKick = 0;
  onUpdate = () => {};
  onFinish = (_session: Session) => {};
  onFeedback = (_message: string, _head = false, _hit = false) => {};
  constructor(readonly range: RangeScene, readonly audio: GunAudio, public settings: Settings) {
    this.flashSource.visible = false; range.scene.add(this.flashSource);
    document.addEventListener('keydown', event => {
      if (!this.running) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyR', 'Space'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code); if (event.code === 'KeyR') this.reload();
    });
    document.addEventListener('keyup', event => this.keys.delete(event.code));
    document.addEventListener('mousemove', event => {
      if (!this.running || document.pointerLockElement !== range.renderer.domElement) return;
      const multiplier = THREE.MathUtils.degToRad(0.07) * this.settings.sensitivity;
      this.yaw -= event.movementX * multiplier;
      this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * multiplier, -1.45, 1.45);
    });
    document.addEventListener('mousedown', event => {
      if (this.running && event.button === 0 && event.target === range.renderer.domElement) {
        this.trigger = true; this.cadence.press(this.session!.elapsed);
      }
    });
    document.addEventListener('mouseup', event => { if (event.button === 0) this.trigger = false; });
    window.addEventListener('blur', () => { this.clearInput(); if (document.pointerLockElement) document.exitPointerLock(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clearInput(); if (document.pointerLockElement) document.exitPointerLock(); } });
    range.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
  }
  init() { this.ready = true; this.loop(); }
  start(mode: Mode, difficulty: string, duration: number) {
    this.session = { mode, shots: [], kills: 0, elapsed: 0, duration, date: new Date().toISOString(), peekErrors: [] };
    this.flashTrial.reset(this.settings.flashEnabled); this.flashSource.visible = false;
    this.session.flashEnabled = this.settings.flashEnabled; this.session.flashes = this.flashTrial.results;
    this.yaw = this.pitch = this.reloading = this.speed = this.distanceSinceShot = this.shotKick = 0;
    this.recoil.reset(); this.cadence.reset(); this.walking = false;
    this.ammo = WEAPON.magazine; this.stopAt = null;
    this.clearInput(); this.range.setMode(mode, difficulty); this.range.resetPlayer();
    this.range.resize(this.settings.fov, true); this.syncCamera();
  }
  clearInput() { this.keys.clear(); this.trigger = false; this.velocity.set(0, 0); this.speed = 0; this.accumulator = 0; }
  pause() { this.running = false; this.clearInput(); }
  resume() { this.clearInput(); this.running = true; this.previousTime = performance.now(); }
  finish() {
    const result = this.session; if (!result) return;
    result.blindSeconds = this.flashTrial.blindSeconds; this.flashSource.visible = false;
    this.pause(); this.session = null; this.range.resize(this.settings.fov, false);
    if (document.pointerLockElement) document.exitPointerLock(); this.onFinish(result);
  }
  reload() { if (!this.running || this.reloading > 0 || this.ammo === WEAPON.magazine) return; this.reloading = WEAPON.reload; this.audio.reload(); }
  private syncCamera() {
    const p = this.range.player.translation(); this.range.camera.position.set(p.x, p.y + 0.75, p.z);
    const view = this.recoil.cameraOffset();
    this.range.camera.rotation.set(THREE.MathUtils.clamp(this.pitch + view.y, -1.5, 1.5), this.yaw + view.x, 0, 'YXZ');
    this.range.camera.updateMatrixWorld(true);
  }
  private shoot() {
    const session = this.session!;
    if (this.reloading > 0) return;
    if (this.ammo === 0) { this.reload(); return; }
    if (!this.cadence.take(session.elapsed)) return;
    this.ammo--;
    const spread = spreadAngle(this.speed, this.heat, this.walking);
    const { x: spreadX, y: spreadY } = sampleSpread(spread);
    this.syncCamera(); this.range.scene.updateMatrixWorld(true);
    const shotRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.clamp(this.pitch + this.recoilY, -1.5, 1.5), this.yaw + this.recoilX, 0, 'YXZ'));
    const direction = new THREE.Vector3(spreadX, spreadY, -1).normalize().applyQuaternion(shotRotation);
    this.ray.set(this.range.camera.position, direction);
    const intersection = this.ray.intersectObjects(this.range.collidables(), false)[0];
    const target = intersection?.object.userData.target as Target | undefined;
    const head = !!target && !!intersection.object.userData.head;
    const moving = this.speed > WEAPON.accurateSpeed;
    const qualified = session.mode !== 'stop' || (!moving && this.distanceSinceShot >= 0.65);
    session.shots.push({ hit: !!target, head, moving, x: -this.recoilX + Math.atan(spreadX), y: this.recoilY + Math.atan(spreadY),
      stopDelay: !moving && this.stopAt !== null ? session.elapsed - this.stopAt : null, time: session.elapsed, spread });
    if (target) {
      this.audio.hit(head);
      if (qualified) {
        const leg = !!intersection.object.userData.leg;
        const damage = head ? WEAPON.headDamage : leg ? WEAPON.legDamage : WEAPON.bodyDamage;
        target.hp -= damage;
        if (target.hp <= 0) { target.group.visible = false; target.respawn = session.elapsed + 0.45; session.kills++; this.distanceSinceShot = 0; this.stopAt = null; }
        this.onFeedback(head ? '头部命中' : `${leg ? '腿部' : '身体'}命中 · ${damage}`, head, true);
      } else this.onFeedback(moving ? '开枪过早 · 尚未停稳' : '先完成横移，再停稳射击', false, true);
    } else if (moving && this.settings.assist) this.onFeedback('移动射击 · 散布增加');
    const endpoint = intersection?.point ?? this.range.camera.position.clone().addScaledVector(direction, 90);
    const muzzle = new THREE.Vector3(0, 0.045, -0.92); this.range.weapon.localToWorld(muzzle);
    this.range.trace(muzzle, endpoint, !!target);
    this.recoil.kick(session.elapsed, this.settings.recoil, moving && !this.walking);
    this.flashTime = 0.035; this.shotKick = 1; this.audio.shot(this.cadence.scheduledAt);
  }
  private step(dt: number) {
    const session = this.session!; session.elapsed = Math.min(session.duration, session.elapsed + dt);
    if (session.elapsed >= session.duration) { this.finish(); return; }
    const horizontal = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const forward = Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW'));
    const input = new THREE.Vector2(horizontal, forward).normalize();
    this.walking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this.walking ? WEAPON.walkSpeed : WEAPON.maxSpeed;
    const desiredX = (input.x * Math.cos(this.yaw) + input.y * Math.sin(this.yaw)) * speed;
    const desiredZ = (-input.x * Math.sin(this.yaw) + input.y * Math.cos(this.yaw)) * speed;
    this.velocity.x = moveVelocity(this.velocity.x, desiredX, dt); this.velocity.y = moveVelocity(this.velocity.y, desiredZ, dt);
    const distance = this.range.move(this.velocity.x * dt, this.velocity.y * dt);
    const previousSpeed = this.speed; this.speed = distance / dt; this.distanceSinceShot += distance;
    if (previousSpeed > WEAPON.accurateSpeed && this.speed <= WEAPON.accurateSpeed) this.stopAt = session.elapsed;
    if (this.speed > WEAPON.accurateSpeed) this.stopAt = null;
    if (this.reloading > 0) { this.reloading = Math.max(0, this.reloading - dt); if (this.reloading === 0) this.ammo = WEAPON.magazine; }
    this.recoil.recover(session.elapsed);
    this.syncCamera();
    if (this.trigger) this.shoot();
    if (session.flashEnabled) this.updateFlash(dt);
    for (const target of this.range.targets) {
      if (!target.group.visible && session.elapsed >= target.respawn) {
        target.group.visible = true; target.hp = WEAPON.targetHealth; target.exposed = false;
        if (session.mode !== 'peek') {
          target.group.position.x = (Math.random() - 0.5) * (this.range.difficulty === 'easy' ? 10 : 19);
          target.group.position.z = -7 - Math.random() * (this.range.difficulty === 'hard' ? 24 : 16);
        }
      }
    }
    if (session.mode === 'peek') this.measurePeek();
    this.flashTime = Math.max(0, this.flashTime - dt); this.shotKick *= Math.exp(-dt * 18);
    this.range.flash.visible = this.flashTime > 0;
    const reloadTilt = this.reloading > 0 ? Math.sin((1 - this.reloading / WEAPON.reload) * Math.PI) : 0;
    this.range.weapon.position.set(0.31 + Math.sin(session.elapsed * 11) * this.speed * 0.0015, -0.28 - reloadTilt * 0.16, -0.65 + this.shotKick * 0.065);
    const view = this.recoil.cameraOffset();
    this.range.weapon.rotation.set(this.shotKick * 0.06 + (this.recoilY - view.y) * 0.6 - reloadTilt * 0.4,
      0.015 + (this.recoilX - view.x) * 0.9, -reloadTilt * 0.6 - this.recoilX * 0.45);
  }
  private updateFlash(dt: number) {
    const now = this.session!.elapsed, trial = this.flashTrial, camera = this.range.camera;
    if (trial.warningAt === null && now >= trial.nextAt && now + FLASH.fuse < this.session!.duration) {
      const direction = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw + (Math.random() - 0.5) * 1.1);
      this.flashSource.position.copy(camera.position).addScaledVector(direction, 4 + Math.random() * 3);
      this.flashSource.position.y = 2.2;
      this.flashSource.position.x = THREE.MathUtils.clamp(this.flashSource.position.x, -18, 18);
      this.flashSource.position.z = THREE.MathUtils.clamp(this.flashSource.position.z, -36, 21);
      trial.begin(now); this.audio.flashCue();
    }
    const direction = this.flashSource.position.clone().sub(camera.position), distance = direction.length(); direction.normalize();
    const angle = THREE.MathUtils.radToDeg(camera.getWorldDirection(new THREE.Vector3()).angleTo(direction));
    this.range.scene.updateMatrixWorld(true); this.ray.set(camera.position, direction);
    const blocker = this.ray.intersectObjects([...this.range.solids, ...(this.session!.mode === 'peek' ? this.range.peekSolids : [])], false)[0];
    const result = trial.step(now, dt, angle, !!blocker && blocker.distance < distance);
    if (result) this.audio.flashCue(true);
    this.flashSource.visible = trial.warningAt !== null;
    this.flashSource.scale.setScalar(1 + (trial.warningAt === null ? 0 : (now - trial.warningAt) / FLASH.fuse));
    this.flashSource.rotation.y += dt * 5;
  }
  private measurePeek() {
    const camera = this.range.camera, forward = new THREE.Vector3(); camera.getWorldDirection(forward);
    this.range.scene.updateMatrixWorld(true);
    for (const target of this.range.targets) {
      if (!target.group.visible) continue;
      const head = target.head.getWorldPosition(new THREE.Vector3());
      const direction = head.sub(camera.position); const distance = direction.length(); direction.normalize();
      this.ray.set(camera.position, direction);
      const blocker = this.ray.intersectObjects([...this.range.solids, ...this.range.peekSolids], false)[0];
      const angle = THREE.MathUtils.radToDeg(forward.angleTo(direction));
      const visible = (!blocker || blocker.distance > distance) && angle < 60;
      if (visible && !target.exposed && this.speed > 0.5) this.session!.peekErrors!.push(angle);
      target.exposed = visible;
    }
  }
  private loop = () => {
    if (!this.ready) return;
    requestAnimationFrame(this.loop);
    const now = performance.now(), dt = Math.min((now - this.previousTime) / 1000, 0.1); this.previousTime = now;
    if (this.running) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120 && this.running) { this.step(1 / 120); this.accumulator -= 1 / 120; }
      if (this.running) this.syncCamera();
    } else if (!this.session) this.range.lobbyView(now / 1000);
    this.range.effects(dt); this.range.render(); this.onUpdate();
  };
}
