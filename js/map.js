import { getSpell } from './spells.js';

let map = null;
let playerMarker = null;
let senseCircle = null;
let npcMarkers = {};
let remoteMarkers = {};
let projectileMarkers = {};
let playerClickHandler = null;

export function initMap(center, onMapClick) {
  map = L.map('map', { zoomControl: true, tap: true }).setView([center.lat, center.lng], 17);
  // Dark basemap (real streets/city labels) instead of stock light OSM tiles,
  // so the map reads clearly against the game's night theme.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(map);
  map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng));
  setTimeout(() => map.invalidateSize(), 80);
  window.addEventListener('resize', () => map && map.invalidateSize());
}

export function recenter(pos) {
  if (map) map.panTo([pos.lat, pos.lng]);
}

export function updatePlayer(pos, wizard, onPlayerClick) {
  playerClickHandler = onPlayerClick;
  const icon = L.divIcon({
    className: 'wizard-marker player-marker',
    html: `<div class="marker-avatar player-avatar">${wizard.avatar}</div><div class="marker-label">${wizard.name}</div>`,
    iconSize: [50, 56],
    iconAnchor: [25, 50],
  });
  if (!playerMarker) {
    playerMarker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    playerMarker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      playerClickHandler && playerClickHandler();
    });
  } else {
    playerMarker.setLatLng([pos.lat, pos.lng]);
    playerMarker.setIcon(icon);
  }
}

export function updateSenseCircle(pos, radiusM) {
  if (!senseCircle) {
    senseCircle = L.circle([pos.lat, pos.lng], {
      radius: radiusM,
      color: '#8a5cf6',
      weight: 1.5,
      fillColor: '#8a5cf6',
      fillOpacity: 0.07,
      dashArray: '4 6',
    }).addTo(map);
  } else {
    senseCircle.setLatLng([pos.lat, pos.lng]);
    senseCircle.setRadius(radiusM);
  }
}

export function renderNpcs(npcs, onNpcClick, selectedId) {
  const seen = new Set();
  npcs.forEach((npc) => {
    seen.add(npc.id);
    const defeated = npc.hp <= 0;
    const selected = npc.id === selectedId;
    const html = `
      <div class="marker-avatar npc-avatar${defeated ? ' defeated' : ''}${selected ? ' selected' : ''}">${npc.avatar}</div>
      <div class="marker-hp"><div class="marker-hp-fill" style="width:${Math.max(0, (npc.hp / npc.maxHP) * 100)}%"></div></div>
      <div class="marker-label">${npc.name}</div>`;
    const icon = L.divIcon({ className: 'wizard-marker npc-marker', html, iconSize: [46, 58], iconAnchor: [23, 50] });
    if (!npcMarkers[npc.id]) {
      const m = L.marker([npc.position.lat, npc.position.lng], { icon }).addTo(map);
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onNpcClick(npc.id);
      });
      npcMarkers[npc.id] = m;
    } else {
      npcMarkers[npc.id].setLatLng([npc.position.lat, npc.position.lng]);
      npcMarkers[npc.id].setIcon(icon);
    }
  });
  Object.keys(npcMarkers).forEach((id) => {
    if (!seen.has(id)) {
      map.removeLayer(npcMarkers[id]);
      delete npcMarkers[id];
    }
  });
}

// Real players render like NPCs (same HP bar / name label pattern) but with
// a distinct accent color plus a persistent badge dot, so one's recognizable
// as a real, possibly-offline player before tapping it — see docs/FEATURES.md
// "Multiplayer". Kept as its own marker registry/function rather than
// reusing renderNpcs — the two are similar-looking but genuinely different
// data sources (own NPC array vs. fetched remote-player snapshots), and
// collapsing them would mean threading an isRemote flag through every line.
export function renderRemotePlayers(remotePlayers, onRemoteClick, selectedId) {
  const seen = new Set();
  remotePlayers.forEach((rp) => {
    seen.add(rp.id);
    const defeated = rp.hp <= 0;
    const selected = rp.id === selectedId;
    const html = `
      <div class="marker-avatar remote-avatar${defeated ? ' defeated' : ''}${selected ? ' selected' : ''}">${rp.avatar}<span class="remote-badge"></span></div>
      <div class="marker-hp"><div class="marker-hp-fill" style="width:${Math.max(0, (rp.hp / rp.maxHP) * 100)}%"></div></div>
      <div class="marker-label">${rp.name}</div>`;
    const icon = L.divIcon({ className: 'wizard-marker remote-marker', html, iconSize: [46, 58], iconAnchor: [23, 50] });
    if (!remoteMarkers[rp.id]) {
      const m = L.marker([rp.position.lat, rp.position.lng], { icon }).addTo(map);
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onRemoteClick(rp.id);
      });
      remoteMarkers[rp.id] = m;
    } else {
      remoteMarkers[rp.id].setLatLng([rp.position.lat, rp.position.lng]);
      remoteMarkers[rp.id].setIcon(icon);
    }
  });
  Object.keys(remoteMarkers).forEach((id) => {
    if (!seen.has(id)) {
      map.removeLayer(remoteMarkers[id]);
      delete remoteMarkers[id];
    }
  });
}

export function renderProjectiles(projectiles, now) {
  const seen = new Set();
  projectiles.forEach((p) => {
    if (p.resolved || now < p.travelStart) return;
    seen.add(p.id);
    const dur = Math.max(1, p.impactTime - p.travelStart);
    const frac = Math.min(1, Math.max(0, (now - p.travelStart) / dur));
    const lat = p.startPos.lat + (p.endPos.lat - p.startPos.lat) * frac;
    const lng = p.startPos.lng + (p.endPos.lng - p.startPos.lng) * frac;
    const spell = getSpell(p.spellId);
    const icon = L.divIcon({ className: 'projectile-marker', html: `<div class="projectile-icon">${spell.icon}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
    if (!projectileMarkers[p.id]) {
      projectileMarkers[p.id] = L.marker([lat, lng], { icon, interactive: false }).addTo(map);
    } else {
      projectileMarkers[p.id].setLatLng([lat, lng]);
    }
  });
  Object.keys(projectileMarkers).forEach((id) => {
    if (!seen.has(id)) {
      map.removeLayer(projectileMarkers[id]);
      delete projectileMarkers[id];
    }
  });
}
