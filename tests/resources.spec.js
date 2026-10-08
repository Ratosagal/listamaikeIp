import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { instanceResources } from "../src/systems/resource-batches.js";

test("resource instances preserve different radii and hide only the collected resource", () => {
  const scene = new THREE.Scene(),
    material = new THREE.MeshStandardMaterial();
  const resources = [1, 2].map((radius, index) => {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(radius, 1),
      material,
    );
    mesh.position.set(index * 5, 1, 0);
    scene.add(mesh);
    return { mesh, amount: 4 };
  });
  const rendering = instanceResources(scene, resources);
  expect(rendering.batches).toBe(1);
  const batch = scene.children.find((o) => o.isInstancedMesh),
    matrix = new THREE.Matrix4();
  batch.getMatrixAt(1, matrix);
  expect(matrix.elements[0]).toBe(2);
  expect(matrix.elements[12]).toBe(5);
  resources[0].amount = 0;
  resources[0].mesh.visible = false;
  rendering.update();
  batch.getMatrixAt(0, matrix);
  expect(matrix.elements[0]).toBe(0);
  batch.getMatrixAt(1, matrix);
  expect(matrix.elements[0]).toBe(2);
  expect(batch.instanceMatrix.version).toBeGreaterThan(0);
});

test("collecting an instanced tree removes it and preserves inventory after reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "vigilia-settings",
      JSON.stringify({ quality: "low", music: 0, effects: 0 }),
    );
    if (sessionStorage.getItem("resource-test")) return;
    sessionStorage.setItem("resource-test", "1");
    localStorage.setItem(
      "vigilia-v1",
      JSON.stringify({
        time: 180,
        health: 100,
        player: { x: 0, z: 0 },
        base: { x: 0, z: 0 },
        inventory: {
          wood: 10,
          stone: 10,
          scrap: 10,
          arrows: 0,
          ammo: 0,
          capsules: 3,
        },
        weapons: ["sword"],
        weapon: "sword",
        creatures: [
          { type: 0, hp: 100, x: 2, z: 0, role: "companion", level: 1, xp: 0 },
        ],
        structures: [],
        colossi: [],
        zombieSnapshot: [],
        lastHorde: 0,
        kills: 0,
      }),
    );
  });
  await page.goto("/");
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.evaluate(() => {
    const state = vigilia.snapshot(),
      tree = vigilia.entities().resources[0];
    state.player = { x: tree.x, z: tree.z };
    state.creatures[0].x = tree.x + 1;
    state.creatures[0].z = tree.z;
    localStorage.setItem("vigilia-v1", JSON.stringify(state));
  });
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  await page.locator("#play").click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
  expect(
    await page.evaluate(() => vigilia.character().resourceBatches),
  ).toBeLessThan(10);
  await page.keyboard.press("KeyE");
  await expect
    .poll(() => page.evaluate(() => vigilia.entities().resources[0].amount))
    .toBe(0);
  expect(await page.evaluate(() => vigilia.snapshot().inventory.wood)).toBe(15);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.waitForFunction(() => window.vigilia?.ready);
  expect(
    await page.evaluate(() => vigilia.entities().resources[0].amount),
  ).toBe(0);
  expect(await page.evaluate(() => vigilia.snapshot().inventory.wood)).toBe(15);
  expect(errors).toEqual([]);
});
