'use strict';
// TURKEY SHOOT — zero-dependency Node smoke test.
// Starts serve.js on port 8137, fetches / and /game.js, asserts basics, shuts down.
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8137;
const BASE = 'http://localhost:' + PORT;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return true;
    } catch (e) { /* not up yet */ }
    await wait(100);
  }
  return false;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve.js')], { stdio: 'ignore' });
  let failed = false;
  try {
    const up = await waitForServer();
    assert(up, 'serve.js did not come up on port ' + PORT);

    const home = await fetch(BASE + '/');
    assert(home.status === 200, 'GET / expected 200, got ' + home.status);
    const body = await home.text();
    assert(body.includes('<canvas'), 'index.html must contain <canvas>');
    assert(body.includes('game.js'), 'index.html must load game.js');

    const js = await fetch(BASE + '/game.js');
    assert(js.status === 200, 'GET /game.js expected 200, got ' + js.status);
    const jsBody = await js.text();
    assert(jsBody.includes('__TURKEY_TEST__'), 'game.js must expose __TURKEY_TEST__ hooks');

    const missing = await fetch(BASE + '/nope.txt');
    assert(missing.status === 404, 'GET /nope.txt expected 404, got ' + missing.status);

    console.log('PASS');
  } catch (e) {
    console.error('FAIL: ' + e.message);
    failed = true;
  } finally {
    try { server.kill(); } catch (e) {}
  }
  process.exit(failed ? 1 : 0);
}

main();
