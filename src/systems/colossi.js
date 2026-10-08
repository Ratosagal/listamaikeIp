import * as THREE from "three";
export class Colossi {
  constructor(scene, state, fx, audio, notify) {
    this.scene = scene;
    this.state = state;
    this.fx = fx;
    this.audio = audio;
    this.notify = notify;
    this.list = [];
    state.colossusKills = Math.max(0, Number(state.colossusKills) || 0);
    const saved = state.colossi;
    const source = Array.isArray(saved)
      ? saved
      : [
          { id: 1, x: 24, z: -12, hp: 300 },
          { id: 2, x: 24, z: 45, hp: 300 },
        ];
    for (const data of source) {
      if (
        !Number.isFinite(data.x) ||
        !Number.isFinite(data.z) ||
        !(data.hp > 0)
      )
        continue;
      this.spawn(data);
    }
  }
  spawn(data) {
    const g = new THREE.Group();
    this.scene.add(g);
    const stone = new THREE.MeshStandardMaterial({
        color: 0x627475,
        flatShading: true,
        roughness: 1,
      }),
      dark = new THREE.MeshStandardMaterial({
        color: 0x2c424b,
        flatShading: true,
      }),
      ember = new THREE.MeshStandardMaterial({
        color: 0xfcc37b,
        emissive: 0xf09a56,
        emissiveIntensity: 1,
      });
    const part = (w, h, d, material, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
      return m;
    };
    part(2.7, 3, 1.5, stone, 0, 5.3, 0);
    part(1.6, 1.7, 1.5, stone, 0, 8, 0);
    part(1.3, 0.18, 0.1, ember, 0, 8.2, -0.8);
    const legs = [],
      arms = [];
    for (const sign of [-1, 1]) {
      legs.push(part(0.9, 3.7, 1, dark, sign * 0.8, 1.85, 0));
      arms.push(part(0.85, 3.7, 1, stone, sign * 1.9, 5, 0));
      part(1.6, 0.4, 1.8, dark, sign * 0.8, 0.25, -0.3);
    }
    const weak = part(0.8, 0.6, 0.18, ember, 0, 7.3, 0.87);
    part(0.18, 2, 0.1, ember, 0, 5.8, 0.8);
    const giant = {
      id: data.id,
      x: data.x,
      z: data.z,
      hp: Math.min(300, data.hp),
      rotation: Number(data.rotation) || 0,
      phase: ["windup", "recover"].includes(data.phase) ? data.phase : "roam",
      timer: Math.min(4, Math.max(0, Number(data.timer) || 0)),
      cooldown: Math.min(4, Math.max(0, Number(data.cooldown) || 2)),
      mesh: g,
      legs,
      arms,
      weak,
    };
    this.list.push(giant);
    g.position.set(giant.x, 0, giant.z);
    g.rotation.y = giant.rotation;
  }
  anchors() {
    return this.list.map((g) => ({
      x: g.x + Math.sin(g.rotation) * 1.2,
      z: g.z + Math.cos(g.rotation) * 1.2,
      h: 7.5,
      w: 1,
      d: 1,
      anchor: new THREE.Vector3(
        g.x + Math.sin(g.rotation) * 1.2,
        8.1,
        g.z + Math.cos(g.rotation) * 1.2,
      ),
      label: "Nuca do colosso",
    }));
  }
  strike(p, yaw, weapon, speed, clearSight) {
    const range = weapon === "sword" ? 4 : weapon === "bow" ? 28 : 40;
    const facing = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const targets = this.list
      .filter((g) => {
        const dx = g.x - p.x,
          dz = g.z - p.z,
          d = Math.hypot(dx, dz);
        return (
          d < range &&
          (dx * facing.x + dz * facing.z) / Math.max(0.1, d) >
            (weapon === "sword" ? -0.1 : 0.94) &&
          ((p.y || 0) > 5 || clearSight(p, g))
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      );
    const g = targets[0];
    if (!g) return false;
    const behind =
      ((p.x - g.x) * Math.sin(g.rotation) +
        (p.z - g.z) * Math.cos(g.rotation)) /
      Math.max(0.1, Math.hypot(p.x - g.x, p.z - g.z));
    const weak = Math.abs((p.y || 0) + 1.2 - 7.3) < 2 && behind > 0.15;
    const damage = weak
      ? weapon === "sword"
        ? Math.round(150 + Math.min(150, speed * 5))
        : 65
      : weapon === "sword"
        ? 5
        : 8;
    g.hp -= damage;
    this.fx.burst(
      { x: g.x, y: weak ? 7.3 : 3, z: g.z },
      weak ? 0xffcc81 : 0x879996,
      16,
    );
    this.fx.text(
      g,
      weak ? `NUCA −${damage}` : `ARMADURA −${damage}`,
      weak ? "#ffd09a" : "#a1b6bb",
    );
    this.audio.play("hit");
    if (g.hp <= 0) {
      this.scene.remove(g.mesh);
      g.mesh.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
      });
      for (const material of new Set([
        g.weak.material,
        ...g.legs.map((m) => m.material),
        ...g.arms.map((m) => m.material),
      ]))
        material.dispose();
      this.list.splice(this.list.indexOf(g), 1);
      this.state.colossusKills++;
      this.state.inventory.scrap += 25;
      this.state.inventory.capsules += 2;
      this.state.inventory.stone += 15;
      for (const c of this.state.creatures) c.xp += 5;
      this.notify(
        "COLOSSO VENCIDO · +25 sucatas, +15 pedras, +2 cápsulas · aliados +5 XP",
      );
    } else
      this.notify(
        weak
          ? "Ponto fraco atingido!"
          : "Armadura resistente. Use os ganchos e ataque a nuca por trás.",
      );
    return true;
  }
  update(dt, blocked, protectedPlayer) {
    const p = this.state.player;
    for (const g of this.list) {
      const d = Math.hypot(g.x - p.x, g.z - p.z);
      g.cooldown -= dt;
      g.timer -= dt;
      if (g.phase === "windup") {
        g.arms.forEach((m) => (m.rotation.x = -1.5));
        if (g.timer <= 0) {
          g.phase = "recover";
          g.timer = 2;
          g.cooldown = 4;
          this.fx.burst({ x: g.x, y: 0.3, z: g.z }, 0xdfb68d, 30);
          if (d < 7 && (p.y || 0) < 3 && !protectedPlayer) {
            this.state.health -= 25;
            this.fx.hurt();
            this.audio.play("hurt");
            this.notify(
              "Impacto do colosso! Ganhe altitude ou recue durante a preparação.",
            );
          }
          for (const s of [...this.state.structures])
            if (Math.hypot(s.x - g.x, s.z - g.z) < 6) {
              s.hp -= 70;
              if (s.hp <= 0) {
                this.scene.remove(s.mesh);
                this.state.structures.splice(
                  this.state.structures.indexOf(s),
                  1,
                );
              }
            }
        }
      } else if (g.phase === "recover") {
        g.arms.forEach((m) => (m.rotation.x = 0.3));
        if (g.timer <= 0) g.phase = "roam";
      } else if (d < 35) {
        g.rotation = Math.atan2(g.x - p.x, g.z - p.z);
        if (d < 7 && g.cooldown <= 0) {
          g.phase = "windup";
          g.timer = 1.7;
          this.notify("COLOSSO PREPARANDO IMPACTO · suba com G ou Espaço!");
        } else if (d > 4) {
          const step = dt * 0.8,
            dx = ((p.x - g.x) / d) * step,
            dz = ((p.z - g.z) / d) * step;
          if (!blocked(g.x + dx, g.z)) g.x += dx;
          if (!blocked(g.x, g.z + dz)) g.z += dz;
          g.legs.forEach(
            (m, i) =>
              (m.rotation.x =
                Math.sin(this.state.time * 3 + i * Math.PI) * 0.13),
          );
        }
        g.arms.forEach((m) => (m.rotation.x = 0));
      }
      g.mesh.position.set(g.x, 0, g.z);
      g.mesh.rotation.y = g.rotation;
      g.weak.scale.setScalar(1 + Math.sin(this.state.time * 4) * 0.15);
    }
  }
  snapshot() {
    return this.list.map((g) => ({
      id: g.id,
      x: g.x,
      z: g.z,
      hp: g.hp,
      rotation: g.rotation,
      phase: g.phase,
      timer: g.timer,
      cooldown: g.cooldown,
    }));
  }
}
