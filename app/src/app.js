// Neon Cover Studio — a GTA VI-style cover art maker that runs fully offline.
// The user drops in their own photos, arranges them in a multi-panel poster,
// writes a bold caption, picks a Vice City sunset or neon grade, and exports a
// share-ready PNG in 1080x1080, 1080x1350 or 1920x1080. Photos are read on the
// user's own machine and never leave it: no network request is ever made.
import { SAMPLES } from './samples.js';

const PREVIEW_MAX = 900; // longest side of the on-screen preview canvas
const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: '1920 x 1080' },
};
const GRADES = {
  sunset: { name: 'Sunset', filter: 'saturate(1.35) contrast(1.08) brightness(1.04)' },
  neon: { name: 'Neon', filter: 'saturate(1.6) contrast(1.16) brightness(1.0)' },
  noir: { name: 'Noir', filter: 'grayscale(1) contrast(1.25) brightness(1.06)' },
  clean: { name: 'Clean', filter: 'saturate(1.05) contrast(1.02)' },
};
const CAPTION_COLORS = {
  white: '#ffffff', sun: '#ffd94d', pink: '#ff5fa2', cyan: '#4de8ff',
};
const PRESET_CAPTIONS = ['VICE CITY', 'NEON NIGHTS', 'SUNSET DRIVE', 'OCEAN DRIVE'];

// Panel geometry as fractions of the cover. Each layout returns panels in
// draw order; the caption band is drawn over the panels afterwards.
const LAYOUTS = {
  poster: {
    name: 'Poster', hint: 'Hero photo up top, two panels below',
    panels(w, h) {
      return [
        { x: 0, y: 0, w: 1, h: 0.6 },
        { x: 0, y: 0.6, w: 0.5, h: 0.4 },
        { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
      ];
    },
  },
  grid: {
    name: 'Four panel', hint: 'Two by two, title across the middle',
    panels(w, h) {
      return [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      ];
    },
  },
  hero: {
    name: 'Hero', hint: 'One full-bleed photo, big title',
    panels(w, h) {
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    },
  },
};

const state = {
  layout: 'poster',
  grade: 'sunset',
  size: 'landscape',
  caption: 'VICE CITY',
  subtitle: 'WELCOME TO PARADISE',
  captionColor: 'white',
  captionSize: 1, // multiplier on the auto-fitted size
  captionTop: false,
  frame: true,
  grain: true,
  // One photo slot per panel; each slot: { img, name, zoom, panX, panY }.
  // panX/panY are fractions of the panel size, zoom is a 1..2.5 multiplier.
  slots: [],
  selected: 0,
  photos: [], // tray: { img, name, sample }
};

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');

function slotCount() {
  return LAYOUTS[state.layout].panels(1, 1).length;
}

function ensureSlots() {
  const n = slotCount();
  while (state.slots.length < n) state.slots.push(blankSlot());
  state.slots.length = n;
  if (state.selected >= n) state.selected = 0;
}

function blankSlot() {
  return { img: null, name: '', zoom: 1, panX: 0, panY: 0 };
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not read ' + file.name));
    img.src = URL.createObjectURL(file);
  });
}

function loadImageURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      const img = await loadImageURL(s.url);
      state.photos.push({ img, name: s.name, sample: true });
    } catch (err) {
      console.warn('sample failed:', s.url, err);
    }
  }
  // Fill the panels with the samples so the first paint is already a cover.
  ensureSlots();
  for (let i = 0; i < state.slots.length; i++) {
    const photo = state.photos[i % Math.max(1, state.photos.length)];
    if (photo) state.slots[i] = { img: photo.img, name: photo.name, zoom: 1, panX: 0, panY: 0 };
  }
}

let fontsReady = false;
async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.ready,
    ]);
    fontsReady = true;
  } catch (err) {
    console.warn('fonts did not load, falling back:', err);
  }
}

// ---- cover rendering -------------------------------------------------------

function gutterPx(w, h) {
  return Math.max(6, Math.round(Math.min(w, h) * 0.011));
}

