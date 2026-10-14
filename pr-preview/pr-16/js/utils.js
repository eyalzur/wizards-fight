export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function log(world, msg) {
  world.log.unshift(msg);
  if (world.log.length > 60) world.log.length = 60;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
