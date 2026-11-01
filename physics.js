// Pure, time-based motion in CSS pixels. No timers or DOM dependencies.
const DEFAULT_ANGLE = Math.PI / 5;
const DEGREES_PER_RADIAN = 180 / Math.PI;

function finite(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number.`);
  }
}

function limits(bounds) {
  finite(bounds.width, "bounds.width");
  finite(bounds.height, "bounds.height");
  finite(bounds.radius, "bounds.radius");
  if (bounds.width <= 0 || bounds.height <= 0 || bounds.radius < 0) {
    throw new RangeError(
      "Bounds dimensions must be positive and radius nonnegative.",
    );
  }
  // If the ball is larger than an axis, keep it centered on that axis.
  const radiusX = Math.min(bounds.radius, bounds.width / 2);
  const radiusY = Math.min(bounds.radius, bounds.height / 2);
  return {
    minX: radiusX,
    maxX: bounds.width - radiusX,
    minY: radiusY,
    maxY: bounds.height - radiusY,
  };
}

function validBall(ball) {
  for (const key of ["x", "y", "vx", "vy", "rotation"]) {
    finite(ball[key], `ball.${key}`);
  }
}

function validSpeed(speed) {
  finite(speed, "speed");
  if (speed < 0) throw new RangeError("Speed must be nonnegative.");
}

export function createBall(bounds, speed = 240, angle = DEFAULT_ANGLE) {
  limits(bounds);
  validSpeed(speed);
  finite(angle, "angle");
  return {
    x: bounds.width / 2,
    y: bounds.height / 2,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rotation: 0,
  };
}

export function clampBall(ball, bounds) {
  validBall(ball);
  const edges = limits(bounds);
  ball.x = Math.max(edges.minX, Math.min(edges.maxX, ball.x));
  ball.y = Math.max(edges.minY, Math.min(edges.maxY, ball.y));
  return ball;
}

// A stationary ball has no heading, so restarting it uses the default diagonal.
export function setBallSpeed(ball, speed) {
  validBall(ball);
  validSpeed(speed);
  const angle =
    ball.vx === 0 && ball.vy === 0
      ? DEFAULT_ANGLE
      : Math.atan2(ball.vy, ball.vx);
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  return ball;
}

function advanceAxis(position, velocity, low, high, seconds) {
  const span = high - low;
  if (span === 0 || velocity === 0 || seconds === 0) {
    return { position, velocity, bounces: 0 };
  }

  const displacement = velocity * seconds;
  finite(displacement, "step displacement");
  const distance = Math.abs(displacement);
  const firstWallDistance = velocity > 0 ? high - position : position - low;

  if (distance < firstWallDistance) {
    return { position: position + displacement, velocity, bounces: 0 };
  }

  // A triangular wave reflects any number of wall crossings without a loop.
  // Landing exactly on a wall counts once and leaves velocity pointing inward.
  const bounces = 1 + Math.floor((distance - firstWallDistance) / span);
  if (!Number.isSafeInteger(bounces)) {
    throw new RangeError(
      "Time step is too large to count wall collisions precisely.",
    );
  }
  const period = 2 * span;
  const unfolded = position - low + displacement;
  const wrapped = ((unfolded % period) + period) % period;
  return {
    position: low + (wrapped <= span ? wrapped : period - wrapped),
    velocity: bounces % 2 === 0 ? velocity : -velocity,
    bounces,
  };
}

/**
 * Advance by a finite, nonnegative elapsed time, with no arbitrary time cap.
 * Returns the number of wall contacts (a corner contacts two walls).
 * Callers should pause when hidden rather than advance through hidden time.
 * Tiny fields pin an oversized ball; its velocity survives a later resize.
 */
export function stepBall(ball, bounds, deltaSeconds) {
  finite(deltaSeconds, "deltaSeconds");
  if (deltaSeconds < 0)
    throw new RangeError("Elapsed time must be nonnegative.");
  clampBall(ball, bounds);
  const edges = limits(bounds);
  const horizontal = advanceAxis(
    ball.x,
    ball.vx,
    edges.minX,
    edges.maxX,
    deltaSeconds,
  );
  const vertical = advanceAxis(
    ball.y,
    ball.vy,
    edges.minY,
    edges.maxY,
    deltaSeconds,
  );
  const bounces = horizontal.bounces + vertical.bounces;
  if (!Number.isSafeInteger(bounces)) {
    throw new RangeError(
      "Time step is too large to count wall collisions precisely.",
    );
  }

  // Signed path distance reverses the visual spin when the ball rebounds.
  // The horizontal axis sets direction, except for purely vertical motion.
  const activeVx = edges.maxX > edges.minX ? ball.vx : 0;
  const activeVy = edges.maxY > edges.minY ? ball.vy : 0;
  const speed = Math.hypot(activeVx, activeVy);
  const signedDistance =
    Math.abs(activeVx) > 1e-8
      ? ((horizontal.position - ball.x) * speed) / Math.abs(activeVx)
      : activeVy !== 0
        ? ((vertical.position - ball.y) * speed) / Math.abs(activeVy)
        : 0;
  const rotation =
    ball.rotation +
    (signedDistance / Math.max(1, bounds.radius)) * DEGREES_PER_RADIAN;
  finite(rotation, "ball rotation");

  ball.x = horizontal.position;
  ball.y = vertical.position;
  ball.vx = horizontal.velocity;
  ball.vy = vertical.velocity;
  ball.rotation = rotation;
  return bounces;
}
