/**
 * MAGXOR ENGINE — Backend único (Google Apps Script Web App)
 * Pegar en Extensiones > Apps Script, luego ejecutar setupMagxor() una vez
 * y desplegar como Aplicación web (Ejecutar como: Yo / Acceso: Cualquiera).
 *
 * Seguridad:
 * - El Sheet NUNCA se publica en la web (Restringido).
 * - Lecturas públicas requieren READ_TOKEN. Escrituras sensibles requieren sesión admin.
 * - CREDENCIALES guarda PASS_HASH = SHA256(pass + salt). Jamás se devuelve al cliente.
 * - Control maestro en DATOS.ESTADO_CUENTA: SI | ATRASO | NO (suspende tienda y login).
 * - Config sensible extra protegida por ADMIN_PASS_HASH (acción verifyAdminPass).
 */

var SHEETS = {
  inventario: 'INVENTARIO',
  resenas: 'RESEÑAS',
  clientes: 'CLIENTES',
  pedidos: 'PEDIDOS',
  datos: 'DATOS',
  credenciales: 'CREDENCIALES'
};

var DATOS_HEADERS = ['NOMBRE WEB','HORARIOS','DIRECCIÓN','CONTACTO MINORISTA','CONTACTO MAYORISTA','CONTACTO TICKET','PALETA DE COLORES','ANUNCIO HEADER','ENDPOINT APPS SCRIPT','COLOR_PRESET','COLOR_PRIMARIO','COLOR_SECUNDARIO','MODO_OSCURO','LOGO_URL','FAVICON_URL','LOGO_ANIMADO_URL','SPLASH_ACTIVO','SPLASH_DURACION_MS','SPLASH_FONDO','SEO_TITULO','SEO_DESCRIPCION','SEO_KEYWORDS','SEO_URL_CANONICA','SEO_ROBOTS','MONEDA','ESTADO_CUENTA','SUSPENSION_IMAGE_URL','SUSPENSION_MENSAJE'];
var INV_HEADERS = ['Id','Nombre de Producto','Categoría','Descripción','Precio','Precio Oferta','Disponible','Oferta','Fotos'];
var RES_HEADERS = ['productId','name','rating','comment','date'];
var CLI_HEADERS = ['PHONE','DATE','METODO','CONTACTO'];
var PED_HEADERS = ['ID','FECHA','CLIENTE','TELEFONO','PRODUCTOS','TOTAL','ENTREGA','ESTADO'];
var CRED_HEADERS = ['USUARIO','PASS_HASH','SALT','ACTIVO','ROL','ADMIN_PASS_HASH','ADMIN_SALT'];

/* ---------- Setup / Admin de tokens ---------- */

function setupMagxor() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SHEETS.inventario, INV_HEADERS);
  ensureSheet(ss, SHEETS.resenas, RES_HEADERS);
  ensureSheet(ss, SHEETS.clientes, CLI_HEADERS);
  ensureSheet(ss, SHEETS.pedidos, PED_HEADERS);
  ensureSheet(ss, SHEETS.datos, DATOS_HEADERS);
  ensureSheet(ss, SHEETS.credenciales, CRED_HEADERS);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('READ_TOKEN')) props.setProperty('READ_TOKEN', randomToken(32));
  if (!props.getProperty('SESSION_TOKENS')) props.setProperty('SESSION_TOKENS', '{}');
  seedDefaultConfig(ss);
  migrarSeguridad(ss);
  Logger.log('READ_TOKEN: ' + props.getProperty('READ_TOKEN'));
  Logger.log('Crea tu admin con: crearAdmin("usuario","clave123","adminpass123")');
}

/**
 * Migra Sheets existentes: agrega columnas nuevas sin borrar datos.
 * Ejecutar una vez por tienda vieja después de actualizar Code.gs.
 */
function migrarSeguridad(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  mergeHeaders(ss, SHEETS.datos, DATOS_HEADERS);
  mergeHeaders(ss, SHEETS.credenciales, CRED_HEADERS);
  return 'Migración OK';
}

