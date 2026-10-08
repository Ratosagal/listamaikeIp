import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Original articulated survivor. Everything is local, including the fabric texture.
export function createSurvivor(scene) {
  const root = new THREE.Group();
  root.name = "survivor";
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const fabric = document.createElement("canvas");
  fabric.width = fabric.height = 64;
  const ctx = fabric.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "#b6c2bf";
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 64; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 64);
    ctx.moveTo(0, i);
    ctx.lineTo(64, i);
    ctx.stroke();
  }
  const weave = new THREE.CanvasTexture(fabric);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(3, 3);
  const material = (color, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mats = {
    skin: material(0xc89573, 0.7),
    shirt: material(0x34575c),
    vest: material(0x293a36),
    pants: material(0x35464b),
    boot: material(0x202a2d),
    leather: material(0x755840),
    metal: material(0x9aa9a6, 0.35, 0.65),
    hair: material(0x2f2521),
    eye: material(0xe0d6bd),
    iris: material(0x395259),
    black: material(0x17252a),
    scarf: material(0xb88b58),
    seam: material(0x758079),
  };
  mats.shirt.map = weave;
  mats.pants.map = weave;
  const part = (parent, geometry, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const round = (parent, w, h, d, mat, x = 0, y = 0, z = 0, r = 0.045) =>
    part(parent, new RoundedBoxGeometry(w, h, d, 2, r), mat, x, y, z);
  const oval = (parent, x, y, z, sx, sy, sz, mat) => {
    const mesh = part(
      parent,
      new THREE.SphereGeometry(1, 16, 12),
      mat,
      x,
      y,
      z,
    );
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };
  const joint = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const torso = joint(body, 0, 1.22, 0);
  oval(torso, 0, 0.14, 0, 0.31, 0.4, 0.2, mats.shirt);
  round(torso, 0.58, 0.55, 0.36, mats.vest, 0, 0.17, -0.018, 0.08);
  // Layered collar, armored shoulders, stitching and zipped tactical vest.
  oval(torso, 0, 0.49, 0, 0.15, 0.12, 0.14, mats.scarf);
  round(torso, 0.028, 0.43, 0.025, mats.metal, 0, 0.19, -0.21, 0.008);
  for (const s of [-1, 1]) {
    round(torso, 0.21, 0.15, 0.055, mats.leather, s * 0.16, 0.22, -0.215, 0.02);
    round(torso, 0.16, 0.018, 0.065, mats.seam, s * 0.16, 0.29, -0.24, 0.004);
    round(torso, 0.075, 0.61, 0.045, mats.leather, s * 0.21, 0.14, 0.2, 0.012);
    round(torso, 0.1, 0.035, 0.06, mats.metal, s * 0.21, -0.06, 0.225, 0.006);
  }
  const pelvis = joint(body, 0, 1.0, 0);
  oval(pelvis, 0, 0, 0, 0.28, 0.18, 0.18, mats.pants);
  round(pelvis, 0.55, 0.075, 0.35, mats.leather, 0, 0.075, 0, 0.02);
  round(pelvis, 0.095, 0.075, 0.03, mats.metal, 0, 0.075, -0.19, 0.007);
  for (const s of [-1, 1])
    round(pelvis, 0.15, 0.17, 0.13, mats.leather, s * 0.32, 0, 0.02, 0.025);
  const pack = round(
    torso,
    0.43,
    0.51,
    0.22,
    mats.leather,
    0,
    0.16,
    0.29,
    0.06,
  );
  round(pack, 0.33, 0.18, 0.055, mats.vest, 0, -0.07, 0.13, 0.025);
  for (const s of [-1, 1])
    round(pack, 0.035, 0.4, 0.035, mats.scarf, s * 0.14, 0.02, 0.14, 0.005);
  // Gas canisters and cable launcher holsters.
  for (const s of [-1, 1]) {
    const tank = part(
      pelvis,
      new THREE.CylinderGeometry(0.073, 0.073, 0.24, 12),
      mats.metal,
      s * 0.34,
      -0.04,
      0.14,
    );
    tank.rotation.z = s * 0.15;
    round(pelvis, 0.13, 0.14, 0.18, mats.black, s * 0.37, -0.08, -0.075, 0.025);
  }
  const head = joint(torso, 0, 0.63, 0);
  part(
    head,
    new THREE.CylinderGeometry(0.075, 0.09, 0.15, 12),
    mats.skin,
    0,
    -0.09,
    0,
  );
  oval(head, 0, 0.13, 0, 0.18, 0.245, 0.175, mats.skin);
  oval(head, 0, 0.015, -0.055, 0.13, 0.1, 0.125, mats.skin);
  for (const s of [-1, 1]) {
    oval(head, s * 0.181, 0.12, 0.006, 0.038, 0.064, 0.029, mats.skin);
    oval(head, s * 0.066, 0.16, -0.158, 0.035, 0.021, 0.018, mats.eye);
    oval(head, s * 0.066, 0.159, -0.174, 0.013, 0.014, 0.006, mats.iris);
    round(
      head,
      0.073,
      0.014,
      0.013,
      mats.hair,
      s * 0.065,
      0.202,
      -0.154,
      0.004,
    );
  }
  oval(head, 0, 0.12, -0.183, 0.028, 0.05, 0.04, mats.skin);
  round(head, 0.07, 0.009, 0.008, mats.leather, 0, 0.022, -0.158, 0.003);
  const hair = oval(head, 0, 0.285, 0.025, 0.185, 0.112, 0.171, mats.hair);
  for (let i = 0; i < 7; i++) {
    const tuft = oval(
      head,
      (i - 3) * 0.047,
      0.27,
      -0.09,
      0.036,
      0.083,
      0.079,
      mats.hair,
    );
    tuft.rotation.z = -0.25;
  }
  // Upper limbs and separate elbow, wrist, knee and ankle pivots.
  const arms = [],
    elbows = [],
    hands = [],
    legs = [],
    knees = [],
    feet = [];
  for (const s of [-1, 1]) {
    const arm = joint(torso, s * 0.355, 0.39, 0);
    arms.push(arm);
    oval(arm, 0, -0.08, 0, 0.125, 0.17, 0.135, mats.shirt);
    round(arm, 0.2, 0.095, 0.24, mats.vest, 0, -0.03, 0, 0.045);
    part(
      arm,
      new THREE.CapsuleGeometry(0.09, 0.19, 4, 10),
      mats.shirt,
      0,
      -0.21,
      0,
    );
    const elbow = joint(arm, 0, -0.36, 0);
    elbows.push(elbow);
    part(
      elbow,
      new THREE.CapsuleGeometry(0.072, 0.19, 4, 10),
      mats.shirt,
      0,
      -0.17,
      0,
    );
    round(elbow, 0.145, 0.09, 0.16, mats.leather, 0, -0.27, 0, 0.02);
    const hand = joint(elbow, 0, -0.35, 0);
    hands.push(hand);
    round(hand, 0.13, 0.15, 0.12, mats.boot, 0, -0.04, 0, 0.035);
    oval(hand, -s * 0.075, -0.045, -0.02, 0.027, 0.053, 0.037, mats.skin);
    for (let finger = 0; finger < 3; finger++)
      round(
        hand,
        0.024,
        0.057,
        0.05,
        mats.boot,
        (finger - 1) * 0.037,
        -0.12,
        -0.005,
        0.012,
      );
    const leg = joint(pelvis, s * 0.16, -0.09, 0);
    legs.push(leg);
    part(
      leg,
      new THREE.CapsuleGeometry(0.12, 0.21, 4, 12),
      mats.pants,
      0,
      -0.22,
      0,
    );
    round(leg, 0.13, 0.16, 0.06, mats.vest, s * 0.11, -0.2, 0, 0.02);
    const knee = joint(leg, 0, -0.4, 0);
    knees.push(knee);
    round(knee, 0.18, 0.14, 0.07, mats.leather, 0, -0.01, -0.105, 0.025);
    part(
      knee,
      new THREE.CapsuleGeometry(0.092, 0.22, 4, 12),
      mats.pants,
      0,
      -0.17,
      0,
    );
    const foot = joint(knee, 0, -0.34, 0);
    feet.push(foot);
    round(foot, 0.22, 0.18, 0.36, mats.boot, 0, -0.05, -0.06, 0.04);
    round(foot, 0.225, 0.035, 0.37, mats.black, 0, -0.13, -0.06, 0.01);
    for (let lace = 0; lace < 3; lace++)
      round(
        foot,
        0.11,
        0.013,
        0.013,
        mats.seam,
        0,
        0.04 - lace * 0.025,
        -0.16,
        0.004,
      );
  }
  root.userData.arms = arms;
  root.userData.legs = legs;
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
    pack,
    hair,
    phase: 0,
    speed: 0,
    lean: 0,
    air: 0,
    landing: 0,
    lastAir: false,
    mode: "idle",
  };
  // Merge only pieces belonging to the same joint; articulation stays intact.
  const joints = [];
  root.traverse((o) => {
    if (o.isGroup) joints.push(o);
  });
  for (const node of joints) {
    const groups = new Map();
    for (const mesh of [...node.children])
      if (mesh.isMesh && !mesh.children.length) {
        if (!groups.has(mesh.material)) groups.set(mesh.material, []);
        groups.get(mesh.material).push(mesh);
      }
    for (const [mat, meshes] of groups) {
      if (meshes.length < 2) continue;
      const copies = meshes.map((m) => {
        m.updateMatrix();
        const g = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        return g.applyMatrix4(m.matrix);
      });
      const geometry = mergeGeometries(copies);
      copies.forEach((g) => g.dispose());
      if (!geometry) continue;
      const combined = new THREE.Mesh(geometry, mat);
      combined.castShadow = combined.receiveShadow = true;
      node.add(combined);
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
    }
  }
  return root;
}
const damp = (a, b, rate, dt) =>
  THREE.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));
