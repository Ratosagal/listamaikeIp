import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { poseSurvivor } from "../systems/character.js";
// Gisele: original adult heroine, silver hair, plum dress and bronze armature.
export function createGisele(scene) {
  const root = new THREE.Group();
  root.name = "Gisele";
  scene.add(root);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: 0xcda28d, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: 0xaeb8c4, roughness: 0.65 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x49384f, roughness: 0.95 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x222d3b, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xc8a56d,
      metalness: 0.65,
      roughness: 0.35,
    }),
    glow: new THREE.MeshStandardMaterial({
      color: 0x96e5d1,
      emissive: 0x43aa9d,
      emissiveIntensity: 0.65,
    }),
    eyes: new THREE.MeshStandardMaterial({ color: 0x233b40 }),
  };
  const joint = (parent, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const part = (parent, geometry, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const ell = (parent, x, y, z, sx, sy, sz, mat) => {
    const m = part(parent, new THREE.SphereGeometry(1, 14, 10), mat, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const round = (parent, w, h, d, mat, x = 0, y = 0, z = 0) =>
    part(parent, new RoundedBoxGeometry(w, h, d, 2, 0.025), mat, x, y, z);
  const body = joint(root),
    pelvis = joint(body, 0, 0.98),
    torso = joint(body, 0, 1.22);
  ell(pelvis, 0, 0, 0, 0.24, 0.18, 0.16, mats.cloth);
  ell(torso, 0, 0.13, 0, 0.26, 0.33, 0.17, mats.cloth);
  round(torso, 0.44, 0.06, 0.31, mats.gold, 0, -0.1, 0);
  round(torso, 0.055, 0.51, 0.04, mats.gold, 0, 0.16, -0.17);
  for (const sign of [-1, 1]) {
    round(
      torso,
      0.05,
      0.46,
      0.04,
      mats.gold,
      sign * 0.2,
      0.16,
      -0.09,
    ).rotation.z = sign * 0.2;
    ell(torso, sign * 0.08, 0.21, -0.1, 0.1, 0.13, 0.1, mats.cloth);
  }
  const head = joint(torso, 0, 0.6);
  part(
    head,
    new THREE.CylinderGeometry(0.065, 0.075, 0.16, 12),
    mats.skin,
    0,
    -0.08,
    0,
  );
  ell(head, 0, 0.12, 0, 0.16, 0.215, 0.15, mats.skin);
  ell(head, 0, -0.01, -0.025, 0.115, 0.09, 0.12, mats.skin);
  for (const sign of [-1, 1]) {
    ell(head, sign * 0.16, 0.1, 0, 0.025, 0.046, 0.02, mats.skin);
    ell(head, sign * 0.057, 0.145, -0.139, 0.027, 0.013, 0.009, mats.eyes);
    round(head, 0.06, 0.009, 0.01, mats.dark, sign * 0.059, 0.18, -0.135);
  }
  ell(head, 0, 0.105, -0.157, 0.02, 0.035, 0.029, mats.skin);
  round(head, 0.05, 0.006, 0.009, mats.cloth, 0, 0.013, -0.135);
  const hair = joint(head, 0, 0.2, 0.03);
  ell(hair, 0, 0.07, 0.015, 0.17, 0.13, 0.16, mats.hair);
  for (const sign of [-1, 1]) {
    const lock = ell(
      hair,
      sign * 0.14,
      -0.13,
      0.07,
      0.055,
      0.26,
      0.08,
      mats.hair,
    );
    lock.rotation.z = sign * 0.12;
  }
  for (let i = 0; i < 5; i++) {
    const fringe = ell(
      hair,
      (i - 2) * 0.053,
      0.045,
      -0.11,
      0.035,
      0.09,
      0.055,
      mats.hair,
    );
    fringe.rotation.z = -0.2;
  }
  const tail = joint(head, 0, 0.15, 0.16);
  for (let i = 0; i < 5; i++) {
    const lock = ell(
      tail,
      0.025 * Math.sin(i),
      -0.13 * i,
      0.025 * i,
      0.085 - i * 0.01,
      0.12,
      0.08 - i * 0.01,
      mats.hair,
    );
    lock.rotation.x = -0.2;
  }
  round(head, 0.3, 0.027, 0.025, mats.gold, 0, 0.245, -0.115);
  ell(head, 0, 0.244, -0.139, 0.027, 0.027, 0.013, mats.glow);
  // Split overskirt follows movement instead of hiding the leg cycle.
  const skirt = [];
  for (const sign of [-1, 1]) {
    const panel = joint(pelvis, sign * 0.16, -0.08, 0.07);
    const cloth = part(
      panel,
      new THREE.CylinderGeometry(0.1, 0.18, 0.56, 6, 1, true),
      mats.cloth,
      0,
      -0.23,
      0.01,
    );
    cloth.scale.z = 0.5;
    round(panel, 0.025, 0.43, 0.04, mats.gold, sign * 0.12, -0.22, -0.06);
    skirt.push(panel);
  }
  const arms = [],
    elbows = [],
    hands = [],
    legs = [],
    knees = [],
    feet = [];
  for (const sign of [-1, 1]) {
    const arm = joint(torso, sign * 0.31, 0.36);
    arms.push(arm);
    ell(arm, 0, -0.06, 0, 0.085, 0.12, 0.09, mats.skin);
    part(
      arm,
      new THREE.CapsuleGeometry(0.065, 0.19, 4, 10),
      mats.skin,
      0,
      -0.2,
      0,
    );
    if (sign === -1) round(arm, 0.16, 0.11, 0.18, mats.gold, 0, -0.03, 0);
    const elbow = joint(arm, 0, -0.34);
    elbows.push(elbow);
    part(
      elbow,
      new THREE.CapsuleGeometry(0.055, 0.18, 4, 10),
      mats.skin,
      0,
      -0.14,
      0,
    );
    round(elbow, 0.13, 0.2, 0.13, mats.gold, 0, -0.19, 0);
    const hand = joint(elbow, 0, -0.32);
    hands.push(hand);
    round(hand, 0.1, 0.13, 0.1, mats.dark, 0, -0.02, 0);
    ell(hand, -sign * 0.06, -0.03, -0.01, 0.022, 0.04, 0.024, mats.skin);
    const leg = joint(pelvis, sign * 0.135, -0.08);
    legs.push(leg);
    part(
      leg,
      new THREE.CapsuleGeometry(0.095, 0.22, 4, 12),
      mats.dark,
      0,
      -0.22,
      0,
    );
    const knee = joint(leg, 0, -0.41);
    knees.push(knee);
    ell(knee, 0, 0, -0.06, 0.08, 0.08, 0.06, mats.gold);
    part(
      knee,
      new THREE.CapsuleGeometry(0.07, 0.2, 4, 10),
      mats.dark,
      0,
      -0.16,
      0,
    );
    round(knee, 0.08, 0.25, 0.05, mats.gold, 0, -0.17, -0.07);
    const foot = joint(knee, 0, -0.33);
    feet.push(foot);
    round(foot, 0.18, 0.13, 0.29, mats.dark, 0, -0.05, -0.04);
    round(foot, 0.19, 0.028, 0.3, mats.gold, 0, -0.12, -0.04);
  }
  const cape = joint(torso, 0, 0.37, 0.19);
  const fabric = part(
    cape,
    new THREE.PlaneGeometry(0.45, 0.75, 3, 5),
    mats.cloth,
    0,
    -0.34,
    0.1,
  );
  fabric.material = mats.cloth.clone();
  fabric.material.side = THREE.DoubleSide;
  fabric.rotation.x = -0.18;
  const staff = joint(hands[1], 0, -0.02, 0);
  part(
    staff,
    new THREE.CylinderGeometry(0.025, 0.035, 1.7, 10),
    mats.gold,
    0,
    0.3,
    0,
  );
  ell(staff, 0, 1.18, 0, 0.09, 0.14, 0.08, mats.glow);
  part(
    staff,
    new THREE.TorusGeometry(0.14, 0.022, 6, 20),
    mats.gold,
    0,
    1.18,
    0,
  ).rotation.x = 0.2;
  const blades = joint(hands[1]);
  for (const sign of [-1, 1]) {
    const blade = part(
      blades,
      new THREE.ConeGeometry(0.07, 0.52, 4),
      mats.gold,
      sign * 0.06,
      -0.3,
      -0.02,
    );
    blade.rotation.z = 0.15 * sign;
  }
  const bow = joint(hands[1]);
  part(
    bow,
    new THREE.TorusGeometry(0.43, 0.025, 6, 24, Math.PI),
    mats.gold,
    0,
    0.05,
    0,
  ).rotation.z = Math.PI / 2;
  part(
    bow,
    new THREE.CylinderGeometry(0.006, 0.006, 0.84, 5),
    mats.glow,
    0,
    0.05,
    0,
  );
  root.userData.rig = {
    body,
    torso,
    pelvis,
    head,
    arms,
    elbows,
    hands,
    legs,
    knees,
    feet,
    phase: 0,
    speed: 0,
    air: 0,
    landing: 0,
    lastAir: false,
    mode: "idle",
  };
  root.userData.outfit = { hair: tail, cape, skirt, staff, blades, bow };
  // Merge details per joint, preserving the articulated skeleton hierarchy.
  const nodes = [];
  root.traverse((o) => {
    if (o.isGroup) nodes.push(o);
  });
  for (const node of nodes) {
    const groups = new Map();
    for (const m of [...node.children])
      if (m.isMesh && !m.children.length) {
        if (!groups.has(m.material)) groups.set(m.material, []);
        groups.get(m.material).push(m);
      }
    for (const [mat, meshes] of groups) {
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        const geo = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        return geo.applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (merged) {
        part(node, merged, mat);
        for (const m of meshes) {
          m.removeFromParent();
          m.geometry.dispose();
        }
      }
    }
  }
  return root;
}
export function animateGisele(model, h, time, dt, weapon, charge = 0) {
  poseSurvivor(model, {
    speed: Math.min(8, Math.hypot(h.vx, h.vz)),
    dt,
    time,
    attack: h.pose,
    weapon: weapon === "bow" ? "bow" : "sword",
  });
  const outfit = model.userData.outfit;
  outfit.staff.visible = weapon === "staff";
  outfit.blades.visible = weapon === "blades";
  outfit.bow.visible = weapon === "bow";
  outfit.cape.rotation.x =
    0.1 +
    Math.sin(time * 7) * 0.04 +
    Math.min(0.4, Math.hypot(h.vx, h.vz) * 0.035);
  outfit.hair.rotation.x = Math.sin(time * 4) * 0.08;
  outfit.skirt.forEach(
    (p, i) =>
      (p.rotation.x = Math.sin(model.userData.rig.phase + i * Math.PI) * 0.14),
  );
  if (h.dash > 0) model.userData.rig.body.rotation.x = 0.45;
  if (charge > 0.5) {
    model.userData.rig.arms[1].rotation.x = -1.4;
    model.userData.rig.elbows[1].rotation.x = -0.7;
  }
}
