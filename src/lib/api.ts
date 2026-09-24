export interface MxConfig {
  nombreWeb: string;
  slogan: string;
  horarios: string;
  direccion: string;
  contactoMinorista: string;
  contactoMayorista: string;
  contactoTicket: string;
  paletaColores: string;
  anuncioHeader: string;
  colorPreset: string;
  colorPrimario: string;
  colorSecundario: string;
  logoUrl: string;
  faviconUrl: string;
  logoAnimadoUrl: string;
  splashActivo: string;
  splashDuracionMs: number;
  splashFondo: string;
  seoTitulo: string;
  seoDescripcion: string;
  seoKeywords: string;
  seoUrlCanonica: string;
  seoRobots: string;
  moneda: string;
  estadoCuenta: string;
  suspensionImageUrl: string;
  suspensionMensaje: string;
  [k: string]: unknown;
}

export interface MxProductRow {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  precio: string;
  precioOferta: string;
  disponible: string;
  oferta: string;
  fotos: string;
}

export interface MxReviewRow {
  productId: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
}

const BASE: string = (import.meta as unknown as { env: Record<string, string> }).env
  .VITE_APPS_SCRIPT_URL || "";
const READ_TOKEN: string =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_READ_TOKEN || "";

export function isEndpointConfigured(): boolean {
  return BASE.startsWith("https://");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Apps Script responde al POST con un redirect 302 que algunos navegadores
// cachean o re-juegan sin cuerpo. El cache-buster + no-store evita que se
// reutilice un redirect viejo (causaba 404 o "Sesión requerida" fantasma).
function endpointUrl(): string {
  const sep = BASE.includes("?") ? "&" : "?";
  return `${BASE}${sep}_t=${Date.now()}`;
}

function isTransient(msg: string): boolean {
  return (
    msg.includes("Error de red") ||
    msg.includes("Sesión requerida") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("HTML en vez de JSON")
  );
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  if (!isEndpointConfigured()) throw new Error("Endpoint no configurado");
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(800 * attempt);
    try {
      const res = await fetch(endpointUrl(), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Error de red 404: la URL del Web App no existe o el despliegue fue eliminado. Verificá VITE_APPS_SCRIPT_URL y redesplegá el frontend.");
        }
        throw new Error("Error de red " + res.status);
      }

      const text = await res.text();
      let data: { status: string; message?: string } & T;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("El servidor respondió con HTML en vez de JSON. Verificá que la URL del Web App de Apps Script sea correcta y esté publicada.");
      }

      if (data.status !== "ok") throw new Error(data.message || "Error del servidor");
      return data;
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message || e || "");
      if (attempt === 0 && isTransient(msg)) continue;
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Error del servidor");
}

export const api = {
  health: () => post<{ time: string }>({ action: "health" }),
  getConfig: () => post<{ config: MxConfig }>({ action: "getConfig", token: READ_TOKEN }),
  getProducts: () => post<{ products: MxProductRow[] }>({ action: "getProducts", token: READ_TOKEN }),
  getReviews: () => post<{ reviews: MxReviewRow[] }>({ action: "getReviews", token: READ_TOKEN }),
  listClients: (session?: string) =>
    post<{ clients: any[] }>({ action: "listClients", session: session || sessionGet() }),
  listOrders: (session?: string) =>
    post<{ orders: any[] }>({ action: "listOrders", session: session || sessionGet() }),
  listUsers: (adminPass: string, session?: string) =>
    post<{ users: any[] }>({ action: "listUsers", adminPass, session: session || sessionGet() }),
  addOrder: (p: Record<string, unknown>) => post({ action: "addOrder", ...p }),
  // Registra un carrito perdido en AUDIT_LOG (se acepta incluso con la
  // cuenta suspendida; no crea pedidos).
  logLostCart: (p: Record<string, unknown>) => post({ action: "logLostCart", ...p }),
  addReview: (p: Record<string, unknown>) => post({ action: "addReview", ...p }),
  addClient: (p: Record<string, unknown>) => post({ action: "addClient", ...p }),
  login: (username: string, password: string) =>
    post<{ session: string; user: string; atraso?: boolean; debeCambiarCredenciales?: boolean; rol?: string }>({ action: "login", username, password }),
  verifyAdminPass: (session: string, adminPass: string) =>
    post({ action: "verifyAdminPass", session, adminPass }),
  // Ping liviano: valida sesión y renueva expiración deslizante sin traer datos
  sessionPing: (session?: string) =>
    post<{ estadoCuenta?: string }>({ action: "sessionPing", session: session || sessionGet() }),
  changeCredentials: (session: string, newUsername: string, newPassword: string) =>
    post({ action: "changeCredentials", session, newUsername, newPassword }),
  admin: (session: string, action: string, p: Record<string, unknown> = {}) =>
    post<Record<string, unknown>>({ action, session, ...p }),
};

export function sessionGet(): string {
  try {
    return sessionStorage.getItem("mx_admin_session") || localStorage.getItem("mx_admin_session") || "";
  } catch {
    return "";
  }
}
export function sessionSet(t: string) {
  try {
    if (t) {
      sessionStorage.setItem("mx_admin_session", t);
      localStorage.setItem("mx_admin_session", t);
    } else {
      sessionStorage.removeItem("mx_admin_session");
      localStorage.removeItem("mx_admin_session");
    }
  } catch {
    // ignore
  }
}
