import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, Lock, User, Users, Check, AlertTriangle, RefreshCw, Smartphone, 
  Settings, Package, LayoutDashboard, Plus, Trash2, Edit2, LogOut, ExternalLink, HelpCircle,
  Search, Calendar, MessageSquare, Phone, Receipt, Eye, Printer, ChevronLeft, ChevronRight, Menu,
  LayoutList, Grid, LayoutGrid, Filter, Bell, Image
} from "lucide-react";
import { parseCSV, submitToAppsScript, formatPrice } from "../utils";
import { api, isEndpointConfigured, sessionSet, sessionGet } from "../lib/api";
import { Product } from "../types";
import { motion, AnimatePresence } from "motion/react";

// Web Audio API pure synthesizer to chime on new orders without external audio files
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Play a friendly arpeggio chime (C5 -> E5 -> G5)
    const now = ctx.currentTime;
    
    // Note C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Note E5 (659.25 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.08);
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.43);

    // Note G5 (783.99 Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(783.99, now + 0.16);
    gain3.gain.setValueAtTime(0, now + 0.16);
    gain3.gain.linearRampToValueAtTime(0.15, now + 0.20);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.16);
    osc3.stop(now + 0.55);

  } catch (e) {
    console.warn("Audio Context chime failed to play:", e);
  }
};

// Parse raw spreadsheet order text cells (e.g. "[2 uni] Product A \n [1 uni] Product B") into structured arrays
const parseProductsString = (prodStr: string) => {
  if (!prodStr) return [];
  return prodStr.split("\n").map(line => {
    line = line.trim();
    if (!line) return null;
    const match = line.match(/^\[(\d+)\s*(?:uni|units|unidades|x)?\]\s*(.*)$/i);
    if (match) {
      return {
        qty: parseInt(match[1]),
        name: match[2].trim()
      };
    }
    const fallbackMatch = line.match(/^(\d+)\s*[xX]\s*(.*)$/);
    if (fallbackMatch) {
      return {
        qty: parseInt(fallbackMatch[1]),
        name: fallbackMatch[2].trim()
      };
    }
    return {
      qty: 1,
      name: line
    };
  }).filter((x): x is { qty: number; name: string } => x !== null);
};

// Parse various standard date-time string formats returned by Google Sheets
const parseOrderDate = (fechaStr: string): Date => {
  if (!fechaStr) return new Date();
  const cleaned = fechaStr.trim();
  
  // Try DD/MM/YYYY HH:MM:SS or DD/MM/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const minute = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const second = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;
    return new Date(year, month, day, hour, minute, second);
  }
  
  // Try YYYY-MM-DD HH:MM:SS or YYYY-MM-DD
  const dashMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10) - 1;
    const day = parseInt(dashMatch[3], 10);
    const hour = dashMatch[4] ? parseInt(dashMatch[4], 10) : 0;
    const minute = dashMatch[5] ? parseInt(dashMatch[5], 10) : 0;
    const second = dashMatch[6] ? parseInt(dashMatch[6], 10) : 0;
    return new Date(year, month, day, hour, minute, second);
  }
  
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date();
};

