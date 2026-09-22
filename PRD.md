# PRD — TURKEY SHOOT: Backyard Battle

A one-person shooter web game. Australian brush turkeys are attacking the player's
backyard, digging everything up. The player defends the veggie patch.

## 0. How to work (READ THIS FIRST)

- This project is being built by a Ralph Wiggum loop: each iteration is a FRESH
  context. Before doing anything, read `progress.txt` to learn the current state
  and what remains. APPEND to `progress.txt` at the end of every iteration:
  date, what you did, what passes, what remains, and the exact next steps.
- Work incrementally. Get a working vertical slice first, then polish.
- NEVER regress: after every change, run the full verification in section 9.
  If a check fails, fix it before finishing the iteration.
- Do not use external assets (no image files, no audio files, no CDN scripts).
  ALL graphics and sound must be procedurally generated in code.
- No npm dependencies. The game must run from plain files.
- If `DONE` exists in the project root, the game is finished. Do not touch it.

## 1. Concept

- Title: **TURKEY SHOOT** (subtitle: *Backyard Battle*).
- Setting: a sun-baked Australian suburban backyard at the foot of a mountain
  range (Toowoomba escarpment vibes). Blue sky, eucalyptus trees, corrugated
  iron fence, a Hills Hoist clothesline, and vegetable garden beds.
- Enemy: the Australian brush turkey (Alectura lathami) — black plumage, bald
  red head, bright yellow neck wattle, big fan tail. They burst out of dirt
  mounds and waddle/dart across the yard, tearing up the garden.
- The player is a homeowner with a (feather, not lead — keep it family-friendly:
  the "gun" shoots soft corks from a cork gun / slingshot vibe) defending the
  backyard. Turkeys are never gory: a hit pops them into a burst of feathers
  and they comically flap off / tumble.

## 2. Tech stack (EXACT, do not deviate)

- Plain HTML + CSS + vanilla JavaScript. Single `index.html` at project root,
  a `<canvas>` for the game, one or a few plain `.js` files loaded with plain
  `<script>` tags (no modules, no bundler, no framework, no TypeScript).
- Rendering: HTML5 Canvas 2D. Fixed logical resolution 1280x720, scaled to fit
  the window (letterboxed), crisp rendering, `requestAnimationFrame` loop with
  delta-time based movement.
- Server: `serve.js` — a tiny Node.js static file server (built on the built-in
  `http` module, ZERO npm deps) serving the project root on port 8137.
  `package.json` with a `start` script: `node serve.js`.
- Audio: Web Audio API, fully synthesised (oscillators + noise buffers + gain
  envelopes). No audio files. Audio must be created/resumed after the first
  user gesture (browser autoplay policy) and must never throw.
- Persistence: `localStorage` for the high score only.

## 3. Controls (must be SIMPLE and usable)

- Mouse move: aim (custom drawn crosshair; hide the OS cursor over the canvas).
- Left click / tap: shoot at the crosshair position.
- R key (or Space): reload the 6-shell magazine. Clicking with an empty mag
  plays an empty click. Reloading takes ~0.8s with a visible pump-action
  animation indicator.
- P or Esc: pause/resume. M: mute toggle.
- Everything must also work with basic touch (tap = aim + shoot) on mobile.

## 4. Gameplay

- Core loop: waves of turkeys invade; shoot them before they wreck the garden.
- **Garden health**: starts 100%. Each turkey that reaches a garden bed starts
  DIGGING: while digging it flings mulch and the health drains (~3%/s per
  digging turkey). Health 0% = game over ("Your backyard is rooted!").
- **Turkeys**:
  - Enter from the left/right screen edges or from dirt mounds that pop up
    anywhere on the ground with a dust burst.
  - Behaviours: WANDER (zig-zag waddle), DART (quick burst toward a garden),
    DIG (stop at a garden bed, bob head, throw mulch particles), FLEE (if the
    player shoots near them, they may panic and sprint).
  - Speeds and spawn rate scale with wave number.
