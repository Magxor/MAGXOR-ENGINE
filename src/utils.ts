import { Product, ReviewItem } from "./types";

export function formatPrice(price: number | string | undefined | null): string {
  if (price === undefined || price === null) return "$0";
  const num = typeof price === "number" ? price : parseFloat(String(price)) || 0;
  const rounded = Math.round(num);
  return "$" + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function getArgentinaTime(): Date {
  const now = new Date();
  // Get UTC time and subtract 3 hours for Argentina's standard offset (UTC-3)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc - (3600000 * 3));
}

export function checkShopStatus(): { isOpen: boolean; text: string } {
  const now = getArgentinaTime();
  const day = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTimeVal = hour * 100 + minute; // 16:30 -> 1630

  let isOpen = false;
  let text = "";

  if (day >= 1 && day <= 5) {
    // Lunes a Viernes
    if (currentTimeVal >= 900 && currentTimeVal < 1300) {
      isOpen = true;
      text = `Abierto ahora — Cierra a las 13:00 hs.`;
    } else if (currentTimeVal >= 1600 && currentTimeVal < 2000) {
      isOpen = true;
      text = `Abierto ahora — Cierra a las 20:00 hs.`;
    } else if (currentTimeVal < 900) {
      text = `Cerrado ahora — Abre hoy a las 09:00 hs.`;
    } else if (currentTimeVal >= 1300 && currentTimeVal < 1600) {
      text = `Cerrado ahora — Abre hoy a las 16:00 hs.`;
    } else {
      text = `Cerrado ahora — Abre mañana a las 09:00 hs.`;
    }
  } else if (day === 6) {
    // Sábado
    if (currentTimeVal >= 900 && currentTimeVal < 1300) {
      isOpen = true;
      text = `Abierto ahora — Cierra a las 13:00 hs.`;
    } else if (currentTimeVal < 900) {
      text = `Cerrado ahora — Abre hoy a las 09:00 hs.`;
    } else {
      text = `Cerrado ahora — Abre el lunes a las 09:00 hs.`;
    }
  } else {
    // Domingo
    text = `Cerrado ahora — Abre el lunes a las 09:00 hs.`;
  }

  return { isOpen, text };
}

// Extract Spreadsheet ID from standard Google Sheets URL
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Enhanced CSV parser that respects commas inside quotes
export function parseCSV(csvText: string): any[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  // Parse headers
  const splitCSVRow = (row: string): string[] => {
    const tokens: string[] = [];
    let token = "";
    let insideQuotes = false;
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        tokens.push(token.trim().replace(/^["']|["']$/g, ''));
        token = "";
      } else {
        token += char;
      }
    }
    tokens.push(token.trim().replace(/^["']|["']$/g, ''));
    return tokens;
  };

  const headers = splitCSVRow(lines[0]);
  const result: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].trim();
    if (!row) continue;
    const values = splitCSVRow(row);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] !== undefined ? values[index] : "";
    });
    result.push(obj);
  }

  return result;
}

