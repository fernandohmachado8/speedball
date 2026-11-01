import { createBall, stepBall, clampBall, setBallSpeed } from "./physics.js";

const $ = (selector) => document.querySelector(selector);
const pitch = $("#pitch");
const ballElement = $("#ball");
const ballImage = ballElement.querySelector("img");
const overlay = $("#pitch-overlay");
const speedInput = $("#speed");
const trailInput = $("#trail");
const trailLayer = $("#ball-trail");
const effects = $("#effects");
const dialog = $("#how-to-dialog");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const RECORD_KEY = "speedball.best-sprint.v1";
const SPRINT_SECONDS = 30;
const state = {
  phase: "ready",
  mode: "free",
  speed: 1,
  touches: 0,
  misses: 0,
  bounces: 0,
  remaining: SPRINT_SECONDS,
  best: 0,
};
let storageAvailable = true;
let ball;
let bounds;
let animationId = null;
let lastFrame = null;
let trailAge = 0;
let trailHistory = [];
let newRecord = false;
let lastClockValue = "";

try {
  const stored = Number(localStorage.getItem(RECORD_KEY));
  if (Number.isSafeInteger(stored) && stored >= 0) state.best = stored;
} catch {
  storageAvailable = false;
}

// The game starts still; reduced motion also disables optional trails and spin.
trailInput.checked = !reducedMotion.matches;
pitch.tabIndex = -1;
const trailDots = Array.from({ length: 9 }, () => {
  const dot = document.createElement("span");
  dot.className = "trail-dot";
  trailLayer.append(dot);
  return dot;
});

