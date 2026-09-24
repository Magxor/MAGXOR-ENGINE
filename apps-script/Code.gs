/**
 * MAGXOR ENGINE — Backend único (Google Apps Script Web App) — V3
 * 
 * CAMBIOS EN FLUJO DE ESTADOS DE CUENTA:
 * - Estado SI: login sin problema
 * - Estado ATRASO: toast al login + banner permanente
 * - Estado NO: login bloqueado
 *
 * LIMPIEZA V3:
 * - Acción getEstadoCuenta eliminada → reemplazada por sessionPing
 *   (valida sesión, renueva expiración deslizante y devuelve estadoCuenta).
 * - Acciones changePassword / changeAdminPass eliminadas (no usadas por el
 *   frontend; se usan cambiarClave() / setAdminPass() desde el editor).
 * - Campo MODO_OSCURO eliminado (el dark mode es un toggle local del visitante).
 * - Campo PALETA DE COLORES deprecado (solo lectura por compatibilidad con
 *   tiendas viejas; el color se gestiona con COLOR_PRESET/PRIMARIO/SECUNDARIO).
 * - updateConfig ahora hace lectura-modificación-escritura: solo pisa los
 *   campos enviados y escribe alineado a los encabezados reales de la hoja
 *   (antes borraba SEO/splash/moneda/estado en cada guardado del Admin).
 *
 * CARRITOS PERDIDOS (suspensión):
 * - addOrder bloqueado por estado NO/ATRASO → se asienta en AUDIT_LOG como
 *   'carrito_perdido' con detalle completo (cliente, teléfono, productos,
 *   total, entrega).
 * - Nueva acción pública 'logLostCart': el frontend registra el checkout
 *   bloqueado localmente. Se acepta en cualquier estado y no crea pedidos.
 * 
 * Pegar en Extensiones > Apps Script, luego ejecutar setupMagxor() una vez
 * y desplegar como Aplicación web (Ejecutar como: Yo / Acceso: Cualquiera).
 * Tiendas existentes: ejecutar migrarSeguridad() una vez tras actualizar.
 */

var SHEETS = {
  inventario: 'INVENTARIO',
  resenas: 'RESEÑAS',
  clientes: 'CLIENTES',
  pedidos: 'PEDIDOS',
  datos: 'DATOS',
  credenciales: 'CREDENCIALES',
  auditLog: 'AUDIT_LOG'
};

var DATOS_HEADERS = ['NOMBRE WEB','SLOGAN','HORARIOS','DIRECCIÓN','CONTACTO MINORISTA','CONTACTO MAYORISTA','CONTACTO TICKET','ANUNCIO HEADER','ENDPOINT APPS SCRIPT','COLOR_PRESET','COLOR_PRIMARIO','COLOR_SECUNDARIO','LOGO_URL','FAVICON_URL','LOGO_ANIMADO_URL','SPLASH_ACTIVO','SPLASH_DURACION_MS','SPLASH_FONDO','SEO_TITULO','SEO_DESCRIPCION','SEO_KEYWORDS','SEO_URL_CANONICA','SEO_ROBOTS','MONEDA','ESTADO_CUENTA','SUSPENSION_IMAGE_URL','SUSPENSION_MENSAJE'];
var INV_HEADERS = ['Id','Nombre de Producto','Categoría','Descripción','Precio','Precio Oferta','Disponible','Oferta','Fotos'];
var RES_HEADERS = ['productId','name','rating','comment','date'];
var CLI_HEADERS = ['PHONE','DATE','METODO','CONTACTO'];
var PED_HEADERS = ['ID','FECHA','CLIENTE','TELEFONO','PRODUCTOS','TOTAL','ENTREGA','ESTADO'];
var CRED_HEADERS = ['USUARIO','PASS_HASH','SALT','ACTIVO','ROL','ADMIN_PASS_HASH','ADMIN_SALT'];
var AUDIT_HEADERS = ['FECHA','USUARIO','ACCION','DETALLES','ESTADO_ANTERIOR','ESTADO_NUEVO'];

/* ---------- Setup / Admin de tokens ---------- */

