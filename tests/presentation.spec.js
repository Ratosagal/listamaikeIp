import { test, expect } from "@playwright/test";
async function launch(page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "vigilia-settings",
      JSON.stringify({ quality: "low", music: 0, effects: 0 }),
    );
    localStorage.setItem(
      "vigilia-v1",
      JSON.stringify({
        time: 180,
        health: 100,
        player: { x: 16, z: -20 },
        base: { x: 0, z: 0 },
        inventory: {
          wood: 100,
          stone: 100,
          scrap: 100,
          arrows: 10,
          ammo: 10,
          capsules: 3,
        },
        weapons: ["sword", "bow", "gun"],
        weapon: "sword",
        creatures: [],
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
  await page.locator("#play").click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
}
test("articulated gait blends between walk, sprint and idle without idle camera turning the body", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await launch(page);
  expect(
    await page.evaluate(() => vigilia.character().batchedSurfaces),
  ).toBeGreaterThan(100);
  await page.keyboard.down("KeyS");
  await expect
    .poll(() => page.evaluate(() => vigilia.character().mode))
    .toBe("walk");
  await expect
    .poll(() =>
      page.evaluate(() => vigilia.character().joints.some((x) => x < -0.05)),
    )
    .toBeTruthy();
  await page.keyboard.down("ShiftLeft");
  await expect
    .poll(() => page.evaluate(() => vigilia.character().mode))
    .toBe("run");
  await page.keyboard.up("KeyS");
  await page.keyboard.up("ShiftLeft");
  await expect
    .poll(() => page.evaluate(() => vigilia.character().speed))
    .toBeLessThan(0.1);
  const facing = await page.evaluate(() => vigilia.character().facing);
  const camera = await page.evaluate(() => vigilia.view().camera);
  await page.mouse.move(450, 350);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(700, 350, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate(() => vigilia.view().camera[0]))
    .not.toBe(camera[0]);
  expect(await page.evaluate(() => vigilia.character().facing)).toBeCloseTo(
    facing,
    4,
  );
  expect(
    await page.evaluate(() => vigilia.view().camera.every(Number.isFinite)),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("jump preserves ground momentum and blends into a landing pose", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.down("KeyS");
  await expect
    .poll(() => page.evaluate(() => vigilia.character().speed))
    .toBeGreaterThan(3);
  const before = await page.evaluate(() => vigilia.snapshot().player);
  await page.keyboard.press("Space");
  await page.keyboard.up("KeyS");
  await expect
    .poll(() => page.evaluate(() => vigilia.aerial().height))
    .toBeGreaterThan(0.5);
  await expect
    .poll(() =>
      page.evaluate(
        (before) =>
          Math.hypot(
            vigilia.snapshot().player.x - before.x,
            vigilia.snapshot().player.z - before.z,
          ),
        before,
      ),
    )
    .toBeGreaterThan(0.7);
  await expect.poll(() => page.evaluate(() => vigilia.aerial().height)).toBe(0);
  await expect
    .poll(() => page.evaluate(() => vigilia.character().mode))
    .toBe("idle");
});
test("holding the attack button repeats fire and releasing it stops consuming ammunition", async ({
  page,
}) => {
  await launch(page);
  await page.keyboard.press("Digit3");
  await page.mouse.move(600, 350);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => vigilia.snapshot().inventory.ammo))
    .toBeLessThan(9);
  await page.mouse.up();
  await page.evaluate(() => document.exitPointerLock());
  const ammo = await page.evaluate(() => vigilia.snapshot().inventory.ammo);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => vigilia.snapshot().inventory.ammo)).toBe(
    ammo,
  );
});