const APPS_SCRIPT_TEMPLATE = `// MAGXOR ENGINE — Usa apps-script/Code.gs de este repo (versión segura con READ_TOKEN + login servidor).
// Pasos: crea un Google Sheet NUEVO (privado) > Extensiones > Apps Script > pega Code.gs >
// ejecuta setupMagxor() > crearAdmin("admin","CLAVE") > Implementar > Aplicación web (Yo/Cualquiera).
// Luego configura VITE_APPS_SCRIPT_URL + VITE_READ_TOKEN en .env. El Sheet NO se publica en la web.
// (Plantilla legacy sin auth eliminada por seguridad. Ver apps-script/README_SETUP.md)
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var params = {};
  if (e && e.parameter) {
    for (var key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      for (var key in json) {
        params[key] = json[key];
      }
    } catch(err) {}
  }
  
  var action = params.action;
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "addReview") {
    var reviewsSheet = sheet.getSheetByName("RESEÑAS");
    if (!reviewsSheet) {
      reviewsSheet = sheet.insertSheet("RESEÑAS");
      reviewsSheet.appendRow(["productId", "name", "rating", "comment", "date"]);
    }
    reviewsSheet.appendRow([
      params.productId || "",
      params.name || "Cliente",
      parseInt(params.rating) || 5,
      params.comment || "",
      params.date || "Hace poco"
    ]);
  } else if (action === "addClient") {
    var clientsSheet = sheet.getSheetByName("CLIENTES");
    if (!clientsSheet) {
      clientsSheet = sheet.insertSheet("CLIENTES");
      clientsSheet.appendRow(["PHONE", "DATE", "METODO", "CONTACTO"]);
    }
    clientsSheet.appendRow([
      params.phone || "",
      params.date || "",
      params.metodo || "Club WhatsApp",
      params.contacto || "NO"
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
      
      var targetPhone = String(params.phone).trim();
      for (var r = 1; r < data.length; r++) {
        var rowPhone = String(data[r][phoneCol]).trim();
        if (rowPhone === targetPhone || rowPhone.replace(/[^0-9]/g, "") === targetPhone.replace(/[^0-9]/g, "")) {
          if (contactoCol !== -1) {
            clientsSheet.getRange(r + 1, contactoCol + 1).setValue(params.contacto || "SI");
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
      var targetPhone = String(params.phone).trim();
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
      params.id || "",
      params.fecha || "",
      params.cliente || "",
      params.telefono || "",
      params.productos || "",
      parseFloat(params.total) || 0,
      params.entrega || "",
      params.estado || "PENDIENTE"
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
      var targetId = String(params.id).trim();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).trim() === targetId) {
          if (estadoCol !== -1) {
            ordersSheet.getRange(r + 1, estadoCol + 1).setValue(params.estado || "PENDIENTE");
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
      var targetId = String(params.id).trim();
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][idCol]).trim() === targetId) {
          ordersSheet.deleteRow(r + 1);
          break;
        }
      }
    }
  } else if (action === "updateSettings") {
    var datosSheet = sheet.getSheetByName("DATOS");
    if (!datosSheet) {
      datosSheet = sheet.insertSheet("DATOS");
      datosSheet.appendRow(["NOMBRE WEB", "HORARIOS", "DIRECCIÓN", "CONTACTO MINORISTA", "CONTACTO MAYORISTA", "CONTACTO TICKET", "PALETA DE COLORES", "ANUNCIO HEADER", "ENDPOINT APPS SCRIPT"]);
    }
    var numRows = datosSheet.getLastRow();
    if (numRows > 1) {
      datosSheet.deleteRows(2, numRows - 1);
    }
    datosSheet.appendRow([
      params.nombre_web || "",
      params.horarios || "",
      params.direccion || "",
      params.contacto_minorista || "",
      params.contacto_mayorista || "",
      params.contacto_ticket || "",
      params.paleta_colores || "",
      params.anuncio_header || "",
      params.endpoint_apps_script || ""
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
      params.id || "",
      params.nombre || "",
      params.categoria || "",
      params.descripcion || "",
      params.precio || "",
      params.precio_oferta || "",
      params.disponible || "SI",
      params.oferta || "NO",
      params.fotos || ""
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
      var targetId = String(params.id).toLowerCase().trim();
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
        if (mapCols["nombre"] !== undefined && params.nombre !== undefined) invSheet.getRange(foundRow, mapCols["nombre"] + 1).setValue(params.nombre);
        if (mapCols["categoria"] !== undefined && params.categoria !== undefined) invSheet.getRange(foundRow, mapCols["categoria"] + 1).setValue(params.categoria);
        if (mapCols["descripcion"] !== undefined && params.descripcion !== undefined) invSheet.getRange(foundRow, mapCols["descripcion"] + 1).setValue(params.descripcion);
        if (mapCols["precio"] !== undefined && params.precio !== undefined) invSheet.getRange(foundRow, mapCols["precio"] + 1).setValue(params.precio);
        if (mapCols["precio_oferta"] !== undefined && params.precio_oferta !== undefined) invSheet.getRange(foundRow, mapCols["precio_oferta"] + 1).setValue(params.precio_oferta);
        if (mapCols["disponible"] !== undefined && params.disponible !== undefined) invSheet.getRange(foundRow, mapCols["disponible"] + 1).setValue(params.disponible);
        if (mapCols["oferta"] !== undefined && params.oferta !== undefined) invSheet.getRange(foundRow, mapCols["oferta"] + 1).setValue(params.oferta);
        if (mapCols["fotos"] !== undefined && params.fotos !== undefined) invSheet.getRange(foundRow, mapCols["fotos"] + 1).setValue(params.fotos);
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
      var targetId = String(params.id).toLowerCase().trim();
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

interface InlinePriceInputProps {
  initialValue: number;
  onSave: (val: number) => void;
  className?: string;
}

function InlinePriceInput({ initialValue, onSave, className }: InlinePriceInputProps) {
  const [val, setVal] = useState(String(initialValue));

  useEffect(() => {
    setVal(String(initialValue));
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const parsed = parseFloat(val) || 0;
      onSave(parsed);
      e.currentTarget.blur();
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(val) || 0;
    onSave(parsed);
  };

  return (
    <div className="relative inline-flex items-center text-xs">
      <span className="absolute left-1.5 text-slate-500 font-bold select-none">$</span>
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={`bg-neutral-900 border border-white/5 hover:border-white/15 focus:border-blue-500/80 focus:outline-none rounded-lg py-1 pl-4.5 pr-1.5 w-26 text-right font-mono text-white text-xs ${className || ""}`}
      />
    </div>
  );
}

interface AdminPortalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetsUrl: string;
  backendUrl: string;
  onUpdateConnection?: (sheetsUrl: string, backendUrl: string) => void;
  allProducts: Product[];
  onUpdateProducts: (products: Product[]) => void;
  webSettings: {
    nombreWeb: string;
    horarios: string;
    direccion: string;
    contactoMinorista: string;
    contactoMayorista: string;
    contactoTicket?: string;
    paletaColores: string;
    anuncioHeader?: string;
    endpointAppsScript?: string;
  };
  onUpdateSettings: (settings: any) => void;
  showToast: (text: string, type?: "success" | "info" | "error") => void;
}

export default function AdminPortal({
  isOpen,
  onClose,
  sheetsUrl,
  backendUrl,
  onUpdateConnection,
  allProducts,
  onUpdateProducts,
  webSettings,
  onUpdateSettings,
  showToast
}: AdminPortalProps) {
  // Unique categories list derived dynamically
  const allCategories = Array.from(
    new Set(
      allProducts
        .map(p => p.category?.trim() || "")
        .filter(c => c !== "" && c.toLowerCase() !== "todos" && c.toLowerCase() !== "varios")
    )
  ).sort();

  // Login Session states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPausado, setIsPausado] = useState(false);
  const [isAtraso, setIsAtraso] = useState(false);
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("mx_admin_logged") === "true";
  });
  const [adminUser, setAdminUser] = useState(() => {
    return localStorage.getItem("mx_admin_user") || "";
  });

  // Navigation state
  const [activeTab, setActiveTab ] = useState<"metrics" | "inventory" | "settings" | "clients" | "orders">("metrics");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  
  // Clients state
  const [clients, setClients] = useState<{ phone: string; date: string; metodo: string; contacto: string }[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const fetchClients = async (isSilent = false) => {
    if (!isSilent) setIsLoadingClients(true);
    try {
      // 1. Endpoint seguro primero (sesión admin, Sheet privado)
      let records: any[] | null = await adminRead<any>("listClients");
      if (!records) {
        // 2. Fallback legacy CSV
        if (!sheetsUrl) return;
        const cleanSpreadsheetId = (url: string) => {
          const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          return match ? match[1] : null;
        };
        const ssId = cleanSpreadsheetId(sheetsUrl);
        if (!ssId) return;

        let clientsUrl = "";
        if (sheetsUrl.includes("/pub?")) {
          clientsUrl = `${sheetsUrl}&sheet=CLIENTES`;
        } else {
          clientsUrl = `https://docs.google.com/spreadsheets/d/${ssId}/gviz/tq?tqx=out:csv&sheet=CLIENTES&headers=1`;
        }

        const response = await fetch(clientsUrl);
        if (!response.ok) throw new Error();
        const csvText = await response.text();
        records = parseCSV(csvText);
      }

      // Map rows
      const mapped = records.map((row: any) => {
        let phoneVal = "";
        let dateVal = "";
        let metodoVal = "";
        let contactoVal = "NO";
        for (const k in row) {
          const lk = k.toLowerCase().trim();
          if (lk === "phone" || lk === "telefono" || lk === "teléfono" || lk === "celular" || lk.includes("phone") || lk === "tel" || lk === "cel" || lk === "celular" || lk.includes("número") || lk.includes("numero")) {
            phoneVal = row[k];
          } else if (lk.includes("date") || lk.includes("fecha") || lk === "registro") {
            dateVal = row[k];
          } else if (lk === "metodo" || lk === "método" || lk.includes("metod")) {
            metodoVal = row[k];
          } else if (lk === "contacto" || lk.includes("contac")) {
            contactoVal = row[k];
          }
        }
        if (!phoneVal) phoneVal = Object.values(row)[0] as string || "";
        if (!dateVal) dateVal = Object.values(row)[1] as string || "";

        // Smart Swap Auto-correction: if phone and date columns are inverted in the spreadsheet or fallback keys
        const pClean = String(phoneVal).trim();
        const dClean = String(dateVal).trim();
        
        const isLikelyDate = (s: string): boolean => {
          if (s.includes("/")) return true;
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s) || /^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) return true;
          return false;
        };

        const isLikelyPhone = (s: string): boolean => {
          if (s.includes("/")) return false;
          const digits = s.replace(/[^0-9]/g, "");
          return digits.length >= 6 && /^[+0-9\s()-.]{6,25}$/.test(s);
        };

        if (isLikelyDate(pClean) || (isLikelyPhone(dClean) && !isLikelyPhone(pClean))) {
          // They are swapped; correct the assignment:
          phoneVal = dClean;
          dateVal = pClean;
        }

        return {
          phone: String(phoneVal).trim(),
          date: String(dateVal).trim(),
          metodo: String(metodoVal || "Club WhatsApp").trim(),
          contacto: String(contactoVal || "NO").trim().toUpperCase() === "SI" ? "SI" : "NO"
        };
      }).filter(item => item.phone && item.phone.trim() !== "");

      setClients(prev => {
        if (prev.length > 0) {
          const existingPhones = new Set(prev.map(c => c.phone));
          const newClientsList = mapped.filter(c => !existingPhones.has(c.phone));
          if (newClientsList.length > 0) {
            playNotificationSound();
            showToast(`¡Nuevo cliente registrado: ${newClientsList[0].phone}!`, "success");
            setNewClientPopupData(newClientsList[0]);
          }
        }
        return mapped;
      });
    } catch (err) {
      console.error("Error loading clients:", err);
    } finally {
      if (!isSilent) setIsLoadingClients(false);
    }
  };

  // --- ORDERS STATE & HANDLERS ---
  interface OrderItem {
    id: string;
    fecha: string;
    cliente: string;
    telefono: string;
    productos: string;
    total: number;
    entrega: string;
    estado: string;
  }

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderFilterStatus, setOrderFilterStatus] = useState<"all" | "PENDIENTE" | "CONFIRMADO" | "ENTREGADO" | "CANCELADO" | "ARCHIVADO">("all");
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderItem | null>(null);

  // Custom added states for requested reforms
  const [showOrderFilters, setShowOrderFilters] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"hoy" | "7dias" | "30dias" | "personalizado">("30dias");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [newOrderPopupData, setNewOrderPopupData] = useState<OrderItem | null>(null);
  const [newClientPopupData, setNewClientPopupData] = useState<{ phone: string; date: string; metodo: string; contacto: string } | null>(null);
  const [inventoryLayout, setInventoryLayout] = useState<"list" | "grid-3" | "grid-4">("list");

  const fetchOrders = async (isSilent = false) => {
    if (!isSilent) setIsLoadingOrders(true);
    try {
      // 1. Endpoint seguro primero (sesión admin, Sheet privado)
      let records: any[] | null = await adminRead<any>("listOrders");
      if (!records) {
        // 2. Fallback legacy CSV
        if (!sheetsUrl) return;
        const cleanSpreadsheetId = (url: string) => {
          const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          return match ? match[1] : null;
        };
        const ssId = cleanSpreadsheetId(sheetsUrl);
        if (!ssId) return;

        let ordersUrl = "";
        if (sheetsUrl.includes("/pub?")) {
          ordersUrl = `${sheetsUrl}&sheet=PEDIDOS`;
        } else {
          ordersUrl = `https://docs.google.com/spreadsheets/d/${ssId}/gviz/tq?tqx=out:csv&sheet=PEDIDOS&headers=1`;
        }

        const response = await fetch(ordersUrl);
        if (!response.ok) throw new Error();
        const csvText = await response.text();
        records = parseCSV(csvText);
      }

      const mapped = records.map((row: any) => {
        let idVal = "";
        let fechaVal = "";
        let clienteVal = "";
        let telefonoVal = "";
        let productosVal = "";
        let totalVal = 0;
        let entregaVal = "";
        let estadoVal = "PENDIENTE";

        for (const k in row) {
          const lk = k.toLowerCase().trim();
          if (lk === "id" || lk === "codigo" || lk === "código" || lk === "pedido") {
            idVal = row[k];
          } else if (lk === "fecha" || lk === "date") {
            fechaVal = row[k];
          } else if (lk === "cliente" || lk === "customer" || lk === "nombre") {
            clienteVal = row[k];
          } else if (lk === "telefono" || lk === "teléfono" || lk === "phone" || lk === "celular") {
            telefonoVal = row[k];
          } else if (lk === "productos" || lk === "products" || lk === "detalle") {
            productosVal = row[k];
          } else if (lk === "total" || lk === "amount") {
            totalVal = parseFloat(String(row[k]).replace(/[^0-9.]/g, "")) || 0;
          } else if (lk === "entrega" || lk === "delivery") {
            entregaVal = row[k];
          } else if (lk === "estado" || lk === "status") {
            estadoVal = String(row[k]).trim().toUpperCase();
          }
        }

        if (!idVal) idVal = Object.values(row)[0] as string || "";
        if (!fechaVal) fechaVal = Object.values(row)[1] as string || "";

        return {
          id: String(idVal).trim(),
          fecha: String(fechaVal).trim(),
          cliente: String(clienteVal || "Cliente").trim(),
          telefono: String(telefonoVal || "-").trim(),
          productos: String(productosVal || "").trim(),
          total: totalVal,
          entrega: String(entregaVal || "Retiro en local").trim(),
          estado: estadoVal || "PENDIENTE"
        };
      }).filter(item => item.id && item.id.trim() !== "");

      // Reverse so newest orders are displayed first
      mapped.reverse();

      // Set orders and trigger chime if new orders are detected during intervals
      setOrders(prev => {
        if (prev.length > 0) {
          const existingIds = new Set(prev.map(o => o.id));
          const newOrdersList = mapped.filter(o => !existingIds.has(o.id));
          if (newOrdersList.length > 0) {
            playNotificationSound();
            showToast(`¡Entró un nuevo pedido de ${newOrdersList[0].cliente}!`, "success");
            setNewOrderPopupData(newOrdersList[0]);
          }
        }
        return mapped;
      });
    } catch (err) {
      console.error("Error loading orders:", err);
    } finally {
      if (!isSilent) setIsLoadingOrders(false);
    }
  };

  // --- ADMIN ESCRITURAS: endpoint con sesión primero, legacy GET como fallback ---
  const adminWrite = async (params: Record<string, unknown>): Promise<boolean> => {
    const { action, ...rest } = params;
    if (isEndpointConfigured()) {
      try {
        await api.admin(sessionGet(), String(action), rest);
        return true;
      } catch (e) {
        console.error(`adminWrite ${String(action)} falló:`, e);
        return false;
      }
    }
    if (backendUrl) {
      return submitToAppsScript(backendUrl, params);
    }
    return false;
  };

  // --- LECTURAS ADMIN: endpoint con sesión primero, CSV legacy como fallback ---
  const adminRead = async <T,>(action: "listOrders" | "listClients"): Promise<T[] | null> => {
    if (isEndpointConfigured()) {
      try {
        const res = await api.admin(sessionGet(), action);
        const key = action === "listOrders" ? "orders" : "clients";
        return (res[key] as T[]) || [];
      } catch (e) {
        console.error(`adminRead ${action} falló:`, e);
        return null;
      }
    }
    return null;
  };

  const handleUpdateOrderStatus = async (id: string, nextEstado: string) => {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, estado: nextEstado } : o));

    try {
      const success = await adminWrite({
        action: "updateOrderStatus",
        id: id,
        estado: nextEstado
      });
      if (success) {
        showToast(`Estado de pedido actualizado a ${nextEstado} en Google Sheets.`, "success");
      } else {
        showToast("Actualizado localmente, pero falló la sincronización con Google Sheets.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión al actualizar estado.", "error");
    }
  };

  const handleDeleteOrder = async (id: string) => {
    // Optimistic UI update
    setOrders(prev => prev.filter(o => o.id !== id));
    showToast("Pedido eliminado de la lista local", "info");

    try {
      const success = await adminWrite({
        action: "deleteOrder",
        id: id
      });
      if (success) {
        showToast("Pedido eliminado correctamente de Google Sheets.", "success");
      } else {
        showToast("Eliminado localmente, pero falló la eliminación de Google Sheets.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión al eliminar pedido del Sheet.", "error");
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      if (activeTab === "clients") {
        fetchClients();
        fetchOrders(true);
      } else if (activeTab === "orders") {
        fetchOrders();
        fetchClients(true);
      } else {
        fetchOrders(true);
        fetchClients(true);
      }
      
      // Auto-refresh every 5 seconds for background tracking of orders AND clients
      const interval = setInterval(() => {
        fetchOrders(true);  // silent background fetch
        fetchClients(true); // silent background fetch
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, activeTab, sheetsUrl]);
  
  // Inventory Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "active" | "outofstock">("all");
  const [inventoryViewMode, setInventoryViewMode] = useState<"list" | "grid">("list");

  // Clients Search, Filter, and deletion states
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientFilterStatus, setClientFilterStatus] = useState<"all" | "contacted" | "pending">("all");
  const [clientToDeletePhone, setClientToDeletePhone] = useState<string | null>(null);

  // Admin password lock states
  const [adminPass, setAdminPass] = useState<string>("");
  // Admin pass se verifica en servidor (verifyAdminPass). Nunca se compara en cliente.
  const [isDbUnlocked, setIsDbUnlocked] = useState<boolean>(false);
  const [unlockPasswordAttempt, setUnlockPasswordAttempt] = useState<string>("");
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  const handleUnlockDb = async () => {
    const cleanAttempt = unlockPasswordAttempt.trim();
    if (!cleanAttempt) {
      showToast("Debes ingresar una contraseña.", "error");
      return;
    }
    if (!isEndpointConfigured()) {
      showToast("Configura el endpoint Apps Script para verificación segura.", "error");
      return;
    }
    setIsUnlocking(true);
    try {
      await api.verifyAdminPass(sessionGet(), cleanAttempt);
      setIsDbUnlocked(true);
      setUnlockPasswordAttempt("");
      showToast("¡Configuración desbloqueada con éxito!", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Clave incorrecta.", "error");
    } finally {
      setIsUnlocking(false);
    }
  };
  const [isDbCollapsibleOpen, setIsDbCollapsibleOpen] = useState<boolean>(false);

  // Inventory pagination states
  const [inventoryPage, setInventoryPage] = useState<number>(1);
  const [inventoryItemsPerPage, setInventoryItemsPerPage] = useState<number>(20);
  const [scriptCopied, setScriptCopied] = useState<boolean>(false);

  useEffect(() => {
    setInventoryPage(1);
  }, [searchTerm, stockFilter, inventoryItemsPerPage]);
  
  // Custom dialog states for product deletion confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [deletingProductId, setDeletingProductId] = useState<string>("");
  
  // Settings Form States
  const [formData, setFormData] = useState({
    nombreWeb: webSettings.nombreWeb,
    horarios: webSettings.horarios,
    direccion: webSettings.direccion,
    contactoMinorista: webSettings.contactoMinorista,
    contactoMayorista: webSettings.contactoMayorista,
    contactoTicket: webSettings.contactoTicket || webSettings.contactoMinorista || "5493584164396",
    paletaColores: webSettings.paletaColores,
    anuncioHeader: webSettings.anuncioHeader || "🔥 Obtené una Tienda como Está!!",
    endpointAppsScript: webSettings.endpointAppsScript || ""
  });

  const [localSheetsUrl, setLocalSheetsUrl] = useState(sheetsUrl);
  const [localBackendUrl, setLocalBackendUrl] = useState(backendUrl);

  // Metrics Popups States
  const [metricsPopupType, setMetricsPopupType] = useState<"sales" | "products" | "billing" | null>(null);

  // Product Create/Edit form drawer Modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [prodForm, setProdForm] = useState({
    id: "",
    name: "",
    category: "",
    description: "",
    price: "",
    originalPrice: "",
    stock: "10",
    disponible: "SI",
    oferta: "NO",
    image: "",
    secondaryImage: ""
  });

  // Action Pending states (remotes)
  const [isActionPending, setIsActionPending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Custom Category States
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  // Sync settings when they load or change externally
  useEffect(() => {
    setFormData({
      nombreWeb: webSettings.nombreWeb,
      horarios: webSettings.horarios,
      direccion: webSettings.direccion,
      contactoMinorista: webSettings.contactoMinorista,
      contactoMayorista: webSettings.contactoMayorista,
      contactoTicket: webSettings.contactoTicket || webSettings.contactoMinorista || "5493584164396",
      paletaColores: webSettings.paletaColores,
      anuncioHeader: webSettings.anuncioHeader || "🔥 Obtené una Tienda como Está!!",
      endpointAppsScript: webSettings.endpointAppsScript || ""
    });
  }, [webSettings]);

  useEffect(() => {
    setLocalSheetsUrl(sheetsUrl);
  }, [sheetsUrl]);

  useEffect(() => {
    setLocalBackendUrl(backendUrl);
  }, [backendUrl]);

  // Automatically trigger browser print dialog 600ms after opening any order ticket
  useEffect(() => {
    if (selectedOrderDetail) {
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [selectedOrderDetail]);

  // El Admin pass NUNCA se descarga al cliente: se verifica en servidor (verifyAdminPass).
  // (Se eliminó el fetch CSV de CREDENCIALES por seguridad.)

  // Handle history pop-state to close nicely on Android physical back press
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modalId: "admin-portal" }, "");
      const handlePopState = (event: PopStateEvent) => {
        onClose();
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [isOpen, onClose]);

  // Lock body scroll when AdminPortal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const handleSafeClose = () => {
    if (window.history.state && window.history.state.modalId === "admin-portal") {
      window.history.back();
    } else {
      onClose();
    }
  };

  // 1. LOGIN HANDLER Validate against Sheet CREDENCIALES
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage("Por favor, completá todos los campos.");
      return;
    }

    setIsLoggingIn(true);
    setErrorMessage("");
    setIsPausado(false);

    try {
      // Login seguro: valida en el servidor (Apps Script). Nunca descarga CREDENCIALES al cliente.
      if (isEndpointConfigured()) {
        const res = await api.login(username.trim(), password);
        sessionSet(res.session);
        localStorage.setItem("mx_admin_logged", "true");
        localStorage.setItem("mx_admin_user", res.user || username.trim());
        setIsLoggedIn(true);
        setAdminUser(res.user || username.trim());
        setPassword("");
        if (res.atraso) {
          setIsAtraso(true);
          showToast("⚠️ Sesión iniciada con pago pendiente. Regularizá tu cuenta.", "error");
        } else {
          setIsAtraso(false);
          showToast("¡Sesión iniciada con éxito!", "success");
        }
        return;
      }
      // Sin endpoint no hay login seguro: las credenciales en claro por CSV están prohibidas.
      throw new Error("Configura el endpoint Apps Script (VITE_APPS_SCRIPT_URL) para iniciar sesión de forma segura.");

    } catch (err: any) {
      setErrorMessage(err.message || "Error al autenticar.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("mx_admin_logged");
    localStorage.removeItem("mx_admin_user");
    try {
      sessionStorage.removeItem("mx_admin_session");
    } catch { /* noop */ }
    setIsLoggedIn(false);
    setAdminUser("");
    setIsAtraso(false);
    showToast("Sesión cerrada.", "info");
    onClose();
  };

  // 2. DASHBOARD SETTINGS HANDLER
  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionPending(true);

    try {
      // 1. Submit update setting parameters to Apps Script first
      const activeUrl = localBackendUrl || backendUrl;
      const finalEndpoint = localBackendUrl || backendUrl || formData.endpointAppsScript;
      if (activeUrl) {
        const params = {
          action: "updateSettings",
          nombre_web: formData.nombreWeb,
          horarios: formData.horarios,
          direccion: formData.direccion,
          contacto_minorista: formData.contactoMinorista,
          contacto_mayorista: formData.contactoMayorista,
          contacto_ticket: formData.contactoTicket,
          paleta_colores: formData.paletaColores,
          anuncio_header: formData.anuncioHeader,
          endpoint_apps_script: finalEndpoint
        };
        
        // Asynchronous fire to avoid blocking the client
        void adminWrite(params).then(success => {
          if (success) {
            console.log("Settings written back to Sheets.");
          }
        });
      }

      // Update connection URLs if different
      if (onUpdateConnection) {
        onUpdateConnection(localSheetsUrl, finalEndpoint);
      }

      // 2. Local Fallback is updated immediately to reflect instantly
      onUpdateSettings({
        ...formData,
        endpointAppsScript: finalEndpoint
      });
      showToast("¡Configuración guardada exitosamente y enviada al Sheet!", "success");

    } catch (error) {
      console.error(error);
      showToast("Error al guardar la configuración.", "error");
    } finally {
      setIsActionPending(false);
    }
  };

  // 3. PRODUCT FORM HANDLER (CREATE / UPDATE)
  const openNewProductForm = () => {
    // Generate sequential ID based on last created product suffix
    let nextId = "1";
    if (allProducts && allProducts.length > 0) {
      let maxNum = 0;
      let matchingPattern = { prefix: "sku-", suffix: "", digitsCount: 0 };
      allProducts.forEach(p => {
        const idStr = String(p.id).trim();
        const match = idStr.match(/^(.*?)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const digitsStr = match[2];
          const num = parseInt(digitsStr, 10);
          if (num > maxNum) {
            maxNum = num;
            matchingPattern = {
              prefix,
              suffix: "",
              digitsCount: digitsStr.length
            };
          }
        }
      });
      if (maxNum > 0) {
        const nextNumStr = String(maxNum + 1).padStart(matchingPattern.digitsCount, "0");
        nextId = `${matchingPattern.prefix}${nextNumStr}`;
      } else {
        nextId = String(allProducts.length + 1);
      }
    }

    // Default category to empty string (Sin Categoría)
    const defaultCategory = "";

    setProdForm({
      id: nextId,
      name: "",
      category: defaultCategory,
      description: "",
      price: "",
      originalPrice: "",
      stock: "10",
      disponible: "SI",
      oferta: "NO",
      image: "",
      secondaryImage: ""
    });
    setIsCustomCategory(false);
    setCustomCategoryName("");
    setUploadError("");
    setIsUploadingImage(false);
    setIsEditingProduct(false);
    setShowProductModal(true);
  };

  const openEditProductForm = (product: Product) => {
    const effectivePrice = product.isPromo ? (product.originalPrice || product.price) : product.price;
    const isAvailable = product.stock > 0 && product.price > 0;
    setProdForm({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      price: String(effectivePrice),
      originalPrice: product.isPromo ? String(product.price) : "",
      stock: isAvailable ? String(product.stock) : "0",
      disponible: isAvailable ? "SI" : "NO",
      oferta: product.isPromo ? "SI" : "NO",
      image: product.image,
      secondaryImage: product.secondaryImage || ""
    });
    setIsCustomCategory(false);
    setCustomCategoryName("");
    setUploadError("");
    setIsUploadingImage(false);
    setIsEditingProduct(true);
    setShowProductModal(true);
  };

  // Limpia el nombre del producto para usarlo como nombre de archivo
  const limpiarNombreProducto = (nombre: string) => {
    return nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // saca tildes
      .replace(/[^a-z0-9]+/g, "_") // reemplaza espacios y símbolos por _
      .replace(/^_+|_+$/g, ""); // saca _ sobrantes al principio/final
  };

  // Sube imagen automáticamente a ImgBB vía POST
  // Sube imagen a ImgBB convirtiendo a WebP en el navegador (GIF/video se suben tal cual para no romper animación)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadError("");

    // Create local object URL for instant user feedback
    const localUrl = URL.createObjectURL(file);
    setProdForm((prev) => ({ ...prev, image: localUrl }));

    try {
      const { convertToWebp } = await import("../lib/image");
      const conv = await convertToWebp(file, { maxSide: 1600, quality: 0.82 });
      const uploadFile = conv.file;

      const formData = new FormData();
      formData.append("image", uploadFile);

      const productTitle = prodForm.name || "producto";
      const nombreLimpio = limpiarNombreProducto(productTitle);
      const tiendaName = webSettings.nombreWeb ? limpiarNombreProducto(webSettings.nombreWeb) : "tienda";
      const ext = uploadFile.type === "image/webp" ? "webp" : (uploadFile.name.split(".").pop() || "jpg");
      const fileName = `${tiendaName}_${nombreLimpio}_${Date.now()}.${ext}`;
      formData.append("name", fileName);

      // API Key solo desde entorno (sin fallback quemado por seguridad)
      const apiKey = (import.meta as any).env.VITE_IMGBB_API_KEY || "";
      if (!apiKey) {
        throw new Error("Falta VITE_IMGBB_API_KEY en el archivo .env");
      }
      const endpoint = `https://api.imgbb.com/1/upload?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor de ImgBB (${response.status})`);
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data?.display_url) {
        const uploadedUrl = resJson.data.display_url;
        setProdForm((prev) => ({ ...prev, image: uploadedUrl }));
        showToast(conv.converted ? `Imagen WebP subida (${conv.originalKB}→${conv.webpKB} KB).` : "Imagen cargada y procesada por ImgBB con éxito.", "success");
      } else {
        throw new Error(resJson.error?.message || "La respuesta de ImgBB no fue exitosa.");
      }
    } catch (err: any) {
      console.error("ImgBB Upload failure:", err);
      const matchedProduct = allProducts.find((p) => p.id === prodForm.id);
      setProdForm((prev) => ({ ...prev, image: matchedProduct?.image || "" }));
      setUploadError(err?.message || "Ocurrió un error al subir la imagen.");
      showToast("No se pudo subir la imagen a ImgBB.", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.id || !prodForm.name || !prodForm.price) {
      showToast("Por favor complete los campos obligatorios.", "error");
      return;
    }

    setIsActionPending(true);

    try {
      const priceVal = parseFloat(prodForm.price) || 0;
      const isPromoFlag = prodForm.oferta === "SI";
      const promoPriceVal = isPromoFlag ? (parseFloat(prodForm.originalPrice) || 0) : 0;
      const cleanCategory = prodForm.category?.trim() || "";
      const finalCategory = (cleanCategory.toLowerCase() === "varios" || !cleanCategory) ? "" : cleanCategory;
      const finalPrice = isPromoFlag && promoPriceVal > 0 ? promoPriceVal : priceVal;

      // Si el precio final o base es <= 0, el artículo pasa automáticamente a NO disponible
      const isPriceZero = finalPrice <= 0 || priceVal <= 0;
      const effectiveDisponible = isPriceZero ? "NO" : prodForm.disponible;
      const effectiveStock = (effectiveDisponible === "SI" && !isPriceZero) ? (parseInt(prodForm.stock) || 10) : 0;

      const newProduct: Product = {
        id: prodForm.id,
        name: prodForm.name,
        category: finalCategory,
        description: prodForm.description || "",
        price: finalPrice,
        originalPrice: isPromoFlag && promoPriceVal > 0 ? priceVal : undefined,
        image: prodForm.image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80",
        secondaryImage: prodForm.secondaryImage || undefined,
        stock: effectiveStock,
        badge: isPromoFlag ? "Oferta" : (effectiveStock <= 3 && effectiveStock > 0 && effectiveDisponible === "SI" ? "Últimas unidades" : ""),
        isPromo: isPromoFlag,
        isNew: false,
        isBestSeller: false
      };

      // Create new list
      let updatedProducts = [...allProducts];
      if (isEditingProduct) {
        updatedProducts = updatedProducts.map(p => p.id === newProduct.id ? newProduct : p);
      } else {
        // Exclude duplicate SKU
        if (updatedProducts.some(p => p.id === newProduct.id)) {
          showToast(`El código/ID "${newProduct.id}" ya existe en el inventario.`, "error");
          setIsActionPending(false);
          return;
        }
        updatedProducts.unshift(newProduct);
      }

      // Update Local immediately
      onUpdateProducts(updatedProducts);

      // Async transfer to Sheets Web App (Apps Script)
      if (backendUrl) {
        const actionType = isEditingProduct ? "updateProduct" : "addProduct";
        const paramsSubmit = {
          action: actionType,
          id: newProduct.id,
          nombre: newProduct.name,
          categoria: newProduct.category,
          descripcion: newProduct.description,
          precio: String(isPromoFlag ? (newProduct.originalPrice || priceVal) : priceVal),
          precio_oferta: isPromoFlag ? String(newProduct.price) : "",
          disponible: effectiveDisponible,
          oferta: prodForm.oferta,
          fotos: newProduct.secondaryImage ? `${newProduct.image}, ${newProduct.secondaryImage}` : newProduct.image
        };

        void adminWrite(paramsSubmit).then(success => {
          if (success) {
            console.log(`Action ${actionType} pushed to Sheet.`);
          }
        });
      }

      showToast(
        isEditingProduct ? "¡Artículo actualizado inmediatamente!" : "¡Artículo cargado con éxito!", 
        "success"
      );
      setShowProductModal(false);

    } catch (err) {
      console.error(err);
      showToast("Error al guardar el artículo.", "error");
    } finally {
      setIsActionPending(false);
    }
  };

  // 4. REMOTE DELETE HANDLER
  const handleDeleteProduct = async (prodId: string) => {
    setDeletingProductId(prodId);
    setShowDeleteConfirmModal(true);
  };

  const executeDeleteProduct = async () => {
    const prodId = deletingProductId;
    if (!prodId) return;

    setIsActionPending(true);
    setShowDeleteConfirmModal(false);

    try {
      // Find item details to show in the toast
      const itemToDelete = allProducts.find(p => p.id === prodId);
      const itemName = itemToDelete ? itemToDelete.name : prodId;

      // Update local state first
      const updated = allProducts.filter(p => p.id !== prodId);
      onUpdateProducts(updated);

      // Submit Async Apps Script deletion
      if (backendUrl) {
        showToast(`Eliminando "${itemName}" de Google Sheets...`, "info");
        void adminWrite({ action: "deleteProduct", id: prodId }).then(success => {
          if (success) {
            console.log("Product deleted from Google Sheet.");
            showToast(`¡"${itemName}" eliminado de la tienda y del Google Sheet!`, "success");
          } else {
            showToast(`"${itemName}" eliminado localmente, pero falló la escritura al Google Sheet. Revisa los permisos de script.`, "error");
          }
        });
      } else {
        showToast(`"${itemName}" eliminado localmente (sin conexión a base de datos externa).`, "info");
      }

    } catch (err) {
      console.error(err);
      showToast("Error al eliminar el artículo.", "error");
    } finally {
      setIsActionPending(false);
      setDeletingProductId("");
    }
  };

  // 5. REMOTELY TOGGLE ACCESSIBILITY
  const handleToggleProductAvailability = async (product: Product) => {
    const isNowAvailable = product.stock > 0;

    // Si tiene precio $0 y se intenta habilitar, bloquear y avisar al usuario
    if (!isNowAvailable && product.price <= 0) {
      showToast(`"${product.name}" tiene precio $0. Asigná un precio mayor a 0 para marcarlo como disponible.`, "error");
      return;
    }

    const newStock = isNowAvailable ? 0 : 10;
    
    // Update local state
    const updated = allProducts.map(p => {
      if (p.id === product.id) {
        return { 
          ...p, 
          stock: newStock,
          badge: isNowAvailable ? undefined : (p.badge === "Últimas unidades" && newStock === 0 ? undefined : p.badge)
        };
      }
      return p;
    });
    
    onUpdateProducts(updated);

    // Sync remote Apps Script
    if (backendUrl) {
      const isPromoFlag = product.isPromo;
      const normalPrice = isPromoFlag ? (product.originalPrice || product.price) : product.price;
      const promoPrice = isPromoFlag ? product.price : 0;

      const paramsSubmit = {
        action: "updateProduct",
        id: product.id,
        nombre: product.name,
        categoria: product.category,
        descripcion: product.description,
        precio: String(normalPrice),
        precio_oferta: isPromoFlag ? String(promoPrice) : "",
        disponible: !isNowAvailable ? "SI" : "NO",
        oferta: isPromoFlag ? "SI" : "NO",
        fotos: product.secondaryImage ? `${product.image}, ${product.secondaryImage}` : product.image
      };

      void adminWrite(paramsSubmit).then(success => {
        if (success) console.log("Product availability toggler written to Sheet.");
      });
    }

    showToast(
      !isNowAvailable ? `¡"${product.name}" marcado como DISPONIBLE!` : `¡"${product.name}" marcado como AGOTADO!`,
      "success"
    );
  };

  // 6. INLINE PRICE UPDATE HANDLER
  const handleInlinePriceUpdate = async (product: Product, newPrice: number, isPromoPrice: boolean) => {
    // Update local state first
    const updated = allProducts.map(p => {
      if (p.id === product.id) {
        let updatedProd = { ...p };
        if (p.isPromo) {
          if (isPromoPrice) {
            updatedProd.price = newPrice;
          } else {
            updatedProd.originalPrice = newPrice;
          }
        } else {
          updatedProd.price = newPrice;
        }

        // Si el precio queda en 0 o menor, se marca automáticamente como NO disponible (stock = 0)
        if (updatedProd.price <= 0) {
          updatedProd.stock = 0;
          if (updatedProd.badge === "Últimas unidades") {
            updatedProd.badge = "";
          }
        }

        return updatedProd;
      }
      return p;
    });
    onUpdateProducts(updated);

    // Sync remote Apps Script
    if (backendUrl) {
      const target = updated.find(p => p.id === product.id);
      if (target) {
        const isPromoFlag = target.isPromo;
        const normalPrice = isPromoFlag ? (target.originalPrice ?? target.price) : target.price;
        const promoPrice = isPromoFlag ? target.price : "";
        const isAvailableRemote = target.price > 0 && target.stock > 0;

        const paramsSubmit = {
          action: "updateProduct",
          id: target.id,
          nombre: target.name,
          categoria: target.category,
          descripcion: target.description,
          precio: String(normalPrice),
          precio_oferta: isPromoFlag ? String(promoPrice) : "",
          disponible: isAvailableRemote ? "SI" : "NO",
          oferta: isPromoFlag ? "SI" : "NO",
          fotos: target.secondaryImage ? `${target.image}, ${target.secondaryImage}` : target.image
        };

        void adminWrite(paramsSubmit).then(success => {
          if (success) console.log("Inline price written to sheet.");
        });
      }
    }

    if (newPrice <= 0) {
      showToast(`Precio $0 asignado a "${product.name}". Marcado automáticamente como NO DISPONIBLE.`, "info");
    } else {
      showToast(`Precio de "${product.name}" actualizado en tiempo real.`, "success");
    }
  };

  // 7. INLINE PROMO TOGGLE HANDLER
  const handleToggleProductPromo = async (product: Product) => {
    const nextPromo = !product.isPromo;

    // Update local state
    const updated = allProducts.map(p => {
      if (p.id === product.id) {
        if (nextPromo) {
          return {
            ...p,
            isPromo: true,
            badge: "Oferta" as const,
            originalPrice: p.price,
            price: Math.round(p.price * 0.9)
          };
        } else {
          return {
            ...p,
            isPromo: false,
            badge: p.badge === "Oferta" ? "" as const : p.badge,
            price: p.originalPrice || p.price,
            originalPrice: undefined
          };
        }
      }
      return p;
    });

    onUpdateProducts(updated);

    // Sync remote Apps Script
    if (backendUrl) {
      const target = updated.find(p => p.id === product.id);
      if (target) {
        const normalPrice = nextPromo ? (target.originalPrice || target.price) : target.price;
        const promoPrice = nextPromo ? target.price : "";

        const paramsSubmit = {
          action: "updateProduct",
          id: target.id,
          nombre: target.name,
          categoria: target.category,
          descripcion: target.description,
          precio: String(normalPrice),
          precio_oferta: nextPromo ? String(promoPrice) : "",
          disponible: target.stock > 0 ? "SI" : "NO",
          oferta: nextPromo ? "SI" : "NO",
          fotos: target.secondaryImage ? `${target.image}, ${target.secondaryImage}` : target.image
        };

        void adminWrite(paramsSubmit).then(success => {
          if (success) console.log("Promo status toggler written to Sheet.");
        });
      }
    }

    showToast(
      nextPromo 
        ? `¡"${product.name}" marcado en OFERTA!` 
        : `¡"${product.name}" quitado de oferta!`,
      "success"
    );
  };

  // --- CLIENTS HANDLERS ---
  const handleToggleClientContact = async (phone: string, currentContacto: string) => {
    const nextContacto = currentContacto === "SI" ? "NO" : "SI";
    
    // Optimistic UI update
    setClients(prev => prev.map(c => c.phone === phone ? { ...c, contacto: nextContacto } : c));

    try {
      const success = await adminWrite({
        action: "updateClientContact",
        phone: phone,
        contacto: nextContacto
      });
      if (success) {
        showToast(`Estado de contacto actualizado a ${nextContacto} en Google Sheets.`, "success");
      } else {
        showToast("Actualizado localmente, pero falló la sincronización con Google Sheets.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión al actualizar contacto.", "error");
    }
  };

  const handleDeleteClient = async (phone: string) => {
    // Optimistic UI update
    setClients(prev => prev.filter(c => c.phone !== phone));
    showToast("Cliente eliminado de la lista local", "info");

    try {
      const success = await adminWrite({
        action: "deleteClient",
        phone: phone
      });
      if (success) {
        showToast("Cliente eliminado correctamente de Google Sheets.", "success");
      } else {
        showToast("Eliminado localmente, pero falló la eliminación de Google Sheets.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error de conexión al eliminar cliente del Sheet.", "error");
    }
  };

  // Filtering products for inventory list
  const filteredProducts = allProducts.filter(p => {
    const matchesSearch = (
      String(p.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (!matchesSearch) return false;

    if (stockFilter === "active") {
      return p.stock > 0;
    }
    if (stockFilter === "outofstock") {
      return p.stock === 0;
    }
    return true;
  });

  // Calculate paginated inventory products
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredProducts.length / inventoryItemsPerPage));
  const paginatedInventoryProducts = filteredProducts.slice(
    (inventoryPage - 1) * inventoryItemsPerPage,
    inventoryPage * inventoryItemsPerPage
  );

  // Calculate metrics
  const totalProductsCount = allProducts.length;
  const activeProductsCount = allProducts.filter(p => p.stock > 0).length;
  const inactiveProductsCount = allProducts.filter(p => p.stock === 0).length;

  // Dynamic billing / invoicing metrics based on user period selector
  const now = new Date();
  const todayStr = now.toDateString();

  const billingFilteredOrders = orders.filter(o => {
    if (o.estado === "CANCELADO") return false;
    const oDate = parseOrderDate(o.fecha);
    
    if (billingPeriod === "hoy") {
      return oDate.toDateString() === todayStr;
    }
    if (billingPeriod === "7dias") {
      const diffMs = now.getTime() - oDate.getTime();
      return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
    }
    if (billingPeriod === "30dias") {
      const diffMs = now.getTime() - oDate.getTime();
      return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
    }
    if (billingPeriod === "personalizado") {
      if (!customStartDate) return true;
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      
      const end = customEndDate ? new Date(customEndDate) : new Date();
      end.setHours(23, 59, 59, 999);
      
      return oDate >= start && oDate <= end;
    }
    return true;
  });

  const billingSalesCount = billingFilteredOrders.length;
  const billingProductsCount = billingFilteredOrders.reduce((sum, o) => {
    return sum + parseProductsString(o.productos).reduce((pSum, p) => pSum + p.qty, 0);
  }, 0);
  const billingTotalAmount = billingFilteredOrders.reduce((sum, o) => sum + o.total, 0);

  const isAnyModalOpen = !!(
    showProductModal ||
    showDeleteConfirmModal ||
    newOrderPopupData ||
    newClientPopupData ||
    selectedOrderDetail ||
    metricsPopupType
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 ${isAnyModalOpen ? "overflow-hidden" : "overflow-y-auto"} flex flex-col`} style={{ minHeight: "100dvh" }}>
      
      {/* Fondo y Blur desacoplados para evitar crear un "containing block" que rompa el centrado de los modales 'fixed' al hacer scroll */}
      <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-md pointer-events-none -z-10" />

      {/* Banner / Header */}
      <div className="bg-[#0c0c0c] border-b border-white/10 px-4 md:px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 mr-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl transition-all cursor-pointer flex items-center justify-center select-none shrink-0"
              title={isSidebarCollapsed ? "Mostrar Menú" : "Ocultar Menú"}
            >
              {isSidebarCollapsed ? <Menu className="w-4 h-4 text-blue-400" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-sm">
            PC
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">Panel de Administración</h2>
            <p className="text-[10px] text-slate-400 font-medium">Control de Catálogo y Parámetros Operativos</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isLoggedIn && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs text-slate-300">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>Conectado: <strong className="text-white">{adminUser}</strong></span>
            </div>
          )}

          <button
            onClick={handleSafeClose}
            className="p-1 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
            id="btn-admin-close"
          >
            Salir
          </button>
        </div>
      </div>

      <div className={`flex-1 w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-6 ${isLoggedIn && isSidebarCollapsed ? "max-w-none" : "max-w-7xl"}`}>
        {isLoggedIn && isAtraso && (
          <div className="w-full p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>⚠️ Pago pendiente: regularizá tu cuenta con Magxor Engine para mantener la tienda activa.</span>
          </div>
        )}

        {/* IF NOT LOGGED IN LIST CREDENTIALS INTERACTION LOGIN */}
        {!isLoggedIn ? (
          <div className="w-full max-w-md mx-auto my-auto py-12">
            <div className="bg-[#111111] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
              
              <div className="text-center mb-6 pt-2">
                <div className="w-12 h-12 bg-blue-600/10 text-blue-400 border border-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-center text-white">Iniciar Sesión</h3>
                <p className="text-xs text-slate-400 mt-1">Autorización requerida para administrar el Inventario</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Usuario
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ej: admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoggingIn}
                      className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-4 pl-10 py-3 focus:border-blue-500 focus:outline-none"
                    />
                    <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoggingIn}
                      className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-4 pl-10 py-3 focus:border-blue-500 focus:outline-none"
                    />
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs flex gap-2 w-full">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">
                      <span>{errorMessage}</span>
                      {isPausado && (
                        <div className="mt-2.5">
                          <a
                            href={`https://api.whatsapp.com/send?phone=5493585603676&text=${encodeURIComponent("Tengo problemas para acceder al administrador de mi web. *Error: Cuenta Pausada*")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer border border-emerald-400/20"
                          >
                            Contactar al Administrador
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Verificando credenciales...
                    </>
                  ) : (
                    "Ingresar al Portal"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-white/5 text-[10px] text-slate-500 leading-relaxed text-center">
                🔑 Ingresa con la credencial que te brindó <strong>MAGXOR</strong> ,que es tu credencial de asociado.
              </div>
            </div>
          </div>
        ) : (
          /* LOGGED IN NAVIGATION AND FULL DASHBOARD PANELS */
          <>
            {/* Sidebar Controls */}
            {!isSidebarCollapsed && (
              <div className="w-full md:w-60 flex flex-col gap-2.5 shrink-0">
                <button
                  onClick={() => setActiveTab("metrics")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    activeTab === "metrics"
                      ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md"
                      : "bg-[#111111]/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
                  <span>Panel de Control</span>
                </button>

                <button
                  onClick={() => setActiveTab("inventory")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    activeTab === "inventory"
                      ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md"
                      : "bg-[#111111]/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Package className="w-4.5 h-4.5 shrink-0" />
                  <span>Editar Inventario ({totalProductsCount})</span>
                </button>

                <button
                  onClick={() => setActiveTab("clients")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    activeTab === "clients"
                      ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md"
                      : "bg-[#111111]/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Users className="w-4.5 h-4.5 shrink-0" />
                  <span>Clientes Registrados ({clients.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab("orders")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    activeTab === "orders"
                      ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md"
                      : orders.some(o => o.estado === "PENDIENTE")
                        ? "animate-pulse border-amber-500/30 text-amber-400 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : "bg-[#111111]/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Receipt className={`w-4.5 h-4.5 shrink-0 ${orders.some(o => o.estado === "PENDIENTE") && activeTab !== "orders" ? "text-amber-400 animate-bounce" : ""}`} />
                  <span className="flex-1">Gestión de Pedidos ({orders.length})</span>
                  {orders.some(o => o.estado === "PENDIENTE") && activeTab !== "orders" && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-md"
                      : "bg-[#111111]/60 border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Settings className="w-4.5 h-4.5 shrink-0" />
                  <span>Datos de la Tienda</span>
                </button>

                <div className="pt-4 border-t border-white/5 mt-3 space-y-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}

            {/* Content tabs */}
            <div className="flex-1 bg-[#111111] border border-white/10 rounded-3xl p-5 md:p-7 shadow-2xl flex flex-col min-h-[450px]">
              
              {/* TAB 1: METRICS / CONTROL PANEL */}
              {activeTab === "metrics" && (
                <div className="space-y-6">
                  {/* DYNAMIC BILLING DASHBOARD */}
                  <div className="bg-[#151515] border border-white/10 rounded-3xl p-5 md:p-6 space-y-5 shadow-lg relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                          <LayoutDashboard className="w-5 h-5 text-blue-400" />
                          <span>Resumen de Facturación y Ventas</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Métricas de pedidos activos, entregados y archivados filtrados por periodo</p>
                      </div>

                      {/* Period Select tabs */}
                      <div className="flex bg-[#111111] p-1 rounded-xl border border-white/5 self-start sm:self-center overflow-x-auto shrink-0 gap-0.5 max-w-full">
                        <button
                          type="button"
                          onClick={() => setBillingPeriod("hoy")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            billingPeriod === "hoy" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                        >
                          Hoy
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingPeriod("7dias")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            billingPeriod === "7dias" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                        >
                          7 Días
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingPeriod("30dias")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            billingPeriod === "30dias" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                        >
                          30 Días
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillingPeriod("personalizado")}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            billingPeriod === "personalizado" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                        >
                          Personalizado
                        </button>
                      </div>
                    </div>

                    {/* Custom Date Range Picker */}
                    {billingPeriod === "personalizado" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#111111]/40 border border-white/5 rounded-2xl animate-scale-in">
                        <div 
                          className="space-y-1.5 cursor-pointer group"
                          onClick={(e) => {
                            const input = e.currentTarget.querySelector('input');
                            if (input) {
                              try { input.showPicker(); } catch (err) {}
                            }
                          }}
                        >
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450 flex items-center gap-1 cursor-pointer">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>Fecha Inicio (Desde)</span>
                          </label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            onKeyDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              try { e.currentTarget.showPicker(); } catch (err) {}
                            }}
                            onFocus={(e) => {
                              try { e.currentTarget.showPicker(); } catch (err) {}
                            }}
                            className="w-full text-xs bg-[#151515] hover:bg-[#1a1a1a] border border-white/10 group-hover:border-blue-500/50 rounded-xl px-4.5 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                          />
                        </div>
                        <div 
                          className="space-y-1.5 cursor-pointer group"
                          onClick={(e) => {
                            const input = e.currentTarget.querySelector('input');
                            if (input) {
                              try { input.showPicker(); } catch (err) {}
                            }
                          }}
                        >
                          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-450 flex items-center gap-1 cursor-pointer">
                            <Calendar className="w-3.5 h-3.5 text-blue-400" />
                            <span>Fecha Fin (Hasta)</span>
                          </label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            onKeyDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              try { e.currentTarget.showPicker(); } catch (err) {}
                            }}
                            onFocus={(e) => {
                              try { e.currentTarget.showPicker(); } catch (err) {}
                            }}
                            className="w-full text-xs bg-[#151515] hover:bg-[#1a1a1a] border border-white/10 group-hover:border-blue-500/50 rounded-xl px-4.5 py-3 text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Dashboard Metrics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Ventas card */}
                      <button
                        type="button"
                        onClick={() => setMetricsPopupType("sales")}
                        className="bg-[#1c1c1c] hover:bg-[#222222] border border-white/5 hover:border-blue-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[105px] transition-all duration-300 cursor-pointer text-left w-full group shadow-md"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Ventas Realizadas</span>
                          <strong className="text-3xl font-black text-white mt-1.5 block group-hover:text-blue-400 transition-colors">{billingSalesCount}</strong>
                        </div>
                        <div className="flex items-center justify-between w-full mt-2">
                          <span className="text-[9px] text-slate-500">Pedidos en el periodo</span>
                          <span className="text-[9px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
                        </div>
                        <div className="absolute top-4 right-4 text-blue-500/10 group-hover:text-blue-500/20 transition-colors"><Receipt className="w-7 h-7" /></div>
                      </button>

                      {/* Articulos vendidos card */}
                      <button
                        type="button"
                        onClick={() => setMetricsPopupType("products")}
                        className="bg-[#1c1c1c] hover:bg-[#222222] border border-white/5 hover:border-amber-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[105px] transition-all duration-300 cursor-pointer text-left w-full group shadow-md"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Productos Vendidos</span>
                          <strong className="text-3xl font-black text-amber-400 mt-1.5 block group-hover:text-amber-300 transition-colors">{billingProductsCount}</strong>
                        </div>
                        <div className="flex items-center justify-between w-full mt-2">
                          <span className="text-[9px] text-slate-500">Unidades físicas totales</span>
                          <span className="text-[9px] text-amber-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
                        </div>
                        <div className="absolute top-4 right-4 text-amber-500/10 group-hover:text-amber-500/20 transition-colors"><Package className="w-7 h-7" /></div>
                      </button>

                      {/* Total facturado card */}
                      <button
                        type="button"
                        onClick={() => setMetricsPopupType("billing")}
                        className="bg-[#1c1c1c] hover:bg-[#222222] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[105px] transition-all duration-300 cursor-pointer text-left w-full group shadow-md"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">Facturado</span>
                          <strong className="text-3xl font-black text-emerald-400 mt-1.5 block group-hover:text-emerald-300 transition-colors">{formatPrice(billingTotalAmount)}</strong>
                        </div>
                        <div className="flex items-center justify-between w-full mt-2">
                          <span className="text-[9px] text-slate-500">Ingresos brutos acumulados</span>
                          <span className="text-[9px] text-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver detalle →</span>
                        </div>
                        <div className="absolute top-4 right-4 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors font-mono text-xl font-black select-none">$</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-extrabold text-white">Estado General</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Indicadores y accesos rápidos desde la base de datos de Sheets</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStockFilter("all");
                        setActiveTab("inventory");
                      }}
                      className="bg-[#151515] hover:bg-[#1c1c1c] border border-white/5 hover:border-blue-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[100px] text-left transition-all cursor-pointer group"
                    >
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Productos Totales</span>
                      <strong className="text-3xl font-black text-white mt-1.5 group-hover:text-blue-400 transition-colors">{totalProductsCount}</strong>
                      <span className="text-[10px] text-slate-500 mt-1 select-none">Registrados en INVENTARIO (Ver todos)</span>
                      <div className="absolute top-4 right-4 text-blue-500/20 group-hover:text-blue-500/40 transition-colors"><Package className="w-7 h-7" /></div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStockFilter("active");
                        setActiveTab("inventory");
                      }}
                      className="bg-[#151515] hover:bg-[#1c1c1c] border border-white/5 hover:border-emerald-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[100px] text-left transition-all cursor-pointer group"
                    >
                      <span className="text-[9px] font-bold text-emerald-450 uppercase tracking-widest block">Catálogo Activo</span>
                      <strong className="text-3xl font-black text-emerald-400 mt-1.5 group-hover:text-emerald-300 transition-colors">{activeProductsCount}</strong>
                      <span className="text-[10px] text-slate-500 mt-1">Con Stock / Disponibles (Filtrar)</span>
                      <div className="absolute top-4 right-4 text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors"><Check className="w-7 h-7" /></div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStockFilter("outofstock");
                        setActiveTab("inventory");
                      }}
                      className="bg-[#151515] hover:bg-[#1c1c1c] border border-white/5 hover:border-red-500/30 rounded-2xl p-4.5 relative overflow-hidden flex flex-col justify-between min-h-[100px] text-left transition-all cursor-pointer group"
                    >
                      <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest block">Artículos Agotados</span>
                      <strong className="text-3xl font-black text-red-500 mt-1.5 group-hover:text-red-400 transition-colors">{inactiveProductsCount}</strong>
                      <span className="text-[10px] text-slate-500 mt-1">Sin Stock / Ocultos (Filtrar)</span>
                      <div className="absolute top-4 right-4 text-red-500/20 group-hover:text-red-500/40 transition-colors"><AlertTriangle className="w-7 h-7" /></div>
                    </button>
                  </div>

                  <div className="bg-[#151515] border border-white/5 rounded-2xl p-5 space-y-4">
                    <span className="text-xs font-bold text-white block">Atajos para Administrador</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={openNewProductForm}
                        className="flex items-center gap-3 p-4 bg-blue-600/10 hover:bg-blue-600/15 border border-blue-500/10 rounded-xl text-left cursor-pointer transition-all"
                      >
                        <div className="p-2 bg-blue-500 text-white rounded-lg shrink-0">
                          <Plus className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-xs text-white block">Cargar Nuevo Artículo</strong>
                          <span className="text-[10px] text-slate-400">Ingresar un producto al inventario de Sheets</span>
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab("settings")}
                        className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-left cursor-pointer transition-all"
                      >
                        <div className="p-2 bg-neutral-800 text-slate-300 rounded-lg shrink-0">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-xs text-white block">Editar Datos de la Tienda</strong>
                          <span className="text-[10px] text-slate-400">Modificar teléfono, horarios del local o dirección</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-white/2.5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-350 block">Modo Offline e Instantáneo</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Cualquier cambio realizado en este panel se refleja <strong>al instante</strong> en el catálogo visible de la página.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: INVENTORY LIST TABLE */}
              {activeTab === "inventory" && (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div>
                      <h3 className="text-base font-extrabold text-white">Administrador de Inventario</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Control directo de la pestaña <strong>INVENTARIO</strong> de Sheets</p>
                    </div>
                    
                    <button
                      onClick={openNewProductForm}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition-colors cursor-pointer self-start"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nuevo Artículo</span>
                    </button>
                  </div>
                  <div className="shrink-0 flex flex-col md:flex-row gap-3">
                    <div className="flex-1 flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Buscar por SKU, nombre, categoría..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-3 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex bg-[#111111] p-1 rounded-xl border border-white/5 shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setInventoryViewMode("list")}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${
                            inventoryViewMode === "list" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                          title="Vista Lista"
                        >
                          <LayoutList className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setInventoryViewMode("grid")}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${
                            inventoryViewMode === "grid" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-450 hover:text-white border border-transparent"
                          }`}
                          title="Vista Grilla"
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex bg-[#111111] p-1 rounded-xl border border-white/5 self-start md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setStockFilter("all")}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          stockFilter === "all" ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-white border border-transparent"
                        }`}
                      >
                        Todos ({totalProductsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockFilter("active")}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          stockFilter === "active" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:text-white border border-transparent"
                        }`}
                      >
                        Activos ({activeProductsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockFilter("outofstock")}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          stockFilter === "outofstock" ? "bg-red-500/20 text-red-400 border border-red-500/20" : "text-slate-400 hover:text-white border border-transparent"
                        }`}
                      >
                        Agotados ({inactiveProductsCount})
                      </button>
                    </div>
                  </div>

                  {inventoryViewMode === "grid" ? (
                    <div className="flex-1 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {filteredProducts.length === 0 ? (
                          <div className="col-span-full p-8 text-center text-slate-500">
                            No se encontraron productos coincidentes.
                          </div>
                        ) : (
                          paginatedInventoryProducts.map((p) => {
                            const isAvailable = p.stock > 0;
                            return (
                              <div key={p.id} className="bg-[#151515]/45 border border-white/5 rounded-2xl p-4.5 flex flex-col justify-between hover:border-white/10 transition-all">
                                <div className="space-y-3">
                                  {/* Top Row with ID & Action buttons */}
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-mono font-bold text-slate-450 bg-black/40 px-2 py-0.5 rounded-md">{p.id}</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => openEditProductForm(p)}
                                        className="p-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="p-1.5 bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 hover:border-red-500/25 text-red-400 rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Product image (Mercado Libre Style: full-width, clean background, highly visible) */}
                                  <div className="w-full aspect-square rounded-xl overflow-hidden border border-white/5 bg-[#090909] relative group flex items-center justify-center p-2.5">
                                    <img 
                                      src={p.image} 
                                      alt={p.name} 
                                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        e.currentTarget.src = "https://placehold.co/150?text=Error+Url";
                                      }}
                                    />
                                  </div>

                                  {/* Product title & Category */}
                                  <div className="space-y-1">
                                    <span className="block font-extrabold text-white text-xs line-clamp-2 min-h-[32px] leading-snug" title={p.name}>
                                      {p.name}
                                    </span>
                                    <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                      {p.category || "Sin Categoría"}
                                    </span>
                                  </div>

                                  {/* Price fields */}
                                  <div className="bg-[#111] p-2.5 rounded-xl border border-white/5">
                                    {p.isPromo ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider select-none">Oferta:</span>
                                          <InlinePriceInput 
                                            initialValue={p.price} 
                                            onSave={(val) => handleInlinePriceUpdate(p, val, true)} 
                                            className="border-emerald-500/20 focus:border-emerald-500 text-emerald-400 text-xs py-0.5"
                                          />
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider select-none">Antes:</span>
                                          <InlinePriceInput 
                                            initialValue={p.originalPrice || p.price} 
                                            onSave={(val) => handleInlinePriceUpdate(p, val, false)} 
                                            className="border-white/5 focus:border-blue-500 text-slate-400 text-[11px] py-0.5"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider select-none">Precio:</span>
                                        <InlinePriceInput 
                                          initialValue={p.price} 
                                          onSave={(val) => handleInlinePriceUpdate(p, val, false)} 
                                          className="py-0.5"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom controls (Disponible & Oferta toggles) */}
                                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500 text-center select-none">Disponible</span>
                                    <button
                                      onClick={() => handleToggleProductAvailability(p)}
                                      className={`py-1.5 rounded-lg text-[10px] font-black tracking-wide cursor-pointer select-none transition-all text-center ${
                                        isAvailable 
                                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
                                          : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                      }`}
                                    >
                                      {isAvailable ? "SÍ" : "NO"}
                                    </button>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-500 text-center select-none">En Oferta</span>
                                    <button
                                      onClick={() => handleToggleProductPromo(p)}
                                      className={`py-1.5 rounded-lg text-[10px] font-black tracking-wide cursor-pointer select-none transition-all text-center ${
                                        p.isPromo 
                                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20" 
                                          : "bg-neutral-800 border border-white/5 text-slate-400 hover:bg-white/5"
                                      }`}
                                    >
                                      {p.isPromo ? "SÍ" : "NO"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-x-auto border border-white/5 rounded-2xl bg-[#151515]/30">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 bg-[#151515]/80 text-slate-450 select-none font-bold">
                            <th className="p-3.5 pl-4">Id/SKU</th>
                            <th className="p-3.5">Producto</th>
                            <th className="p-3.5">Categoría</th>
                            <th className="p-3.5 text-right">Precio</th>
                            <th className="p-3.5 text-center">Disponible</th>
                            <th className="p-3.5 text-center">Oferta</th>
                            <th className="p-3.5 text-center pr-4">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-slate-500">
                                No se encontraron productos coincidentes.
                              </td>
                            </tr>
                          ) : (
                            paginatedInventoryProducts.map((p) => {
                              const isAvailable = p.stock > 0;
                              return (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/2.5 transition-colors">
                                  <td className="p-3 pl-4 font-mono font-bold text-[10px] text-slate-400">{p.id}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-3.5 py-1.5">
                                      <div className="w-18 h-18 rounded-xl overflow-hidden border border-white/10 bg-[#090909] shrink-0 flex items-center justify-center p-1 relative">
                                        <img 
                                          src={p.image} 
                                          alt={p.name} 
                                          className="w-full h-full object-contain" 
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            e.currentTarget.src = "https://placehold.co/100?text=Error";
                                          }}
                                        />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="font-extrabold text-white text-xs line-clamp-2 leading-snug" title={p.name}>
                                          {p.name}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 block">
                                          {p.category || "Sin Categoría"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 text-slate-350">{p.category || "Sin Categoría"}</td>
                                  <td className="p-3 text-right">
                                    {p.isPromo ? (
                                      <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center gap-1 justify-end">
                                          <span className="text-[8px] text-emerald-400 font-bold select-none text-right">Oferta:</span>
                                          <InlinePriceInput 
                                            initialValue={p.price} 
                                            onSave={(val) => handleInlinePriceUpdate(p, val, true)} 
                                            className="border-emerald-500/20 focus:border-emerald-500 text-emerald-400 text-xs py-0.5"
                                          />
                                        </div>
                                        <div className="flex items-center gap-1 justify-end">
                                          <span className="text-[8px] text-slate-500 font-bold select-none text-right">Antes:</span>
                                          <InlinePriceInput 
                                            initialValue={p.originalPrice || p.price} 
                                            onSave={(val) => handleInlinePriceUpdate(p, val, false)} 
                                            className="border-white/5 focus:border-blue-500 text-slate-400 text-[11px] py-0.5"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1">
                                        <InlinePriceInput 
                                          initialValue={p.price} 
                                          onSave={(val) => handleInlinePriceUpdate(p, val, false)} 
                                          className="py-0.5"
                                        />
                                      </div>
                                    )}
                                  </td>
                                  
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => handleToggleProductAvailability(p)}
                                      title="Alternar Disponibilidad (Stock)"
                                      className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black tracking-wide cursor-pointer select-none transition-all ${
                                        isAvailable 
                                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" 
                                          : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                                      }`}
                                    >
                                      {isAvailable ? "SÍ" : "NO"}
                                    </button>
                                  </td>

                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => handleToggleProductPromo(p)}
                                      title="Alternar en Oferta (Promo)"
                                      className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black tracking-wide cursor-pointer select-none transition-all ${
                                        p.isPromo 
                                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20" 
                                          : "bg-neutral-800 border border-white/5 text-slate-400 hover:bg-white/5"
                                      }`}
                                    >
                                      {p.isPromo ? "SÍ" : "NO"}
                                    </button>
                                  </td>

                                  <td className="p-3 text-center pr-4">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => openEditProductForm(p)}
                                        className="p-1 px-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="p-1 px-1.5 bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 hover:border-red-500/25 text-red-400 rounded-lg transition-colors cursor-pointer"
                                        title="Eliminar"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination & Limit selectors */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 p-1 bg-white/2.5 border border-white/5 rounded-2xl shrink-0">
                    <div className="flex items-center gap-3 text-xs text-slate-400 p-2">
                      <span className="font-sans text-xs">Ver:</span>
                      <div className="flex bg-[#111] p-0.5 rounded-lg border border-white/10">
                        {[20, 50, 100].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => {
                              setInventoryItemsPerPage(size);
                              setInventoryPage(1);
                            }}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                              inventoryItemsPerPage === size
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {size} items
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans">
                        (Mostrando {filteredProducts.length === 0 ? 0 : (inventoryPage - 1) * inventoryItemsPerPage + 1} - {Math.min(filteredProducts.length, inventoryPage * inventoryItemsPerPage)} de {filteredProducts.length})
                      </span>
                    </div>

                    {/* Pagination Controls */}
                    {inventoryTotalPages > 1 && (() => {
                      const delta = 1;
                      const pages: (number | "...")[] = [];
                      const left = inventoryPage - delta;
                      const right = inventoryPage + delta;

                      for (let i = 1; i <= inventoryTotalPages; i++) {
                        if (i === 1 || i === inventoryTotalPages || (i >= left && i <= right)) {
                          pages.push(i);
                        } else if (i === left - 1 || i === right + 1) {
                          pages.push("...");
                        }
                      }

                      return (
                        <div className="flex items-center gap-1.5 p-2 select-none">
                          <button
                            disabled={inventoryPage === 1}
                            onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 bg-[#151515] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 text-white cursor-pointer transition-colors"
                          >
                            ‹
                          </button>
                          
                          <div className="flex gap-1.5">
                            {pages.map((page, idx) =>
                              page === "..." ? (
                                <span key={`dots-${idx}`} className="px-2 py-1 text-slate-605 text-xs font-bold align-middle self-center">
                                  ...
                                </span>
                              ) : (
                                <button
                                  key={`page-${page}`}
                                  onClick={() => setInventoryPage(Number(page))}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                    inventoryPage === page
                                      ? "bg-blue-600 border-blue-500 text-white font-black"
                                      : "bg-[#151515] border-white/10 text-slate-300 hover:bg-white/5"
                                  }`}
                                >
                                  {page}
                                </button>
                              )
                            )}
                          </div>

                          <button
                            disabled={inventoryPage === inventoryTotalPages}
                            onClick={() => setInventoryPage((p) => Math.min(inventoryTotalPages, p + 1))}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 bg-[#151515] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5 text-white cursor-pointer transition-colors"
                          >
                            ›
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 3: CONTACT GENERAL METADATA / DATOS TAB */}
              {activeTab === "settings" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Editar Datos de la Tienda</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Control directo de la pestaña <strong>DATOS</strong> de Sheets. Configura la estética y comunicación.</p>
                  </div>

                  <form onSubmit={handleSettingsSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Nombre Web (Título del Sitio)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.nombreWeb}
                          onChange={(e) => setFormData({ ...formData, nombreWeb: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Dirección Física (Local para Retiros)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.direccion}
                          onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Horarios de Atención al Público (Local)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.horarios}
                          onChange={(e) => setFormData({ ...formData, horarios: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">Ej: Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00</span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                          Contacto Minorista (WhatsApp No.)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 5493584164396"
                          value={formData.contactoMinorista}
                          onChange={(e) => setFormData({ ...formData, contactoMinorista: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                          Contacto Mayorista (WhatsApp No.)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 5493585706343"
                          value={formData.contactoMayorista}
                          onChange={(e) => setFormData({ ...formData, contactoMayorista: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                          Contacto en Ticket / Facturas
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: 5493584164396"
                          value={formData.contactoTicket}
                          onChange={(e) => setFormData({ ...formData, contactoTicket: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Paleta de Colores
                        </label>
                        <select
                          value={formData.paletaColores}
                          onChange={(e) => setFormData({ ...formData, paletaColores: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="Azul / Oscuro">Azul / Oscuro (Magxor Engine)</option>
                          <option value="Cian / Oscuro">Cian / Oscuro (Clásico)</option>
                          <option value="Esmeralda / Oscuro">Esmeralda / Oscuro (Tecnológico)</option>
                          <option value="Índigo / Oscuro">Índigo / Oscuro (Premium)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-sans">
                          Barra de Anuncio del Header
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.anuncioHeader}
                          onChange={(e) => setFormData({ ...formData, anuncioHeader: e.target.value })}
                          className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                          placeholder="Ej: 🔥 Envío Gratis a Todo el País en Compras Mayores a $50.000!"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          El mensaje promocional animado que aparece en la parte superior del sitio.
                        </span>
                      </div>
                    </div>
                      <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setIsDbCollapsibleOpen(!isDbCollapsibleOpen)}
                          className="w-full flex items-center justify-between p-4 bg-[#111111] hover:bg-white/5 transition-all text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isDbUnlocked ? "bg-emerald-500/10 text-emerald-450" : "bg-blue-500/10 text-blue-400"}`}>
                              {isDbUnlocked ? <Check className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </div>
                            <div>
                              <span className="text-xs font-black text-white uppercase tracking-wider block">
                                Configuración de Base de Datos
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">
                                {isDbUnlocked 
                                  ? "✓ Sección desbloqueada — Podés editar las claves de Google Sheets" 
                                  : "🔒 Sección protegida — Hacé clic para desplegar e ingresar la contraseña de Administrador"}
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 font-mono text-xs select-none pr-2">
                            {isDbCollapsibleOpen ? "OCULTAR ▴" : "VER ▾"}
                          </div>
                        </button>

                        {isDbCollapsibleOpen && (
                          <div className="p-4 border-t border-white/5 bg-[#141414] space-y-4">
                            {!isDbUnlocked ? (
                              /* ACCES CONTROL PASSWORD PROMPT */
                              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-3">
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                                    Ingresá la clave de Administrador
                                  </label>
                                  <p className="text-[10px] text-slate-500 font-sans">
                                    Para preservar la integridad del sistema, la configuración está protegida para evitar modificaciones accidentales.
                                  </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={unlockPasswordAttempt}
                                    onChange={(e) => setUnlockPasswordAttempt(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void handleUnlockDb();
                                      }
                                    }}
                                    className="flex-1 text-xs bg-[#111] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none placeholder-slate-705"
                                  />
                                  <button
                                    type="button"
                                    disabled={isUnlocking}
                                    onClick={() => {
                                      void handleUnlockDb();
                                    }}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-bold rounded-xl cursor-pointer"
                                  >
                                    Desbloquear
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* FULL EDITABLE DATABASE SINK URLS */
                              <div className="space-y-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></span>
                                    <span className="text-[10px] text-emerald-450 font-bold font-sans">Modo de Edición Desbloqueado</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsDbUnlocked(false);
                                      setUnlockPasswordAttempt("");
                                      showToast("Sección bloqueada correctamente.", "info");
                                    }}
                                    className="text-[9px] hover:underline text-slate-400 hover:text-white"
                                  >
                                    Bloquear sección de nuevo
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                                      Planilla de Google Sheets (URL)
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="https://docs.google.com/spreadsheets/d/..."
                                      value={localSheetsUrl}
                                      onChange={(e) => setLocalSheetsUrl(e.target.value)}
                                      className="w-full text-xs bg-[#111111] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none font-mono"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-1 block leading-relaxed font-sans">
                                      Aseguráte de que esté publicada en la Web (Archivo - Compartir - Publicar en la Web) como valores separados por comas (CSV).
                                    </span>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                                      Google Apps Script API (URL de Endpoint)
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="https://script.google.com/macros/s/.../exec"
                                      value={localBackendUrl}
                                      onChange={(e) => setLocalBackendUrl(e.target.value)}
                                      className="w-full text-xs bg-[#111111] text-white rounded-xl border border-white/10 px-4 py-2.5 focus:border-blue-500 focus:outline-none font-mono"
                                    />
                                    <span className="text-[9px] text-slate-500 mt-1 block leading-relaxed font-sans">
                                      Web App macro desplegada para poder escribir, eliminar, crear y leer datos.
                                    </span>
                                  </div>
                                </div>

                                <div className="p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                                  <span className="text-[10px] font-bold text-blue-400 block font-sans">⚠️ Nota Crucial de Despliegue en Apps Script:</span>
                                  <p className="text-[10px] text-slate-350 leading-relaxed font-sans">
                                    Para que funcione tu edición, creación y eliminación, el script en el Google Sheets debe tener permisos globales de ejecución sin autenticación. Aseguráte de implementar con:
                                  </p>
                                  <ul className="list-disc pl-4 text-[9px] text-slate-400 space-y-0.5 font-sans">
                                    <li><strong>Ejecutar como (Execute as):</strong> "Yo" (Tu correo electrónico / imperiomagxor@gmail.com)</li>
                                    <li><strong>Quién tiene acceso (Who has access):</strong> "Cualquier persona" (Anyone o Anyone, even anonymous)</li>
                                  </ul>
                                </div>

                                {/* Copiar Código Completo para Google Apps Script */}
                                <div className="p-4 bg-[#111111] border border-white/10 rounded-xl space-y-3">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div>
                                      <span className="text-xs font-bold text-white block">Código Apps Script Completo</span>
                                      <span className="text-[10px] text-slate-400 mt-0.5 block">Copia y pega este código en la sección de "Extensiones &gt; Apps Script" de tu planilla de Google.</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                                        setScriptCopied(true);
                                        showToast("¡Código copiado al portapapeles con éxito!", "success");
                                        setTimeout(() => setScriptCopied(false), 2000);
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                        scriptCopied 
                                          ? "bg-emerald-600 border border-emerald-500 text-white" 
                                          : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/20"
                                      }`}
                                    >
                                      {scriptCopied ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>¡Copiado!</span>
                                        </>
                                      ) : (
                                        <>
                                          <span>📋 Copiar Código</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  <div className="relative">
                                    <pre className="text-[10px] text-slate-350 bg-[#0a0a0a] border border-white/5 rounded-lg p-3 max-h-48 overflow-y-auto font-mono select-all leading-normal">
                                      {APPS_SCRIPT_TEMPLATE}
                                    </pre>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setLocalSheetsUrl("");
                                    const envUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_APPS_SCRIPT_URL || "";
                                    setLocalBackendUrl(envUrl);
                                    showToast("Configuración restablecida al demo predeterminado.", "info");
                                  }}
                                  className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 transition-colors text-slate-350 hover:text-white font-bold text-[10px] rounded-lg cursor-pointer"
                                >
                                  Restablecer URLs de Prueba Predeterminadas
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    <div className="pt-4 border-t border-white/5 flex gap-3">
                      <button
                        type="submit"
                        disabled={isActionPending}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isActionPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> Guardando en Servidor...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Guardar Datos
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 4: CLIENTS LIST */}
              {activeTab === "clients" && (
                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-400" />
                        <span>Clientes Registrados</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Contactos registrados en tu base de datos.
                      </p>
                    </div>
                    <button
                      onClick={fetchClients}
                      disabled={isLoadingClients}
                      className="px-3.5 py-2 self-start sm:self-center bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 font-bold text-xs rounded-xl hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingClients ? "animate-spin text-blue-400" : ""}`} />
                      <span>Actualizar Lista</span>
                    </button>
                  </div>

                  {/* Statistics Widgets */}
                  {!isLoadingClients && clients.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registrados Totales</span>
                          <span className="text-lg font-black text-white block mt-0.5">{clients.length}</span>
                        </div>
                      </div>

                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                          <Phone className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendientes de Contacto</span>
                          <span className="text-lg font-black text-amber-400 block mt-0.5">{clients.filter(c => c.contacto === "NO").length}</span>
                        </div>
                      </div>

                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contactados</span>
                          <span className="text-lg font-black text-emerald-400 block mt-0.5">{clients.filter(c => c.contacto === "SI").length}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Search and Filters panel */}
                  {!isLoadingClients && clients.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3.5 bg-[#111111]/60 border border-white/5 rounded-2xl">
                      {/* Search bar */}
                      <div className="relative w-full md:max-w-xs">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Buscar por número o fecha..."
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                          className="w-full bg-[#151515] border border-white/5 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 focus:outline-none transition-colors"
                        />
                        {clientSearchTerm && (
                          <button
                            onClick={() => setClientSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Filters tabs */}
                      <div className="flex items-center gap-1.5 self-stretch md:self-auto overflow-x-auto pb-1 md:pb-0">
                        <button
                          onClick={() => setClientFilterStatus("all")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                            clientFilterStatus === "all"
                              ? "bg-blue-600/10 border-blue-500/20 text-blue-400"
                              : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                          }`}
                        >
                          Todos ({clients.length})
                        </button>
                        <button
                          onClick={() => setClientFilterStatus("pending")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                            clientFilterStatus === "pending"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                          }`}
                        >
                          Pendientes ({clients.filter(c => c.contacto === "NO").length})
                        </button>
                        <button
                          onClick={() => setClientFilterStatus("contacted")}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                            clientFilterStatus === "contacted"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                          }`}
                        >
                          Contactados ({clients.filter(c => c.contacto === "SI").length})
                        </button>
                      </div>
                    </div>
                  )}

                  {isLoadingClients ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                      Cargando lista de clientes registrados...
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="flex-grow bg-white/[0.02] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-400 font-bold">No se encontraron clientes registrados.</p>
                      <p className="text-[10px] text-slate-505 mt-1 max-w-sm">
                        Los números de teléfono de contacto se guardarán aquí automáticamente cuando los clientes se unan al WhatsApp Club de tu tienda.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-x-auto max-h-[440px] bg-neutral-950/40 rounded-2xl border border-white/5">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-[#111111]/60">
                            <th className="p-3.5 px-4 font-mono w-12 text-center">#</th>
                            <th className="p-3.5">Número / WhatsApp</th>
                            <th className="p-3.5 w-36">Fecha Registro</th>
                            <th className="p-3.5 w-36">Método de Captura</th>
                            <th className="p-3.5 w-24 text-center">Contactado</th>
                            <th className="p-3.5 w-52 text-center">Acciones de Gestión</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {clients.filter(c => {
                            const term = clientSearchTerm.trim().toLowerCase();
                            const matchesSearch = !term || 
                              c.phone.toLowerCase().includes(term) || 
                              (c.date && c.date.toLowerCase().includes(term)) ||
                              (c.metodo && c.metodo.toLowerCase().includes(term));
                            
                            if (!matchesSearch) return false;
                            
                            if (clientFilterStatus === "contacted") return c.contacto === "SI";
                            if (clientFilterStatus === "pending") return c.contacto === "NO";
                            return true;
                          }).length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-10 text-center text-slate-500 text-xs">
                                Ningún cliente coincide con los criterios de búsqueda o filtros.
                              </td>
                            </tr>
                          ) : (
                            clients.filter(c => {
                              const term = clientSearchTerm.trim().toLowerCase();
                              const matchesSearch = !term || 
                                c.phone.toLowerCase().includes(term) || 
                                (c.date && c.date.toLowerCase().includes(term)) ||
                                (c.metodo && c.metodo.toLowerCase().includes(term));
                              
                              if (!matchesSearch) return false;
                              
                              if (clientFilterStatus === "contacted") return c.contacto === "SI";
                              if (clientFilterStatus === "pending") return c.contacto === "NO";
                              return true;
                            }).map((c, index) => {
                              const cleanPhone = c.phone.replace(/[^0-9]/g, "");
                              return (
                                <tr key={index} className="hover:bg-white/[0.01] transition-colors">
                                  {/* # Index number */}
                                  <td className="p-3 px-4 font-mono text-[10px] text-slate-500 text-center">{index + 1}</td>
                                  
                                  {/* Phone number */}
                                  <td className="p-3 font-semibold text-white font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <Smartphone className="w-3.5 h-3.5 text-slate-505 shrink-0" />
                                      <span>{c.phone}</span>
                                    </div>
                                  </td>
                                  
                                  {/* Registration Date */}
                                  <td className="p-3 text-slate-400 font-mono text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                      <span>{c.date || "N/A"}</span>
                                    </div>
                                  </td>
                                  
                                  {/* Capture Method */}
                                  <td className="p-3">
                                    <span className="inline-flex items-center px-2 py-0.5 bg-white/5 border border-white/5 rounded-full text-[9px] font-medium text-slate-400">
                                      {c.metodo || "Club WhatsApp"}
                                    </span>
                                  </td>
                                  
                                  {/* Contact Status Badge Toggle */}
                                  <td className="p-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleClientContact(c.phone, c.contacto)}
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border cursor-pointer select-none transition-all active:scale-95 ${
                                        c.contacto === "SI"
                                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                      }`}
                                      title="Haz clic para alternar de forma rápida"
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.contacto === "SI" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`}></span>
                                      <span>{c.contacto}</span>
                                    </button>
                                  </td>
                                  
                                  {/* Actions */}
                                  <td className="p-3">
                                    <div className="flex items-center justify-center gap-2">
                                      {/* Chatear / Volver a contactar Button */}
                                      <a
                                        href={`https://wa.me/${cleanPhone}`}
                                        target="_blank"
                                        referrerPolicy="no-referrer"
                                        onClick={() => {
                                          if (c.contacto === "NO") {
                                            // Automatically switch status to "SI" upon clicking "Chatear"
                                            handleToggleClientContact(c.phone, "NO");
                                          }
                                        }}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                                          c.contacto === "SI"
                                            ? "bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/10"
                                            : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-md shadow-emerald-500/20"
                                        }`}
                                      >
                                        <MessageSquare className="w-3 h-3 shrink-0" />
                                        <span>{c.contacto === "SI" ? "Volver a contactar" : "Chatear"}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      </a>

                                      {/* Inline Deletion Confirmation Button */}
                                      {clientToDeletePhone === c.phone ? (
                                        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg p-0.5 px-1.5">
                                          <span className="text-[9px] text-red-400 font-bold">¿Borrar?</span>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteClient(c.phone)}
                                            className="text-[9px] uppercase font-mono font-black text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                          >
                                            SÍ
                                          </button>
                                          <span className="text-slate-600">/</span>
                                          <button
                                            type="button"
                                            onClick={() => setClientToDeletePhone(null)}
                                            className="text-[9px] uppercase font-mono font-black text-slate-400 hover:text-white transition-colors cursor-pointer"
                                          >
                                            NO
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setClientToDeletePhone(c.phone)}
                                          className="p-1 px-1.5 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded-lg transition-all cursor-pointer"
                                          title="Eliminar este cliente permanentemente"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: ORDERS LIST */}
              {activeTab === "orders" && (
                <div className="space-y-6 flex-1 flex flex-col font-sans">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-400" />
                        <span>Gestión de Pedidos</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Administrá las solicitudes generadas por tu checkout.
                      </p>
                    </div>
                    <button
                      onClick={fetchOrders}
                      disabled={isLoadingOrders}
                      className="px-3.5 py-2 self-start sm:self-center bg-white/5 hover:bg-white/10 active:scale-95 text-slate-300 font-bold text-xs rounded-xl hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? "animate-spin text-blue-400" : ""}`} />
                      <span>Actualizar Pedidos</span>
                    </button>
                  </div>

                  {/* Statistics Widgets */}
                  {!isLoadingOrders && orders.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pedidos Totales</span>
                          <span className="text-lg font-black text-white block mt-0.5">{orders.length}</span>
                        </div>
                      </div>

                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendientes</span>
                          <span className="text-lg font-black text-amber-400 block mt-0.5">
                            {orders.filter(o => o.estado === "PENDIENTE").length}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                          <span className="text-emerald-400 font-extrabold text-sm font-mono">$</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Facturado (Confirmados/Entregados)</span>
                          <span className="text-lg font-black text-emerald-400 block mt-0.5">
                            {formatPrice(orders.filter(o => o.estado === "CONFIRMADO" || o.estado === "ENTREGADO").reduce((sum, o) => sum + o.total, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Search and Filters panel */}
                  {!isLoadingOrders && orders.length > 0 && (
                    <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between p-3.5 bg-[#111111]/60 border border-white/5 rounded-2xl">
                      {/* Search bar & Filter toggler */}
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1 max-w-xl">
                        <div className="relative flex-1">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Buscar por ID, nombre o celular..."
                            value={orderSearchTerm}
                            onChange={(e) => setOrderSearchTerm(e.target.value)}
                            className="w-full bg-[#151515] border border-white/5 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 focus:outline-none transition-colors"
                          />
                          {orderSearchTerm && (
                            <button
                              onClick={() => setOrderSearchTerm("")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowOrderFilters(!showOrderFilters)}
                          className={`px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 select-none ${
                            showOrderFilters 
                              ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
                              : "bg-[#151515] border-white/5 text-slate-400 hover:text-white hover:border-white/10"
                          }`}
                        >
                          <Filter className="w-3.5 h-3.5" />
                          <span>{showOrderFilters ? "Ocultar Filtros" : "Filtrar por Estado"}</span>
                        </button>
                      </div>

                      {/* Filters tabs (Show/Hide conditionally) */}
                      {showOrderFilters && (
                        <div className="flex items-center gap-1.5 self-stretch xl:self-auto overflow-x-auto pb-1 xl:pb-0 animate-scale-in">
                          <button
                            onClick={() => setOrderFilterStatus("all")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "all"
                                ? "bg-blue-600/10 border-blue-500/20 text-blue-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Activos ({orders.filter(o => o.estado !== "ARCHIVADO").length})
                          </button>
                          <button
                            onClick={() => setOrderFilterStatus("PENDIENTE")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "PENDIENTE"
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Pendientes ({orders.filter(o => o.estado === "PENDIENTE").length})
                          </button>
                          <button
                            onClick={() => setOrderFilterStatus("CONFIRMADO")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "CONFIRMADO"
                                ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Confirmados ({orders.filter(o => o.estado === "CONFIRMADO").length})
                          </button>
                          <button
                            onClick={() => setOrderFilterStatus("ENTREGADO")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "ENTREGADO"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Entregados ({orders.filter(o => o.estado === "ENTREGADO").length})
                          </button>
                          <button
                            onClick={() => setOrderFilterStatus("CANCELADO")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "CANCELADO"
                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Cancelados ({orders.filter(o => o.estado === "CANCELADO").length})
                          </button>
                          <button
                            onClick={() => setOrderFilterStatus("ARCHIVADO")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                              orderFilterStatus === "ARCHIVADO"
                                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                : "bg-[#151515] hover:bg-white/5 border-white/5 text-slate-400"
                            }`}
                          >
                            Archivados ({orders.filter(o => o.estado === "ARCHIVADO").length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isLoadingOrders ? (
                    <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                      Cargando lista de pedidos registrados...
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="flex-grow bg-white/[0.02] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-400 font-bold">No se encontraron pedidos en la base de datos.</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-sm">
                        Cuando un cliente complete el carrito de compras e inicie el checkout, sus pedidos se loguearán automáticamente aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-x-auto max-h-[500px] bg-neutral-950/40 rounded-2xl border border-white/5">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-[#111111]/60">
                            <th className="p-3.5 w-24">ID Pedido</th>
                            <th className="p-3.5 w-32">Fecha / Hora</th>
                            <th className="p-3.5 w-40">Cliente</th>
                            <th className="p-3.5">Detalle Artículos</th>
                            <th className="p-3.5 w-24">Total</th>
                            <th className="p-3.5 w-36">Retiro Prog.</th>
                            <th className="p-3.5 w-28 text-center">Estado</th>
                            <th className="p-3.5 w-52 text-center">Gestión</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {orders.filter(o => {
                            const term = orderSearchTerm.trim().toLowerCase();
                            const matchesSearch = !term ||
                              o.id.toLowerCase().includes(term) ||
                              o.cliente.toLowerCase().includes(term) ||
                              o.telefono.toLowerCase().includes(term) ||
                              o.productos.toLowerCase().includes(term);

                            if (!matchesSearch) return false;
                            if (orderFilterStatus === "all" && o.estado === "ARCHIVADO") return false;
                            if (orderFilterStatus !== "all" && o.estado !== orderFilterStatus) return false;
                            return true;
                          }).length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-10 text-center text-slate-500 text-xs">
                                Ningún pedido coincide con los filtros aplicados.
                              </td>
                            </tr>
                          ) : (
                            orders.filter(o => {
                              const term = orderSearchTerm.trim().toLowerCase();
                              const matchesSearch = !term ||
                                o.id.toLowerCase().includes(term) ||
                                o.cliente.toLowerCase().includes(term) ||
                                o.telefono.toLowerCase().includes(term) ||
                                o.productos.toLowerCase().includes(term);

                              if (!matchesSearch) return false;
                              if (orderFilterStatus === "all" && o.estado === "ARCHIVADO") return false;
                              if (orderFilterStatus !== "all" && o.estado !== orderFilterStatus) return false;
                              return true;
                            }).map((o, idx) => {
                              const cleanPhone = o.telefono.replace(/[^0-9]/g, "");
                              return (
                                <tr key={idx} className="hover:bg-white/[0.01] transition-colors align-top">
                                  {/* ID Pedido */}
                                  <td className="p-3 font-mono text-[11px] font-extrabold text-blue-400">
                                    {o.id}
                                  </td>

                                  {/* Fecha */}
                                  <td className="p-3 text-slate-400 font-mono text-[11px] leading-relaxed">
                                    {o.fecha}
                                  </td>

                                  {/* Cliente & Tel */}
                                  <td className="p-3 text-slate-300">
                                    <div className="font-semibold text-white leading-tight">
                                      {o.cliente}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {o.telefono}
                                    </div>
                                  </td>

                                  {/* Productos detallados */}
                                  <td className="p-3 text-slate-300">
                                    {(() => {
                                      const parsed = parseProductsString(o.productos);
                                      const totalQty = parsed.reduce((sum, item) => sum + item.qty, 0);
                                      const uniqueItems = parsed.length;
                                      return (
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-1.5 font-extrabold text-white text-xs">
                                            <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                            <span>
                                              {totalQty} {totalQty === 1 ? "artículo" : "artículos"}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-500">
                                            ({uniqueItems} {uniqueItems === 1 ? "producto distinto" : "productos distintos"})
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedOrderDetail(o)}
                                            className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer py-1 px-2 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/15"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Ver Artículos</span>
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Total */}
                                  <td className="p-3 font-mono font-black text-white text-xs">
                                    {formatPrice(o.total)}
                                  </td>

                                  {/* Entrega */}
                                  <td className="p-3 text-slate-400 font-sans text-[11px] leading-tight">
                                    {o.entrega}
                                  </td>

                                  {/* Estado Badge */}
                                  <td className="p-3 text-center">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                      o.estado === "PENDIENTE" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                      o.estado === "CONFIRMADO" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                      o.estado === "ENTREGADO" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                      o.estado === "ARCHIVADO" ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                                      "bg-red-500/10 border-red-500/20 text-red-400"
                                    }`}>
                                      {o.estado}
                                    </span>
                                  </td>

                                  {/* Acciones de administración */}
                                  <td className="p-3">
                                    <div className="flex flex-col gap-1.5 justify-center items-stretch">
                                      {/* Status modifier triggers - Row 1 */}
                                      <div className="flex gap-1 justify-center">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOrderDetail(o)}
                                          className="flex-1 py-1 px-1 bg-white/10 hover:bg-white/15 text-white text-[9.5px] font-black rounded border border-white/10 transition-colors cursor-pointer text-center flex items-center justify-center gap-0.5"
                                          title="Ver comprobante e imprimir"
                                        >
                                          <Eye className="w-2.5 h-2.5 text-blue-400" />
                                          <span>Ver Ticket</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(o.id, "CONFIRMADO")}
                                          className="flex-1 py-1 px-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9.5px] font-extrabold rounded border border-blue-500/10 transition-colors cursor-pointer text-center"
                                          title="Marcar como Confirmado"
                                        >
                                          Conf.
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(o.id, "ENTREGADO")}
                                          className="flex-1 py-1 px-1 bg-emerald-500/10 hover:bg-emerald-400 text-emerald-400 text-[9.5px] font-extrabold rounded border border-emerald-500/10 transition-colors cursor-pointer text-center"
                                          title="Marcar como Entregado"
                                        >
                                          Entr.
                                        </button>
                                      </div>

                                      {/* Row 2: Contactar, Cancelar & Delete */}
                                      <div className="flex gap-1 items-center justify-between">
                                        <a
                                          href={`https://wa.me/${cleanPhone}`}
                                          target="_blank"
                                          referrerPolicy="no-referrer"
                                          className="flex-1 inline-flex items-center justify-center gap-1 py-1 px-1 bg-emerald-500 hover:bg-emerald-400 text-[#0F0F0F] text-[9.5px] font-black rounded transition-all cursor-pointer text-center font-sans shadow-sm"
                                        >
                                          <MessageSquare className="w-2.5 h-2.5" />
                                          <span>WhatsApp</span>
                                        </a>

                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(o.id, "CANCELADO")}
                                          className="flex-1 py-1 px-1.2 bg-red-500/10 hover:bg-red-500/20 text-red-550 text-[9.5px] font-extrabold rounded border border-red-500/10 transition-colors cursor-pointer text-center"
                                          title="Marcar como Cancelado"
                                        >
                                          Canc.
                                        </button>

                                        {orderToDeleteId === o.id ? (
                                          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded p-0.5 px-1 leading-none shrink-0">
                                            <span className="text-[8px] text-red-400 font-bold">¿Borrar?</span>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteOrder(o.id)}
                                              className="text-[8px] uppercase font-mono font-black text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                            >
                                              SÍ
                                            </button>
                                            <span className="text-slate-600 font-mono">/</span>
                                            <button
                                              type="button"
                                              onClick={() => setOrderToDeleteId(null)}
                                              className="text-[8px] uppercase font-mono font-black text-slate-400 hover:text-white transition-colors cursor-pointer"
                                            >
                                              NO
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setOrderToDeleteId(o.id)}
                                            className="p-1 px-1.5 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 rounded transition-all cursor-pointer shrink-0"
                                            title="Eliminar este pedido permanentemente"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Archivar button if Entregado or Cancelado */}
                                      {o.estado !== "ARCHIVADO" && (o.estado === "ENTREGADO" || o.estado === "CANCELADO") && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateOrderStatus(o.id, "ARCHIVADO")}
                                          className="w-full mt-1.5 py-1 px-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[9.5px] font-black rounded border border-purple-500/20 transition-all cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
                                          title="Archivar pedido"
                                        >
                                          📁 Archivar Pedido
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </>
        )}
      </div>

      {/* --- CONFIRM GENERAL DELETE MODAL --- */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="relative bg-[#111111] border border-red-500/20 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setShowDeleteConfirmModal(false)}
              className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                  ¿Eliminar Artículo?
                </h3>
                <p className="text-[11px] text-slate-400 mt-2 font-sans leading-relaxed">
                  ¿Estás seguro de que deseas eliminar permanentemente el artículo 
                  <strong className="text-red-400"> "{allProducts.find(p => p.id === deletingProductId)?.name || deletingProductId}"</strong>? 
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDeleteProduct}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 transition-colors text-white font-extrabold text-xs rounded-xl shadow-lg shadow-red-500/10 transition-all cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- METRICS DETAIL MODALS --- */}
      {metricsPopupType && (() => {
        let modalTitle = "";
        let modalIcon = null;

        if (metricsPopupType === "sales") {
          modalTitle = "Resumen de Ventas Realizadas";
          modalIcon = <Receipt className="w-5 h-5 text-blue-400" />;
        } else if (metricsPopupType === "products") {
          modalTitle = "Resumen de Productos Vendidos";
          modalIcon = <Package className="w-5 h-5 text-amber-400" />;
        } else if (metricsPopupType === "billing") {
          modalTitle = "Resumen de Facturación";
          modalIcon = <div className="w-5 h-5 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded font-mono text-xs font-bold">$</div>;
        }

        const salesByPaymentMethod: { [key: string]: { count: number; total: number } } = {};
        const salesByStatus: { [key: string]: { count: number; total: number } } = {};
        const productsMap: { [key: string]: { qty: number; name: string; totalAmount: number } } = {};

        billingFilteredOrders.forEach(o => {
          const payMethod = o.metodoPago || "No especificado";
          if (!salesByPaymentMethod[payMethod]) {
            salesByPaymentMethod[payMethod] = { count: 0, total: 0 };
          }
          salesByPaymentMethod[payMethod].count += 1;
          salesByPaymentMethod[payMethod].total += o.total;

          const status = o.estado || "PENDIENTE";
          if (!salesByStatus[status]) {
            salesByStatus[status] = { count: 0, total: 0 };
          }
          salesByStatus[status].count += 1;
          salesByStatus[status].total += o.total;

          const items = parseProductsString(o.productos);
          items.forEach(item => {
            const trimmedName = item.name.trim();
            if (!productsMap[trimmedName]) {
              productsMap[trimmedName] = { qty: 0, name: trimmedName, totalAmount: 0 };
            }
            productsMap[trimmedName].qty += item.qty;
            
            const match = allProducts.find(p => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
            const price = match ? match.price : (o.total / (items.length || 1));
            productsMap[trimmedName].totalAmount += price * item.qty;
          });
        });

        const sortedProducts = Object.values(productsMap).sort((a, b) => b.qty - a.qty);

        return (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-[#111111] border border-white/10 rounded-3xl w-full max-w-2xl p-5 md:p-7 shadow-2xl max-h-[90vh] flex flex-col">
              <button
                onClick={() => setMetricsPopupType(null)}
                className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4 pb-3 border-b border-white/5 flex items-center gap-2.5">
                <div className="p-2 bg-white/5 rounded-xl">
                  {modalIcon}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">{modalTitle}</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Periodo: {billingPeriod === "hoy" ? "Hoy" : billingPeriod === "7dias" ? "Últimos 7 días" : billingPeriod === "30dias" ? "Últimos 30 días" : "Personalizado"}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar text-xs text-slate-300">
                {metricsPopupType === "sales" && (
                  <div className="space-y-4 animate-scale-in">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-[#151515] p-3 rounded-xl border border-white/5 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total de Ventas</span>
                        <strong className="text-xl text-white font-black mt-1 block">{billingSalesCount}</strong>
                      </div>
                      <div className="bg-[#151515] p-3 rounded-xl border border-white/5 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Billetaje</span>
                        <strong className="text-xl text-emerald-400 font-black mt-1 block">{formatPrice(billingTotalAmount)}</strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Listado de Pedidos en este Periodo</h4>
                      {billingFilteredOrders.length === 0 ? (
                        <div className="p-6 bg-white/5 rounded-xl text-center text-slate-500">
                          No hay ventas registradas en este período.
                        </div>
                      ) : (
                        <div className="border border-white/5 rounded-xl overflow-hidden bg-neutral-950/40">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-white/5 text-[10px] uppercase font-bold text-slate-405 border-b border-white/5">
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Método</th>
                                <th className="p-3 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {billingFilteredOrders.map((o) => (
                                <tr key={o.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-3">
                                    <p className="font-bold text-white leading-tight">{o.cliente}</p>
                                    <p className="text-[10px] text-slate-500">ID: {o.id}</p>
                                  </td>
                                  <td className="p-3 text-slate-400">{o.fecha}</td>
                                  <td className="p-3">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-slate-300">
                                      {o.metodoPago || "N/A"}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right font-bold text-white">{formatPrice(o.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {metricsPopupType === "products" && (
                  <div className="space-y-4 animate-scale-in">
                    <div className="bg-[#151515] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Productos Físicos Vendidos</span>
                        <p className="text-slate-500 text-[10px]">Suma total de cantidades de todos los artículos despachados</p>
                      </div>
                      <strong className="text-2xl text-amber-450 font-black">{billingProductsCount}</strong>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ránking de Artículos Más Vendidos</h4>
                      {sortedProducts.length === 0 ? (
                        <div className="p-6 bg-white/5 rounded-xl text-center text-slate-500">
                          No hay productos vendidos en este período.
                        </div>
                      ) : (
                        <div className="border border-white/5 rounded-xl overflow-hidden bg-neutral-950/40">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-white/5 text-[10px] uppercase font-bold text-slate-405 border-b border-white/5">
                                <th className="p-3">Artículo</th>
                                <th className="p-3 text-center">Unidades Vendidas</th>
                                <th className="p-3 text-right">Recaudación Est.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {sortedProducts.map((p, index) => (
                                <tr key={p.name} className="hover:bg-white/5 transition-colors">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="w-4.5 h-4.5 bg-neutral-900 rounded-full flex items-center justify-center text-[10px] text-amber-450 font-bold border border-white/5">
                                        {index + 1}
                                      </span>
                                      <span className="font-extrabold text-white">{p.name}</span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-center font-bold text-amber-400 text-sm">
                                    {p.qty} u.
                                  </td>
                                  <td className="p-3 text-right text-emerald-450 font-extrabold font-mono">
                                    {formatPrice(p.totalAmount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {metricsPopupType === "billing" && (
                  <div className="space-y-5 animate-scale-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div className="bg-[#151515] p-3.5 rounded-xl border border-white/5 text-center">
                        <span className="text-[9.5px] text-slate-400 block font-bold uppercase tracking-wider">Total Facturado</span>
                        <strong className="text-xl text-emerald-400 font-black mt-1.5 block">{formatPrice(billingTotalAmount)}</strong>
                      </div>
                      <div className="bg-[#151515] p-3.5 rounded-xl border border-white/5 text-center">
                        <span className="text-[9.5px] text-slate-400 block font-bold uppercase tracking-wider">Ticket Promedio</span>
                        <strong className="text-xl text-white font-black mt-1.5 block">
                          {billingSalesCount > 0 ? formatPrice(Math.round(billingTotalAmount / billingSalesCount)) : "$0"}
                        </strong>
                      </div>
                      <div className="bg-[#151515] p-3.5 rounded-xl border border-white/5 text-center">
                        <span className="text-[9.5px] text-slate-400 block font-bold uppercase tracking-wider">Cant. Pedidos</span>
                        <strong className="text-xl text-blue-400 font-black mt-1.5 block">{billingSalesCount}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#151515]/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1.5">
                          Ingresos por Canal de Pago
                        </h4>
                        {Object.keys(salesByPaymentMethod).length === 0 ? (
                          <p className="text-slate-500 text-[11px] text-center py-4">Sin información de métodos de pago</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(salesByPaymentMethod).map(([method, data]) => {
                              const percent = billingTotalAmount > 0 ? Math.round((data.total / billingTotalAmount) * 100) : 0;
                              return (
                                <div key={method} className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-bold text-white capitalize">{method.toLowerCase()}</span>
                                    <span className="text-slate-400 font-mono">
                                      {formatPrice(data.total)} ({percent}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#111111] h-1.5 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                      className="bg-emerald-500 h-full rounded-full" 
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="bg-[#151515]/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1.5">
                          Pedidos por Estado
                        </h4>
                        {Object.keys(salesByStatus).length === 0 ? (
                          <p className="text-slate-500 text-[11px] text-center py-4">Sin estados registrados</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(salesByStatus).map(([status, data]) => {
                              const percent = billingSalesCount > 0 ? Math.round((data.count / billingSalesCount) * 100) : 0;
                              let statusColor = "bg-blue-500";
                              if (status === "PENDIENTE") statusColor = "bg-amber-500";
                              if (status === "ENTREGADO") statusColor = "bg-emerald-500";
                              if (status === "PREPARADO" || status === "PREPARANDO") statusColor = "bg-blue-400";
                              if (status === "ARCHIVADO") statusColor = "bg-slate-500";

                              return (
                                <div key={status} className="space-y-1">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="font-bold text-white">{status}</span>
                                    <span className="text-slate-400 font-mono">
                                      {data.count} ({percent}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#111111] h-1.5 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                      className={`${statusColor} h-full rounded-full`} 
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setMetricsPopupType(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- ADD / EDIT PRODUCT MODAL DRAWER --- */}
      {showProductModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/85">
          <div className="relative bg-[#111111] border border-white/10 rounded-3xl w-full max-w-xl p-5 md:p-7 shadow-2xl max-h-[92vh] overflow-y-auto">
            
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/10 text-slate-405 hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <h3 className="text-sm font-extrabold text-white mb-4 flex items-center gap-2">
              <Package className="w-4.5 h-4.5 text-blue-505" />
              <span>{isEditingProduct ? "Editar Artículo" : "Cargar Nuevo Artículo"}</span>
            </h3>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Id / Código (SKU) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditingProduct}
                    value={prodForm.id}
                    onChange={(e) => setProdForm({ ...prodForm, id: e.target.value.replace(/\s+/g, "-").trim() })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none placeholder-slate-505"
                    placeholder="ej: pendrive-64gb"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">
                    Categoría *
                  </label>
                  <select
                    value={isCustomCategory ? "__NEW_CATEGORY__" : prodForm.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__NEW_CATEGORY__") {
                        setIsCustomCategory(true);
                        setProdForm({ ...prodForm, category: "" });
                      } else {
                        setIsCustomCategory(false);
                        setProdForm({ ...prodForm, category: val });
                      }
                    }}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500"
                  >
                    <option value="">Sin Categoría</option>
                    {prodForm.category && !allCategories.includes(prodForm.category) && (
                      <option value={prodForm.category}>{prodForm.category}</option>
                    )}
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__NEW_CATEGORY__">+ Agregar nueva categoría...</option>
                  </select>
                  {isCustomCategory && (
                    <div className="mt-2">
                      <input
                        type="text"
                        required
                        value={customCategoryName}
                        onChange={(e) => {
                          setCustomCategoryName(e.target.value);
                          setProdForm({ ...prodForm, category: e.target.value });
                        }}
                        className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-blue-500/40 px-3.5 py-2.5 focus:outline-none placeholder-blue-500/50"
                        placeholder="Escriba nueva categoría"
                      />
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="ej: Pendrive Kingston DataTraveler 64GB USB 3.2"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Descripción del Producto
                  </label>
                  <textarea
                    rows={3}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none leading-relaxed"
                    placeholder="Indique características, colores o compatibilidades."
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Precio ($ ARS) *
                  </label>
                  <input
                    type="number"
                    required
                    value={prodForm.price}
                    onChange={(e) => {
                      const val = e.target.value;
                      const num = parseFloat(val) || 0;
                      setProdForm((prev) => ({
                        ...prev,
                        price: val,
                        disponible: num <= 0 ? "NO" : prev.disponible
                      }));
                    }}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="precio normal o de oferta"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Precio Oferta / Anterior * (si corresponde)
                  </label>
                  <input
                    type="number"
                    value={prodForm.originalPrice}
                    onChange={(e) => setProdForm({ ...prodForm, originalPrice: e.target.value })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="Dejar vacío si no está en Oferta"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Disponible / Tiene Stock?
                  </label>
                  <select
                    value={parseFloat(prodForm.price) <= 0 ? "NO" : prodForm.disponible}
                    disabled={parseFloat(prodForm.price) <= 0}
                    onChange={(e) => setProdForm({ ...prodForm, disponible: e.target.value })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 disabled:opacity-60"
                  >
                    <option value="SI">SI (Disponible en la web)</option>
                    <option value="NO">NO (Establecer como Agotado / No Disponible)</option>
                  </select>
                  {parseFloat(prodForm.price) <= 0 && (
                    <span className="text-[9px] text-amber-400 font-semibold block mt-1">
                      ⚠️ Con precio $0 pasa automáticamente a NO disponible.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    Destacar en Oferta?
                  </label>
                  <select
                    value={prodForm.oferta}
                    onChange={(e) => setProdForm({ ...prodForm, oferta: e.target.value })}
                    className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500"
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI (Agregar etiqueta Oferta)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      Foto del Producto
                    </label>
                    {prodForm.image && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                        Imagen Cargada
                      </span>
                    )}
                  </div>

                  {/* Opción 1: Subir imagen desde el dispositivo */}
                  <div className="bg-[#151515] p-3.5 rounded-2xl border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400">Subir imagen desde tu dispositivo</span>
                      {isUploadingImage && (
                        <span className="text-[9px] font-mono font-bold text-blue-400 animate-pulse">
                          PROCESANDO EN IMGBB...
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <label className="relative flex-1 flex items-center justify-center gap-2.5 px-4 py-3 bg-neutral-950 hover:bg-neutral-900 text-white rounded-xl border border-white/10 hover:border-blue-500/40 cursor-pointer transition-all text-xs font-semibold group select-none">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleImageUpload}
                          disabled={isUploadingImage || isActionPending}
                        />
                        {isUploadingImage ? (
                          <>
                            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                            <span className="text-blue-400">Subiendo imagen a ImgBB...</span>
                          </>
                        ) : (
                          <>
                            <Image className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                            <span>Seleccionar archivo de imagen</span>
                          </>
                        )}
                      </label>
                      
                      {prodForm.image && (
                        <button
                          type="button"
                          onClick={() => {
                            setProdForm({ ...prodForm, image: "" });
                            setUploadError("");
                          }}
                          className="px-4 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Eliminar Foto
                        </button>
                      )}
                    </div>

                    {uploadError && (
                      <div className="flex items-center gap-2 p-3 bg-rose-600/10 border border-rose-500/20 text-rose-400 rounded-xl text-[11px] font-medium leading-normal animate-fade-in">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                        <span>{uploadError}</span>
                      </div>
                    )}
                  </div>

                  {/* Opción 2: Pegar URL manual */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold text-slate-400 leading-none">O pegar un enlace directo URL:</span>
                    <input
                      type="url"
                      value={prodForm.image}
                      onChange={(e) => {
                        setProdForm({ ...prodForm, image: e.target.value });
                        setUploadError("");
                      }}
                      className="w-full text-xs bg-neutral-950 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:border-blue-500 focus:outline-none"
                      placeholder="https://images.unsplash.com/... o enlace de Drive público"
                    />
                  </div>
                  
                  {/* Mercado Libre Style Large Previsualizer Box */}
                  <div className="flex flex-col items-center justify-center border border-white/5 bg-[#080808]/50 rounded-2xl p-4.5 min-h-[180px] relative overflow-hidden group">
                    {prodForm.image ? (
                      <div className="w-full max-w-[200px] aspect-square rounded-xl overflow-hidden bg-[#0d0d0d] border border-white/5 flex items-center justify-center p-2.5 relative">
                        <img 
                          src={prodForm.image} 
                          alt="Vista previa del Producto" 
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = "https://placehold.co/200?text=Error+en+enlace+de+imagen";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 space-y-2 select-none">
                        <Image className="w-9 h-9 stroke-[1.5] text-slate-600 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin imagen cargada</span>
                        <p className="text-[9px] text-slate-500 text-center max-w-[220px]">Suba una imagen o pegue un enlace válido para ver la previsualización grande aquí.</p>
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-blue-600/10 border border-blue-500/20 rounded-md text-[8px] font-extrabold uppercase tracking-widest text-blue-400 select-none">
                      Vista Previa Grande
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  disabled={isActionPending || isUploadingImage}
                  className="w-1/3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isActionPending || isUploadingImage}
                  className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {isActionPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Guardando...
                    </>
                  ) : isUploadingImage ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Subiendo imagen...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> {isEditingProduct ? "Guardar Cambios" : "Cargar Articulo"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SELECTED ORDER DETAIL (TICKET) MODAL --- */}
      {selectedOrderDetail && (() => {
        const cleanPhone = selectedOrderDetail.telefono.replace(/[^0-9]/g, "");
        const parsedItems = parseProductsString(selectedOrderDetail.productos).map(item => {
          const matchedProd = allProducts.find(p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase());
          const unitPrice = matchedProd ? matchedProd.price : 0;
          return {
            ...item,
            unitPrice,
            subtotal: unitPrice * item.qty
          };
        });

        // Let's see if we have some calculated sub price totals
        const calculatedSubtotal = parsedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
        const subtotalToDisplay = calculatedSubtotal > 0 ? calculatedSubtotal : selectedOrderDetail.total;

        return createPortal(
          <div id="print-modal-container" className="fixed inset-0 z-55 flex justify-center py-6 md:py-12 px-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                html, body {
                  background: #ffffff !important;
                  color: #000000 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  height: auto !important;
                  min-height: auto !important;
                  overflow: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                /* Hide the react mount point / main application wrapper entirely */
                #root, .no-print, nav, header, footer {
                  display: none !important;
                }
                /* Show ONLY the print modal container */
                #print-modal-container {
                  position: static !important;
                  display: block !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: auto !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  z-index: auto !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  transform: none !important;
                  overflow: visible !important;
                }
                .print-card-box {
                  position: static !important;
                  display: block !important;
                  border: none !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  box-shadow: none !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 1cm !important;
                  overflow: visible !important;
                }
                /* Format printing pages */
                @page {
                  size: auto;
                  margin: 1.5cm;
                }
                .print-accent {
                  color: #000000 !important;
                  border-color: #cccccc !important;
                }
                /* Force light-contrast colors for all elements inside modal on print */
                #print-modal-container,
                #print-modal-container * {
                  color: #000000 !important;
                  border-color: #cccccc !important;
                  background-color: transparent !important;
                }
                .overflow-x-auto {
                  overflow: visible !important;
                  display: block !important;
                  max-width: 100% !important;
                }
                table {
                  display: table !important;
                  width: 100% !important;
                  border-collapse: collapse !important;
                  page-break-inside: auto !important;
                }
                thead {
                  display: table-header-group !important;
                }
                tfoot {
                  display: table-footer-group !important;
                }
                tbody {
                  display: table-row-group !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  page-break-after: auto !important;
                }
                td, th {
                  page-break-inside: avoid !important;
                }
                .page-break {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            ` }} />
            
            <div className="relative bg-[#111111] border border-white/10 rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl text-slate-300 print-card-box my-auto">
              {/* Close Button (Hidden on Print) */}
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer no-print"
                title="Cerrar ticket"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title Header (Hidden on Print) */}
              <div className="mb-6 pb-4 border-b border-white/5 flex flex-col gap-4 no-print">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider font-sans">
                        Comprobante de Pedido
                      </h2>
                      <p className="text-[10px] text-slate-500">
                        ID: {selectedOrderDetail.id}
                      </p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        window.print();
                      }}
                      className="py-1.5 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 animate-pulse"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Imprimir / PDF</span>
                    </button>
                  </div>
                </div>

                {/* Helpful PDF tutorial tooltip */}
                <div className="text-[10.5px] text-amber-450 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex gap-2.5 items-start">
                  <span className="text-sm shrink-0 leading-none">💡</span>
                  <div className="space-y-0.5 leading-normal">
                    <p className="font-extrabold text-amber-300">¿Cómo descargarlo como PDF?</p>
                    <p className="text-slate-400">
                      Al presionar <strong className="text-white">"Imprimir / PDF"</strong>, en la opción de <strong className="text-white">"Destino"</strong> u <strong className="text-white">"Impresora"</strong> de tu dispositivo, seleccioná <strong className="text-amber-400">"Guardar como PDF"</strong> para descargarlo rápido en tu cel o PC.
                    </p>
                  </div>
                </div>
              </div>

              {/* TICKET CONTAINER SHEET (Optimized for Printer & Contrast) */}
              <div className="bg-neutral-950/20 border border-white/5 rounded-2xl p-6 print-accent text-slate-200">
                
                <table className="w-full border-collapse">
                  {/* Repeated Header during printing */}
                  <thead>
                    <tr>
                      <td>
                        {/* Header Logo & Store details */}
                        <div className="flex flex-col md:flex-row md:justify-between items-center gap-4 border-b border-dashed border-white/15 pb-6 mb-6 print-accent text-left">
                          <div className="flex items-center gap-3.5">
                            <div className="w-14 h-14 bg-white/5 text-white rounded-2xl border border-white/10 flex items-center justify-center p-1 overflow-hidden print:border-neutral-300 relative">
                              {!logoError ? (
                                <img 
                                  src="/logo.png" 
                                  alt="Logo" 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain"
                                  onError={() => {
                                    setLogoError(true);
                                  }}
                                />
                              ) : (
                                <span className="text-xl font-bold font-mono">
                                  {webSettings.nombreWeb ? webSettings.nombreWeb.charAt(0).toUpperCase() : "M"}
                                </span>
                              )}
                            </div>
                            <div>
                              <h1 className="text-base font-black text-white uppercase tracking-tight print:text-black text-left">
                                {webSettings.nombreWeb || "Mi Catálogo Digital"}
                              </h1>
                              <p className="text-[10px] text-slate-400 font-sans print:text-neutral-600 font-medium text-left">
                                {webSettings.direccion || "Ventas on-line"}
                              </p>
                            </div>
                          </div>

                          <div className="text-center md:text-right font-mono text-[10.5px] leading-relaxed text-slate-400 print:text-neutral-600">
                            <div className="text-white font-extrabold print:text-black">ID PEDIDO: {selectedOrderDetail.id}</div>
                            <div>Fecha: {selectedOrderDetail.fecha}</div>
                            <div>Contacto: {webSettings.contactoTicket || webSettings.contactoMinorista || webSettings.contactoMayorista || "-"}</div>
                          </div>
                        </div>

                        {/* Cliente / Datos de la entrega */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-dashed border-white/15 pb-6 mb-6 print-accent text-left">
                          <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 print:text-neutral-500">
                              Datos del Cliente
                            </h3>
                            <div className="text-xs font-bold text-white print:text-black space-y-0.5">
                              <p className="text-sm font-black">{selectedOrderDetail.cliente}</p>
                              <p className="font-mono text-[11px] text-slate-300 print:text-neutral-700">Tel: {selectedOrderDetail.telefono}</p>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 print:text-neutral-500">
                              Forma de Entrega / Retiro
                            </h3>
                            <div className="text-xs font-semibold text-slate-200 print:text-black space-y-1.5">
                              <div className="inline-block py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold print:border-neutral-300 print:bg-neutral-105">
                                {(() => {
                                  const parts = selectedOrderDetail.entrega.split(" - ");
                                  if (parts.length === 2) {
                                    return (
                                      <div className="space-y-1 text-left">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px]">📅</span>
                                          <span>Retiro: <span className="text-blue-400 print:text-black font-extrabold">{parts[0]}</span></span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px]">⏰</span>
                                          <span>Horario: <span className="text-emerald-400 print:text-black font-extrabold">{parts[1]}</span></span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return <span>{selectedOrderDetail.entrega}</span>;
                                })()}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Estado: {selectedOrderDetail.estado}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </thead>

                  {/* Main items body wrapper */}
                  <tbody>
                    <tr>
                      <td>
                        {/* Products items table list */}
                        <div className="mb-6 pt-2 text-left">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 print:text-neutral-500">
                            Detalle de Artículos
                          </h3>
                          
                          {parsedItems.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs font-sans">
                                <thead>
                                  <tr className="border-b border-white/10 text-[9.5px] uppercase font-bold text-slate-400 tracking-wider print:text-neutral-500 print:border-neutral-300">
                                    <th className="py-2">Artículo</th>
                                    <th className="py-2 text-center w-16">Cant.</th>
                                    <th className="py-2 text-right w-28">P. Unit</th>
                                    <th className="py-2 text-right w-28">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 print:divide-neutral-200">
                                  {parsedItems.map((item, i) => (
                                    <tr key={i} className="text-slate-200 print:text-black page-break">
                                      <td className="py-2.5 font-medium pr-2">{item.name}</td>
                                      <td className="py-2.5 text-center font-mono font-bold text-slate-400 print:text-black">{item.qty} u.</td>
                                      <td className="py-2.5 text-right font-mono text-slate-400 print:text-black">{item.unitPrice > 0 ? formatPrice(item.unitPrice) : "-"}</td>
                                      <td className="py-2.5 text-right font-mono font-bold text-white print:text-black">{item.unitPrice > 0 ? formatPrice(item.subtotal) : "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-300 bg-white/5 p-3.5 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed print:text-black print:bg-neutral-100 print:border-none">
                              {selectedOrderDetail.productos}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>

                  {/* Repeated Footer section */}
                  <tfoot>
                    <tr>
                      <td>
                        {/* Totales */}
                        <div className="flex flex-col items-end border-t border-dashed border-white/15 pt-4 print-accent page-break">
                          <div className="w-full md:w-80 space-y-1.5 font-mono text-xs">
                            {parsedItems.length > 0 && (
                              <div className="flex justify-between text-slate-400 print:text-neutral-500">
                                <span>Suma Subtotal:</span>
                                <span>{formatPrice(subtotalToDisplay)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-black text-white border-t border-white/5 pt-1.5 print:text-black print:border-neutral-300">
                              <span className="uppercase tracking-wide">TOTAL IMPORTE:</span>
                              <span className="text-base text-emerald-400 print:text-black font-extrabold">{formatPrice(selectedOrderDetail.total)}</span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code and digital branding watermark footer */}
                        <div className="mt-8 pt-6 border-t border-dashed border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 print-accent text-center sm:text-left page-break">
                          <div className="space-y-1 text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide print:text-neutral-500">
                              Soporte y Gestión Digital
                            </p>
                            <p className="text-xs font-black text-white print:text-black tracking-tight mt-0.5">
                              - Sistema creado por Magxor Digital -
                            </p>
                            <p className="text-[9px] text-slate-500 print:text-neutral-400 font-mono mt-0.5">
                              Desarrollos Web y de Comercio Electrónico
                            </p>
                          </div>
                          
                          {/* QR Code leading to magxordigital.netlify.app */}
                          <div className="flex flex-col items-center gap-1 bg-white p-2 rounded-xl border border-white/10 shrink-0 print:border-neutral-300">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=https://magxordigital.netlify.app`} 
                              alt="QR Code Magxor" 
                              className="w-16 h-16 object-contain"
                            />
                            <span className="text-[8px] font-extrabold text-neutral-950 font-mono tracking-tighter uppercase">
                              magxordigital
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>

              </div>

              {/* Action Buttons (Footer - Hidden on Print) */}
              <div className="mt-6 pt-4 border-t border-white/5 flex gap-3 no-print">
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  className="w-1/3 py-2.5 bg-white/5 hover:bg-white/15 border border-white/10 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="w-2/3 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="w-4 h-4" /> Imprimir / Descargar PDF
                </button>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}

      {/* NEW ORDER NOTIFICATION POPUP */}
      {newOrderPopupData && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111111] border-2 border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(245,158,11,0.25)] relative overflow-hidden animate-scale-in text-center">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 animate-pulse" />
            
            <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Bell className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white">¡NUEVO PEDIDO RECIBIDO!</h3>
            <p className="text-xs text-amber-400 font-bold mt-1 tracking-widest uppercase font-mono">ID: {newOrderPopupData.id}</p>
            
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 my-5 text-left space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Cliente:</span>
                <span className="text-white font-extrabold">{newOrderPopupData.cliente}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Teléfono:</span>
                <span className="text-white font-mono">{newOrderPopupData.telefono}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Total:</span>
                <span className="text-emerald-400 font-black">{formatPrice(newOrderPopupData.total)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Entrega:</span>
                <span className="text-blue-400 font-bold">{newOrderPopupData.entrega}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
              Ha ingresado un nuevo pedido en la base de datos de Sheets. ¿Qué desea hacer?
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setNewOrderPopupData(null);
                  showToast("Pedido aceptado", "success");
                }}
                className="flex-1 py-3 px-4 bg-[#1c1c1c] hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 cursor-pointer transition-all active:scale-95 text-center"
              >
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewOrderPopupData(null);
                  setOrderFilterStatus("PENDIENTE");
                  setActiveTab("orders");
                  setShowOrderFilters(true);
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-450 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>Ver Pedido</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW CLIENT NOTIFICATION POPUP */}
      {newClientPopupData && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111111] border-2 border-blue-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-[0_0_50px_rgba(59,130,246,0.25)] relative overflow-hidden animate-scale-in text-center">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-450 to-blue-600 animate-pulse" />
            
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <User className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-white">¡NUEVO CLIENTE REGISTRADO!</h3>
            <p className="text-xs text-blue-400 font-bold mt-1 tracking-widest uppercase font-mono">Registro Web</p>
            
            <div className="bg-[#151515] border border-white/5 rounded-2xl p-4 my-5 text-left space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Teléfono / WhatsApp:</span>
                <span className="text-white font-black font-mono">{newClientPopupData.phone}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Fecha Registro:</span>
                <span className="text-white font-bold">{newClientPopupData.date}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Método:</span>
                <span className="text-blue-400 font-bold">{newClientPopupData.metodo}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Estado Contacto:</span>
                <span className={`font-bold ${newClientPopupData.contacto === "SI" ? "text-emerald-400" : "text-amber-400"}`}>
                  {newClientPopupData.contacto === "SI" ? "CONTACTADO" : "PENDIENTE"}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed mb-6">
              Un nuevo cliente se ha sumado a la base de datos de Sheets. ¿Qué desea hacer?
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setNewClientPopupData(null);
                  showToast("Registro aceptado", "success");
                }}
                className="flex-1 py-3 px-4 bg-[#1c1c1c] hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 cursor-pointer transition-all active:scale-95 text-center"
              >
                Aceptar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewClientPopupData(null);
                  setClientFilterStatus("pending");
                  setActiveTab("clients");
                }}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-450 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 cursor-pointer transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>Ver Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