// Convert parsed records from CSV into typed Product elements
export function mapRecordsToProducts(records: any[]): Product[] {
  return records.map((rec, index) => {
    // Normalization helper
    const getField = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(rec).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (foundKey) return rec[foundKey];
      }
      return "";
    };

    const id = getField(["id", "codigo", "código", "sku"]) || `sheet-prod-${index + 1}`;
    const name = getField(["nombre de producto", "nombre del producto", "nombre", "producto", "item", "title", "name"]);
    const rawCategory = getField(["categoría", "categoria", "category", "rubro"]).trim();
    const category = (rawCategory.toLowerCase() === "varios" || !rawCategory) ? "" : rawCategory;
    const description = getField(["descripción", "descripcion", "description", "detalle", "detalles"]) || "Sin descripción disponible.";
    
    // Helper to intelligently parse prices from raw string inputs, handling Spanish format with dot thousands separator (e.g. 10.000, 5.000)
    const parsePrice = (val: string | undefined | null): number => {
      if (!val) return 0;
      let clean = val.trim();
      if (!clean) return 0;

      // Filter down to numbers, dots, commas, and negative signs
      clean = clean.replace(/[^0-9.,-]/g, "");

      if (clean.includes(".") && clean.includes(",")) {
        const dotIdx = clean.indexOf(".");
        const commaIdx = clean.indexOf(",");
        if (dotIdx < commaIdx) {
          // Spanish format: 1.234,56 -> remove dots, replace comma with dot
          clean = clean.replace(/\./g, "").replace(/,/g, ".");
        } else {
          // US format: 1,234.56 -> remove commas
          clean = clean.replace(/,/g, "");
        }
      } else if (clean.includes(".")) {
        // Has dot(s) but no comma
        const dotsCount = clean.split(".").length - 1;
        if (dotsCount > 1) {
          // Multiple dots are definitely thousands separators (e.g. 1.500.000)
          clean = clean.replace(/\./g, "");
        } else {
          // Single dot. In Spanish prices like 10.000 or 5.000 or 150.250, if there are exactly 3 digits after the dot,
          // it almost certainly represents thousands separator in the context of Danipc catalog values.
          const parts = clean.split(".");
          if (parts[1] && parts[1].length === 3) {
            clean = clean.replace(/\./g, "");
          }
        }
      } else if (clean.includes(",")) {
        // Single comma and no dot (e.g. 10,00 -> 10.00 or 10,50 -> 10.5)
        clean = clean.replace(/,/g, ".");
      }

      return parseFloat(clean) || 0;
    };

    // Parse prices handling both standard/offering column layouts
    const precioRaw = getField(["precio", "price", "valor", "costo"]);
    const precioNormal = parsePrice(precioRaw);

    const precioOfertaRaw = getField(["precio oferta", "precio_oferta", "oferta precio", "oferta_precio"]);
    const precioOferta = precioOfertaRaw ? parsePrice(precioOfertaRaw) : undefined;

    const precioAnteriorRaw = getField(["precio anterior", "precio tachado", "descuento", "original_price", "precio_anterior"]);
    const precioAnterior = precioAnteriorRaw ? parsePrice(precioAnteriorRaw) : undefined;

    let price = precioNormal;
    let originalPrice: number | undefined = undefined;

    if (precioOferta !== undefined && precioOferta > 0) {
      // "INVENTARIO" style: "Precio" is normal high, "Precio Oferta" is the actual selling discount price
      price = precioOferta;
      originalPrice = precioNormal;
    } else if (precioAnterior !== undefined && precioAnterior > 0) {
      // Older paradigm: "Precio" is the selling price, "Precio Anterior" is the normal high
      price = precioNormal;
      originalPrice = precioAnterior;
    }

    // Split multiple photo URLs if separated by comma, semicolon, newline, or pipe line
    const fotosRaw = getField(["fotos", "foto", "imagen", "image", "img", "imagen principal", "fotos de producto"]) || "";
    let image = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80";
    let secondaryImage: string | undefined = undefined;

    if (fotosRaw) {
      const fotosList = fotosRaw.split(/[,;\n|]+/).map(f => f.trim()).filter(Boolean);
      if (fotosList.length > 0) {
        image = fotosList[0];
        if (fotosList.length > 1) {
          secondaryImage = fotosList[1];
        }
      }
    }

    // Parse stock availability
    const stockRaw = getField(["disponible", "disponibilidad", "stock", "cantidad", "unidades"]) || "10";
    let stock = 10;
    const cleanStock = stockRaw.replace(/[^0-9]/g, "");
    if (cleanStock && /^\d+$/.test(cleanStock)) {
      stock = parseInt(cleanStock) || 0;
    } else {
      const valLower = stockRaw.toLowerCase().trim();
      if (valLower === "no" || valLower === "false" || valLower === "falso" || valLower === "sin stock" || valLower === "0" || valLower === "no disponible") {
        stock = 0;
      } else {
        stock = 10;
      }
    }

    // Regla de negocio: Si el artículo figura como precio 0 (o <= 0), DEBE FIGURAR COMO NO DISPONIBLE AUTOMÁTICAMENTE
    if (price <= 0) {
      stock = 0;
    }

    // Determine badge and offer highlights
    const ofertaRaw = getField(["oferta", "en oferta", "is_promo", "promo", "promo_status", "badge", "etiqueta"]).toLowerCase().trim();
    const isOfertaFlag = ["true", "si", "sí", "yes", "1"].includes(ofertaRaw) || (precioOferta !== undefined && precioOferta > 0);

    const badgeRaw = getField(["badge", "etiqueta", "estado", "tag"]).toLowerCase().trim();
    let badge: "Oferta" | "Nuevo" | "Últimas unidades" | "" = "";
    if (isOfertaFlag || originalPrice !== undefined || badgeRaw.includes("oferta") || badgeRaw.includes("sale")) {
      badge = "Oferta";
    } else if (badgeRaw.includes("nuevo") || badgeRaw.includes("new")) {
      badge = "Nuevo";
    } else if (badgeRaw.includes("última") || badgeRaw.includes("ultima") || (stock > 0 && stock <= 3)) {
      badge = "Últimas unidades";
    }

    if (stock === 0 && badge === "Últimas unidades") {
      badge = "";
    }

    const isBestSeller = ["true", "si", "sí", "yes", "1"].includes(getField(["mas vendido", "más vendido", "destacado", "bestseller"]).toLowerCase().trim());
    const isNew = ["true", "si", "sí", "yes", "1"].includes(getField(["nuevo prod", "is_new", "novedad"]).toLowerCase().trim()) || badge === "Nuevo";
    const isPromo = originalPrice !== undefined || badge === "Oferta";

    return {
      id,
      name: name || `Producto ${index + 1}`,
      category,
      description,
      price,
      originalPrice,
      image,
      secondaryImage,
      stock,
      badge,
      isBestSeller,
      isNew,
      isPromo
    };
  }).filter(p => p.name !== "");
}