// Instalador único del motor. Ejecutar UNA vez, luego desplegar como Web App.
function InstalarMagxorEngine() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SHEETS.inventario, INV_HEADERS);
  ensureSheet(ss, SHEETS.resenas, RES_HEADERS);
  ensureSheet(ss, SHEETS.clientes, CLI_HEADERS);
  ensureSheet(ss, SHEETS.pedidos, PED_HEADERS);
  ensureSheet(ss, SHEETS.datos, DATOS_HEADERS);
  ensureSheet(ss, SHEETS.credenciales, CRED_HEADERS);
  ensureSheet(ss, SHEETS.auditLog, AUDIT_HEADERS);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('READ_TOKEN')) props.setProperty('READ_TOKEN', randomToken(32));
  if (!props.getProperty('SESSION_TOKENS')) props.setProperty('SESSION_TOKENS', '{}');
  seedDefaultConfig(ss);
  migrarSeguridad(ss);
  limpiarSesionesExpiradas();

  // 1) ROL DESARROLLADOR (acceso total, no figura como credencial gestionable)
  asegurarUsuario('magxor', 'IM130906', '1133627618', 'DESARROLLADOR');
  // 2) ROL ADMINISTRADOR inicial (debe cambiar sus credenciales al primer login)
  asegurarUsuario('admin', 'bienvenido', '', 'ADMINISTRADOR');

  Logger.log('✓ InstalarMagxorEngine() completado');
  Logger.log('READ_TOKEN: ' + props.getProperty('READ_TOKEN'));
  Logger.log('DESARROLLADOR: magxor / IM130906 (admin pass 1133627618)');
  Logger.log('ADMINISTRADOR inicial: admin / bienvenido (cambiar al primer login)');
}

// Alias legacy: setupMagxor() ahora llama al instalador único.
function setupMagxor() {
  return InstalarMagxorEngine();
}

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
  return crearUsuarioConRol(usuario, clave, adminPass, 'ADMINISTRADOR');
}

// Crea un usuario con rol explícito (DESARROLLADOR | ADMINISTRADOR | USUARIO).
function crearUsuarioConRol(usuario, clave, adminPass, rol) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, SHEETS.credenciales, CRED_HEADERS);
  mergeHeaders(ss, SHEETS.credenciales, CRED_HEADERS);
  var salt = randomToken(16);
  var hash = sha256Hex(clave + salt);
  var aSalt = randomToken(16);
  var aHash = adminPass ? sha256Hex(String(adminPass) + aSalt) : '';
  sh.appendRow([String(usuario).trim().toLowerCase(), hash, salt, 'SI', normalizarRol(rol), aHash, aSalt]);
  return 'Usuario creado: ' + usuario + ' (' + normalizarRol(rol) + ')';
}

// Crea el usuario solo si no existe (idempotente para el instalador).
function asegurarUsuario(usuario, clave, adminPass, rol) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, SHEETS.credenciales, CRED_HEADERS);
  mergeHeaders(ss, SHEETS.credenciales, CRED_HEADERS);
  if (sh.getLastRow() > 1) {
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).toLowerCase().trim() === String(usuario).toLowerCase().trim()) {
        Logger.log('· Usuario existente: ' + usuario);
        return 'Existe: ' + usuario;
      }
    }
  }
  var out = crearUsuarioConRol(usuario, clave, adminPass, rol);
  Logger.log('✓ ' + out);
  return out;
}

function normalizarRol(rol) {
  var r = String(rol || 'USUARIO').toUpperCase().trim();
  if (r === 'DESARROLLADOR' || r === 'DEV' || r === 'DEVELOPER') return 'DESARROLLADOR';
  if (r === 'ADMINISTRADOR' || r === 'ADMIN' || r === 'ADMINISTRATOR') return 'ADMINISTRADOR';
  return 'USUARIO';
}