- **Waves**: Wave N spawns `4 + 2*N` turkeys over the wave duration. When all
  turkeys in a wave are shot or all gardens are destroyed... actually: when all
  turkeys in the wave are dealt with, show a wave-break banner with an Aussie
  one-liner for ~2.5s, heal a small amount of garden (+10%), then next wave.
- **Boss — "BIG BAZZA"**: every 5th wave (wave 5, 10, ...). A comically huge
  turkey (3x size) with a health bar, needs ~10 hits, struts across the yard,
  periodically SCREAMS (audio + screen shake + cowering animation) and flings
  clods of dirt at the camera (dodge by... the clods obscure the screen briefly
  as dirt splats). Defeating Bazza drops a MEAT TRAY bonus (see power-ups).
- **Power-ups** (drop occasionally from shot turkeys, ~12% chance):
  - **Bunnings Snag** (sausage in bread): instantly reloads + +6 bonus shells.
  - **Meat Tray**: +500 points, screen flashes "MEAT TRAY!".
  - **Garden Gnome**: repairs the garden +15%.
  - Power-ups sit on the ground pulsing; click them to collect.
- **Scoring**: 100 per turkey, 25% bonus for mid-air/leaping hits ("air shot!"),
  combo multiplier for hits within 2s of each other (x2, x3, max x5).
  Score displayed as "TURKEY TOLL". High score persisted.
- **Turkeys are cute**: no blood. Hits produce feather bursts and the turkey
  somersaults off-screen.

## 5. Graphics direction (must be SLICK)

- Procedural Canvas 2D vector art with a polished, modern-flat look with
  chunky outlines (cartoon style). Gradients for sky (dawn blue → warm
  horizon), soft shadows under entities.
- Parallax background layers (drawn once to offscreen canvases for perf):
  1. Sky with sun, drifting clouds, distant mountain range silhouette.
  2. Eucalyptus trees + hills Hoist clothesline with hanging tea towels.
  3. Corrugated iron fence with rust streaks; a "Beware of Turkeys" sign.
  4. Ground: lawn with mowing stripes, three garden beds with tomato stakes,
    lettuce rows, a garden gnome.
- Garden beds visibly degrade as health drops (plants get uprooted, mounds of
  mulch appear, dirt spreads).
- **Turkey animation**: walking leg shuffle, head bob, wattle jiggle, tail fan
  flick, dust puffs on dart; on hit: feather-burst particles + comedic tumble.
- **Juice**: muzzle flash at crosshair, screen shake on shots/hits/Bazza
  scream, floating score popups ("+100", "AIR SHOT! +125", "COMBO x3"),
  hit-stop (30ms freeze) on hits, gentle idle animation everywhere.
- **HUD**: top-left TURKEY TOLL score; top-centre wave banner; top-right high
  score; bottom-left ammo as shotgun shell icons that deplete; bottom-right
  garden health bar styled as a wooden sign that tilts as health drops.
- Aussie mascot touch: a koala in a gum tree reacts (covers eyes) when you
  miss repeatedly. Optional but delightful.

## 6. Screens & flow

1. **Title screen**: big chunky "TURKEY SHOOT" logo (vector text with
   cartoon outline + drop shadow), a brush turkey strutting across, subtitle
   "Backyard Battle", "G'day mate! The bloody bush turkeys are tearing up
   your backyard again.", controls hint, "CLICK TO START", high score display.
2. **Playing**: game as above. Wave banners between waves.
3. **Game over**: "YOUR BACKYARD IS ROOTED!" with final TURKEY TOLL, best
   toll, wave reached, a deadpan Aussie quip, "CLICK TO HAVE ANOTHER GO".
4. **Pause overlay**: "HAVING A NAP (PAUSED)" + resume hint.

## 7. Audio (all synthesised)