function mergeHeaders(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) { ss.insertSheet(name).appendRow(headers); return; }
  if (sh.getLastRow() < 1) { sh.appendRow(headers); return; }
  var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var missing = headers.filter(function (h) { return current.indexOf(String(h).toLowerCase()) === -1; });
  if (missing.length) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function crearAdmin(usuario, clave, adminPass) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, SHEETS.credenciales, CRED_HEADERS);
  mergeHeaders(ss, SHEETS.credenciales, CRED_HEADERS);
  var salt = randomToken(16);
  var hash = sha256Hex(clave + salt);
  var aSalt = randomToken(16);
  var aHash = adminPass ? sha256Hex(String(adminPass) + aSalt) : '';
  sh.appendRow([String(usuario).trim().toLowerCase(), hash, salt, 'SI', 'ADMIN', aHash, aSalt]);
  return 'Admin creado: ' + usuario;
}

/** Define o rota el Admin pass (config sensible) de un usuario. La clave en claro nunca se pega en el Sheet. */
function setAdminPass(usuario, nuevaAdminPass) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.credenciales);
  if (!sh) return 'Sin hoja CREDENCIALES';
  var data = sh.getDataRange().getValues();
  var u = String(usuario).trim().toLowerCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toLowerCase() === u) {
      var aSalt = randomToken(16);
      // Cols F/G (6/7). ensure width:
      if (sh.getLastColumn() < 7) mergeHeaders(ss, SHEETS.credenciales, CRED_HEADERS);
      sh.getRange(r + 1, 6).setValue(sha256Hex(String(nuevaAdminPass) + aSalt));
      sh.getRange(r + 1, 7).setValue(aSalt);
      return 'Admin pass actualizado para ' + usuario;
    }
  }
  return 'Usuario no encontrado';
}

function rotarReadToken() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('READ_TOKEN', randomToken(32));
  return props.getProperty('READ_TOKEN');
}

function cambiarClave(usuario, claveNueva) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.credenciales);
  if (!sh) return 'Sin hoja CREDENCIALES';
  var data = sh.getDataRange().getValues();
  var u = String(usuario).trim().toLowerCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toLowerCase() === u) {
      var salt = randomToken(16);
      sh.getRange(r + 1, 2).setValue(sha256Hex(claveNueva + salt));
      sh.getRange(r + 1, 3).setValue(salt);
      return 'Clave actualizada';
    }
  }
  return 'Usuario no encontrado';
}

/* ---------- Router ---------- */

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var params = collectParams(e);
  var action = String(params.action || '').trim();
  try {
    if (action === 'health') return json({ status: 'ok', action: action, time: new Date().toISOString() });
    if (action === 'login') return handleLogin(params);
    if (action === 'getConfig' || action === 'getProducts' || action === 'getReviews') {
      requireReadToken(params);
      if (action === 'getConfig') return json({ status: 'ok', config: readConfig() });
      if (action === 'getProducts') return json({ status: 'ok', products: readProducts() });
      return json({ status: 'ok', reviews: readReviews() });
    }
    // Escrituras públicas limitadas (con validación, sin lectura sensible)
    if (action === 'addOrder' || action === 'addReview' || action === 'addClient') {
      return handlePublicWrite(action, params);
    }
    // Todo lo demás requiere sesión admin
    requireSession(params);
    return handleAdminWrite(action, params);
  } catch (err) {
    return json({ status: 'error', action: action, message: String(err && err.message || err) });
  }
}

/* ---------- Auth ---------- */

function requireReadToken(params) {
  var expected = PropertiesService.getScriptProperties().getProperty('READ_TOKEN') || '';
  if (!expected || String(params.token || '') !== expected) throw new Error('Token de lectura inválido.');
}