function setAdminPass(usuario, nuevaAdminPass) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.credenciales);
  if (!sh) return 'Sin hoja CREDENCIALES';
  var data = sh.getDataRange().getValues();
  var u = String(usuario).trim().toLowerCase();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]).trim().toLowerCase() === u) {
      var aSalt = randomToken(16);
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

function limpiarSesionesExpiradas() {
  var props = PropertiesService.getScriptProperties();
  var store = JSON.parse(props.getProperty('SESSION_TOKENS') || '{}');
  var ahora = Date.now();
  var limpiadas = 0;
  for (var tok in store) {
    if (store[tok].exp < ahora) {
      delete store[tok];
      limpiadas++;
    }
  }
  props.setProperty('SESSION_TOKENS', JSON.stringify(store));
  return 'Sesiones expiradas limpiadas: ' + limpiadas;
}

function auditLog(usuario, accion, detalles, estadoAnterior, estadoNuevo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ensureSheet(ss, SHEETS.auditLog, AUDIT_HEADERS);
  sh.appendRow([
    new Date().toISOString(),
    String(usuario || ''),
    String(accion || ''),
    JSON.stringify(detalles || {}),
    String(estadoAnterior || ''),
    String(estadoNuevo || '')
  ]);
}

/* ---------- Router ---------- */

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var params = collectParams(e);
  var action = String(params.action || '').trim();
  
  // Limpiar sesiones expiradas antes de procesar
  limpiarSesionesExpiradas();
  
  try {
    if (action === 'health') return json({ status: 'ok', action: action, time: new Date().toISOString() });
    if (action === 'login') return handleLogin(params);
    if (action === 'getConfig' || action === 'getProducts' || action === 'getReviews') {
      requireReadToken(params);
      if (action === 'getConfig') return json({ status: 'ok', config: readConfig() });
      if (action === 'getProducts') return json({ status: 'ok', products: readProducts() });
      return json({ status: 'ok', reviews: readReviews() });
    }
    // Escrituras públicas limitadas (logLostCart registra carritos perdidos
    // incluso con la cuenta suspendida: su propósito es auditar la demanda)
    if (action === 'addOrder' || action === 'addReview' || action === 'addClient' || action === 'logLostCart') {
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

/**
 * ========================================================================
 * NUEVO FLUJO DE ESTADOS DE CUENTA EN LOGIN
 * ========================================================================
 * SI → login OK, sin avisos
 * ATRASO → login OK, devuelve flag "atraso: true" para mostrar toast
 * NO → login BLOQUEADO
 */
function handleLogin(params) {
  var estado = getEstadoCuenta();

  var user = String(params.username || params.usuario || '').trim().toLowerCase();
  var pass = String(params.password || params.pass || '');

  if (!pass) {
    throw new Error('Contraseña o ADMIN PASS requerido.');
  }

  var sh = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(SHEETS.credenciales);

  if (!sh) {
    throw new Error('Sin credenciales configuradas.');
  }

  var data = sh.getDataRange().getValues();

  // 1) Coincidencia por usuario (o admin pass del propio usuario)
  if (user) {
    for (var r = 1; r < data.length; r++) {
      var storedUser = String(data[r][0] || '').trim().toLowerCase();
      if (storedUser !== user) continue;

      var activo = String(data[r][3] || '').toUpperCase();
      if (activo !== 'SI' && activo !== 'SÍ') {
        throw new Error('ESTADO_NO|Cuenta pausada por falta de pago. Tu web seguirá activa, pero no podrás administrarla ni recibir pedidos.');
      }

      var normalHash = String(data[r][1] || '');
      var normalSalt = String(data[r][2] || '');
      if (normalHash === sha256Hex(pass + normalSalt)) {
        return handleEstadoCuenta(user, estado, filaComoUsuario(data[r]));
      }
      var adminHash = String(data[r][5] || '');
      var adminSalt = String(data[r][6] || '');
      if (adminHash && adminSalt && adminHash === sha256Hex(pass + adminSalt)) {
        return handleEstadoCuenta(user, estado, filaComoUsuario(data[r]));
      }
      throw new Error('Usuario o contraseña incorrectos.');
    }
    throw new Error('Usuario o contraseña incorrectos.');
  }

  // 2) Solo ADMIN PASS (sin usuario): busca en todas las filas por admin pass
  for (var k = 1; k < data.length; k++) {
    var ah = String(data[k][5] || '');
    var as = String(data[k][6] || '');
    if (!ah || !as) continue;
    if (ah === sha256Hex(pass + as)) {
      var u2 = String(data[k][0] || '').trim().toLowerCase();
      var act2 = String(data[k][3] || '').toUpperCase();
      if (act2 !== 'SI' && act2 !== 'SÍ') {
        throw new Error('ESTADO_NO|Cuenta pausada por falta de pago. Tu web seguirá activa, pero no podrás administrarla ni recibir pedidos.');
      }
      return handleEstadoCuenta(u2, estado, filaComoUsuario(data[k]));
    }
  }

  throw new Error('ADMIN PASS incorrecto.');
}

function filaComoUsuario(row) {
  return {
    usuario: String(row[0] || '').trim().toLowerCase(),
    activo: String(row[3] || 'SI'),
    rol: normalizarRol(row[4])
  };
}

/**
 * Maneja el flujo según el estado de la cuenta.
 * Devuelve además rol y debeCambiarCredenciales (admin/bienvenido por defecto).
 */
function handleEstadoCuenta(user, estado, infoUsuario) {
  var rol = infoUsuario ? infoUsuario.rol : 'ADMINISTRADOR';

  // Estado NO: Bloquear login completamente
  if (estado === 'NO') {
    auditLog(user, 'login_bloqueado', { razon: 'cuenta_suspendida' }, '', 'NO');
    throw new Error('ESTADO_NO|Cuenta Suspendida por falta de pago. No puedes administrarla. La web se seguirá mostrando, pero se dejarán de tomar pedidos.');
  }

  var debeCambiar = esCredencialDefaultAdmin(user);

  var tok = randomToken(48);
  var props = PropertiesService.getScriptProperties();
  var store = JSON.parse(props.getProperty('SESSION_TOKENS') || '{}');

  // Estado ATRASO: Permitir login pero con bandera
  if (estado === 'ATRASO') {
    store[tok] = { user: user, exp: Date.now() + 12 * 3600 * 1000, estado: 'ATRASO', rol: rol };
    props.setProperty('SESSION_TOKENS', JSON.stringify(store));
    auditLog(user, 'login_exitoso', { estado: 'ATRASO' }, '', 'ATRASO');
    return json({ status: 'ok', session: tok, user: user, rol: rol, atraso: true, debeCambiarCredenciales: debeCambiar, mensaje: 'Tu cuenta está en atraso. Tienes 7 días para regularizar el pago.' });
  }

  // Estado SI: Login normal
  store[tok] = { user: user, exp: Date.now() + 12 * 3600 * 1000, estado: 'SI', rol: rol };
  props.setProperty('SESSION_TOKENS', JSON.stringify(store));
  auditLog(user, 'login_exitoso', { estado: 'SI' }, '', 'SI');
  return json({ status: 'ok', session: tok, user: user, rol: rol, atraso: false, debeCambiarCredenciales: debeCambiar });
}

// Detecta si el ADMINISTRADOR aún usa las credenciales por defecto.
function esCredencialDefaultAdmin(user) {
  try {
    if (String(user || '').toLowerCase() !== 'admin') return false;
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.credenciales);
    if (!sh || sh.getLastRow() < 2) return false;
    var data = sh.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || '').trim().toLowerCase() === 'admin') {
        var h = String(data[r][1] || '');
        var s2 = String(data[r][2] || '');
        return h === sha256Hex('bienvenido' + s2);
      }
    }
  } catch (e) {}
  return false;
}