// Convert parsed records from CSV into typed ReviewItem elements
export function mapRecordsToReviews(records: any[]): ReviewItem[] {
  return records.map((rec, index) => {
    const getField = (keys: string[]): string => {
      for (const k of keys) {
        const foundKey = Object.keys(rec).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (foundKey) return rec[foundKey];
      }
      return "";
    };

    const id = getField(["id", "review_id"]) || `sheet-rev-${index + 1}`;
    const productId = getField(["productId", "product_id", "id_producto", "producto_id", "prod_id", "sku", "codigo", "código"]);
    const name = getField(["name", "nombre", "usuario", "nombre de usuario", "autor", "customer_name"]);
    const ratingRaw = getField(["rating", "calificacion", "calificación", "estrellas", "score", "nota"]);
    const rating = parseInt(ratingRaw.replace(/[^0-9]/g, "")) || 5;
    const comment = getField(["comment", "comentario", "comentarios", "reseña", "reseñas", "opinion", "opinión", "texto"]);
    const date = getField(["date", "fecha", "creado", "timestamp"]) || "Hace poco";

    return {
      id,
      productId: productId || undefined,
      name: name || "Cliente Anónimo",
      rating: rating >= 1 && rating <= 5 ? rating : 5,
      comment: comment || "Excelente atención y productos recomendados.",
      date
    };
  }).filter(r => r.name !== "" && r.comment !== "");
}

// Submits data to Google Apps Script Web App using GET redirect to avoid CORS handshake issues
export async function submitToAppsScript(appsScriptUrl: string, params: Record<string, any>): Promise<boolean> {
  if (!appsScriptUrl) return false;
  try {
    const urlObj = new URL(appsScriptUrl);
    Object.keys(params).forEach(key => {
      urlObj.searchParams.append(key, String(params[key]));
    });
    // Add cache buster to prevent cached requests
    urlObj.searchParams.append("_t", String(Date.now()));

    await fetch(urlObj.toString(), {
      method: "GET",
      mode: "no-cors", // Allows requests across origins / redirects flawlessly
      keepalive: true  // Crucial: ensures browser completes request in background even on mobile redirections
    });
    return true;
  } catch (error) {
    console.error("Error submitting to Apps Script:", error);
    return false;
  }
}