export function poseSurvivor(
  root,
  {
    speed = 0,
    dt = 1 / 60,
    time = 0,
    attack = 0,
    airborne = false,
    hooks = 0,
    vertical = 0,
    strafe = 0,
    forward = 1,
    weapon = "sword",
  } = {},
) {
  const r = root.userData.rig;
  r.speed = damp(r.speed, speed, 9, dt);
  const amount = Math.min(1, r.speed / 4.5),
    sprint = Math.max(0, Math.min(1, (r.speed - 4.5) / 3));
  // Advance by distance instead of global time: starting and stopping never snap gait.
  r.phase += dt * r.speed * (1.95 - sprint * 0.32);
  r.air = damp(r.air, airborne ? 1 : 0, 12, dt);
  if (r.lastAir && !airborne) r.landing = 0.1;
  r.lastAir = airborne;
  r.landing = damp(r.landing, 0, 12, dt);
  const gait = 1 - r.air,
    phase = r.phase,
    stroke = Math.sin(attack * Math.PI);
  r.mode =
    attack > 0
      ? "attack"
      : airborne
        ? hooks
          ? "grapple"
          : vertical > 0
            ? "jump"
            : "fall"
        : r.speed > 5.5
          ? "run"
          : r.speed > 0.2
            ? "walk"
            : "idle";
  r.body.position.y =
    Math.abs(Math.sin(phase)) * 0.045 * amount * gait +
    Math.sin(time * 2) * 0.007 * (1 - amount) -
    r.landing;
  r.body.rotation.x = damp(
    r.body.rotation.x,
    sprint * 0.13 * forward + r.air * 0.15,
    10,
    dt,
  );
  r.body.rotation.z = damp(r.body.rotation.z, -strafe * amount * 0.08, 9, dt);
  r.torso.rotation.y = Math.sin(phase) * 0.045 * amount * gait - stroke * 0.28;
  r.head.rotation.y = -r.torso.rotation.y * 0.6;
  r.head.rotation.x = r.air * -0.1;
  for (let i = 0; i < 2; i++) {
    const cycle = phase + i * Math.PI,
      wave = Math.sin(cycle),
      lift = Math.max(0, -wave);
    r.legs[i].rotation.x =
      wave * (0.55 + sprint * 0.22) * amount * gait * forward +
      r.air * (i === 0 ? -0.45 : 0.35);
    r.legs[i].rotation.z = strafe * wave * 0.16 * amount * gait;
    r.knees[i].rotation.x = -(
      lift * (0.65 + sprint * 0.5) * amount * gait +
      r.air * (hooks ? 0.7 : 0.5)
    );
    r.feet[i].rotation.x = Math.max(0, wave) * 0.2 * amount * gait;
    r.arms[i].rotation.x =
      -wave * (0.34 + sprint * 0.28) * amount * gait -
      r.air * (hooks ? 1.7 : 0.5);
    r.arms[i].rotation.z = (i === 0 ? -0.1 : 0.1) * (1 + r.air * 2);
    r.elbows[i].rotation.x = -(
      0.15 +
      sprint * 0.5 +
      r.air * 0.45 +
      lift * 0.18 * amount
    );
  }
  if (attack > 0) {
    r.arms[1].rotation.x -= stroke * 1.8;
    r.arms[1].rotation.z += stroke * 0.6;
    r.elbows[1].rotation.x -= stroke * 0.3;
  }
  if (weapon === "bow" || weapon === "gun") {
    r.arms[1].rotation.x -= 0.45 * (1 - r.air);
    r.elbows[1].rotation.x -= 0.65 * (1 - r.air);
  }
}
