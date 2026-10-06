import * as THREE from "three";
// A fixed-size pool bounds allocations, draw calls, and particle memory.
export class Feedback {
  constructor(scene, settings) {
    this.settings = settings;
    this.pool = Array.from({ length: 192 }, () => ({
      life: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    this.positions = new Float32Array(192 * 3);
    this.colors = new Float32Array(192 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({
        size: 0.13,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.labels = [];
    this.pointer = 0;
    this.damage = 0;
    this.shake = 0;
  }
  burst(at, color, count = 12) {
    if (!this.settings.particles) return;
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const id = this.pointer++ % 192,
        p = this.pool[id];
      Object.assign(p, {
        life: 0.35 + Math.random() * 0.35,
        x: at.x,
        y: at.y || 1,
        z: at.z,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3,
        vz: (Math.random() - 0.5) * 3,
      });
      c.toArray(this.colors, id * 3);
    }
  }
  text(at, text, color = "#e7f1b9") {
    const el = document.createElement("span");
    el.className = "world-feedback";
    el.textContent = text;
    el.style.color = color;
    document.getElementById("feedback").append(el);
    this.labels.push({ el, at: { x: at.x, y: 2.5, z: at.z }, life: 1.3 });
    if (this.labels.length > 12) this.labels.shift().el.remove();
  }
  hurt() {
    this.damage = 0.65;
    if (this.settings.shake) this.shake = 0.18;
  }
  update(dt, camera) {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 6 * dt;
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.life > 0 ? p.y : -100;
      this.positions[i * 3 + 2] = p.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.points.visible = this.settings.particles;
    for (const f of [...this.labels]) {
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this.labels.splice(this.labels.indexOf(f), 1);
        continue;
      }
      const v = new THREE.Vector3(
        f.at.x,
        f.at.y + (1.3 - f.life) * 0.7,
        f.at.z,
      ).project(camera);
      f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px,${(-v.y * 0.5 + 0.5) * innerHeight}px)`;
      f.el.style.opacity = v.z < 1 ? Math.min(1, f.life * 2) : 0;
    }
    this.damage = Math.max(0, this.damage - dt * 1.4);
    this.shake = Math.max(0, this.shake - dt);
    document.getElementById("damage").style.opacity = this.settings.flashes
      ? this.damage
      : 0;
  }
}
