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
  // Zoom used to be fixed at 17 ("distances are tuned for this one view") —
  // reversed 2026-10-11 by direct user request (see proj-status.md Decisions
  // Log). Bounded 14..19 is a first guess, same "tune from play later" spirit
  // as every other number in this project, not a value derived from testing
  // every zoom level. All gameplay distance math (sense range, the 250m
  // tap-to-walk cap, NPC spawn radius) lives in js/geo.js:distanceMeters,
  // real lat/lng haversine math with no pixel/zoom term in it at all — so it
  // stays correct at any zoom without any code change here; only the sense
  // circle's and markers' on-screen pixel size change with zoom, same as any
  // map app. scrollWheelZoom is harmless for desktop testing even though this
  // is a mobile-first game. boxZoom/keyboard stay off — not useful gestures
  // for a touch-first game, no reason to add them.
  map = L.map('map', {
    zoomControl: true, tap: true,
    minZoom: 14, maxZoom: 19,
    scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true, boxZoom: false, keyboard: false,
  }).setView([center.lat, center.lng], 17);
  // iOS Safari ignores viewport maximum-scale; block its page pinch-zoom too.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // Esri's World Light Gray Canvas (real streets/city labels) — keyless,
  // unlike CARTO's basemaps (which started requiring an API key in 2026);
  // base + reference are two layers because Esri ships labels separately
  // from the road canvas.
  //
  // 2026-10-14: switched from Esri's Dark Gray Canvas to this Light Gray
  // counterpart (same service family, same base+reference split, still
  // keyless) to match the watercolor theme's light palette — a direct
  // reversal of the original "map stays dark to match the dark theme"
  // reasoning (2026-09-26, see proj-status.md Decisions Log), by the user's
  // own choice after reviewing 5 mockup directions. Every marker/circle
  // color that assumed a dark backdrop (bright fills, light borders) was
  // rechecked for contrast against the new light streets too — see
  // css/style.css's marker/ring/label rules and the sense-circle color just
  // below.
  const esriAttribution = '&copy; OpenStreetMap contributors &copy; Esri';
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    maxNativeZoom: 16,
    attribution: esriAttribution,
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
    maxNativeZoom: 16,
  }).addTo(map);
  map.on('click', (e) => onMapClick(e.latlng.lat, e.latlng.lng));
  setTimeout(() => map.invalidateSize(), 80);
  // The map's box changes whenever the docked sheet or the defend strip
  // appears/disappears (and on window resize / mobile toolbar changes), so
  // watch the element itself rather than the window.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (!map) return;
      map.invalidateSize({ animate: false }); // keeps the centre fixed, no competing pan animation
      keepInView();
    }).observe(document.getElementById('map'));
  } else {
    window.addEventListener('resize', () => map && map.invalidateSize());
  }
}

// Marker footprint in container pixels around its lat/lng point (matches the
// divIcon's 64x84 box + iconAnchor [32, 24] used by every wizard marker — the
// anchor sits at the ring's visual center, not the box's bottom, so `up`/
// `down` are no longer symmetric-looking numbers; see the comment above
// updatePlayer() for why). `up` = the 24px from the anchor to the ring's top
// edge, plus the shield-bubble's 8px `inset: -8px` overhang when a Ward
// Shield is active (see `.shield-bubble` in css/style.css) = 32. `down` =
// iconSize.height - iconAnchor.y = 84 - 24 = 60 (the box's reserved panning
// margin below the content, unchanged invariant from before this fix).
const BOX = { left: 32, right: 32, up: 32, down: 60 };
const MARGIN = 8;
let playerLatLng = null;
let focusLatLng = null; // the wizard whose sheet is open, if any

function boxOf(ll) {
  const p = map.latLngToContainerPoint(ll);
  return { x0: p.x - BOX.left, x1: p.x + BOX.right, y0: p.y - BOX.up, y1: p.y + BOX.down };
}

// How far the view must move along one axis so the span [lo, hi] sits inside
// [MARGIN, size - MARGIN]. Spans that cannot fit are aligned by their start.
function axisShift(lo, hi, size) {
  if (hi - lo > size - 2 * MARGIN) return lo - MARGIN;
  if (lo < MARGIN) return lo - MARGIN;
  if (hi > size - MARGIN) return hi - (size - MARGIN);
  return 0;
}

