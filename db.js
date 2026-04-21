// ═══════════════════════════════════════════════════════════════
// db.js — Pagasi
// Inicialización de Firebase, objeto DB, cola offline y cache de motos.
// Depende de: utils.js (clean, showLoader, hideLoader, toast)
//             state.js (S, PLAN, CATALOGO, calcularMoraAuto)
// Debe cargarse DESPUÉS de utils.js y state.js
// ═══════════════════════════════════════════════════════════════

// ╔══════════════════════════════════════════════════════════╗
// ║   CONFIGURACIÓN DE FIREBASE                             ║
// ║   Si cambias el proyecto, actualiza solo este bloque.   ║
// ╚══════════════════════════════════════════════════════════╝
var FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDrtg1AOD3nX1bnS3WW87g14ofa9_OPxDo',
  authDomain:        'pagasi-b859b.firebaseapp.com',
  projectId:         'pagasi-b859b',
  storageBucket:     'pagasi-b859b.firebasestorage.app',
  messagingSenderId: '230117681047',
  appId:             '1:230117681047:web:53dc6a914fec4068f606d2'
};

// ── Referencias globales ─────────────────────────────────────
var db             = null;
var auth           = null;
var FIREBASE_READY = false;

// ── Credenciales locales (modo sin Firebase) ─────────────────
// ⚠ IMPORTANTE: Configura usuario y contraseña en
//   Configuración → Acceso Local antes de desplegar.
var USERS_LOCAL    = [{ user: '', pass: '', nombre: 'Administrador', rol: 'Administrador' }];
var LOCAL_CREDS_KEY = 'pagasi_local_creds';

// ── Inicialización de Firebase ───────────────────────────────
try {
  if (typeof firebase === 'undefined') {
    console.warn('SDK de Firebase no cargado — modo local activo');
  } else if (FIREBASE_CONFIG.apiKey !== 'TU_API_KEY') {
    var _existingApp;
    try { _existingApp = firebase.app(); } catch (ex) {}
    if (!_existingApp) firebase.initializeApp(FIREBASE_CONFIG);
    if (typeof firebase.firestore !== 'function') {
      throw new Error('Firestore bundle no cargado. Habilita Firestore Database en Firebase Console.');
    }
    db   = firebase.firestore();
    if (typeof firebase.auth === 'function') auth = firebase.auth();
    FIREBASE_READY = true;
    console.log('Firebase inicializado correctamente');
  } else {
    console.warn('⚠ Firebase no configurado — usando modo local');
  }
} catch (e) { console.warn('Firebase init:', e.message); }

// ── Cola offline: guarda operaciones pendientes sin conexión ──
var _dbQueue  = [];
var _dbOnline = true;
window.addEventListener('online',  function() { _dbOnline = true;  _flushDbQueue(); });
window.addEventListener('offline', function() { _dbOnline = false; });

function _dbSilent(fn) {
  try {
    var p = fn();
    if (p && p.catch) p.catch(function(e) {
      var msg = e.message || '';
      // Ignorar errores de transporte — la persistencia offline los reintenta
      if (msg.includes('transport') || msg.includes('WebChannel') ||
          msg.includes('network')   || e.code === 'unavailable') return;
      console.warn('DB write error:', msg);
    });
  } catch (e) { console.warn('DB error:', e.message); }
}

function _flushDbQueue() {
  var q = _dbQueue.slice();
  _dbQueue = [];
  q.forEach(function(fn) { _dbSilent(fn); });
}

// ── Cache local de motos (sobrevive recargas sin Firebase) ───
var MOTOS_CACHE_KEY = 'pagasi_motos_cache_v1';

