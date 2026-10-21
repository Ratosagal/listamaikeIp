import { test, expect } from "@playwright/test";
import { freshState, Rogue, KEY, restore } from "../src/rogue/simulation.js";
import {
  readProgress,
  writeProgress,
  exportProgress,
  importProgress,
  BACKUP,
} from "../src/rogue/storage.js";
function memory() {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
}
test("rolling backup recovers damaged primary and export imports all progress", () => {
  const store = memory(),
    s = freshState(7);
  writeProgress(store, s);
  s.meta.shards = 55;
  writeProgress(store, s);
  expect(importProgress(exportProgress(s)).meta.shards).toBe(55);
  expect(restore(store.getItem(BACKUP)).meta.shards).toBe(0);
  store.setItem(KEY, "broken");
  const recovered = readProgress(store);
  expect(recovered.source).toBe("backup");
  expect(recovered.recovered).toBe(true);
  expect(() => importProgress('{"game":"another-game"}')).toThrow();
  expect(() => importProgress("x".repeat(1048577))).toThrow();
});
test("ascensions scale enemies and results unlock once with bounded history", () => {
  const s = freshState(12),
    g = new Rogue(s);
  g.begin();
  const hp = s.enemies[0].maxHp;
  g.finish(true);
  g.finish(true);
  expect(s.meta.wins).toBe(1);
  expect(s.meta.records).toHaveLength(1);
  expect(s.meta.ascension).toBe(1);
  g.hub();
  s.meta.difficulty = 1;
  g.begin();
  expect(s.enemies[0].maxHp).toBeCloseTo(hp * 1.12);
  g.finish(true);
  expect(s.meta.ascension).toBe(2);
  expect(restore(JSON.stringify(s)).meta.records).toHaveLength(2);
});
test("victory epilogue, credits and save export/import work in the browser", async ({
  page,
}) => {
  const s = freshState(8),
    g = new Rogue(s);
  g.begin();
  s.run.room = 12;
  g.finish(true);
  await page.addInitScript(
    ({ KEY, s }) => localStorage.setItem(KEY, JSON.stringify(s)),
    { KEY, s },
  );
  await page.goto("/");
  await page.locator("#play").click();
  await page.locator("#endingButton").click();
  for (let i = 0; i < 3; i++) await page.locator("#endingNext").click();
  await expect(page.locator("#panelTitle")).toContainText("Obrigada");
  await page.locator("#creditsBack").click();
  await page.locator("#returnHub").click();
  await expect(page.locator("#difficulty option")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.locator("#pause").click();
  await page.locator("#settingsOpen").click();
  await page.locator("#progressOpen").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportSave").click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "gisele-progresso.json",
  );
  await page
    .locator("#importSave")
    .setInputFiles({
      name: "save.json",
      mimeType: "application/json",
      buffer: Buffer.from(exportProgress(s)),
    });
  await page.locator("#confirmImport").click();
  await expect(page.locator("#menu")).toBeVisible();
  expect(await page.evaluate(() => window.gisele.snapshot().meta.wins)).toBe(1);
});