// Pans just enough that the player marker (and the focused wizard, when it can
// fit alongside) is fully inside the visible map. Called after the map's box
// changes — i.e. when a sheet or the defend strip shrinks it.
function keepInView() {
  if (!map || !playerLatLng) return;
  const size = map.getSize();
  const boxes = [boxOf(playerLatLng)];
  if (focusLatLng) boxes.push(boxOf(focusLatLng));
  const span = (k0, k1) => [Math.min(...boxes.map((b) => b[k0])), Math.max(...boxes.map((b) => b[k1]))];
  let [x0, x1] = span('x0', 'x1');
  let [y0, y1] = span('y0', 'y1');
  if (x1 - x0 > size.x - 2 * MARGIN) [x0, x1] = [focusLatLng ? boxes[1].x0 : boxes[0].x0, focusLatLng ? boxes[1].x1 : boxes[0].x1];
  if (y1 - y0 > size.y - 2 * MARGIN) [y0, y1] = [focusLatLng ? boxes[1].y0 : boxes[0].y0, focusLatLng ? boxes[1].y1 : boxes[0].y1];
  const dx = axisShift(x0, x1, size.x);
  const dy = axisShift(y0, y1, size.y);
  if (dx || dy) map.panBy([dx, dy]);
}

// main.js calls this when a sheet opens (with the tapped wizard's position) or
// closes (null). It re-measures first, because the sheet was just added to the
// layout and the ResizeObserver callback has not run yet.
export function reveal(pos) {
  if (!map) return;
  focusLatLng = pos ? L.latLng(pos.lat, pos.lng) : null;
  map.invalidateSize({ animate: false });
  keepInView();
}

export function recenter(pos) {
  if (map) map.panTo([pos.lat, pos.lng]);
}

// `wizard.shieldActive` is an optional display-only flag main.js attaches
// before calling this (mirroring how `casterColor` is attached to
// projectiles below) — map.js never imports combat.js to compute it itself,
// keeping the map.js/combat.js boundary from docs/ARCHITECTURE.md intact.
// iconSize is sized to fit the ring + shield-bubble at their largest (bubble
// present) so the marker never resizes/jumps when a shield toggles on or
// off. iconAnchor targets the ring's true visual center (see
// js/portraits.js:avatarWithRing — the 48x48 `.marker-ring-wrap` is the
// first/top child of the icon's HTML, with `.marker-label` below it), not a
// pin-tip-style bottom anchor — that's what keeps the marker visually
// centered on the lat/lng it's drawn at (e.g. the player's own sense-range
// circle, which is a real L.circle centered on that same point). Only tune
// these by eye against the live map, not by the numbers alone.
export function updatePlayer(pos, wizard, onPlayerClick) {
  playerClickHandler = onPlayerClick;
  playerLatLng = L.latLng(pos.lat, pos.lng);
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
    iconAnchor: [32, 24],
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
      // Leaflet's vector-layer colors can't read a CSS custom property, so
      // this is a hardcoded literal matched to the current --purple token
      // value by hand — update this alongside --purple in css/style.css if
      // that token's value ever changes again (same maintenance note as the
      // v1/Pixar passes before this one; this is the watercolor pass's
      // muted-lavender value, #7f6aa0).
      radius: radiusM,
      color: '#7f6aa0',
      weight: 1.5,
      fillColor: '#7f6aa0',
      fillOpacity: 0.1,
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
    const icon = L.divIcon({ className: 'wizard-marker npc-marker', html, iconSize: [64, 84], iconAnchor: [32, 24] });
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

// Real players render exactly like NPCs now — same ring/HP-gauge/name-label
// pattern via avatarWithRing, *and* the same identity ring color (pink, gold
// when selected) — by explicit product decision (see proj-status.md
// Decisions Log) a player should not be able to tell a real opponent from an
// NPC before tapping; the previous purple "real player" accent is gone.
// Kept as its own marker registry/function rather than reusing renderNpcs —
// the two look identical but are genuinely different data sources (own NPC
// array vs. fetched remote-player snapshots), and collapsing them would mean
// threading an isRemote flag through every line. shieldActive is always
// false: this device has no live visibility into a remote player's shield
// state (see combat.js) — same as an NPC with no shield up, so it reads the
// same either way.
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
      ringColor: selected ? 'var(--gold)' : 'var(--pink)',
      shieldActive: false,
      wrapClass,
    });
    const html = `${avatarHtml}<div class="marker-label">${rp.name}</div>`;
    const icon = L.divIcon({ className: 'wizard-marker remote-marker', html, iconSize: [64, 84], iconAnchor: [32, 24] });
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