function getEstadoCuenta() {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.datos);
    if (!sh || sh.getLastRow() < 2) return 'SI';
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = sh.getRange(2, 1, 1, sh.getLastColumn()).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).toLowerCase().trim() === 'estado_cuenta' || String(headers[c]).toLowerCase().trim() === 'estado cuenta') {
        var v = String(row[c] || 'SI').toUpperCase().trim();
        if (v === 'NO') return 'NO';
        if (v === 'ATRASO' || v === 'ATRASADO') return 'ATRASO';
        return 'SI';
      }
    }
  } catch (e) {}
  return 'SI';
}

function cambiarCredenciales(usuarioActual, nuevoUsuario, nuevaClave) {

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.credenciales);

  if (!sh) {
    throw new Error('Sin hoja CREDENCIALES.');
  }

  var usuarioViejo = String(usuarioActual || '')
    .trim()
    .toLowerCase();

  var usuarioNuevo = String(nuevoUsuario || '')
    .trim()
    .toLowerCase();

  if (!usuarioViejo) {
    throw new Error('Usuario actual requerido.');
  }

  if (!usuarioNuevo) {
    throw new Error('El nuevo usuario es obligatorio.');
  }

  if (!nuevaClave) {
    throw new Error('La nueva contraseña es obligatoria.');
  }

  if (usuarioNuevo.length < 3) {
    throw new Error('El nuevo usuario debe tener al menos 3 caracteres.');
  }

  if (String(nuevaClave).length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }

  var data = sh.getDataRange().getValues();

  var filaUsuarioActual = -1;

  for (var r = 1; r < data.length; r++) {

    var u = String(data[r][0] || '')
      .trim()
      .toLowerCase();

    if (u === usuarioViejo) {
      filaUsuarioActual = r + 1;
      break;
    }
  }

  if (filaUsuarioActual === -1) {
    throw new Error('Usuario actual no encontrado.');
  }

  for (var i = 1; i < data.length; i++) {

    var existente = String(data[i][0] || '')
      .trim()
      .toLowerCase();

    if (
      existente === usuarioNuevo &&
      (i + 1) !== filaUsuarioActual
    ) {
      throw new Error('El nuevo usuario ya existe.');
    }
  }

  var salt = randomToken(16);
  var hash = sha256Hex(String(nuevaClave) + salt);

  sh.getRange(filaUsuarioActual, 1).setValue(usuarioNuevo);
  sh.getRange(filaUsuarioActual, 2).setValue(hash);
  sh.getRange(filaUsuarioActual, 3).setValue(salt);

  return {
    usuarioAnterior: usuarioViejo,
    usuarioNuevo: usuarioNuevo,
    actualizado: true
  };
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
  cfg.slogan = get(['slogan', 'lema', 'tagline']) || '';
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

/**
 * ========================================================================
 * ESCRITURAS PÚBLICAS — Bloquea pedidos si estado es NO o ATRASO
 * ========================================================================
 */
