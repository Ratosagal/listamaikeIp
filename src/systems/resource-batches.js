import * as THREE from "three";

// Resource state keeps its original handles; foliage and rocks share draw calls.
export function instanceResources(scene, resources) {
  scene.updateMatrixWorld(true);
  const buckets = new Map(),
    entries = [];
  for (const resource of resources) {
    resource.mesh.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const parameters = { ...mesh.geometry.parameters };
      const radius =
        mesh.geometry.type === "DodecahedronGeometry" ? parameters.radius : 1;
      if (mesh.geometry.type === "DodecahedronGeometry") parameters.radius = 1;
      const key = `${mesh.geometry.type}:${JSON.stringify(parameters)}:${mesh.material.uuid}`;
      if (!buckets.has(key)) {
        const geometry = mesh.geometry.clone();
        if (radius !== 1) geometry.scale(1 / radius, 1 / radius, 1 / radius);
        buckets.set(key, { geometry, material: mesh.material, parts: [] });
      }
      const matrix = mesh.matrixWorld.clone();
      if (radius !== 1) matrix.scale(new THREE.Vector3(radius, radius, radius));
      const entry = { resource, matrix, index: 0, batch: null, visible: null };
      buckets.get(key).parts.push(entry);
      entries.push(entry);
    });
  }
  const invisible = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const bucket of buckets.values()) {
    const batch = new THREE.InstancedMesh(
      bucket.geometry,
      bucket.material,
      bucket.parts.length,
    );
    batch.name = "harvestable-resources";
    batch.castShadow = batch.receiveShadow = true;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    bucket.parts.forEach((entry, index) => {
      entry.index = index;
      entry.batch = batch;
      entry.visible = entry.resource.amount > 0 && entry.resource.mesh.visible;
      batch.setMatrixAt(index, entry.visible ? entry.matrix : invisible);
    });
    batch.computeBoundingSphere();
    scene.add(batch);
  }
  for (const resource of resources) resource.mesh.removeFromParent();
  return {
    batches: buckets.size,
    update() {
      for (const entry of entries) {
        const visible =
          entry.resource.amount > 0 && entry.resource.mesh.visible;
        if (visible === entry.visible) continue;
        entry.visible = visible;
        entry.batch.setMatrixAt(
          entry.index,
          visible ? entry.matrix : invisible,
        );
        entry.batch.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