function requireSession(params) {
  var tok = String(params.session || params.token || '');
  if (!tok) throw new Error('Sesión requerida.');
  var store = JSON.parse(PropertiesService.getScriptProperties().getProperty('SESSION_TOKENS') || '{}');
  var rec = store[tok];
  if (!rec || rec.exp < Date.now()) throw new Error('Sesión expirada. Inicia sesión de nuevo.');
}

function handleLogin(params) {
  var estado = getEstadoCuenta();
  if (estado === 'NO') throw new Error('Cuenta suspendida. Contactá a Magxor Engine.');
  var user = String(params.username || params.usuario || '').trim().toLowerCase();
  var pass = String(params.password || params.pass || '');
  if (!user || !pass) throw new Error('Usuario y contraseña requeridos.');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.credenciales);
  if (!sh) throw new Error('Sin credenciales configuradas.');
  var data = sh.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toLowerCase() === user) {
      var activo = String(data[r][3] || '').toUpperCase();
      if (activo !== 'SI' && activo !== 'SÍ') throw new Error('Cuenta pausada.');
      var hash = sha256Hex(pass + String(data[r][2] || ''));
      if (hash !== String(data[r][1] || '')) throw new Error('Usuario o contraseña incorrectos.');
      var tok = randomToken(48);
      var props = PropertiesService.getScriptProperties();
      var store = JSON.parse(props.getProperty('SESSION_TOKENS') || '{}');
      store[tok] = { user: user, exp: Date.now() + 12 * 3600 * 1000 };
      props.setProperty('SESSION_TOKENS', JSON.stringify(store));
      return json({ status: 'ok', session: tok, user: user, atraso: estado === 'ATRASO' });
    }
  }
  throw new Error('Usuario o contraseña incorrectos.');
}

/** Estado global de la cuenta desde DATOS: SI | ATRASO | NO (default SI). */
function getEstadoCuenta() {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.datos);
    if (!sh || sh.getLastRow() < 2) return 'SI';
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).toLowerCase().trim() === 'estado_cuenta' || String(headers[c]).toLowerCase().trim() === 'estado cuenta') {
        var v = String(row[c] || 'SI').toUpperCase().trim();
        if (v === 'NO' || v === 'ATRASO' || v === 'ATRASADO') return v === 'ATRASADO' ? 'ATRASO' : v;
        return 'SI';
      }
    }
  } catch (e) {}
  return 'SI';
}

/* ---------- Lecturas ---------- */