function handlePublicWrite(action, p) {
  var estado = getEstadoCuenta();
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'addReview') {
      // Las reseñas se bloquean si la cuenta está pausada (NO)
      if (estado === 'NO') {
        auditLog('público', 'intento_resena_bloqueado', { estado: estado }, estado, estado);
        throw new Error('ESTADO_BLOQUEADO|Cuenta pausada por falta de pago. No se pueden recibir reseñas en este momento.');
      }
      var rs = ensureSheet(ss, SHEETS.resenas, RES_HEADERS);
      rs.appendRow([s(p.productId, 50), s(p.name, 80) || 'Cliente', Math.min(5, Math.max(1, parseInt(p.rating) || 5)), s(p.comment, 1000), s(p.date, 30)]);
    } else if (action === 'addClient') {
      // Los clientes de email/newsletter se aceptan en cualquier estado
      var cs = ensureSheet(ss, SHEETS.clientes, CLI_HEADERS);
      var phone = String(p.phone || '').replace(/[^0-9+]/g, '').slice(0, 20);
      if (phone.length < 6) throw new Error('Teléfono inválido.');
      cs.appendRow([phone, s(p.date, 30), s(p.metodo, 40) || 'Club WhatsApp', 'NO']);
    } else if (action === 'addOrder') {
      // LOS PEDIDOS SE BLOQUEAN SI ESTADO ES NO O ATRASO.
      // El intento queda asentado como CARRITO PERDIDO en AUDIT_LOG con todo
      // el detalle (cliente, teléfono, productos, total) para medir la demanda
      // que se pierde mientras la cuenta está suspendida.
      if (estado === 'NO' || estado === 'ATRASO') {
        auditLog('público', 'carrito_perdido', {
          cliente: s(p.cliente || p.nombre, 120),
          telefono: String(p.telefono || '').replace(/[^0-9+]/g, '').slice(0, 20),
          productos: s(p.productos, 5000),
          total: parseFloat(p.total) || 0,
          entrega: s(p.entrega, 120),
          motivo: 'estado_cuenta_' + estado
        }, estado, estado);
        throw new Error('ESTADO_BLOQUEADO|La tienda no está recibiendo pedidos en este momento. Por favor, intenta más tarde.');
      }
      var os = ensureSheet(ss, SHEETS.pedidos, PED_HEADERS);
      if (!p.cliente && !p.nombre) throw new Error('Falta nombre del cliente.');
      var tel = String(p.telefono || '').replace(/[^0-9+]/g, '').slice(0, 20);
      if (tel.length < 6) throw new Error('Teléfono inválido.');
      var clienteNombre = s(p.cliente || p.nombre, 120);
      os.appendRow([s(p.id, 30), s(p.fecha, 40), clienteNombre, tel, s(p.productos, 5000), parseFloat(p.total) || 0, s(p.entrega, 120), 'PENDIENTE']);
      
      // Guardar también automáticamente como cliente en la hoja CLIENTES
      var cs = ensureSheet(ss, SHEETS.clientes, CLI_HEADERS);
      var clientData = cs.getDataRange().getValues();
      var exists = false;
      for (var i = 1; i < clientData.length; i++) {
        var existingPhone = String(clientData[i][0] || '').replace(/[^0-9+]/g, '');
        if (existingPhone && existingPhone === tel) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        cs.appendRow([tel, s(p.fecha, 40), clienteNombre, 'NO']);
      }

      auditLog('público', 'pedido_creado', { cliente: clienteNombre }, 'SI', 'SI');
    } else if (action === 'logLostCart') {
      // Registro explícito de carritos perdidos desde el frontend (checkout
      // bloqueado localmente). Se acepta en CUALQUIER estado de cuenta y NO
      // crea pedidos: solo deja constancia en AUDIT_LOG.
      auditLog('público', 'carrito_perdido', {
        cliente: s(p.cliente || p.nombre, 120),
        telefono: String(p.telefono || '').replace(/[^0-9+]/g, '').slice(0, 20),
        productos: s(p.productos, 5000),
        total: parseFloat(p.total) || 0,
        entrega: s(p.entrega, 120),
        motivo: 'checkout_bloqueado_' + estado,
        origen: s(p.origen, 40) || 'frontend'
      }, estado, estado);
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
    if (action === 'sessionPing') {
      // Ping liviano del Admin: la sesión ya fue validada por requireSession().
      // Renueva la expiración deslizante y devuelve el estado de la cuenta.
      var tokPing = String(p.session || p.token || '');
      var propsPing = PropertiesService.getScriptProperties();
      var storePing = JSON.parse(propsPing.getProperty('SESSION_TOKENS') || '{}');
      if (storePing[tokPing]) {
        storePing[tokPing].exp = Date.now() + 12 * 3600 * 1000;
        propsPing.setProperty('SESSION_TOKENS', JSON.stringify(storePing));
      }
      return json({ status: 'ok', action: action, estadoCuenta: getEstadoCuenta() });
    }
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
      mergeHeaders(ss, SHEETS.datos, DATOS_HEADERS);
      var estadoAnterior = getEstadoCuenta();
      // Lectura-modificación-escritura: solo se pisan los campos presentes en
      // el request y se escribe alineado a los encabezados REALES de la hoja
      // (evita desalineación en tiendas migradas y ya no vacía campos no enviados).
      var headersCfg = ds.getRange(1, 1, 1, ds.getLastColumn()).getValues()[0];
      var filaCfg = ds.getLastRow() >= 2 ? ds.getRange(2, 1, 1, ds.getLastColumn()).getValues()[0] : [];
      var valsCfg = headersCfg.map(function (h, idx) {
        var enviado = configValueFor(h, p);
        if (enviado !== undefined) return enviado;
        return (filaCfg[idx] !== undefined && filaCfg[idx] !== null) ? filaCfg[idx] : '';
      });
      if (ds.getLastRow() >= 2) {
        ds.getRange(2, 1, 1, headersCfg.length).setValues([valsCfg]);
      } else {
        ds.appendRow(valsCfg);
      }
      var estadoNuevoCfg = getEstadoCuenta();
      if (estadoAnterior !== estadoNuevoCfg) {
        auditLog(currentSessionUser(p), 'cambio_estado_cuenta', { detalles: 'Estado modificado' }, estadoAnterior, estadoNuevoCfg);
      }
      return json({ status: 'ok', action: action });
    }
    if (action === 'changeCredentials') {
      var usuarioSesion = currentSessionUser(p);
      if (!usuarioSesion) {
        throw new Error('Sesión inválida o expirada.');
      }
      var nuevoUsuario = String(p.newUsername || p.newUser || p.usuarioNuevo || '').trim();
      var nuevaClave = String(p.newPassword || p.newPass || '');
      var resultadoCredenciales = cambiarCredenciales(usuarioSesion, nuevoUsuario, nuevaClave);
      var sessionToken = String(p.session || p.token || '');
      if (sessionToken) {
        var propsCred = PropertiesService.getScriptProperties();
        var sesionesCred = JSON.parse(propsCred.getProperty('SESSION_TOKENS') || '{}');
        if (sesionesCred[sessionToken]) {
          sesionesCred[sessionToken].user = resultadoCredenciales.usuarioNuevo;
          sesionesCred[sessionToken].exp = Date.now() + 12 * 3600 * 1000;
          propsCred.setProperty('SESSION_TOKENS', JSON.stringify(sesionesCred));
        }
      }
      auditLog(resultadoCredenciales.usuarioAnterior, 'cambio_credenciales', { nuevoUsuario: resultadoCredenciales.usuarioNuevo }, 'SI', 'SI');
      return json({
        status: 'ok',
        action: action,
        usuarioAnterior: resultadoCredenciales.usuarioAnterior,
        usuario: resultadoCredenciales.usuarioNuevo,
        mensaje: 'Usuario y contraseña actualizados correctamente.'
      });
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
    
    // ====================================================================
    // GESTIÓN DE USUARIOS (requiere admin pass)
    // ====================================================================
    
    if (action === 'listUsers') {
      // Verificar admin pass
      var usuarioSesion = currentSessionUser(p);
      verifyAdminPassInternal(usuarioSesion, String(p.adminPass || ''));

      var sh = ss.getSheetByName(SHEETS.credenciales);
      if (!sh || sh.getLastRow() < 2) return json({ status: 'ok', users: [] });

      var data = sh.getDataRange().getValues();
      var users = [];
      for (var r = 1; r < data.length; r++) {
        users.push({
          usuario: String(data[r][0] || ''),
          activo: String(data[r][3] || 'SI'),
          rol: normalizarRol(data[r][4])
        });
      }
      return json({ status: 'ok', users: users });
    }

    if (action === 'createUser') {
      // Verificar admin pass
      var usuarioSesion = currentSessionUser(p);
      verifyAdminPassInternal(usuarioSesion, String(p.adminPass || ''));

      var nuevoUsuario = String(p.usuario || '').trim().toLowerCase();
      var nuevaPass = String(p.password || '');
      var rol = normalizarRol(p.rol);

      if (!nuevoUsuario || nuevoUsuario.length < 3) {
        throw new Error('El usuario debe tener al menos 3 caracteres.');
      }
      if (!nuevaPass || nuevaPass.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      if (rol !== 'ADMINISTRADOR' && rol !== 'USUARIO' && rol !== 'DESARROLLADOR') {
        throw new Error('El rol debe ser ADMINISTRADOR o USUARIO.');
      }
      // Solo un DESARROLLADOR puede crear otro DESARROLLADOR
      if (rol === 'DESARROLLADOR' && rolDeUsuario(usuarioSesion) !== 'DESARROLLADOR') {
        throw new Error('Solo el rol DESARROLLADOR puede crear desarrolladores.');
      }

      var sh = ss.getSheetByName(SHEETS.credenciales);
      var data = sh.getDataRange().getValues();

      // Verificar que no exista
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]).trim().toLowerCase() === nuevoUsuario) {
          throw new Error('El usuario ' + nuevoUsuario + ' ya existe.');
        }
      }

      // Crear
      var salt = randomToken(16);
      var hash = sha256Hex(nuevaPass + salt);
      sh.appendRow([nuevoUsuario, hash, salt, 'SI', rol, '', '']);

      auditLog(usuarioSesion, 'usuario_creado', { usuario: nuevoUsuario, rol: rol }, 'SI', 'SI');
      return json({ status: 'ok', action: action, usuario: nuevoUsuario });
    }

    if (action === 'deleteUser') {
      // Verificar admin pass
      var usuarioSesion = currentSessionUser(p);
      verifyAdminPassInternal(usuarioSesion, String(p.adminPass || ''));

      var usuarioABorrar = String(p.usuario || '').trim().toLowerCase();

      if (usuarioABorrar === usuarioSesion) {
        throw new Error('No puedes borrar tu propia cuenta.');
      }

      var sh = ss.getSheetByName(SHEETS.credenciales);
      var data = sh.getDataRange().getValues();

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]).trim().toLowerCase() === usuarioABorrar) {
          // Los datos del DESARROLLADOR no los toca nadie salvo otro DESARROLLADOR
          if (normalizarRol(data[r][4]) === 'DESARROLLADOR' && rolDeUsuario(usuarioSesion) !== 'DESARROLLADOR') {
            throw new Error('Solo el rol DESARROLLADOR puede eliminar desarrolladores.');
          }
          sh.deleteRow(r + 1);
          auditLog(usuarioSesion, 'usuario_eliminado', { usuario: usuarioABorrar }, 'SI', 'SI');
          return json({ status: 'ok', action: action, usuario: usuarioABorrar });
        }
      }
      throw new Error('Usuario no encontrado.');
    }

    if (action === 'updateUser') {
      // Verificar admin pass
      var usuarioSesion = currentSessionUser(p);
      verifyAdminPassInternal(usuarioSesion, String(p.adminPass || ''));

      var usuarioAActualizar = String(p.usuario || '').trim().toLowerCase();
      var nuevoEstado = p.activo ? 'SI' : 'NO';
      var nuevoRol = p.rol ? normalizarRol(p.rol) : null;

      var sh = ss.getSheetByName(SHEETS.credenciales);
      var data = sh.getDataRange().getValues();

      for (var r = 1; r < data.length; r++) {
        if (String(data[r][0]).trim().toLowerCase() === usuarioAActualizar) {
          if (normalizarRol(data[r][4]) === 'DESARROLLADOR' && rolDeUsuario(usuarioSesion) !== 'DESARROLLADOR') {
            throw new Error('Solo el rol DESARROLLADOR puede modificar desarrolladores.');
          }
          if (p.activo !== undefined) {
            sh.getRange(r + 1, 4).setValue(nuevoEstado);
          }
          if (nuevoRol) {
            sh.getRange(r + 1, 5).setValue(nuevoRol);
          }
          auditLog(usuarioSesion, 'usuario_actualizado', { usuario: usuarioAActualizar, activo: nuevoEstado, rol: nuevoRol }, 'SI', 'SI');
          return json({ status: 'ok', action: action, usuario: usuarioAActualizar });
        }
      }
      throw new Error('Usuario no encontrado.');
    }

    if (action === 'updateOrderDetail') {
      // Edición del detalle de productos de un pedido (falta de stock / cantidades)
      sh = ss.getSheetByName(SHEETS.pedidos);
      r = findRowById(sh, ['id', 'codigo', 'código', 'pedido'], p.id);
      if (r !== -1) {
        var mapD = { productos: colIndex(sh, ['productos', 'products', 'detalle']), total: colIndex(sh, ['total', 'amount']) };
        if (mapD.productos !== -1 && p.productos !== undefined) sh.getRange(r, mapD.productos + 1).setValue(s(p.productos, 5000));
        if (mapD.total !== -1 && p.total !== undefined) sh.getRange(r, mapD.total + 1).setValue(parseFloat(p.total) || 0);
        auditLog(currentSessionUser(p), 'pedido_detalle_actualizado', { id: p.id }, '', '');
      }
      return json({ status: 'ok', action: action });
    }

    throw new Error('Acción no soportada: ' + action);
  } finally { lock.releaseLock(); }
}

