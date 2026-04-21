// ═══════════════════════════════════════════════════════════════
// state.js — Pagasi
// Estado global de la aplicación, constantes, catálogo y plan.
// Depende de: utils.js (solo para localStorage, no usa funciones de utils)
// Debe cargarse DESPUÉS de utils.js y ANTES de db.js
// ═══════════════════════════════════════════════════════════════

// ── Estado principal de la app ───────────────────────────────
const S = {
  motos:            [],
  clientes:         [],
  creds:            [],
  pagos:            [],
  egresos:          [],
  cuentas:          [],
  movimientos:      [],
  cuentasPendientes:[],
  page:             'dash',
  mTab:             'todas',
  credTab:          'todos',
  pagosTab:         'todos',
  saveFn:           null,
  clienteFiltro:    '',
  currentUser:      null
};

// ── Paginación ───────────────────────────────────────────────
window._pages = {};

// ── Etiquetas de módulos (usadas en sidebar y topbar) ────────
const PGL = {
  dash:      'Dashboard',
  clientes:  'Clientes',
  motos:     'Motocicletas',
  creditos:  'Financiamientos',
  pagos:     'Pagos',
  cobranza:  'Cobranza',
  contratos: 'Contratos',
  gps:       'GPS — Rastreo',
  notif:     'Notificaciones',
  reportes:  'Reportes',
  cuentas:   'Cuentas',
  conta:     'Contabilidad',
  plan:      'Plan & Precios',
  config:    'Configuración',
  users:     'Usuarios'
};

// ── Permisos extra (no son módulos, son capacidades) ─────────
const EXTRA_PERMS = { perm_delete: 'Permiso para eliminar' };

// ── Lista de módulos del sistema ─────────────────────────────
var MODULOS = [
  { id: 'dash',      label: 'Dashboard',       grupo: 'Principal'   },
  { id: 'clientes',  label: 'Clientes',         grupo: 'Gestión'     },
  { id: 'motos',     label: 'Motocicletas',     grupo: 'Gestión'     },
  { id: 'creditos',  label: 'Financiamientos',  grupo: 'Gestión'     },
  { id: 'pagos',     label: 'Pagos',            grupo: 'Gestión'     },
  { id: 'cobranza',  label: 'Cobranza',         grupo: 'Operaciones' },
  { id: 'contratos', label: 'Contratos',        grupo: 'Operaciones' },
  { id: 'gps',       label: 'GPS Rastreo',      grupo: 'Operaciones' },
  { id: 'notif',     label: 'Notificaciones',   grupo: 'Operaciones' },
  { id: 'reportes',  label: 'Reportes',         grupo: 'Análisis'    },
  { id: 'cuentas',   label: 'Cuentas',          grupo: 'Análisis'    },
  { id: 'conta',     label: 'Contabilidad',     grupo: 'Análisis'    },
  { id: 'plan',      label: 'Plan & Precios',   grupo: 'Sistema'     },
  { id: 'config',    label: 'Configuración',    grupo: 'Sistema'     },
  { id: 'users',     label: 'Usuarios',         grupo: 'Sistema'     },
];

// ── Plan de financiamiento por defecto ───────────────────────
// (se sobreescribe con los valores de Firebase/localStorage al cargar)
const PLAN = {
  plazo:       10,
  factor:      1.90,
  inicial:     0.40,
  tasaMensual: 13.77,
  apy:         370.28
};

// ── Catálogo de motos ────────────────────────────────────────
// (puede sobreescribirse desde Firebase config/catalogo)
const CATALOGO = [
  { id:  1, modelo: 'NEW HORSE 150',         precio: 1320.00 },
  { id:  2, modelo: 'EK XPRESS 150',         precio: 1090.00 },
  { id:  3, modelo: 'EK XPRESS II 150',      precio: 1126.00 },
  { id:  4, modelo: 'EK XPRESS 200S',        precio: 1360.00 },
  { id:  5, modelo: 'EK XPRESS 150 LITE',    precio: 1020.00 },
  { id:  6, modelo: 'NEW OWEN II 150',       precio: 1255.00 },
  { id:  7, modelo: 'OWEN 200S',             precio: 1550.00 },
  { id:  8, modelo: 'RK 200',               precio: 1750.00 },
  { id:  9, modelo: 'RK 250',               precio: 2075.00 },
  { id: 10, modelo: 'TX 250 GS',            precio: 2599.00 },
  { id: 11, modelo: 'MATRIX 150 LITE',      precio: 1290.00 },
  { id: 12, modelo: 'MATRIX 150',           precio: 1499.00 },
  { id: 13, modelo: 'NEW OUTLOOK 175',      precio: 2450.00 },
  { id: 14, modelo: 'OUTLOOK XL PALETA',    precio: 4851.00 },
  { id: 15, modelo: 'ATLAS 200HD',          precio: 4600.00 },
];