function readConfig() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.datos);
  if (!sh || sh.getLastRow() < 2) return defaultConfig();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
  var get = function (names) {
    for (var i = 0; i < names.length; i++) {
      for (var c = 0; c < headers.length; c++) {
        if (String(headers[c]).toLowerCase().trim() === String(names[i]).toLowerCase()) return String(row[c] || '');
      }
    }
    return '';
  };
  var cfg = defaultConfig();
  cfg.nombreWeb = get(['nombre web', 'nombre_web', 'nombre']) || cfg.nombreWeb;
  cfg.horarios = get(['horarios', 'horario']) || cfg.horarios;
  cfg.direccion = get(['dirección', 'direccion', 'address']) || cfg.direccion;
  cfg.contactoMinorista = get(['contacto minorista', 'contacto_minorista']) || cfg.contactoMinorista;
  cfg.contactoMayorista = get(['contacto mayorista', 'contacto_mayorista']) || cfg.contactoMayorista;
  cfg.contactoTicket = get(['contacto ticket', 'contacto_ticket']) || cfg.contactoMinorista;
  cfg.paletaColores = get(['paleta de colores', 'paleta_colores', 'paleta']) || cfg.paletaColores;
  cfg.anuncioHeader = get(['anuncio header', 'anuncio_header', 'anuncio']) || cfg.anuncioHeader;
  cfg.colorPreset = get(['color_preset', 'color preset']) || 'Azul';
  cfg.colorPrimario = get(['color_primario', 'color primario']) || '#2563EB';
  cfg.colorSecundario = get(['color_secundario', 'color secundario']) || '#4F46E5';
  cfg.modoOscuro = get(['modo_oscuro', 'modo oscuro']) || 'SI';
  cfg.logoUrl = get(['logo_url', 'logo url', 'logo']) || '';
  cfg.faviconUrl = get(['favicon_url', 'favicon url', 'favicon']) || '';
  cfg.logoAnimadoUrl = get(['logo_animado_url', 'logo animado url']) || '';
  cfg.splashActivo = get(['splash_activo', 'splash activo']) || 'NO';
  cfg.splashDuracionMs = parseInt(get(['splash_duracion_ms', 'splash duracion'])) || 2000;
  cfg.splashFondo = get(['splash_fondo', 'splash fondo']) || '#0A0A0A';
  cfg.seoTitulo = get(['seo_titulo', 'seo titulo']) || (cfg.nombreWeb + ' — Tienda online');
  cfg.seoDescripcion = get(['seo_descripcion', 'seo descripcion']) || ('Catálogo online de ' + cfg.nombreWeb + '.');
  cfg.seoKeywords = get(['seo_keywords', 'seo keywords']) || 'tienda online, catálogo, ofertas';
  cfg.seoUrlCanonica = get(['seo_url_canonica', 'seo url canonica', 'url']) || '';
  cfg.seoRobots = get(['seo_robots', 'seo robots']) || 'index, follow';
  cfg.moneda = get(['moneda', 'currency']) || 'ARS';
  var est = get(['estado_cuenta', 'estado cuenta', 'estado']) || 'SI';
  est = String(est).toUpperCase().trim();
  cfg.estadoCuenta = (est === 'NO' || est === 'ATRASO' || est === 'ATRASADO') ? (est === 'ATRASADO' ? 'ATRASO' : est) : 'SI';
  cfg.suspensionImageUrl = get(['suspension_image_url', 'suspension image url', 'imagen suspension', 'suspension_imagen']) || '';
  cfg.suspensionMensaje = get(['suspension_mensaje', 'suspension mensaje', 'mensaje suspension']) || '';
  return cfg;
}

function readProducts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.inventario) || ss.getSheetByName('PRODUCTOS');
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var col = function () {
    for (var i = 0; i < arguments.length; i++) {
      var idx = headers.indexOf(String(arguments[i]).toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  var cId = col('id', 'codigo', 'código', 'sku');
  var cNom = -1, cCat = -1, cDesc = -1, cPre = -1, cOfe = -1, cSto = -1, cPro = -1, cFot = -1;
  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (cNom === -1 && (h.indexOf('nombre') !== -1 || h === 'producto' || h === 'name' || h === 'title')) cNom = c;
    if (cCat === -1 && (h.indexOf('categor') !== -1 || h === 'category' || h === 'rubro')) cCat = c;
    if (cDesc === -1 && (h.indexOf('descrip') !== -1 || h === 'description' || h === 'detalle')) cDesc = c;
    if (cPre === -1 && (h === 'precio' || h === 'price' || h === 'valor')) cPre = c;
    if (cOfe === -1 && (h === 'precio oferta' || h === 'precio_oferta')) cOfe = c;
    if (cSto === -1 && (h.indexOf('dispon') !== -1 || h === 'stock' || h === 'cantidad')) cSto = c;
    if (cPro === -1 && (h === 'oferta' || h.indexOf('promo') !== -1)) cPro = c;
    if (cFot === -1 && (h === 'fotos' || h === 'foto' || h === 'imagen' || h === 'image')) cFot = c;
  }
  var out = [];
  for (var r = 1; r < data.length; r++) {
    out.push({
      id: String(cId !== -1 ? data[r][cId] : r),
      nombre: String(cNom !== -1 ? data[r][cNom] : ''),
      categoria: String(cCat !== -1 ? data[r][cCat] : ''),
      descripcion: String(cDesc !== -1 ? data[r][cDesc] : ''),
      precio: String(cPre !== -1 ? data[r][cPre] : '0'),
      precioOferta: String(cOfe !== -1 ? data[r][cOfe] : ''),
      disponible: String(cSto !== -1 ? data[r][cSto] : 'SI'),
      oferta: String(cPro !== -1 ? data[r][cPro] : 'NO'),
      fotos: String(cFot !== -1 ? data[r][cFot] : '')
    });
  }
  return out.filter(function (p) { return p.nombre; });
}

function readReviews() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.resenas);
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    out.push({ productId: String(data[r][0] || ''), name: String(data[r][1] || 'Cliente'), rating: parseInt(data[r][2]) || 5, comment: String(data[r][3] || ''), date: String(data[r][4] || '') });
  }
  return out;
}