- Cork-gun shot: short noise burst + pop (band-pass filtered).
- Empty click. Reload: two-stage clack-clack.
- Turkey squawk: warbly FM oscillator, varied pitch; squawk on hit, angry
  cluck while digging, big scream for Bazza.
- Mulch dig: soft scrunching noise loop while a turkey digs.
- Power-up pickup: cheerful two-note blip. Wave horn: didgeridoo-ish drone
  (low sawtooth with LFO). Game over: descending sad trombone-ish synth.
- Ambient: occasional kookaburra laugh (synth warble) every ~20s. Birds add
  to the Aussie atmosphere.
- Master mute (M) + everything must no-op safely if AudioContext fails.

## 8. Humour (essential — full Australian flavour)

- Commentary lines shown as a speech-bubble ticker at key moments, e.g.:
  - Wave start: "Here they come, the feathered mongrels!", "Strike a light,
    more of 'em!", "Wave 3 — it's like central station out here."
  - Big Bazza: "STREWTH! It's BIG BAZZA!", "He's a big bugga, eh!"
  - Bazza defeated: "HE'S DONE LIKE A DINNER!", "That's going in the smear
    sheet, mate!"
  - Miss streak: "You hit like a dropped pie, mate.", "My nan shoots
    straighter — and she's been dead 20 years."
  - Turkey digs: "Oi! Not the tomatoes!", "Me bloody petunias!"
  - Low garden: "The backyard's going to buggery, mate!"
  - Game over: "Your backyard is rooted.", "The turkeys won, mate. The
    turkeys... won."
- All text Australian English ("mate", "bloody", "strewth", "arvo"), deadpan
  and family-friendly.

## 9. Testing & verification (run after EVERY change)

Run from the project root:

1. `node --check serve.js` and `node --check game.js` (and any other JS files)
   — all must pass.
2. `node test.js` — a Node smoke test (zero npm deps) that: starts serve.js on
   port 8137, fetches `/` and asserts HTTP 200 + content contains `<canvas>`,
   asserts game.js is served with 200, then shuts down. Prints PASS/FAIL and
   exits non-zero on failure.
3. `npx playwright test` — Playwright test file `tests/game.spec.js` that:
   - loads http://localhost:8137 (start the server itself via
     `child_process.spawn`),
   - collects console errors and page errors — asserts ZERO,
   - clicks to start the game, waits, moves the mouse to a turkey position
     (compute from the page's exposed game state — expose
     `window.__TURKEY_TEST__ = { getTurkeys, getScore, getHealth, startGame }`
     for testability), clicks to shoot, asserts score can increase,
   - forces a game over (expose a debug hook, e.g. `window.__TURKEY_TEST__.damage(100)`),
     asserts the game over screen shows,
   - captures screenshots: title, gameplay, game over, into `shots/`.
4. Manual-ish visual check: screenshots in `shots/` must show a polished,
   colourful backyard scene with visible turkeys, HUD, crosshair.

Playwright installation: if `npx playwright` is unavailable, run
`npm install -D playwright` + `npx playwright install chromium` and note it in
progress.txt. This devDependency is the ONLY allowed npm install.

## 10. Definition of DONE (all must be true)

- [ ] `index.html`, `serve.js`, `package.json`, `game.js` (may be split into
      a few plain JS files), `test.js`, `tests/game.spec.js` exist.
- [ ] `node --check` passes on every JS file; `node test.js` prints PASS.
- [ ] Playwright test passes: zero console/page errors, game startable,
      score increments on a hit, game over screen reachable, screenshots
      captured in `shots/`.
- [ ] The game is genuinely playable and polished per sections 3–8: waves,
      digging turkeys, boss Big Bazza every 5th wave, power-ups, combo
      scoring, reload mechanic, pause, mute, high score persistence.
- [ ] Only when ALL of the above are true: create the file `DONE` in the
      project root containing the date and a one-line summary, and finish
      progress.txt with "STATUS: DONE".
