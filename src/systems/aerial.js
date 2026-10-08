import * as THREE from "three";
export class AerialRig {
  constructor(scene, state, obstacles, notify, audio) {
    this.state = state;
    this.obstacles = obstacles;
    this.notify = notify;
    this.audio = audio;
    this.hooks = [];
    this.v = new THREE.Vector3();
    this.gas = 100;
    this.target = null;
    this.cooldown = 0;
    this.lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xd9edc5 }),
    );
    this.lines.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3),
    );
    this.lines.geometry.setDrawRange(0, 0);
    scene.add(this.lines);
    state.player.y = Math.max(0, Number(state.player.y) || 0);
  }
  aim(yaw) {
    const p = this.state.player;
    this.target =
      [...this.obstacles, ...(this.extraAnchors?.() || [])]
        .filter((b) => b.h && Math.hypot(b.x - p.x, b.z - p.z) < 48)
        .map((b) => {
          const dx = b.x - p.x,
            dz = b.z - p.z,
            d = Math.hypot(dx, dz),
            align =
              (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) / Math.max(d, 0.1);
          return { b, d, align };
        })
        .filter((t) => t.align > 0.65)
        .sort((a, b) => (b.align - a.align) * 40 + a.d - b.d)[0]?.b || null;
    return this.target;
  }
  fire(yaw, second = false) {
    const b = this.aim(yaw);
    if (!b) return this.notify("Mire na direção de um prédio a até 48 metros.");
    if (this.gas < 10)
      return this.notify("Propulsor vazio. Pouse para recarregar.");
    if (!second) this.release();
    if (this.hooks.length >= 2) this.hooks.shift();
    const p = this.state.player;
    const dx = p.x - b.x,
      dz = p.z - b.z;
    const anchor =
      b.anchor?.clone() ||
      new THREE.Vector3(
        b.x + Math.sign(dx) * Math.min(Math.abs(dx), b.w / 2 + 0.9),
        b.h + 2,
        b.z + Math.sign(dz) * Math.min(Math.abs(dz), b.d / 2 + 0.9),
      );
    if (second && !b.anchor) {
      anchor.x += dx >= 0 ? -1.2 : 1.2;
    }
    const origin = new THREE.Vector3(p.x, p.y + 1, p.z);
    const direction = anchor.clone().sub(origin).normalize();
    this.hooks.push({ anchor, length: origin.distanceTo(anchor) });
    this.v.addScaledVector(direction, 14);
    this.v.y = Math.max(this.v.y, 8);
    this.gas -= 8;
    this.audio.play("bow");
    this.notify(
      second
        ? "Segundo cabo preso · Shift recolhe · X solta"
        : "Gancho preso · WASD balança · Shift propulsiona · Espaço salta",
    );
  }
  release() {
    this.hooks = [];
    this.draw();
  }
  reset() {
    this.release();
    this.v.set(0, 0, 0);
    this.state.player.y = 0;
    this.gas = 100;
  }
  jump() {
    if (this.hooks.length) {
      this.release();
      this.v.y = Math.max(8, this.v.y + 5);
    } else if (this.state.player.y <= this.floor(this.state.player) + 0.1)
      this.v.y = 8;
  }
  floor(p) {
    let floor = 0;
    for (const b of this.obstacles)
      if (
        b.h &&
        Math.abs(p.x - b.x) < b.w / 2 + 0.05 &&
        Math.abs(p.z - b.z) < b.d / 2 + 0.05
      )
        floor = Math.max(floor, b.h);
    return floor;
  }
  active() {
    return this.hooks.length > 0 || this.state.player.y > 0 || this.v.y > 0;
  }
  update(dt, dx, dz, boost, blocked) {
    const p = this.state.player;
    if (!this.active()) {
      this.gas = Math.min(100, this.gas + dt * 12);
      this.draw();
      return false;
    }
    for (let elapsed = 0; elapsed < dt;) {
      const step = Math.min(1 / 60, dt - elapsed);
      elapsed += step;
      this.v.y -= 15 * step;
      this.v.x += dx * 14 * step;
      this.v.z += dz * 14 * step;
      this.v.multiplyScalar(Math.exp(-step * 0.15));
      if (this.hooks.length) {
        this.gas = Math.max(0, this.gas - step * (boost ? 16 : 1.5));
        for (const hook of this.hooks) {
          hook.length = Math.max(1.8, hook.length - step * (boost ? 15 : 3.5));
          const to = hook.anchor
            .clone()
            .sub(new THREE.Vector3(p.x, p.y + 1, p.z));
          this.v.addScaledVector(to.normalize(), step * (boost ? 28 : 9));
        }
        if (this.gas === 0) this.release();
      }
      if (this.v.length() > 32) this.v.setLength(32);
      const priorY = p.y,
        np = {
          x: p.x + this.v.x * step,
          y: p.y + this.v.y * step,
          z: p.z + this.v.z * step,
        };
      const collision = (x, z) =>
        Math.abs(x) > 97 ||
        Math.abs(z) > 97 ||
        this.obstacles.some(
          (b) =>
            Math.abs(x - b.x) < b.w / 2 + 0.4 &&
            Math.abs(z - b.z) < b.d / 2 + 0.4 &&
            np.y < (b.h || 2) - 0.05,
        ) ||
        (np.y < 3 &&
          blocked(x, z) &&
          !this.obstacles.some(
            (b) =>
              b.h &&
              np.y >= b.h - 0.05 &&
              Math.abs(x - b.x) < b.w / 2 + 0.5 &&
              Math.abs(z - b.z) < b.d / 2 + 0.5,
          ));
      if (!collision(np.x, p.z)) p.x = np.x;
      else this.v.x = 0;
      if (!collision(p.x, np.z)) p.z = np.z;
      else this.v.z = 0;
      p.y = np.y;
      const floor = this.floor(p);
      if (priorY >= floor - 0.05 && p.y <= floor) {
        p.y = floor;
        this.v.y = 0;
        if (!this.hooks.length) {
          this.v.x *= Math.exp(-step * 3);
          this.v.z *= Math.exp(-step * 3);
          this.gas = Math.min(100, this.gas + step * 12);
        }
      }
      if (p.y < 0) {
        p.y = 0;
        this.v.y = 0;
      }
      for (const hook of this.hooks) {
        const pos = new THREE.Vector3(p.x, p.y + 1, p.z),
          offset = pos.clone().sub(hook.anchor);
        if (offset.length() > hook.length) {
          const dir = offset.normalize(),
            outward = this.v.dot(dir);
          if (outward > 0) this.v.addScaledVector(dir, -outward);
          this.v.addScaledVector(
            dir,
            -Math.min(
              10,
              (pos.distanceTo(hook.anchor) - hook.length) * step * 25,
            ),
          );
        }
      }
    }
    this.draw();
    return true;
  }
  draw() {
    const p = this.state.player,
      attribute = this.lines.geometry.getAttribute("position");
    let index = 0;
    for (const h of this.hooks) {
      attribute.setXYZ(index++, p.x, (p.y || 0) + 1.3, p.z);
      attribute.setXYZ(index++, h.anchor.x, h.anchor.y, h.anchor.z);
    }
    attribute.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, index);
    this.lines.frustumCulled = false;
  }
  snapshot() {
    return {
      gas: this.gas,
      height: this.state.player.y,
      hooks: this.hooks.length,
      speed: this.v.length(),
      target: this.target
        ? { x: this.target.x, z: this.target.z, height: this.target.h }
        : null,
    };
  }
}