/* ---------- Escrituras ---------- */

function handlePublicWrite(action, p) {
  if (getEstadoCuenta() === 'NO') throw new Error('Tienda suspendida.');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'addReview') {
      var rs = ensureSheet(ss, SHEETS.resenas, RES_HEADERS);
      rs.appendRow([s(p.productId, 50), s(p.name, 80) || 'Cliente', Math.min(5, Math.max(1, parseInt(p.rating) || 5)), s(p.comment, 1000), s(p.date, 30)]);
    } else if (action === 'addClient') {
      var cs = ensureSheet(ss, SHEETS.clientes, CLI_HEADERS);
      var phone = String(p.phone || '').replace(/[^0-9+]/g, '').slice(0, 20);
      if (phone.length < 6) throw new Error('Teléfono inválido.');
      cs.appendRow([phone, s(p.date, 30), s(p.metodo, 40) || 'Club WhatsApp', 'NO']);
    } else if (action === 'addOrder') {
      var os = ensureSheet(ss, SHEETS.pedidos, PED_HEADERS);
      if (!p.cliente && !p.nombre) throw new Error('Falta nombre del cliente.');
      os.appendRow([s(p.id, 30), s(p.fecha, 40), s(p.cliente || p.nombre, 120), s(p.telefono, 30), s(p.productos, 5000), parseFloat(p.total) || 0, s(p.entrega, 120), 'PENDIENTE']);
    }
    return json({ status: 'ok', action: action });
  } finally { lock.releaseLock(); }
}

