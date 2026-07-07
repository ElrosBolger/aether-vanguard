export const FIXED_DT = 1 / 30;
export const MOVE_SPEED = 4.5;
export const PLAYER_RADIUS = 0.35;

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputPacket {
  seq: number;
  moveX: number;
  moveY: number;
}

export interface StaticObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function simulateStep(
  state: Vec2,
  input: InputPacket,
  obstacles: StaticObstacle[]
): Vec2 {
  const len = Math.hypot(input.moveX, input.moveY) || 1;
  const nx = input.moveX / len;
  const ny = input.moveY / len;

  let x = state.x + nx * MOVE_SPEED * FIXED_DT;
  let y = state.y + ny * MOVE_SPEED * FIXED_DT;

  return resolveCollisions(x, y, obstacles);
}

function resolveCollisions(x: number, y: number, obstacles: StaticObstacle[]): Vec2 {
  for (const o of obstacles) {
    const closestX = clamp(x, o.x, o.x + o.width);
    const closestY = clamp(y, o.y, o.y + o.height);
    const dx = x - closestX;
    const dy = y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const overlap = PLAYER_RADIUS - dist;
      x += (dx / dist) * overlap;
      y += (dy / dist) * overlap;
    }
  }
  return { x, y };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
