import test from "node:test";
import assert from "node:assert/strict";
import { createBall, clampBall, setBallSpeed, stepBall } from "../physics.js";

const bounds = { width: 120, height: 100, radius: 10 };
const close = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} should equal ${expected}`,
  );
const state = (x, y, vx, vy) => ({ x, y, vx, vy, rotation: 0 });

test("starts centered with the requested speed and direction", () => {
  const ball = createBall(bounds, 200, Math.PI / 3);
  assert.equal(ball.x, 60);
  assert.equal(ball.y, 50);
  close(Math.hypot(ball.vx, ball.vy), 200);
  close(Math.atan2(ball.vy, ball.vx), Math.PI / 3);
  assert.equal(ball.rotation, 0);
});

test("motion depends on elapsed time and rotates with distance", () => {
  const ball = state(60, 50, 20, 0);
  assert.equal(stepBall(ball, bounds, 0.5), 0);
  assert.equal(ball.x, 70);
  assert.equal(ball.y, 50);
  close(ball.rotation, 180 / Math.PI);
});

test("rebounds from an edge and consumes the remaining time", () => {
  const ball = state(100, 50, 40, 0);
  assert.equal(stepBall(ball, bounds, 1), 1);
  assert.equal(ball.x, 80);
  assert.equal(ball.vx, -40);
  close(Math.hypot(ball.vx, ball.vy), 40);
});

test("an exact boundary arrival bounces once, without double counting next frame", () => {
  const ball = state(60, 50, 50, 0);
  assert.equal(stepBall(ball, bounds, 1), 1);
  assert.equal(ball.x, 110);
  assert.equal(ball.vx, -50);
  assert.equal(stepBall(ball, bounds, 0.1), 0);
  assert.equal(ball.x, 105);
});

test("an outward heading at a boundary immediately reflects", () => {
  const ball = state(10, 50, -40, 0);
  assert.equal(stepBall(ball, bounds, 0.25), 1);
  assert.equal(ball.x, 20);
  assert.equal(ball.vx, 40);
});

test("a corner counts two walls and reflects both components", () => {
  const ball = state(100, 80, 20, 20);
  assert.equal(stepBall(ball, bounds, 0.5), 2);
  assert.equal(ball.x, 110);
  assert.equal(ball.y, 90);
  assert.equal(ball.vx, -20);
  assert.equal(ball.vy, -20);
});

test("large steps handle multiple rebounds without escaping the field", () => {
  const ball = state(60, 50, 100, 0);
  assert.equal(stepBall(ball, bounds, 5), 5);
  assert.equal(ball.x, 60);
  assert.equal(ball.vx, -100);
});

test("subdividing time preserves position, velocity, spin, and collision count", () => {
  const oneStep = state(34, 71, 130, -91);
  const manySteps = { ...oneStep };
  const expectedBounces = stepBall(oneStep, bounds, 2);
  let actualBounces = 0;
  for (let index = 0; index < 200; index += 1) {
    actualBounces += stepBall(manySteps, bounds, 0.01);
  }
  assert.equal(actualBounces, expectedBounces);
  for (const key of ["x", "y", "vx", "vy", "rotation"]) {
    close(manySteps[key], oneStep[key], 1e-7);
  }
});

test("speed changes preserve an existing heading", () => {
  const ball = state(60, 50, -30, 40);
  setBallSpeed(ball, 250);
  close(ball.vx, -150);
  close(ball.vy, 200);
  close(Math.hypot(ball.vx, ball.vy), 250);
});

test("zero speed stays finite and can be restarted", () => {
  const ball = createBall(bounds, 0);
  assert.equal(stepBall(ball, bounds, 100), 0);
  assert.equal(ball.rotation, 0);
  setBallSpeed(ball, 240);
  close(Math.hypot(ball.vx, ball.vy), 240);
  assert.ok(ball.vx > 0 && ball.vy > 0);
  setBallSpeed(ball, 0);
  assert.equal(stepBall(ball, bounds, 1), 0);
  assert.ok(Object.values(ball).every(Number.isFinite));
});

test("resize clamps the center without erasing momentum", () => {
  const ball = state(500, -20, 50, -20);
  clampBall(ball, bounds);
  assert.equal(ball.x, 110);
  assert.equal(ball.y, 10);
  assert.equal(ball.vx, 50);
  assert.equal(ball.vy, -20);
});

test("an oversized ball stays centered and resumes after the field grows", () => {
  const tinyBounds = { width: 15, height: 12, radius: 20 };
  const ball = createBall(tinyBounds, 100, Math.PI / 4);
  assert.equal(stepBall(ball, tinyBounds, 10), 0);
  assert.equal(ball.x, 7.5);
  assert.equal(ball.y, 6);
  assert.equal(ball.rotation, 0);
  clampBall(ball, bounds);
  stepBall(ball, bounds, 0.1);
  assert.ok(ball.x > 10 && ball.y > 10);
});

test("a single pinned axis does not prevent motion on the other axis", () => {
  const thinBounds = { width: 10, height: 100, radius: 10 };
  const ball = state(5, 50, 20, 30);
  assert.equal(stepBall(ball, thinBounds, 0.5), 0);
  assert.equal(ball.x, 5);
  assert.equal(ball.y, 65);
  assert.ok(ball.rotation > 0);
});

test("a zero time step does not fabricate a collision at a wall", () => {
  const ball = state(110, 90, 20, 20);
  assert.equal(stepBall(ball, bounds, 0), 0);
  assert.equal(ball.vx, 20);
  assert.equal(ball.vy, 20);
});

test("invalid bounds, time, speed, and state fail explicitly", () => {
  assert.throws(() => createBall({ ...bounds, width: 0 }), RangeError);
  assert.throws(() => createBall({ ...bounds, radius: -1 }), RangeError);
  assert.throws(() => createBall({ ...bounds, height: NaN }), TypeError);
  assert.throws(() => createBall(bounds, -1), RangeError);
  assert.throws(() => createBall(bounds, 100, Infinity), TypeError);
  assert.throws(() => stepBall(createBall(bounds), bounds, -1), RangeError);
  assert.throws(
    () => stepBall(createBall(bounds), bounds, Infinity),
    TypeError,
  );
  assert.throws(
    () => clampBall({ ...createBall(bounds), x: NaN }, bounds),
    TypeError,
  );
  assert.throws(() => setBallSpeed(createBall(bounds), NaN), TypeError);
});
