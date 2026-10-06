import * as THREE from "three";
// Original procedural textures and instanced decoration; no external assets.
export function dressWorld(scene, ground, solid) {
  let seed = 9827;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#96a596";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2800; i++) {
    const shade = 120 + Math.floor(random() * 70);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},.17)`;
    ctx.fillRect(
      random() * 128,
      random() * 128,
      1 + random() * 3,
      1 + random() * 3,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(65, 65);
  ground.material = ground.material.clone();
  ground.material.map = texture;
  const geo = new THREE.ConeGeometry(0.14, 0.55, 3),
    mat = new THREE.MeshStandardMaterial({
      color: 0x657b63,
      roughness: 1,
      flatShading: true,
    });
  const grass = new THREE.InstancedMesh(geo, mat, 420);
  const dummy = new THREE.Object3D();
  let count = 0;
  for (let i = 0; i < 1800 && count < 420; i++) {
    const x = (random() - 0.5) * 190,
      z = (random() - 0.5) * 190;
    if (
      Math.abs(x - 24) < 10 ||
      Math.abs(z + 25) < 8 ||
      Math.hypot(x, z) < 7 ||
      solid.some(
        (s) =>
          Math.abs(x - s.x) < s.w / 2 + 1 && Math.abs(z - s.z) < s.d / 2 + 1,
      )
    )
      continue;
    dummy.position.set(x, 0.25, z);
    dummy.scale.setScalar(0.6 + random() * 0.8);
    dummy.rotation.y = random() * Math.PI;
    dummy.updateMatrix();
    grass.setMatrixAt(count++, dummy.matrix);
  }
  grass.count = count;
  scene.add(grass);
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x506971,
    flatShading: true,
    roughness: 1,
  });
  for (let i = 0; i < 14; i++) {
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(18 + random() * 15, 15 + random() * 20, 5),
      stoneMat,
    );
    const angle = (i / 14) * Math.PI * 2;
    mountain.position.set(Math.cos(angle) * 133, 5, Math.sin(angle) * 133);
    scene.add(mountain);
  }
  const metal = new THREE.MeshStandardMaterial({
      color: 0x3b5157,
      roughness: 0.7,
    }),
    lampMat = new THREE.MeshStandardMaterial({
      color: 0xf5c688,
      emissive: 0xeeb87c,
      emissiveIntensity: 0.65,
    });
  for (let z = -65; z < 80; z += 24) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 5, 6),
      metal,
    );
    post.position.set(15, 2.5, z);
    scene.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), metal);
    arm.position.set(15.8, 4.9, z);
    scene.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), lampMat);
    lamp.position.set(16.4, 4.8, z);
    scene.add(lamp);
  }
  const colors = [0x576f75, 0x8b755f, 0x697b67];
  for (let i = 0; i < 6; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 4),
      new THREE.MeshStandardMaterial({ color: colors[i % 3], roughness: 0.95 }),
    );
    body.position.y = 0.8;
    group.add(body);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.65, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x40585d, roughness: 0.65 }),
    );
    roof.position.set(0, 1.55, -0.15);
    group.add(roof);
    for (const x of [-1, 1])
      for (const z of [-1.25, 1.25]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 0.25, 8),
          metal,
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.5, z);
        group.add(wheel);
      }
    group.position.set(i % 2 ? 31 : 17, 0, -70 + i * 27);
    group.rotation.y = i % 2 ? 0.12 : -0.15;
    scene.add(group);
    solid.push({
      x: group.position.x,
      z: group.position.z,
      w: 2.2,
      d: 4.3,
      car: true,
    });
  }
}