function rolDeUsuario(usuario) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.credenciales);
    if (!sh || sh.getLastRow() < 2) return 'USUARIO';
    var data = sh.getDataRange().getValues();
    var u = String(usuario || '').trim().toLowerCase();
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim().toLowerCase() === u) return normalizarRol(data[r][4]);
    }
  } catch (e) {}
  return 'USUARIO';
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
  return { nombreWeb: 'Magxor Engine', slogan: '', horarios: 'Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00', direccion: '', contactoMinorista: '', contactoMayorista: '', contactoTicket: '', paletaColores: '', anuncioHeader: '', colorPreset: 'Azul', colorPrimario: '#2563EB', colorSecundario: '#4F46E5', logoUrl: '', faviconUrl: '', logoAnimadoUrl: '', splashActivo: 'NO', splashDuracionMs: 2000, splashFondo: '#0A0A0A', seoTitulo: 'Magxor Engine — Tienda online', seoDescripcion: 'Catálogo online de Magxor Engine.', seoKeywords: 'tienda online, catálogo, ofertas', seoUrlCanonica: '', seoRobots: 'index, follow', moneda: 'ARS', estadoCuenta: 'SI', suspensionImageUrl: '', suspensionMensaje: '' };
}

function seedDefaultConfig(ss) {
  var sh = ss.getSheetByName(SHEETS.datos);
  if (sh && sh.getLastRow() >= 2) return;
  var d = defaultConfig();
  // Seed alineado a DATOS_HEADERS por nombre de columna (a prueba de reordenamientos).
  var mapa = {
    'nombre web': d.nombreWeb, 'slogan': d.slogan, 'horarios': d.horarios, 'dirección': d.direccion,
    'contacto minorista': d.contactoMinorista, 'contacto mayorista': d.contactoMayorista, 'contacto ticket': d.contactoTicket,
    'anuncio header': d.anuncioHeader, 'endpoint apps script': '',
    'color_preset': d.colorPreset, 'color_primario': d.colorPrimario, 'color_secundario': d.colorSecundario,
    'logo_url': d.logoUrl, 'favicon_url': d.faviconUrl, 'logo_animado_url': d.logoAnimadoUrl,
    'splash_activo': d.splashActivo, 'splash_duracion_ms': d.splashDuracionMs, 'splash_fondo': d.splashFondo,
    'seo_titulo': d.seoTitulo, 'seo_descripcion': d.seoDescripcion, 'seo_keywords': d.seoKeywords,
    'seo_url_canonica': d.seoUrlCanonica, 'seo_robots': d.seoRobots, 'moneda': d.moneda,
    'estado_cuenta': d.estadoCuenta, 'suspension_image_url': d.suspensionImageUrl, 'suspension_mensaje': d.suspensionMensaje
  };
  sh.appendRow(DATOS_HEADERS.map(function (h) {
    var v = mapa[String(h).toLowerCase()];
    return v === undefined ? '' : v;
  }));
}

