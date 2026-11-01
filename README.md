# Speedball

A small soccer playground: a smoothly bouncing ball, adjustable speed, and a new direction with every kick.

**Play:** https://fernandohmachado8.github.io/speedball/

## Play

- **Free play:** click or tap the ball to kick it. There is no time limit.
- **30-second sprint:** collect as many touches as possible before the clock runs out.
- Adjust the speed slider or choose Chill, Classic, or Turbo.
- Pitch clicks that miss the ball reduce accuracy. Wall bounces are counted separately.
- Pause, resume, reset, and toggle the optional motion trail.
- A completed sprint can set a personal record, saved only in this browser. When storage is blocked, it lasts for the current visit.

Keyboard: Space plays or pauses when not focused on a control. R resets. Tab to the moving ball and press Enter or Space to kick it. Standard input and button keyboard behavior is preserved. Opening instructions or leaving the tab pauses play automatically.

The game starts still. Reduced-motion preferences disable optional ball rotation, kick movement effects, and the default trail. Ball movement is the essential interaction and starts only when you choose to play.

## Run locally

This is a static site with native JavaScript modules. Serve it over HTTP (opening index.html as a file will not load modules). With Python installed:

```sh
python -m http.server 8000
```

Open http://localhost:8000. No dependency installation or build is required.

## Check

With Node.js installed:

```sh
npm test
npm run check
```

The pure physics tests cover elapsed-time motion, multiple wall bounces, corners, changing speed, resizing, tiny fields, and stationary states. Manual browser checks cover play/pause/reset, scoring and accuracy, sprint completion, best-score persistence, visibility pausing, keyboard controls, speed changes, and responsive layouts.

## Project structure

- `index.html`: page, pitch, controls, and instructions.
- `styles.css`: responsive layout, field markings, and visual effects.
- `app.js`: session state, input, rendering, and browser-local personal records.
- `physics.js`: independent ball movement and collision calculations.
- `assets/`: original, locally hosted soccer-ball SVG and favicon.
- `tests/physics.test.mjs`: native Node test suite.

All visible artwork is original and local. There are no external runtime assets, trackers, accounts, or backend services. The best sprint is a casual personal score across all speeds and input methods, not a competitive leaderboard.

## GitHub Pages

The root of `main` is the publishing source. Under Settings → Pages, select Deploy from a branch → main → / (root). Pushes to main deploy automatically. Relative asset paths support the `/speedball/` project URL.

The original 2024 movement experiments and assets are preserved in Git history. The finished version replaces the broken interval-based movement and speed controls with requestAnimationFrame and elapsed-time physics.

A project by Fernando Machado.
