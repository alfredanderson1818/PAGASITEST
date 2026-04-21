// ═══════════════════════════════════════════════════════════════
// utils.js — Pagasi
// Funciones de utilidad puras. No dependen de ningún otro archivo.
// Debe cargarse PRIMERO en el HTML, antes que cualquier otro script.
// ═══════════════════════════════════════════════════════════════

// ── Selector rápido ─────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Formateador de moneda (USD) ──────────────────────────────
const fmt = n => '$' + parseFloat(n).toLocaleString('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

// ── Iniciales de nombre ──────────────────────────────────────
const ini = n => n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// ── Clase CSS de badge según estado ─────────────────────────
const sbg = s => ({
  activo:      'b-g',
  mora:        'b-r',
  recuperada:  'b-a',
  recuperado:  'b-a',
  disponible:  'b-p',
  financiada:  'b-p',
  inventario:  'b-b',
  confirmado:  'b-g',
  pendiente:   'b-a',
  completado:  'b-g',
  propia:      'b-g',
  cancelado:   'b-r'
}[s] || 'b-x');

// ── Hash SHA-256 (para contraseñas en modo local) ────────────
async function sha256Hex(str) {
  if (!(window.crypto && window.crypto.subtle && window.TextEncoder))
    throw new Error('SHA-256 no disponible');
  var buf = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(str || ''))
  );
  return Array.from(new Uint8Array(buf))
    .map(function(b) { return b.toString(16).padStart(2, '0'); })
    .join('');
}

// ── Limpia undefined antes de guardar en Firestore ───────────
function clean(o) {
  var r = {};
  Object.keys(o).forEach(function(k) {
    if (o[k] !== undefined) r[k] = o[k] === null ? null : o[k];
  });
  return r;
}

// ── Toast de notificación ────────────────────────────────────
function toast(msg, type) {
  type = type || 'info';
  var c = $('toasts');
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  var ic = { success: '✓', error: 'OFF', info: 'ℹ️', warn: '⚠' };
  t.innerHTML = '<span>' + (ic[type] || 'ℹ️') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(12px)';
    t.style.transition = 'all .26s';
  }, 3000);
  setTimeout(function() { t.remove(); }, 3300);
}

// ── Paginación simple ────────────────────────────────────────
function pgGet(key) { return window._pages[key] || 1; }
function pgSet(key, n) { window._pages[key] = n; }

// ── Nombre de mes en español ─────────────────────────────────
function nombreMesEsp(yyyy_mm) {
  var meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var parts = (yyyy_mm || '').split('-');
  var yr = parts[0];
  var mn = parseInt(parts[1], 10) - 1;
  return (meses[mn] || '') + ' ' + yr;
}

// ── Loader de pantalla completa ──────────────────────────────
function showLoader(msg, sub) {
  var w = $('ld-wrap'), m = $('ld-msg'), s = $('ld-sub');
  if (w) w.style.display = 'flex';
  if (m) m.textContent = msg || 'Cargando...';
  if (s) s.textContent = sub || '';
}
function hideLoader() {
  var w = $('ld-wrap');
  if (w) w.style.display = 'none';
}

// ── Skeleton loader del dashboard ───────────────────────────
function showSkeleton() {
  var cnt = $('cnt');
  if (!cnt) return;
  var skCards = Array(4).fill(0).map(function() {
    return '<div class="sk-card" style="flex:1">' +
      '<div class="sk sk-line" style="width:35%;height:10px"></div>' +
      '<div class="sk sk-val"></div>' +
      '<div class="sk sk-line" style="width:70%"></div>' +
      '<div class="sk sk-line" style="width:50%;margin-top:12px"></div>' +
      '</div>';
  }).join('');
  cnt.innerHTML = '<div class="page">' +
    '<div style="background:var(--surf2);border-radius:12px;height:80px;margin-bottom:18px" class="sk"></div>' +
    '<div style="display:flex;gap:12px;margin-bottom:14px">' + skCards + '</div>' +
    '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">' +
      '<div class="sk-card"><div class="sk sk-title"></div><div class="sk" style="height:110px;border-radius:8px"></div></div>' +
      '<div class="sk-card"><div class="sk sk-title"></div>' +
        Array(3).fill('<div class="sk sk-line"></div>').join('') +
      '</div>' +
    '</div>' +
  '</div>';
}

// ── Dark mode ─────────────────────────────────────────────────
function toggleDark() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setDark(!isDark);
  setTimeout(function() {
    if (typeof renderDashChart === 'function') renderDashChart();
  }, 50);
}
function setDark(on) {
  if (on) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.setProperty('color-scheme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.setProperty('color-scheme', 'light');
  }
  ['darkToggle', 'darkToggleMob'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) {
      btn.textContent = on ? '☾' : '☀';
      btn.title = on ? 'Modo claro' : 'Modo oscuro';
    }
  });
  try { localStorage.setItem('pagasi_theme', on ? 'dark' : 'light'); } catch(e) {}
}
document.addEventListener('DOMContentLoaded', function() {
  try {
    var saved = localStorage.getItem('pagasi_theme');
    if (saved === 'dark') setDark(true);
    else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) setDark(true);
  } catch(e) {}
});

// ── Abrir ventana de impresión/PDF ────────────────────────────
function _abrirVentanaImpresion(titulo, htmlBody) {
  var w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Permite las ventanas emergentes para imprimir', 'warn'); return; }
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + titulo + '</title>' +
    '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px}' +
    'table{width:100%;border-collapse:collapse;margin:12px 0}' +
    'th,td{border:1px solid #ddd;padding:7px 10px;text-align:left}' +
    'th{background:#f5f5f5;font-weight:700}' +
    'h2{text-align:center;font-size:18px;margin-bottom:4px}' +
    'h3{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}' +
    '@media print{button{display:none}}' +
    '</style></head><body>' + htmlBody +
    '<div style="text-align:center;margin-top:28px"><button onclick="window.print()" ' +
    'style="padding:9px 28px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;' +
    'font-size:14px;cursor:pointer">Imprimir / Guardar PDF</button></div></body></html>');
  w.document.close();
}