function announce(message) {
  $("#announcement").textContent = message;
}
function actualSpeed() {
  return Math.min(bounds.width, bounds.height) * 0.66 * state.speed;
}
function renderBall() {
  ballElement.style.transform = `translate3d(${ball.x - bounds.radius}px, ${ball.y - bounds.radius}px, 0)`;
  ballImage.style.transform = reducedMotion.matches
    ? "none"
    : `rotate(${ball.rotation}deg)`;
}
function clearTrail() {
  trailHistory = [];
  trailAge = 0;
  trailDots.forEach((dot) => {
    dot.style.opacity = "0";
  });
}
function updateTrail(delta) {
  if (!trailInput.checked) return;
  trailAge += delta;
  if (trailAge >= 0.035) {
    trailAge = 0;
    trailHistory.unshift({ x: ball.x, y: ball.y });
    trailHistory.length = Math.min(trailHistory.length, trailDots.length);
  }
  trailDots.forEach((dot, index) => {
    const position = trailHistory[index];
    if (!position) return;
    const size = 1 - index / trailDots.length;
    dot.style.transform = `translate3d(${position.x - 6}px, ${position.y - 6}px, 0) scale(${size})`;
    dot.style.opacity = String(size * 0.25);
  });
}
function resizeBoard() {
  const previous = bounds;
  bounds = {
    width: Math.max(1, pitch.clientWidth),
    height: Math.max(1, pitch.clientHeight),
    radius: ballElement.offsetWidth / 2,
  };
  if (!ball) ball = createBall(bounds, actualSpeed());
  else {
    ball.x *= bounds.width / previous.width;
    ball.y *= bounds.height / previous.height;
    clampBall(ball, bounds);
    setBallSpeed(ball, actualSpeed());
  }
  clearTrail();
  renderBall();
}
function updateStats() {
  $("#touches").textContent = String(state.touches).padStart(2, "0");
  const attempts = state.touches + state.misses;
  $("#accuracy").innerHTML =
    `${attempts ? Math.round((state.touches / attempts) * 100) : "—"}<small>%</small>`;
  $("#bounces").textContent = String(state.bounces).padStart(2, "0");
  $("#best").textContent = String(state.best).padStart(2, "0");
  $("#best-caption").textContent = storageAvailable
    ? "Your personal record"
    : "Record for this visit";
}
function updateClock() {
  const value =
    state.mode === "free"
      ? "∞"
      : `0:${String(Math.max(0, Math.ceil(state.remaining))).padStart(2, "0")}`;
  if (value !== lastClockValue) {
    $("#clock").textContent = value;
    lastClockValue = value;
  }
  $("#clock-label").textContent =
    state.mode === "free"
      ? "Room to play"
      : state.phase === "finished"
        ? "Full time"
        : "Time on the clock";
  $("#clock-progress").hidden = state.mode === "free";
  $("#clock-progress-fill").style.width =
    `${Math.max(0, (state.remaining / SPRINT_SECONDS) * 100)}%`;
  const pitchCountdown = $("#pitch-countdown");
  if (pitchCountdown && pitchCountdown.textContent !== value) {
    pitchCountdown.textContent = value;
  }
}
function renderControls() {
  const running = state.phase === "running";
  const paused = state.phase === "paused";
  const finished = state.phase === "finished";
  pitch.dataset.phase = state.phase;
  overlay.hidden = running;
  ballElement.disabled = !running;
  ballElement.tabIndex = running ? 0 : -1;
  $("#pitch-status").textContent = running
    ? "Ball in play"
    : paused
      ? "Taking a breather"
      : finished
        ? "Full time. Well played."
        : "Ready for kickoff";
  $("#status-dot").classList.toggle("is-live", running);
  $("#pitch-mode").innerHTML =
    state.mode === "free"
      ? 'FREE PLAY <span aria-hidden="true">∞</span>'
      : 'SPRINT <span class="pitch-countdown" id="pitch-countdown">0:30</span>';
  $("#play-label").textContent = running
    ? "Pause"
    : paused
      ? "Resume"
      : finished
        ? "Play again"
        : "Start playing";
  $("#play-icon").setAttribute(
    "d",
    running ? "M5 3h3v14H5zM12 3h3v14h-3z" : "m6 3 10 7-10 7Z",
  );
  $("#overlay-eyebrow").textContent = finished
    ? newRecord
      ? "A NEW PERSONAL BEST"
      : "THAT’S A WRAP"
    : paused
      ? "A LITTLE HALF-TIME"
      : "NO BOOTS REQUIRED";
  $("#overlay-title").textContent = finished
    ? `${state.touches} touches. Nice work.`
    : paused
      ? "Take a breather."
      : state.mode === "sprint"
        ? "30 seconds. All you."
        : "Your pitch. Your pace.";
  $("#overlay-description").textContent = finished
    ? newRecord
      ? "A new number to beat. Fancy another round?"
      : "Every round is a fresh chance. Go again?"
    : paused
      ? "Your ball and your clock are right where you left them."
      : state.mode === "sprint"
        ? "Chase the ball. Beat the clock. Set your personal best."
        : "Chase the ball. Click to kick. Find your flow.";
  $("#overlay-button-label").textContent = finished
    ? "One more go"
    : paused
      ? "Back to it"
      : "Let’s play";
  $("#overlay-footnote").textContent = finished
    ? `Accuracy: ${state.touches + state.misses ? Math.round((state.touches / (state.touches + state.misses)) * 100) : 0}% · Best sprint: ${state.best} touches`
    : paused
      ? "No rush. Good things take a little pause."
      : state.mode === "free"
        ? "Free play · No timer, just good touches"
        : "30-second sprint · Every touch counts";
  $("#pitch-tip").textContent = finished
    ? "A fresh start is one click away."
    : "Click or tap the ball to give it a kick.";
  updateClock();
}
function stopFrames() {
  if (animationId !== null) cancelAnimationFrame(animationId);
  animationId = null;
  lastFrame = null;
}
function resetSession(shouldAnnounce = true) {
  stopFrames();
  state.phase = "ready";
  state.touches = 0;
  state.misses = 0;
  state.bounces = 0;
  state.remaining = SPRINT_SECONDS;
  newRecord = false;
  ball = createBall(bounds, actualSpeed());
  clearTrail();
  effects.replaceChildren();
  renderBall();
  updateStats();
  renderControls();
  if (shouldAnnounce) announce("Fresh session. Ready when you are.");
}
function finishSprint() {
  stopFrames();
  state.remaining = 0;
  state.phase = "finished";
  newRecord = state.touches > state.best;
  if (newRecord) {
    state.best = state.touches;
    try {
      localStorage.setItem(RECORD_KEY, String(state.best));
    } catch {
      storageAvailable = false;
    }
  }
  clearTrail();
  updateStats();
  renderControls();
  overlay.querySelector("button").focus({ preventScroll: true });
  announce(
    `Full time. ${state.touches} touches.${newRecord ? " A new personal best." : ""} Select Play again for a fresh sprint.`,
  );
}
function frame(timestamp) {
  if (state.phase !== "running") return;
  if (lastFrame === null) lastFrame = timestamp;
  const delta = Math.max(0, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  if (state.mode === "sprint") {
    state.remaining = Math.max(0, state.remaining - delta);
    if (state.remaining <= 0) {
      finishSprint();
      return;
    }
  }
  // Preserve real elapsed time for the clock, but soften visual jumps after a busy frame.
  const movementDelta = Math.min(delta, 0.1);
  const bounces = stepBall(ball, bounds, movementDelta);
  if (bounces) {
    state.bounces += bounces;
    $("#bounces").textContent = String(state.bounces).padStart(2, "0");
  }
  renderBall();
  updateTrail(movementDelta);
  updateClock();
  animationId = requestAnimationFrame(frame);
}
function startSession() {
  if (state.phase === "finished") resetSession(false);
  state.phase = "running";
  lastFrame = null;
  renderControls();
  pitch.focus({ preventScroll: true });
  if (matchMedia("(max-width: 720px)").matches)
    $(".pitch-shell").scrollIntoView({
      behavior: reducedMotion.matches ? "instant" : "smooth",
      block: "center",
    });
  animationId = requestAnimationFrame(frame);
  announce(
    state.mode === "free"
      ? "Free play started. Click or tap the ball, or Tab to it and press Enter."
      : "Sprint started. You have 30 seconds.",
  );
}
function pauseSession(
  message = "Game paused. Select Resume when you’re ready.",
) {
  if (state.phase !== "running") return;
  stopFrames();
  state.phase = "paused";
  renderControls();
  announce(message);
}
function togglePlay() {
  if (state.phase === "running") pauseSession();
  else startSession();
}
function setSpeed(value) {
  state.speed = Math.max(0.5, Math.min(3, Number(value)));
  speedInput.value = String(state.speed);
  speedInput.style.setProperty(
    "--range-progress",
    `${((state.speed - 0.5) / 2.5) * 100}%`,
  );
  speedInput.setAttribute("aria-valuetext", `${state.speed} times speed`);
  $("#speed-output").innerHTML = `${state.speed.toFixed(2)}<span>×</span>`;
  document.querySelectorAll("[data-speed]").forEach((button) => {
    const active = Number(button.dataset.speed) === state.speed;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (ball) setBallSpeed(ball, actualSpeed());
}
function showEffect(text, x, y, isMiss = false) {
  const effect = document.createElement("span");
  effect.className = `hit-effect${isMiss ? " miss-effect" : ""}`;
  effect.textContent = text;
  effect.style.left = `${x}px`;
  effect.style.top = `${Math.max(22, y - bounds.radius)}px`;
  effects.append(effect);
  if (reducedMotion.matches) {
    setTimeout(() => effect.remove(), 350);
    return;
  }
  const animation = effect.animate(
    [
      { opacity: 1, transform: "translate(-50%, -50%) scale(.9)" },
      { opacity: 0, transform: "translate(-50%, -150%) scale(1.1)" },
    ],
    { duration: 600, easing: "ease-out" },
  );
  animation.finished.then(
    () => effect.remove(),
    () => effect.remove(),
  );
}
ballElement.addEventListener("click", (event) => {
  event.stopPropagation();
  if (state.phase !== "running") return;
  state.touches += 1;
  // A new diagonal kick avoids an exclusively vertical or horizontal loop.
  const angle =
    (Math.random() * Math.PI) / 3 +
    Math.PI / 12 +
    (Math.floor(Math.random() * 4) * Math.PI) / 2;
  ball.vx = Math.cos(angle) * actualSpeed();
  ball.vy = Math.sin(angle) * actualSpeed();
  showEffect("+1", ball.x, ball.y);
  if (!reducedMotion.matches)
    ballElement.animate([{ scale: "1" }, { scale: "1.14" }, { scale: "1" }], {
      duration: 190,
      easing: "ease-out",
    });
  updateStats();
  announce(
    `${state.touches} ${state.touches === 1 ? "touch" : "touches"}. Nice kick.`,
  );
});
pitch.addEventListener("click", (event) => {
  if (state.phase !== "running" || event.target.closest("button")) return;
  state.misses += 1;
  const rect = pitch.getBoundingClientRect();
  showEffect(
    "so close",
    event.clientX - rect.left,
    event.clientY - rect.top,
    true,
  );
  updateStats();
});
document
  .querySelectorAll('[data-action="play"]')
  .forEach((button) => button.addEventListener("click", togglePlay));
$("#reset-button").addEventListener("click", () => resetSession());
speedInput.addEventListener("input", () => setSpeed(speedInput.value));
document
  .querySelectorAll("[data-speed]")
  .forEach((button) =>
    button.addEventListener("click", () => setSpeed(button.dataset.speed)),
  );
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    if (state.mode === button.dataset.mode) return;
    state.mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((modeButton) => {
      const active = modeButton === button;
      modeButton.classList.toggle("is-active", active);
      modeButton.setAttribute("aria-pressed", String(active));
    });
    $("#mode-help").textContent =
      state.mode === "free"
        ? "No countdown. Just you and the ball."
        : "30 seconds to find your personal best.";
    resetSession(false);
    announce(
      `${state.mode === "free" ? "Free play" : "30-second sprint"} selected. Ready to play.`,
    );
  }),
);
trailInput.addEventListener("change", () => {
  trailLayer.hidden = !trailInput.checked;
  clearTrail();
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    trailInput.checked = false;
    trailLayer.hidden = true;
    clearTrail();
  }
  renderBall();
});
$("#how-to-open").addEventListener("click", () => {
  pauseSession("Game paused while you read the instructions.");
  dialog.showModal();
});
document.addEventListener("keydown", (event) => {
  if (
    dialog.open ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select"))
  )
    return;
  if (event.code === "Space" && !target.closest("button, a")) {
    event.preventDefault();
    togglePlay();
  }
  if (event.key.toLowerCase() === "r") {
    event.preventDefault();
    resetSession();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden)
    pauseSession(
      "Game paused because you left the tab. Select Resume to continue.",
    );
});
resizeBoard();
new ResizeObserver(resizeBoard).observe(pitch);
setSpeed(1);
trailLayer.hidden = !trailInput.checked;
updateStats();
renderControls();
