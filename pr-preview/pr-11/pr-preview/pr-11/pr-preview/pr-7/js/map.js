import { getElement } from './wizard.js';
import { avatarWithRing } from './portraits.js';

let map = null;
let playerMarker = null;
let senseCircle = null;
let npcMarkers = {};
let remoteMarkers = {};
let projectileMarkers = {};
let playerClickHandler = null;

export function initMap(center, onMapClick) {
  // Zoom is fixed on purpose: gameplay distances (sense range, walk limit,
  // spell range) are tuned for this one view, so there is no zoom UI and every
  // zoom gesture is off. Panning (dragging) still works.
  map = L.map('map', {
    zoomControl: false, tap: true,
    minZoom: 17, maxZoom: 17,
    scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false,
  }).setView([center.lat, center.lng], 17);
  // iOS Safari ignores viewport maximum-scale; block its page pinch-zoom too.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // Dark basemap (real streets/city labels) instead of stock light OSM tiles,
  // so the map reads clearly against the game's night theme. Esri's Dark
  // Gray Canvas is keyless (unlike CARTO's basemaps, which started
  // requiring an API key in 2026); base + reference are two layers because
  // Esri ships labels separately from the road canvas.
  const esriAttribution = '&copy; OpenStreetMap contributors &copy; Esri';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    maxNativeZoom: 16,
    attribution: esriAttribution,
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    maxNativeZoom: 16,
  }).addTo(map);
  map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng));
  setTimeout(() => map.invalidateSize(), 80);
  window.addEventListener('resize', () => map && map.invalidateSize());
}

export function recenter(pos) {
  if (map) map.panTo([pos.lat, pos.lng]);
}

// `wizard.shieldActive` is an optional display-only flag main.js attaches
// before calling this (mirroring how `casterColor` is attached to
// projectiles below) — map.js never imports combat.js to compute it itself,
// keeping the map.js/combat.js boundary from docs/ARCHITECTURE.md intact.
// iconSize/iconAnchor are sized to fit the ring + shield-bubble at their
// largest (bubble present) so the marker never resizes/jumps when a shield
// toggles on or off — only tune these by eye against the live map, not by
// the numbers alone.
export function updatePlayer(pos, wizard, onPlayerClick) {
  playerClickHandler = onPlayerClick;
  const avatarHtml = avatarWithRing(wizard.avatar, getElement(wizard.element).color, {
    hp: wizard.hp,
    maxHP: wizard.maxHP,
    ringColor: 'var(--mana)',
    shieldActive: !!wizard.shieldActive,
  });
  const icon = L.divIcon({
    className: 'wizard-marker player-marker',
    html: `${avatarHtml}<div class="marker-label">${wizard.name}</div>`,
    iconSize: [64, 84],
    iconAnchor: [32, 74],
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
      // #8a5cf6 was the pre-desaturation --purple accent, hardcoded here
      // rather than read from the token, so it stayed neon-bright through
      // the v1 mature-theme pass while every CSS-token color got muted.
      // Matched to the current --purple (#5d4a99) instead.
      radius: radiusM,
      color: '#5d4a99',
      weight: 1.5,
      fillColor: '#5d4a99',
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
    // The old separate `.marker-hp` sliver bar under the marker is gone —
    // the ring above is now the HP gauge, so there's no need for two
    // competing HP indicators on the same marker.
    const wrapClass = [selected ? 'selected' : '', defeated ? 'defeated' : ''].filter(Boolean).join(' ');
    const avatarHtml = avatarWithRing(npc.avatar, getElement(npc.element).color, {
      hp: npc.hp,
      maxHP: npc.maxHP,
      ringColor: selected ? 'var(--gold)' : 'var(--pink)',
      shieldActive: !!npc.shieldActive,
      wrapClass,
    });
    const html = `${avatarHtml}<div class="marker-label">${npc.name}</div>`;
    const icon = L.divIcon({ className: 'wizard-marker npc-marker', html, iconSize: [64, 84], iconAnchor: [32, 74] });
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

// Real players render like NPCs (same ring/HP-gauge/name-label pattern, via
// avatarWithRing) but with a distinct ring color (var(--purple)) so one's
// recognizable as a real, possibly-offline player before tapping it — see
// docs/FEATURES.md "Multiplayer". Kept as its own marker registry/function
// rather than reusing renderNpcs — the two are similar-looking but genuinely
// different data sources (own NPC array vs. fetched remote-player
// snapshots), and collapsing them would mean threading an isRemote flag
// through every line. shieldActive is always false: this device has no live
// visibility into a remote player's shield state (see combat.js).
export function renderRemotePlayers(remotePlayers, onRemoteClick, selectedId) {
  const seen = new Set();
  remotePlayers.forEach((rp) => {
    seen.add(rp.id);
    const defeated = rp.hp <= 0;
    const selected = rp.id === selectedId;
    const wrapClass = [selected ? 'selected' : '', defeated ? 'defeated' : ''].filter(Boolean).join(' ');
    const avatarHtml = avatarWithRing(rp.avatar, getElement(rp.element).color, {
      hp: rp.hp,
      maxHP: rp.maxHP,
      ringColor: 'var(--purple)',
      shieldActive: false,
      wrapClass,
    });
    const html = `${avatarHtml}<div class="marker-label">${rp.name}</div>`;
    const icon = L.divIcon({ className: 'wizard-marker remote-marker', html, iconSize: [64, 84], iconAnchor: [32, 74] });
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

// `projectiles` entries are expected to carry a `casterColor` field (a hex
// string) added by main.js — map.js renders whatever it's handed and
// doesn't look up wizards by id itself (see docs/ARCHITECTURE.md on the
// map.js/combat.js boundary).
export function renderProjectiles(projectiles, now) {
  const seen = new Set();
  projectiles.forEach((p) => {
    if (p.resolved || now < p.travelStart) return;
    seen.add(p.id);
    const dur = Math.max(1, p.impactTime - p.travelStart);
    const frac = Math.min(1, Math.max(0, (now - p.travelStart) / dur));
    const lat = p.startPos.lat + (p.endPos.lat - p.startPos.lat) * frac;
    const lng = p.startPos.lng + (p.endPos.lng - p.startPos.lng) * frac;
    const icon = L.divIcon({
      className: 'projectile-marker',
      html: `<div class="projectile-orb" style="--orb-color:${p.casterColor || '#b9903f'}"></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
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