// Draws one photo into a panel rect with cover-fit, zoom and pan.
function drawPhotoInPanel(c, img, rect, slot) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const scale = base * slot.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + rect.w / 2 - dw / 2 + slot.panX * rect.w;
  const dy = rect.y + rect.h / 2 - dh / 2 + slot.panY * rect.h;
  c.save();
  c.beginPath();
  c.rect(rect.x, rect.y, rect.w, rect.h);
  c.clip();
  c.filter = GRADES[state.grade].filter;
  c.drawImage(img, dx, dy, dw, dh);
  c.filter = 'none';
  // Warm / neon wash over the photo so the panels share one grade.
  if (state.grade === 'sunset') {
    const g = c.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255,122,40,0.10)');
    g.addColorStop(0.55, 'rgba(255,60,110,0.10)');
    g.addColorStop(1, 'rgba(120,20,120,0.22)');
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
  } else if (state.grade === 'neon') {
    const g = c.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, 'rgba(255,40,160,0.16)');
    g.addColorStop(1, 'rgba(0,210,255,0.16)');
    c.fillStyle = g;
    c.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  c.restore();
}

function drawEmptyPanel(c, rect, label) {
  c.save();
  c.fillStyle = '#241a33';
  c.fillRect(rect.x, rect.y, rect.w, rect.h);
  c.strokeStyle = 'rgba(255,255,255,0.25)';
  c.lineWidth = Math.max(1, rect.w * 0.004);
  c.setLineDash([10, 8]);
  c.strokeRect(rect.x + 6, rect.y + 6, rect.w - 12, rect.h - 12);
  c.setLineDash([]);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.font = `${Math.max(14, rect.h * 0.07)}px "Bebas Neue", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  c.restore();
}



// Film grain from a small pre-rendered noise tile.
let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 128; t.height = 128;
  const tc = t.getContext('2d');
  const data = tc.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255;
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 22;
  }
  tc.putImageData(data, 0, 0);
  grainTile = t;
  return t;
}

function fitFont(c, text, fontName, startSize, maxWidth, minSize) {
  let size = startSize;
  while (size > minSize) {
    c.font = `${size}px ${fontName}`;
    if (c.measureText(text).width <= maxWidth) return size;
    size = Math.floor(size * 0.94);
  }
  c.font = `${size}px ${fontName}`;
  return size;
}

function drawCaption(c, w, h) {
  const title = (state.caption || 'VICE CITY').toUpperCase();
  const sub = (state.subtitle || '').toUpperCase();
  const bandH = h * (state.layout === 'grid' ? 0.17 : 0.26);
  const bandY = state.captionTop ? 0 : h - bandH;
  // Dark band so the lettering reads over any photo.
  const band = c.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (state.captionTop) {
    band.addColorStop(0, 'rgba(10,4,24,0.82)');
    band.addColorStop(1, 'rgba(10,4,24,0)');
  } else {
    band.addColorStop(0, 'rgba(10,4,24,0)');
    band.addColorStop(0.35, 'rgba(10,4,24,0.72)');
    band.addColorStop(1, 'rgba(10,4,24,0.88)');
  }
  c.fillStyle = band;
  c.fillRect(0, bandY, w, bandH);

  const color = CAPTION_COLORS[state.captionColor] || '#ffffff';
  const maxW = w * 0.92;
  const titleBase = h * (state.layout === 'hero' ? 0.17 : 0.13);
  const titleSize = fitFont(c, title, 'Anton, sans-serif', titleBase * state.captionSize, maxW, 24);
  const titleY = state.captionTop
    ? bandY + titleSize * 0.95
    : h - h * 0.035 - (sub ? h * 0.028 : 0);
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.miterLimit = 2;
  if (state.grade === 'neon') {
    c.shadowColor = 'rgba(255,47,160,0.85)';
    c.shadowBlur = titleSize * 0.14;
  } else {
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = titleSize * 0.06;
  }
  c.shadowOffsetY = titleSize * 0.03;
  c.strokeStyle = '#160a26';
  c.lineWidth = Math.max(2, titleSize * 0.14);
  c.strokeText(title, w / 2, titleY);
  c.fillStyle = color;
  c.fillText(title, w / 2, titleY);
  c.restore();

  if (sub) {
    const subSize = Math.max(16, Math.round(titleSize * 0.24));
    c.save();
    c.font = `${subSize}px "Bebas Neue", sans-serif`;
    try { c.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch (err) { /* older canvas */ }
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = state.grade === 'neon' ? '#7df3ff' : '#ffd94d';
    const subY = state.captionTop
      ? titleY + subSize * 1.5
      : titleY - titleSize * 1.02;
    c.shadowColor = 'rgba(0,0,0,0.7)';
    c.shadowBlur = 6;
    c.fillText(sub, w / 2, subY);
    try { c.letterSpacing = '0px'; } catch (err) { /* older canvas */ }
    c.restore();
  }
}

// The whole cover: frame, panels, decorations, caption, grain, vignette.
function renderCover(target, w, h) {
  const c = target.getContext('2d');
  target.width = w;
  target.height = h;
  ensureSlots();
  const g = state.frame ? gutterPx(w, h) : 0;
  const frame = state.frame ? g : 0;
  c.fillStyle = '#f4ead8'; // ivory poster frame
  c.fillRect(0, 0, w, h);
  const inner = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 };
  const rects = LAYOUTS[state.layout].panels(inner.w, inner.h).map((p) => ({
    x: inner.x + p.x * inner.w + (p.x > 0 ? g / 2 : 0),
    y: inner.y + p.y * inner.h + (p.y > 0 ? g / 2 : 0),
    w: p.w * inner.w - (p.x > 0 ? g / 2 : 0) - (p.x + p.w < 1 ? g / 2 : 0),
    h: p.h * inner.h - (p.y > 0 ? g / 2 : 0) - (p.y + p.h < 1 ? g / 2 : 0),
  }));
  rects.forEach((rect, i) => {
    const slot = state.slots[i];
    if (slot && slot.img) drawPhotoInPanel(c, slot.img, rect, slot);
    else drawEmptyPanel(c, rect, `Panel ${i + 1} — add a photo`);
    c.strokeStyle = 'rgba(20,8,32,0.85)';
    c.lineWidth = Math.max(1.5, w * 0.0016);
    c.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  // Decorations sit over the photos, under the caption. The photos carry
  // their own suns and palms, so nothing is drawn over them here: the grade,
  // grain and vignette below do the finishing.
  drawCaption(c, w, h);

  if (state.grain) {
    const tile = getGrainTile();
    c.save();
    c.globalAlpha = 0.5;
    c.globalCompositeOperation = 'overlay';
    const pat = c.createPattern(tile, 'repeat');
    c.fillStyle = pat;
    c.fillRect(0, 0, w, h);
    c.restore();
  }
  // Vignette to pull the eye to the middle.
  const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(8,2,18,0.3)');
  c.fillStyle = vg;
  c.fillRect(0, 0, w, h);
}

function previewSize() {
  const s = EXPORT_SIZES[state.size];
  const scale = Math.min(1, PREVIEW_MAX / Math.max(s.w, s.h));
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  renderCover(canvas, w, h);
}

// Export the cover at full size and trigger a download.
function exportCover(sizeKey) {
  const s = EXPORT_SIZES[sizeKey];
  const off = document.createElement('canvas');
  renderCover(off, s.w, s.h);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vice-cover-${s.w}x${s.h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

// Same render as the download, as a data URL (used by the shot harness).
function exportDataURL(sizeKey, type = 'image/png', quality) {
  const s = EXPORT_SIZES[sizeKey];
  const off = document.createElement('canvas');
  renderCover(off, s.w, s.h);
  return off.toDataURL(type, quality);
}

// ---- editor UI -------------------------------------------------------------

const statusEl = $('status');
function setStatus(msg) {
  statusEl.textContent = msg;
}

function currentRects() {
  const { w, h } = previewSize();
  const g = state.frame ? gutterPx(w, h) : 0;
  const frame = state.frame ? g : 0;
  const inner = { x: frame, y: frame, w: w - frame * 2, h: h - frame * 2 };
  return LAYOUTS[state.layout].panels(inner.w, inner.h).map((p) => ({
    x: inner.x + p.x * inner.w + (p.x > 0 ? g / 2 : 0),
    y: inner.y + p.y * inner.h + (p.y > 0 ? g / 2 : 0),
    w: p.w * inner.w - (p.x > 0 ? g / 2 : 0) - (p.x + p.w < 1 ? g / 2 : 0),
    h: p.h * inner.h - (p.y > 0 ? g / 2 : 0) - (p.y + p.h < 1 ? g / 2 : 0),
  }));
}

function buildTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const b = document.createElement('button');
    b.className = 'tray-item';
    b.type = 'button';
    b.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    b.appendChild(img);
    const label = document.createElement('span');
    label.textContent = photo.name;
    b.appendChild(label);
    b.addEventListener('click', () => {
      ensureSlots();
      state.slots[state.selected] = {
        img: photo.img, name: photo.name, zoom: 1, panX: 0, panY: 0,
      };
      syncPanelControls();
      redraw();
      setStatus(`Panel ${state.selected + 1} now shows ${photo.name}.`);
    });
    tray.appendChild(b);
  });
}

function syncPanelControls() {
  const slot = state.slots[state.selected] || blankSlot();
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${slotCount()}${slot.name ? ' — ' + slot.name : ''}`;
  $('zoom').value = slot.zoom;
  $('panX').value = slot.panX;
  $('panY').value = slot.panY;
  $('zoomVal').textContent = `${Math.round(slot.zoom * 100)}%`;
}