// ── Sobrescribir PLAN y CATALOGO desde localStorage ──────────
// (se ejecuta aquí para que DB.load() pueda refinar con Firebase después)
try {
  var _catLs = JSON.parse(localStorage.getItem('pagasi_catalogo_config') || 'null');
  if (Array.isArray(_catLs) && _catLs.length) {
    CATALOGO.splice(0, CATALOGO.length);
    _catLs.forEach(function(item) { CATALOGO.push(item); });
  }
  var _planLs = JSON.parse(localStorage.getItem('pagasi_config_plan') || 'null');
  if (_planLs && typeof _planLs === 'object') {
    if (Object.prototype.hasOwnProperty.call(_planLs, 'factor'))      PLAN.factor      = _planLs.factor;
    if (Object.prototype.hasOwnProperty.call(_planLs, 'inicial'))     PLAN.inicial     = _planLs.inicial;
    if (Object.prototype.hasOwnProperty.call(_planLs, 'tasaMensual')) PLAN.tasaMensual = _planLs.tasaMensual;
    if (Object.prototype.hasOwnProperty.call(_planLs, 'plazo'))       PLAN.plazo       = _planLs.plazo;
    if (Object.prototype.hasOwnProperty.call(_planLs, 'apy'))         PLAN.apy         = _planLs.apy;
    var _gr = Object.prototype.hasOwnProperty.call(_planLs, 'diasGracia') ? _planLs.diasGracia : _planLs.gracia;
    if (typeof _gr !== 'undefined' && _gr !== null) PLAN.diasGracia = _gr;
    var _mp = Object.prototype.hasOwnProperty.call(_planLs, 'moraPct') ? _planLs.moraPct : _planLs.mora_pct;
    if (typeof _mp !== 'undefined' && _mp !== null) PLAN.moraPct = _mp;
  }
  window._planesExtra = JSON.parse(localStorage.getItem('pagasi_planes_extra') || '[]') || [];
} catch (_cfgErr) {
  window._planesExtra = window._planesExtra || [];
}

// ── Cálculo de financiamiento para una moto ──────────────────
function calcMoto(precio) {
  var ini       = precio * PLAN.inicial;
  var fin       = precio - ini;
  var total     = fin * PLAN.factor;
  var cuotaM    = total / PLAN.plazo;
  var cuotaQ    = cuotaM / 2;
  var totalPagado = ini + total;
  return { ini, fin, total, cuotaM, cuotaQ, totalPagado };
}

// ── Helpers de crédito (leen de S.pagos) ─────────────────────
function getCreditoTotalCuotas(c) {
  return parseInt((c && c.totalCuotas) || ((c && c.plazo) ? c.plazo * 2 : 20), 10) || 20;
}
function getCreditoCuotaBase(c) {
  return parseFloat((c && (c.cuotaQ || c.cuota)) || 0) || 0;
}
function getCreditoPagosConfirmados(c) {
  if (!c) return 0;
  var pagosDelCred = (S && Array.isArray(S.pagos))
    ? S.pagos.filter(function(p) {
        return p && !p.eliminado && p.estado === 'confirmado' &&
               p.cred === c.id && !p.esInicial && p.tipoOperacion !== 'inicial_credito';
      })
    : [];
  if (pagosDelCred.length) {
    return pagosDelCred.reduce(function(a, p) { return a + (parseFloat(p.monto) || 0); }, 0);
  }
  if (Array.isArray(c.pagosRegistrados) && c.pagosRegistrados.length) {
    return c.pagosRegistrados.reduce(function(a, h) { return a + (parseFloat(h.montoPagado) || 0); }, 0);
  }
  return (parseInt(c.pagado, 10) || 0) * getCreditoCuotaBase(c);
}
function getCreditoCuotasPagadas(c) {
  if (!c) return 0;
  var totalCuotas      = getCreditoTotalCuotas(c);
  var cuotaBase        = getCreditoCuotaBase(c);
  var pagadoRegistrado = parseInt(c.pagado, 10) || 0;
  var pagadoPorMonto   = cuotaBase > 0
    ? Math.floor((getCreditoPagosConfirmados(c) + 0.000001) / cuotaBase)
    : pagadoRegistrado;
  return Math.max(0, Math.min(totalCuotas, Math.max(pagadoRegistrado, pagadoPorMonto)));
}
function getCreditoSaldoPendiente(c) {
  return Math.max(0, (parseFloat((c && c.total) || 0) || 0) - getCreditoPagosConfirmados(c));
}

// ── Helpers de movimientos iniciales ─────────────────────────
function esMovimientoInicialCredito(m) {
  if (!m || m.eliminado) return false;
  var concepto = (m.concepto || '');
  return m.tipoOperacion === 'inicial_credito' || concepto.indexOf('Inicial · ') === 0;
}
function getTotalInicialesCobradas() {
  return (S && Array.isArray(S.movimientos) ? S.movimientos : [])
    .filter(esMovimientoInicialCredito)
    .reduce(function(a, m) { return a + (parseFloat(m.monto) || 0); }, 0);
}