function handleAdminWrite(action, p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh, data, r;
    if (action === 'listOrders') return json({ status: 'ok', orders: sheetToObjects(ss.getSheetByName(SHEETS.pedidos)) });
    if (action === 'listClients') return json({ status: 'ok', clients: sheetToObjects(ss.getSheetByName(SHEETS.clientes)) });
    if (action === 'updateOrderStatus') {
      sh = ss.getSheetByName(SHEETS.pedidos);
      r = findRowById(sh, ['id', 'codigo', 'código', 'pedido'], p.id);
      if (r !== -1) sh.getRange(r, colIndex(sh, ['estado', 'status']) + 1).setValue(s(p.estado, 20) || 'PENDIENTE');
      return json({ status: 'ok', action: action });
    }
    if (action === 'deleteOrder') {
      sh = ss.getSheetByName(SHEETS.pedidos);
      r = findRowById(sh, ['id', 'codigo', 'código', 'pedido'], p.id);
      if (r !== -1) sh.deleteRow(r);
      return json({ status: 'ok', action: action });
    }
    if (action === 'updateClientContact' || action === 'deleteClient') {
      sh = ss.getSheetByName(SHEETS.clientes);
      data = sh.getDataRange().getValues();
      var pc = colIndex(sh, ['phone', 'telefono', 'teléfono', 'celular']) ;
      if (pc === -1) pc = 0;
      var target = String(p.phone || '').replace(/[^0-9]/g, '');
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][pc]).replace(/[^0-9]/g, '') === target) {
          if (action === 'deleteClient') sh.deleteRow(i + 1);
          else { var cc = colIndex(sh, ['contacto']); if (cc !== -1) sh.getRange(i + 1, cc + 1).setValue('SI'); }
          break;
        }
      }
      return json({ status: 'ok', action: action });
    }
    if (action === 'addProduct' || action === 'updateProduct' || action === 'deleteProduct') {
      sh = ss.getSheetByName(SHEETS.inventario) || ss.getSheetByName('PRODUCTOS') || ensureSheet(ss, SHEETS.inventario, INV_HEADERS);
      if (action === 'addProduct') {
        sh.appendRow([s(p.id, 40), s(p.nombre, 200), s(p.categoria, 80), s(p.descripcion, 2000), s(p.precio, 20), s(p.precio_oferta || p.precioOferta, 20), s(p.disponible, 10) || 'SI', s(p.oferta, 10) || 'NO', s(p.fotos, 2000)]);
      } else if (action === 'deleteProduct') {
        r = findRowById(sh, ['id', 'codigo', 'código', 'sku'], p.id);
        if (r !== -1) sh.deleteRow(r);
      } else {
        r = findRowById(sh, ['id', 'codigo', 'código', 'sku'], p.id);
        if (r !== -1) {
          var map = productColMap(sh);
          if (p.nombre !== undefined && map.nombre !== -1) sh.getRange(r, map.nombre + 1).setValue(s(p.nombre, 200));
          if (p.categoria !== undefined && map.categoria !== -1) sh.getRange(r, map.categoria + 1).setValue(s(p.categoria, 80));
          if (p.descripcion !== undefined && map.descripcion !== -1) sh.getRange(r, map.descripcion + 1).setValue(s(p.descripcion, 2000));
          if (p.precio !== undefined && map.precio !== -1) sh.getRange(r, map.precio + 1).setValue(s(p.precio, 20));
          if ((p.precio_oferta !== undefined || p.precioOferta !== undefined) && map.precioOferta !== -1) sh.getRange(r, map.precioOferta + 1).setValue(s(p.precio_oferta !== undefined ? p.precio_oferta : p.precioOferta, 20));
          if (p.disponible !== undefined && map.disponible !== -1) sh.getRange(r, map.disponible + 1).setValue(s(p.disponible, 10));
          if (p.oferta !== undefined && map.oferta !== -1) sh.getRange(r, map.oferta + 1).setValue(s(p.oferta, 10));
          if (p.fotos !== undefined && map.fotos !== -1) sh.getRange(r, map.fotos + 1).setValue(s(p.fotos, 2000));
        }
      }
      return json({ status: 'ok', action: action });
    }
    if (action === 'updateConfig') {
      var ds = ensureSheet(ss, SHEETS.datos, DATOS_HEADERS);
      var vals = DATOS_HEADERS.map(function (h) { return configValueFor(h, p); });
      if (ds.getLastRow() > 1) ds.deleteRows(2, ds.getLastRow() - 1);
      ds.appendRow(vals);
      return json({ status: 'ok', action: action });
    }
    if (action === 'changePassword') {
      var me = currentSessionUser(p);
      cambiarClave(p.username || me, String(p.newPassword || ''));
      return json({ status: 'ok', action: action });
    }
    if (action === 'verifyAdminPass') {
      var who = currentSessionUser(p);
      var targetUser = String(p.username || who || '').trim().toLowerCase();
      var sh = ss.getSheetByName(SHEETS.credenciales);
      if (!sh) throw new Error('Sin credenciales configuradas.');
      var rows = sh.getDataRange().getValues();
      for (var r = 1; r < rows.length; r++) {
        if (String(rows[r][0]).trim().toLowerCase() === targetUser) {
          var ah = String(rows[r][5] || '');
          var as = String(rows[r][6] || '');
          if (!ah) throw new Error('Admin pass no configurado. Pedilo con setAdminPass().');
          if (sha256Hex(String(p.adminPass || '') + as) !== ah) throw new Error('Admin pass incorrecto.');
          return json({ status: 'ok', action: action });
        }
      }
      throw new Error('Usuario no encontrado.');
    }
    if (action === 'changeAdminPass') {
      var me2 = currentSessionUser(p);
      setAdminPass(p.username || me2, String(p.newAdminPass || ''));
      return json({ status: 'ok', action: action });
    }
    throw new Error('Acción no soportada: ' + action);
  } finally { lock.releaseLock(); }
}

