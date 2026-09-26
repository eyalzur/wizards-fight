const STORAGE_KEY = 'wizardsfight_save_v1';

export function saveState(world) {
  try {
    const data = { player: world.player, npcs: world.npcs, spawnCenter: world.spawnCenter };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save game state', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