function markActive(group, value) {
  document.querySelectorAll(`[data-group="${group}"]`).forEach((b) => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}

function bindUI() {
  document.querySelectorAll('[data-group="layout"]').forEach((b) => {
    b.addEventListener('click', () => {
      state.layout = b.dataset.value;
      ensureSlots();
      markActive('layout', state.layout);
      syncPanelControls();
      redraw();
    });
  });
  document.querySelectorAll('[data-group="grade"]').forEach((b) => {
    b.addEventListener('click', () => {
      state.grade = b.dataset.value;
      markActive('grade', state.grade);
      redraw();
    });
  });
  document.querySelectorAll('[data-group="size"]').forEach((b) => {
    b.addEventListener('click', () => {
      state.size = b.dataset.value;
      markActive('size', state.size);
      redraw();
    });
  });
  document.querySelectorAll('[data-group="color"]').forEach((b) => {
    b.addEventListener('click', () => {
      state.captionColor = b.dataset.value;
      markActive('color', state.captionColor);
      redraw();
    });
  });
  $('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  document.querySelectorAll('.preset-btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.caption = b.dataset.caption;
      $('caption').value = state.caption;
      redraw();
    });
  });
  $('captionSize').addEventListener('input', (e) => {
    state.captionSize = parseFloat(e.target.value);
    $('captionSizeVal').textContent = `${Math.round(state.captionSize * 100)}%`;
    redraw();
  });
  $('captionTop').addEventListener('change', (e) => { state.captionTop = e.target.checked; redraw(); });
  $('frame').addEventListener('change', (e) => { state.frame = e.target.checked; redraw(); });
  $('grain').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });
  $('zoom').addEventListener('input', (e) => {
    const slot = state.slots[state.selected];
    if (slot) slot.zoom = parseFloat(e.target.value);
    $('zoomVal').textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
    redraw();
  });
  $('panX').addEventListener('input', (e) => {
    const slot = state.slots[state.selected];
    if (slot) slot.panX = parseFloat(e.target.value);
    redraw();
  });
  $('panY').addEventListener('input', (e) => {
    const slot = state.slots[state.selected];
    if (slot) slot.panY = parseFloat(e.target.value);
    redraw();
  });

  $('addPhotoBtn').addEventListener('click', () => $('addPhoto').click());
  $('addPhoto').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    for (const f of files) {
      try {
        const img = await loadImageFile(f);
        state.photos.push({ img, name: f.name.replace(/\.[^.]+$/, ''), sample: false });
      } catch (err) {
        console.warn(err);
      }
    }
    if (files.length) {
      buildTray();
      const last = state.photos[state.photos.length - 1];
      ensureSlots();
      state.slots[state.selected] = { img: last.img, name: last.name, zoom: 1, panX: 0, panY: 0 };
      syncPanelControls();
      redraw();
      setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added — the last one went into panel ${state.selected + 1}.`);
    }
    e.target.value = '';
  });

  // Click a panel to select it; drag to pan its photo; wheel to zoom it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const hit = currentRects().findIndex((rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h);
    if (hit >= 0) {
      state.selected = hit;
      syncPanelControls();
      drag = { x, y, panX: state.slots[hit].panX, panY: state.slots[hit].panY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (canvas.width / r.width);
    const y = (e.clientY - r.top) * (canvas.height / r.height);
    const rect = currentRects()[state.selected];
    const slot = state.slots[state.selected];
    if (!rect || !slot || !slot.img) return;
    if (Math.abs(x - drag.x) + Math.abs(y - drag.y) > 3) drag.moved = true;
    slot.panX = Math.max(-0.5, Math.min(0.5, drag.panX + (x - drag.x) / rect.w));
    slot.panY = Math.max(-0.5, Math.min(0.5, drag.panY + (y - drag.y) / rect.h));
    $('panX').value = slot.panX;
    $('panY').value = slot.panY;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.slots[state.selected];
    if (!slot || !slot.img) return;
    slot.zoom = Math.max(1, Math.min(2.5, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    $('zoom').value = slot.zoom;
    $('zoomVal').textContent = `${Math.round(slot.zoom * 100)}%`;
    redraw();
  }, { passive: false });

  $('exportBtn').addEventListener('click', async () => {
    setStatus('Exporting…');
    await exportCover(state.size);
    const s = EXPORT_SIZES[state.size];
    setStatus(`Saved vice-cover-${s.w}x${s.h}.png — share it.`);
  });
  $('exportAllBtn').addEventListener('click', async () => {
    setStatus('Exporting all three sizes…');
    for (const key of Object.keys(EXPORT_SIZES)) {
      await exportCover(key);
      await new Promise((r) => setTimeout(r, 250));
    }
    setStatus('Saved all three sizes: 1080x1080, 1080x1350, 1920x1080.');
  });
}

// Fixed scenes for screenshots: ?shot=cover&layout=poster&size=landscape
// &photo=sunset-city&caption=VICE%20CITY, or ?shot=editor for the editor.
function applyShotParams() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  if (q.get('size') && EXPORT_SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('caption') !== null) state.caption = q.get('caption');
  if (q.get('subtitle') !== null) state.subtitle = q.get('subtitle');
  if (q.get('photo')) {
    const wanted = q.get('photo');
    const photo = state.photos.find((p) => p.name === wanted) || state.photos[0];
    ensureSlots();
    for (let i = 0; i < state.slots.length; i++) {
      const p = state.photos[(state.photos.indexOf(photo) + i) % state.photos.length];
      state.slots[i] = { img: p.img, name: p.name, zoom: 1, panX: 0, panY: 0 };
    }
    if (q.get('photo2')) {
      const p2 = state.photos.find((p) => p.name === q.get('photo2'));
      if (p2 && state.slots[1]) state.slots[1] = { img: p2.img, name: p2.name, zoom: 1, panX: 0, panY: 0 };
    }
    if (q.get('photo3')) {
      const p3 = state.photos.find((p) => p.name === q.get('photo3'));
      if (p3 && state.slots[2]) state.slots[2] = { img: p3.img, name: p3.name, zoom: 1, panX: 0, panY: 0 };
    }
  }
  // Reflect the shot state in the controls.
  $('caption').value = state.caption;
  $('subtitle').value = state.subtitle;
  markActive('layout', state.layout);
  markActive('grade', state.grade);
  markActive('size', state.size);
  markActive('color', state.captionColor);
  syncPanelControls();
}

// Test hook for the screenshot harness: the app's own drawing as a data URL.
window.__vice = {
  state,
  redraw,
  exportDataURL,
  renderCover,
  previewSize,
};

async function init() {
  ensureSlots();
  await Promise.all([loadFonts(), loadSamples()]);
  buildTray();
  bindUI();
  applyShotParams();
  redraw();
  syncPanelControls();
  setStatus('Ready — pick a photo for each panel, write your caption, export.');
  document.body.dataset.ready = 'true';
}

init().catch((err) => {
  console.error(err);
  setStatus('Something failed to load: ' + err.message);
});