/* ---------- Helpers ---------- */

function collectParams(e) {
  var params = {};
  if (e && e.parameter) for (var k in e.parameter) params[k] = e.parameter[k];
  if (e && e.postData && e.postData.contents) {
    try { var b = JSON.parse(e.postData.contents); for (var k2 in b) params[k2] = b[k2]; } catch (err) {}
  }
  return params;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function s(v, max) { v = String(v === undefined || v === null ? '' : v); return max ? v.slice(0, max) : v; }

function sha256Hex(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function randomToken(n) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var out = '';
  for (var i = 0; i < n; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function ensureSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); }
  return sh;
}

function defaultConfig() {
  return { nombreWeb: 'Magxor Engine', horarios: 'Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00', direccion: '', contactoMinorista: '', contactoMayorista: '', contactoTicket: '', paletaColores: 'Azul / Oscuro', anuncioHeader: '', colorPreset: 'Azul', colorPrimario: '#2563EB', colorSecundario: '#4F46E5', modoOscuro: 'SI', logoUrl: '', faviconUrl: '', logoAnimadoUrl: '', splashActivo: 'NO', splashDuracionMs: 2000, splashFondo: '#0A0A0A', seoTitulo: 'Magxor Engine — Tienda online', seoDescripcion: 'Catálogo online de Magxor Engine.', seoKeywords: 'tienda online, catálogo, ofertas', seoUrlCanonica: '', seoRobots: 'index, follow', moneda: 'ARS', estadoCuenta: 'SI', suspensionImageUrl: '', suspensionMensaje: '' };
}

function seedDefaultConfig(ss) {
  var sh = ss.getSheetByName(SHEETS.datos);
  if (sh && sh.getLastRow() >= 2) return;
  var d = defaultConfig();
  sh.appendRow([d.nombreWeb, d.horarios, d.direccion, d.contactoMinorista, d.contactoMayorista, d.contactoTicket, d.paletaColores, d.anuncioHeader, '', d.colorPreset, d.colorPrimario, d.colorSecundario, d.modoOscuro, d.logoUrl, d.faviconUrl, d.logoAnimadoUrl, d.splashActivo, d.splashDuracionMs, d.splashFondo, d.seoTitulo, d.seoDescripcion, d.seoKeywords, d.seoUrlCanonica, d.seoRobots, d.moneda, d.estadoCuenta, d.suspensionImageUrl, d.suspensionMensaje]);
}

