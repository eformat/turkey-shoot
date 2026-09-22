'use strict';
// TURKEY SHOOT — Playwright end-to-end test.
// Starts serve.js itself, loads the game, plays, forces game over, captures screenshots.
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:8137';
const SHOTS = path.join(ROOT, 'shots');

fs.mkdirSync(SHOTS, { recursive: true });

let server;

test.beforeAll(async () => {
  server = spawn(process.execPath, [path.join(ROOT, 'serve.js')], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('serve.js did not start on port 8137');
});

test.afterAll(async () => {
  if (server) {
    try { server.kill(); } catch (e) {}
  }
});

test('turkey shoot: start, hit a turkey, reach game over, zero errors', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE + '/');

  // Title screen
  await page.waitForSelector('body[data-screen="title"]');
  await page.screenshot({ path: path.join(SHOTS, 'title.png') });

  // Start the game
  await page.locator('canvas').click();
  await page.waitForSelector('body[data-screen="playing"]');

  // Wait for turkeys, then move mouse onto one and click to shoot.
  const box = await page.locator('canvas').boundingBox();
  let score = await page.evaluate(() => window.__TURKEY_TEST__.getScore());

  for (let attempt = 0; attempt < 40 && score === 0; attempt++) {
    const ammo = await page.evaluate(() => window.__TURKEY_TEST__.getAmmo());
    if (ammo <= 0) {
      await page.evaluate(() => window.__TURKEY_TEST__.reload());
      await page.waitForTimeout(1100);
      continue;
    }
    const turkeys = await page.evaluate(() => window.__TURKEY_TEST__.getTurkeys());
    const onScreen = turkeys.filter((t) => t.x > 80 && t.x < 1200 && t.y > 400 && t.y < 710);
    if (!onScreen.length) {
      await page.waitForTimeout(250);
      continue;
    }
    const t = onScreen[0];
    const px = box.x + t.x * (box.width / 1280);
    const py = box.y + t.y * (box.height / 720);
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
    score = await page.evaluate(() => window.__TURKEY_TEST__.getScore());
  }

  expect(score).toBeGreaterThan(0);

  // Let gameplay breathe for the screenshot
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(SHOTS, 'gameplay.png') });

  // Force game over via debug hook
  await page.evaluate(() => window.__TURKEY_TEST__.damage(100));
  await page.waitForSelector('body[data-screen="gameover"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOTS, 'gameover.png') });

  // Zero console/page errors
  expect(errors).toEqual([]);
});