function loadMotosCache() {
  try {
    var raw = localStorage.getItem(MOTOS_CACHE_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveMotosCache(arr) {
  try { localStorage.setItem(MOTOS_CACHE_KEY, JSON.stringify(Array.isArray(arr) ? arr : [])); } catch (e) {}
}
function upsertMotoCache(moto) {
  try {
    var arr = loadMotosCache();
    var i = arr.findIndex(function(x) { return String(x.id) === String(moto.id); });
    if (i >= 0) arr[i] = clean(moto); else arr.push(clean(moto));
    saveMotosCache(arr);
  } catch (e) {}
}
function delMotoCache(id) {
  try {
    var arr = loadMotosCache().filter(function(x) { return String(x.id) !== String(id); });
    saveMotosCache(arr);
  } catch (e) {}
}
function mergeMotosPreferLocal(remote, local) {
  var map = {};
  (Array.isArray(remote) ? remote : []).forEach(function(x) { if (x && x.id != null) map[String(x.id)] = x; });
  (Array.isArray(local)  ? local  : []).forEach(function(x) { if (x && x.id != null) map[String(x.id)] = x; });
  return Object.keys(map).map(function(k) { return map[k]; });
}

// ── Mappers (Firebase guarda el mismo objeto, sin conversión) ─
function mapMoto(r) { return r; }
function mapCred(r) { return r; }
function mapPago(r) { return r; }

// ── Objeto DB — todas las operaciones de persistencia ────────
var DB = {

  load: function() {
    var motosCacheLocal = loadMotosCache();
    if (!db) {
      if (motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
      return Promise.resolve();
    }
    showLoader('Cargando datos...', 'Conectando con Firebase');
    return Promise.all([
      db.collection('motos').get(),
      db.collection('clientes').get(),
      db.collection('creditos').get(),
      db.collection('pagos').get(),
      db.collection('egresos').get(),
      Promise.resolve({ docs: [] }),          // slot reservado
      db.collection('movimientos').get(),
      db.collection('cuentasPendientes').get(),
      db.collection('config').doc('plan').get(),
      db.collection('config').doc('catalogo').get(),
      db.collection('config').doc('planes').get(),
    ]).then(function(snaps) {
      function read(snap) { return snap.docs.map(function(d) { return d.data(); }); }
      var m   = read(snaps[0]);
      var cl  = read(snaps[1]);
      var cr  = read(snaps[2]);
      var p   = read(snaps[3]);
      var e   = read(snaps[4]);
      var mv  = read(snaps[6]);
      var pnd = read(snaps[7]);
      var planDoc     = snaps[8];
      var catalogoDoc = snaps[9];
      var planesDoc   = snaps[10];

      // Actualizar PLAN desde Firebase
      if (planDoc && planDoc.exists) {
        var pd = planDoc.data() || {};
        if (Object.prototype.hasOwnProperty.call(pd, 'factor'))      PLAN.factor      = pd.factor;
        if (Object.prototype.hasOwnProperty.call(pd, 'inicial'))     PLAN.inicial     = pd.inicial;
        if (Object.prototype.hasOwnProperty.call(pd, 'tasaMensual')) PLAN.tasaMensual = pd.tasaMensual;
        if (Object.prototype.hasOwnProperty.call(pd, 'plazo'))       PLAN.plazo       = pd.plazo;
        if (Object.prototype.hasOwnProperty.call(pd, 'apy'))         PLAN.apy         = pd.apy;
        var graciaCfg = Object.prototype.hasOwnProperty.call(pd, 'diasGracia') ? pd.diasGracia : pd.gracia;
        if (typeof graciaCfg !== 'undefined' && graciaCfg !== null) PLAN.diasGracia = graciaCfg;
        var moraCfg = Object.prototype.hasOwnProperty.call(pd, 'moraPct') ? pd.moraPct : pd.mora_pct;
        if (typeof moraCfg !== 'undefined' && moraCfg !== null) PLAN.moraPct = moraCfg;
      }

      // Actualizar CATALOGO desde Firebase
      if (catalogoDoc && catalogoDoc.exists) {
        var catData = catalogoDoc.data() || {};
        if (Array.isArray(catData.items) && catData.items.length) {
          CATALOGO.splice(0, CATALOGO.length);
          catData.items.forEach(function(item) { CATALOGO.push(item); });
        }
      }

      // Planes extra
      if (planesDoc && planesDoc.exists) {
        var extraData = planesDoc.data() || {};
        window._planesExtra = Array.isArray(extraData.items) ? extraData.items : [];
      } else {
        window._planesExtra = window._planesExtra || [];
      }

      // Poblar estado global
      S.motos             = mergeMotosPreferLocal(m.map(mapMoto), motosCacheLocal);
      S.clientes          = cl;
      S.creds             = cr.map(mapCred);
      S.pagos             = p.map(mapPago);
      S.egresos           = e;
      S.movimientos       = mv;
      S.cuentasPendientes = pnd;

      saveMotosCache(S.motos);
      if (typeof calcularMoraAuto === 'function') calcularMoraAuto();
      if (typeof cargarCuentasBanc === 'function') cargarCuentasBanc();
      if (typeof cargarEmpresa === 'function') cargarEmpresa();
      hideLoader();
      setTimeout(function() {
        if (typeof mostrarAlertaMora === 'function') mostrarAlertaMora();
      }, 800);

    }).catch(function(e) {
      hideLoader();
      if (motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
      if (e.code === 'unavailable' || (e.message && e.message.includes('network'))) {
        toast('Sin conexión — modo offline activo', 'info');
      } else {
        toast('Error al cargar datos: ' + e.message, 'error');
      }
    });
  },

  // ── Motos ──
  saveMoto:  function(o)  { upsertMotoCache(o); if (!db) return; _dbSilent(function() { return db.collection('motos').doc(String(o.id)).set(clean(o)); }); },
  delMoto:   function(id) { delMotoCache(id);   if (!db) return; _dbSilent(function() { return db.collection('motos').doc(String(id)).delete(); }); },

  // ── Clientes ──
  saveCliente: function(o)  { if (!db) return; _dbSilent(function() { return db.collection('clientes').doc(String(o.id)).set(clean(o)); }); },
  delCliente:  function(id) { if (!db) return; _dbSilent(function() { return db.collection('clientes').doc(String(id)).delete(); }); },

  // ── Créditos ──
  saveCred:   function(o)    { if (!db) return; _dbSilent(function() { return db.collection('creditos').doc(o.id).set(clean(o)); }); },
  updateCred: function(id,u) { if (!db) return; _dbSilent(function() { return db.collection('creditos').doc(id).update(u); }); },

  // ── Pagos ──
  savePago: function(o) { if (!db) return; _dbSilent(function() { return db.collection('pagos').doc(o.id).set(clean(o)); }); },

  // ── Egresos ──
  saveEgreso: function(o)  { if (!db) return; _dbSilent(function() { return db.collection('egresos').doc(String(o.id)).set(clean(o)); }); },
  delEgreso:  function(id) { if (!db) return; _dbSilent(function() { return db.collection('egresos').doc(String(id)).delete(); }); },

  // ── Usuarios e invitaciones ──
  getUsuarios:    function()       { if (!db) return Promise.resolve([]); return db.collection('usuarios').get().then(function(s) { return s.docs.map(function(d) { return Object.assign({ uid: d.id }, d.data()); }); }); },
  saveUsuario:    function(uid, d) { if (!db) return Promise.resolve(); return db.collection('usuarios').doc(uid).set(d, { merge: true }); },
  updateUsuario:  function(uid, d) { if (!db) return; _dbSilent(function() { return db.collection('usuarios').doc(uid).update(d); }); },
  deleteUsuario:  function(uid)    { if (!db) return; _dbSilent(function() { return db.collection('usuarios').doc(uid).delete(); }); },
  saveInvitacion: function(token, d) { if (!db) return; return db.collection('invitaciones').doc(token).set(d); },
  getInvitacion:  function(token)    { if (!db) return Promise.resolve(null); return db.collection('invitaciones').doc(token).get(); },
  usarInvitacion: function(token, uid) { if (!db) return; _dbSilent(function() { return db.collection('invitaciones').doc(token).update({ usado: true, uid: uid, fechaUso: new Date().toISOString() }); }); },

  // ── Cuentas bancarias ──
  saveCuenta:   function(o)    { if (!db) return; _dbSilent(function() { return db.collection('cuentas').doc(String(o.id)).set(clean(o)); }); },
  delCuenta:    function(id)   { if (!db) return; _dbSilent(function() { return db.collection('cuentas').doc(String(id)).delete(); }); },
  updateCuenta: function(id,u) { if (!db) return; _dbSilent(function() { return db.collection('cuentas').doc(String(id)).update(u); }); },

  // ── Movimientos ──
  saveMovimiento: function(o)  { if (!db) return; _dbSilent(function() { return db.collection('movimientos').doc(o.id).set(clean(o)); }); },
  delMovimiento:  function(id) { if (!db) return; _dbSilent(function() { return db.collection('movimientos').doc(id).delete(); }); },
};

// ── Restaurar credenciales locales desde localStorage ────────
(function() {
  try {
    var saved = localStorage.getItem(LOCAL_CREDS_KEY);
    if (saved) {
      var creds = JSON.parse(saved);
      if (creds && creds.user && (creds.passwordHash || creds.pass)) {
        USERS_LOCAL[0] = creds;
      }
    }
  } catch (e) {}
})();