// Devuelve el valor enviado en el request para un encabezado dado,
// o UNDEFINED si el campo no fue enviado (updateConfig preserva el valor
// existente en esos casos).
function configValueFor(header, p) {
  var h = String(header).toLowerCase();
  var pick = function () { for (var i = 0; i < arguments.length; i++) { if (p[arguments[i]] !== undefined) return String(p[arguments[i]]); } return undefined; };
  if (h === 'nombre web') return pick('nombre_web', 'nombreWeb', 'nombre');
  if (h === 'slogan' || h === 'lema') return pick('slogan');
  if (h === 'horarios') return pick('horarios');
  if (h.indexOf('direcci') !== -1) return pick('direccion');
  if (h.indexOf('minorista') !== -1) return pick('contacto_minorista', 'contactoMinorista');
  if (h.indexOf('mayorista') !== -1) return pick('contacto_mayorista', 'contactoMayorista');
  if (h.indexOf('ticket') !== -1) return pick('contacto_ticket', 'contactoTicket');
  // Legacy: solo se acepta por compatibilidad con hojas viejas que aún tienen
  // la columna PALETA DE COLORES. El color actual se gestiona con COLOR_*.
  if (h.indexOf('paleta') !== -1) return pick('paleta_colores', 'paletaColores');
  if (h.indexOf('anuncio') !== -1) return pick('anuncio_header', 'anuncioHeader');
  if (h.indexOf('endpoint') !== -1) return pick('endpoint_apps_script');
  if (h === 'color_preset') return pick('color_preset', 'colorPreset');
  if (h === 'color_primario') return pick('color_primario', 'colorPrimario');
  if (h === 'color_secundario') return pick('color_secundario', 'colorSecundario');
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
  return undefined;
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
  if (idx === -1) throw new Error('Campo ID no encontrado en ' + sh.getName());
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

function verifyAdminPassInternal(usuario, adminPass) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.credenciales);
  if (!sh) throw new Error('Sin credenciales configuradas.');
  var rows = sh.getDataRange().getValues();
  var u = String(usuario || '').trim().toLowerCase();
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][0]).trim().toLowerCase() === u) {
      var ah = String(rows[r][5] || '');
      var as = String(rows[r][6] || '');
      if (!ah) throw new Error('Admin pass no configurado para este usuario.');
      if (sha256Hex(String(adminPass) + as) !== ah) throw new Error('Admin pass incorrecto.');
      return true;
    }
  }
  throw new Error('Usuario no encontrado.');
}