function configValueFor(header, p) {
  var h = String(header).toLowerCase();
  var pick = function () { for (var i = 0; i < arguments.length; i++) { if (p[arguments[i]] !== undefined) return String(p[arguments[i]]); } return ''; };
  if (h === 'nombre web') return pick('nombre_web', 'nombreWeb', 'nombre');
  if (h === 'horarios') return pick('horarios');
  if (h.indexOf('direcci') !== -1) return pick('direccion');
  if (h.indexOf('minorista') !== -1) return pick('contacto_minorista', 'contactoMinorista');
  if (h.indexOf('mayorista') !== -1) return pick('contacto_mayorista', 'contactoMayorista');
  if (h.indexOf('ticket') !== -1) return pick('contacto_ticket', 'contactoTicket');
  if (h.indexOf('paleta') !== -1) return pick('paleta_colores', 'paletaColores');
  if (h.indexOf('anuncio') !== -1) return pick('anuncio_header', 'anuncioHeader');
  if (h.indexOf('endpoint') !== -1) return pick('endpoint_apps_script');
  if (h === 'color_preset') return pick('color_preset', 'colorPreset');
  if (h === 'color_primario') return pick('color_primario', 'colorPrimario');
  if (h === 'color_secundario') return pick('color_secundario', 'colorSecundario');
  if (h === 'modo_oscuro') return pick('modo_oscuro', 'modoOscuro');
  if (h === 'logo_url') return pick('logo_url', 'logoUrl');
  if (h === 'favicon_url') return pick('favicon_url', 'faviconUrl');
  if (h === 'logo_animado_url') return pick('logo_animado_url', 'logoAnimadoUrl');
  if (h === 'splash_activo') return pick('splash_activo', 'splashActivo');
  if (h === 'splash_duracion_ms') return pick('splash_duracion_ms', 'splashDuracionMs');
  if (h === 'splash_fondo') return pick('splash_fondo', 'splashFondo');
  if (h === 'seo_titulo') return pick('seo_titulo', 'seoTitulo');
  if (h === 'seo_descripcion') return pick('seo_descripcion', 'seoDescripcion');
  if (h === 'seo_keywords') return pick('seo_keywords', 'seoKeywords');
  if (h === 'seo_url_canonica') return pick('seo_url_canonica', 'seoUrlCanonica');
  if (h === 'seo_robots') return pick('seo_robots', 'seoRobots');
  if (h === 'moneda') return pick('moneda');
  if (h === 'estado_cuenta') return pick('estado_cuenta', 'estadoCuenta');
  if (h === 'suspension_image_url') return pick('suspension_image_url', 'suspensionImageUrl');
  if (h === 'suspension_mensaje') return pick('suspension_mensaje', 'suspensionMensaje');
  return '';
}

function sheetToObjects(sh) {
  if (!sh || sh.getLastRow() < 1) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var o = {};
    for (var c = 0; c < headers.length; c++) o[String(headers[c])] = data[r][c];
    out.push(o);
  }
  return out;
}

function colIndex(sh, names) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < names.length; i++) {
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).toLowerCase().trim() === String(names[i]).toLowerCase()) return c;
    }
  }
  return -1;
}

function findRowById(sh, names, id) {
  if (!sh) return -1;
  var data = sh.getDataRange().getValues();
  var idx = -1;
  var headers = data[0];
  for (var i = 0; i < names.length; i++) {
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).toLowerCase().trim() === String(names[i]).toLowerCase()) { idx = c; break; }
    }
    if (idx !== -1) break;
  }
  if (idx === -1) idx = 0;
  var target = String(id || '').toLowerCase().trim();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx]).toLowerCase().trim() === target) return r + 1;
  }
  return -1;
}

function productColMap(sh) {
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).toLowerCase().trim(); });
  var find = function (test) { for (var c = 0; c < headers.length; c++) { if (test(headers[c])) return c; } return -1; };
  return {
    nombre: find(function (h) { return h.indexOf('nombre') !== -1 || h === 'producto' || h === 'name'; }),
    categoria: find(function (h) { return h.indexOf('categor') !== -1 || h === 'category'; }),
    descripcion: find(function (h) { return h.indexOf('descrip') !== -1 || h === 'description'; }),
    precio: find(function (h) { return h === 'precio' || h === 'price' || h === 'valor'; }),
    precioOferta: find(function (h) { return h === 'precio oferta' || h === 'precio_oferta'; }),
    disponible: find(function (h) { return h.indexOf('dispon') !== -1 || h === 'stock'; }),
    oferta: find(function (h) { return h === 'oferta' || h.indexOf('promo') !== -1; }),
    fotos: find(function (h) { return h === 'fotos' || h === 'foto' || h === 'imagen' || h === 'image'; })
  };
}

function currentSessionUser(p) {
  var tok = String(p.session || p.token || '');
  try {
    var store = JSON.parse(PropertiesService.getScriptProperties().getProperty('SESSION_TOKENS') || '{}');
    return store[tok] ? store[tok].user : '';
  } catch (e) { return ''; }
}
