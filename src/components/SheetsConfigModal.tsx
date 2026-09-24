import React, { useState } from "react";
import { X, Check, Link, HelpCircle, RefreshCw, AlertTriangle, Copy, MessageSquareCode } from "lucide-react";
import { extractSpreadsheetId, parseCSV, mapRecordsToProducts } from "../utils";
import { Product } from "../types";

interface SheetsConfigModalProps {
  onClose: () => void;
  onSyncSuccess: (products: Product[], sheetUrl: string, backendUrl: string) => void;
  currentUrl?: string;
  currentBackendUrl?: string;
}

export default function SheetsConfigModal({
  onClose,
  onSyncSuccess,
  currentUrl = "",
  currentBackendUrl = ""
}: SheetsConfigModalProps) {
  const [url, setUrl] = useState(currentUrl);
  const [backendUrl, setBackendUrl] = useState(currentBackendUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Magxor Engine: el código seguro vive en apps-script/Code.gs (con READ_TOKEN + login servidor).
  const appsScriptCode = `// MAGXOR ENGINE — ver apps-script/Code.gs y apps-script/README_SETUP.md
// No publiques el Sheet. Despliega como Aplicación web (Yo/Cualquiera) y usa VITE_APPS_SCRIPT_URL + VITE_READ_TOKEN.
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var action = e.parameter.action;
  if (!action && e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      action = json.action;
      for (var key in json) {
        e.parameter[key] = json[key];
      }
    } catch(err) {}
  }
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "addReview") {
    var reviewsSheet = sheet.getSheetByName("RESEÑAS");
    if (!reviewsSheet) {
      reviewsSheet = sheet.insertSheet("RESEÑAS");
      reviewsSheet.appendRow(["productId", "name", "rating", "comment", "date"]);
    }
    reviewsSheet.appendRow([
      e.parameter.productId || "",
      e.parameter.name || "Cliente",
      parseInt(e.parameter.rating) || 5,
      e.parameter.comment || "",
      e.parameter.date || "Hace poco"
    ]);
  } else if (action === "addClient") {
    var clientsSheet = sheet.getSheetByName("CLIENTES");
    if (!clientsSheet) {
      clientsSheet = sheet.insertSheet("CLIENTES");
      clientsSheet.appendRow(["PHONE", "DATE", "METODO", "CONTACTO"]);
    }
    clientsSheet.appendRow([
      e.parameter.phone || "",
      e.parameter.date || "",
      e.parameter.metodo || "Club WhatsApp",
      e.parameter.contacto || "NO"
    ]);
  } else if (action === "updateClientContact") {
    var clientsSheet = sheet.getSheetByName("CLIENTES");
    if (clientsSheet) {
      var data = clientsSheet.getDataRange().getValues();
      var headers = data[0];
      var phoneCol = -1;
      var contactoCol = -1;
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "phone" || h === "telefono" || h === "teléfono" || h === "celular" || h === "client" || h === "numero" || h === "número") {
          phoneCol = c;
        } else if (h === "contacto" || h === "contactado") {
          contactoCol = c;
        }
      }
      if (phoneCol === -1) phoneCol = 0;
      
      var targetPhone = String(e.parameter.phone).trim();
      for (var r = 1; r < data.length; r++) {
        var rowPhone = String(data[r][phoneCol]).trim();
        if (rowPhone === targetPhone || rowPhone.replace(/[^0-9]/g, "") === targetPhone.replace(/[^0-9]/g, "")) {
          if (contactoCol !== -1) {
            clientsSheet.getRange(r + 1, contactoCol + 1).setValue(e.parameter.contacto || "SI");
          }
          break;
        }
      }
    }
  } else if (action === "deleteClient") {
    var clientsSheet = sheet.getSheetByName("CLIENTES");
    if (clientsSheet) {
      var data = clientsSheet.getDataRange().getValues();
      var headers = data[0];
      var phoneCol = -1;
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "phone" || h === "telefono" || h === "teléfono" || h === "celular" || h === "client" || h === "numero" || h === "número") {
          phoneCol = c;
          break;
        }
      }
      if (phoneCol === -1) phoneCol = 0;
      var targetPhone = String(e.parameter.phone).trim();
      for (var r = 1; r < data.length; r++) {
        var rowPhone = String(data[r][phoneCol]).trim();
        if (rowPhone === targetPhone || rowPhone.replace(/[^0-9]/g, "") === targetPhone.replace(/[^0-9]/g, "")) {
          clientsSheet.deleteRow(r + 1);
          break;
        }
      }
    }
  } else if (action === "addOrder") {
    var ordersSheet = sheet.getSheetByName("PEDIDOS");
    if (!ordersSheet) {
      ordersSheet = sheet.insertSheet("PEDIDOS");
      ordersSheet.appendRow(["ID", "FECHA", "CLIENTE", "TELEFONO", "PRODUCTOS", "TOTAL", "ENTREGA", "ESTADO"]);
    }
    ordersSheet.appendRow([
      e.parameter.id || "",
      e.parameter.fecha || "",
      e.parameter.cliente || "",
      e.parameter.telefono || "",
      e.parameter.productos || "",
      parseFloat(e.parameter.total) || 0,
      e.parameter.entrega || "",
      e.parameter.estado || "PENDIENTE"
    ]);
  } else if (action === "updateOrderStatus") {
    var ordersSheet = sheet.getSheetByName("PEDIDOS");
    if (ordersSheet) {
      var data = ordersSheet.getDataRange().getValues();
      var headers = data[0];
      var idCol = -1;
      var estadoCol = -1;
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "id" || h === "codigo" || h === "código" || h === "pedido") {
          idCol = c;
        } else if (h === "estado" || h === "status") {
          estadoCol = c;
        }
      }
      if (idCol === -1) idCol = 0;
      var targetId = String(e.parameter.id).trim();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).trim() === targetId) {
          if (estadoCol !== -1) {
            ordersSheet.getRange(r + 1, estadoCol + 1).setValue(e.parameter.estado || "PENDIENTE");
          }
          break;
        }
      }
    }
  } else if (action === "deleteOrder") {
    var ordersSheet = sheet.getSheetByName("PEDIDOS");
    if (ordersSheet) {
      var data = ordersSheet.getDataRange().getValues();
      var headers = data[0];
      var idCol = -1;
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "id" || h === "codigo" || h === "código" || h === "pedido") {
          idCol = c;
          break;
        }
      }
      if (idCol === -1) idCol = 0;
      var targetId = String(e.parameter.id).trim();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).trim() === targetId) {
          ordersSheet.deleteRow(r + 1);
          break;
        }
      }
    }
  } else if (action === "updateConfig") {
    var datosSheet = sheet.getSheetByName("DATOS");
    if (!datosSheet) {
      datosSheet = sheet.insertSheet("DATOS");
      datosSheet.appendRow(["NOMBRE WEB", "HORARIOS", "DIRECCIÓN", "CONTACTO MINORISTA", "CONTACTO MAYORISTA", "PALETA DE COLORES"]);
    }
    var numRows = datosSheet.getLastRow();
    if (numRows > 1) {
      datosSheet.deleteRows(2, numRows - 1);
    }
    datosSheet.appendRow([
      e.parameter.nombre_web || "",
      e.parameter.horarios || "",
      e.parameter.direccion || "",
      e.parameter.contacto_minorista || "",
      e.parameter.contacto_mayorista || "",
      e.parameter.paleta_colores || ""
    ]);
  } else if (action === "addProduct") {
    var invSheet = sheet.getSheetByName("INVENTARIO");
    if (!invSheet) {
      invSheet = sheet.getSheetByName("PRODUCTOS");
    }
    if (!invSheet) {
      invSheet = sheet.insertSheet("INVENTARIO");
      invSheet.appendRow(["Id", "Nombre de Producto", "Categoría", "Descripción", "Precio", "Precio Oferta", "Disponible", "Oferta", "Fotos"]);
    }
    invSheet.appendRow([
      e.parameter.id || "",
      e.parameter.nombre || "",
      e.parameter.categoria || "",
      e.parameter.descripcion || "",
      e.parameter.precio || "",
      e.parameter.precio_oferta || "",
      e.parameter.disponible || "SI",
      e.parameter.oferta || "NO",
      e.parameter.fotos || ""
    ]);
  } else if (action === "updateProduct") {
    var invSheet = sheet.getSheetByName("INVENTARIO") || sheet.getSheetByName("PRODUCTOS");
    if (invSheet) {
      var data = invSheet.getDataRange().getValues();
      var idCol = -1;
      var headers = data[0];
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "id" || h === "codigo" || h === "código" || h === "sku") {
          idCol = c;
          break;
        }
      }
      if (idCol === -1) idCol = 0;
      var targetId = String(e.parameter.id).toLowerCase().trim();
      var foundRow = -1;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).toLowerCase().trim() === targetId) {
          foundRow = r + 1;
          break;
        }
      }
      var mapCols = {};
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "id" || h === "codigo" || h === "código" || h === "sku") mapCols["id"] = c;
        else if (h.includes("nombre") || h === "producto" || h === "name" || h === "title") mapCols["nombre"] = c;
        else if (h.includes("categor") || h === "category" || h === "rubro") mapCols["categoria"] = c;
        else if (h.includes("descrip") || h === "description" || h === "detalle") mapCols["descripcion"] = c;
        else if (h === "precio" || h === "price" || h === "valor" || h === "costo") mapCols["precio"] = c;
        else if (h === "precio oferta" || h === "precio_oferta" || h === "oferta precio" || h === "oferta_precio") mapCols["precio_oferta"] = c;
        else if (h.includes("dispon") || h === "stock" || h === "cantidad") mapCols["disponible"] = c;
        else if (h === "oferta" || h.includes("promo") || h === "en oferta") mapCols["oferta"] = c;
        else if (h === "fotos" || h === "foto" || h === "imagen" || h === "image") mapCols["fotos"] = c;
      }
      if (foundRow !== -1) {
        if (mapCols["nombre"] !== undefined && e.parameter.nombre !== undefined) invSheet.getRange(foundRow, mapCols["nombre"] + 1).setValue(e.parameter.nombre);
        if (mapCols["categoria"] !== undefined && e.parameter.categoria !== undefined) invSheet.getRange(foundRow, mapCols["categoria"] + 1).setValue(e.parameter.categoria);
        if (mapCols["descripcion"] !== undefined && e.parameter.descripcion !== undefined) invSheet.getRange(foundRow, mapCols["descripcion"] + 1).setValue(e.parameter.descripcion);
        if (mapCols["precio"] !== undefined && e.parameter.precio !== undefined) invSheet.getRange(foundRow, mapCols["precio"] + 1).setValue(e.parameter.precio);
        if (mapCols["precio_oferta"] !== undefined && e.parameter.precio_oferta !== undefined) invSheet.getRange(foundRow, mapCols["precio_oferta"] + 1).setValue(e.parameter.precio_oferta);
        if (mapCols["disponible"] !== undefined && e.parameter.disponible !== undefined) invSheet.getRange(foundRow, mapCols["disponible"] + 1).setValue(e.parameter.disponible);
        if (mapCols["oferta"] !== undefined && e.parameter.oferta !== undefined) invSheet.getRange(foundRow, mapCols["oferta"] + 1).setValue(e.parameter.oferta);
        if (mapCols["fotos"] !== undefined && e.parameter.fotos !== undefined) invSheet.getRange(foundRow, mapCols["fotos"] + 1).setValue(e.parameter.fotos);
      }
    }
  } else if (action === "deleteProduct") {
    var invSheet = sheet.getSheetByName("INVENTARIO") || sheet.getSheetByName("PRODUCTOS");
    if (invSheet) {
      var data = invSheet.getDataRange().getValues();
      var idCol = -1;
      var headers = data[0];
      for (var c = 0; c < headers.length; c++) {
        var h = String(headers[c]).toLowerCase().trim();
        if (h === "id" || h === "codigo" || h === "código" || h === "sku") {
          idCol = c;
          break;
        }
      }
      if (idCol === -1) idCol = 0;
      var targetId = String(e.parameter.id).toLowerCase().trim();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).toLowerCase().trim() === targetId) {
          invSheet.deleteRow(r + 1);
          break;
        }
      }
    }
  }
  
  var response = { status: "success", action: action };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader("Access-Control-Allow-Origin", "*");
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      if (!url.trim()) {
        throw new Error("Por favor, ingresá una dirección válida.");
      }

      // Convert edit URLs into public CSV export URLs if needed, prioritizing INVENTARIO tab
      let fetchUrl = url;
      if (url.includes("docs.google.com/spreadsheets")) {
        const spreadsheetId = extractSpreadsheetId(url);
        if (!spreadsheetId) {
          throw new Error("No pudimos extraer el ID del documento. Verificá que la URL sea correcta.");
        }
        
        if (url.includes("/pub?")) {
          if (url.includes("&sheet=") || url.includes("?sheet=")) {
            fetchUrl = url;
          } else {
            fetchUrl = `${url}&sheet=INVENTARIO`;
          }
        } else {
          fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=INVENTARIO&headers=1`;
        }
      }

      // Fetch spreadsheet data with fallback
      let response = await fetch(fetchUrl);
      if (!response.ok) {
        // Fallback to default first sheet / PRODUCTOS if sheet=INVENTARIO fails
        if (url.includes("docs.google.com/spreadsheets")) {
          const spreadsheetId = extractSpreadsheetId(url)!;
          if (url.includes("/pub?")) {
            fetchUrl = url;
          } else {
            fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&headers=1`;
          }
          response = await fetch(fetchUrl);
        }
      }

      if (!response.ok) {
        throw new Error(
          "No se pudo descargar el archivo. Verificá que el documento de Google Sheets esté publicado en la web (Archivo > Compartir > Publicar en la web) o que el enlace sea correcto."
        );
      }

      const csvText = await response.text();
      const records = parseCSV(csvText);
      
      if (records.length === 0) {
        throw new Error("El archivo CSV o de Sheets importado parece estar vacío.");
      }

      const products = mapRecordsToProducts(records);
      if (products.length === 0) {
        throw new Error(
          "No se pudieron estructurar los productos. Asegurate de tener columnas con los encabezados correspondientes (ej: 'nombre', 'precio', 'imagen')."
        );
      }

      setSuccess(true);
      setTimeout(() => {
        onSyncSuccess(products, url, backendUrl);
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Sucedió un error inesperado al sincronizar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl animate-scale-in max-h-[92vh] overflow-y-auto">
        {/* Close trigger */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-neutral-450 hover:text-neutral-850 dark:hover:text-white bg-neutral-50 dark:bg-neutral-800 rounded-full cursor-pointer transition-colors"
          title="Cerrar"
          id="btn-close-sheets-config"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand visual header */}
        <div className="flex items-center gap-3 border-b border-neutral-150 dark:border-neutral-850 pb-4 mb-6">
          <div className="p-3 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-2xl">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
              Sincronizar y Configurar Hojas Google (Sheets)
            </h3>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
              Controlador de Inventario, Reseñas y Clientes
            </p>
          </div>
        </div>

        {/* Main form and instruction */}
        <form onSubmit={handleSync} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 dark:text-slate-400 uppercase tracking-widest mb-1.5 align-middle">
                URL de Catálogo (Google Sheets o CSV) *
              </label>
              <div className="relative">
                <input
                  type="url"
                  required
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading || success}
                  className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white rounded-xl border border-neutral-200 dark:border-neutral-800 pl-10 pr-4 py-2.5 focus:border-teal-505 focus:outline-none"
                  id="inp-sheets-url"
                />
                <Link className="absolute left-3.5 top-3 w-4.5 h-4.5 text-neutral-401" />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 lines-2">
                Enlace para descargar tus productos.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                URL de Apps Script (Servidor de Carga dócil)
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  disabled={loading || success}
                  className="w-full text-xs bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-white rounded-xl border border-neutral-200 dark:border-neutral-800 pl-10 pr-4 py-2.5 focus:border-teal-505 focus:outline-none"
                  id="inp-backend-url"
                />
                <MessageSquareCode className="absolute left-3.5 top-3 w-4.5 h-4.5 text-neutral-401" />
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 lines-2">
                Permite registrar nuevas reseñas y números de clientes en tu hoja.
              </p>
            </div>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs rounded-xl p-3.5 font-medium flex gap-2 border border-rose-500/10 mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl p-3.5 font-medium flex gap-2 border border-emerald-500/10 mb-2">
              <Check className="w-5 h-5 bg-emerald-500 text-white rounded-full p-1 shrink-0" />
              <span>¡Cambios y sincronización completados con éxito!</span>
            </div>
          )}

          {/* Google Apps Script deploy instructions */}
          <div className="bg-neutral-50 dark:bg-neutral-850/50 border border-neutral-150 dark:border-neutral-800 rounded-2xl p-4.5 space-y-3">
            <div className="flex justify-between items-center pb-1">
              <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                ⚡ CÓMO HABILITAR CARGAS (RESEÑAS Y CLIENTES)
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copiar Código
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Para guardar reseñas y clientes en tu mismo Sheets, sigue este breve tutorial de 60 segundos:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-neutral-600 dark:text-rose-20 w-full pl-1 leading-relaxed space-y-1">
              <li>Haz clic en el botón de arriba de <strong>Copiar Código</strong>.</li>
              <li>En tu Google Sheets ve a <strong>Extensiones &gt; Apps Script</strong>.</li>
              <li>Borra todo el contenido actual y pega el código copiado.</li>
              <li>Ponle nombre y haz clic en <strong>Implementar &gt; Nueva implementación</strong> (botón azul arriba).</li>
              <li>Selecciona tipo <strong>Aplicación web</strong>. Ejecutar como <strong>"Yo"</strong> y Acceso <strong>"Cualquiera"</strong>.</li>
              <li>Haz clic en Implementar y copia la <strong>URL de la Aplicación web</strong>. Pégala arriba a la derecha.</li>
            </ol>
          </div>

          {/* Guidelines check */}
          <div className="bg-neutral-50 dark:bg-neutral-850/20 border border-neutral-150 dark:border-neutral-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-sky-505" /> ¿Cómo armar las pestañas en tu documento?
            </span>
            <ul className="list-disc list-inside text-[11px] text-neutral-605 dark:text-neutral-400 space-y-1.5 pl-1 leading-relaxed">
              <li>Pestaña 1 (Inventario, ej <strong>INVENTARIO</strong>): Encabezados obligatorios: <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 text-[10px] text-teal-650">Id, Nombre de Producto, Categoría, Descripción, Precio, Precio Oferta, Disponible, Oferta, Fotos</code>.</li>
              <li>Pestaña 2 (<strong>RESEÑAS</strong>): Encabezados: <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 text-[10px] text-teal-650">productId, name, rating, comment, date</code>.</li>
              <li>Pestaña 3 (<strong>CLIENTES</strong>): Encabezados: <code className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 text-[10px] text-teal-650">phone, date</code>.</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="w-1/3 py-3 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="w-2/3 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-300 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              id="btn-sheets-sync-submit"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Descargando Catálogo...
                </>
              ) : (
                <>Guardar y Sincronizar</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
