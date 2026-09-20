export interface MxConfig {
  nombreWeb: string;
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
  modoOscuro: string;
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

async function post<T>(body: Record<string, unknown>): Promise<T> {
  if (!isEndpointConfigured()) throw new Error("Endpoint no configurado");
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error de red " + res.status);
  const data = (await res.json()) as { status: string; message?: string } & T;
  if (data.status !== "ok") throw new Error(data.message || "Error del servidor");
  return data;
}

export const api = {
  health: () => post<{ time: string }>({ action: "health" }),
  getConfig: () => post<{ config: MxConfig }>({ action: "getConfig", token: READ_TOKEN }),
  getProducts: () => post<{ products: MxProductRow[] }>({ action: "getProducts", token: READ_TOKEN }),
  getReviews: () => post<{ reviews: MxReviewRow[] }>({ action: "getReviews", token: READ_TOKEN }),
  addOrder: (p: Record<string, unknown>) => post({ action: "addOrder", ...p }),
  addReview: (p: Record<string, unknown>) => post({ action: "addReview", ...p }),
  addClient: (p: Record<string, unknown>) => post({ action: "addClient", ...p }),
  login: (username: string, password: string) =>
    post<{ session: string; user: string; atraso?: boolean }>({ action: "login", username, password }),
  verifyAdminPass: (session: string, adminPass: string) =>
    post({ action: "verifyAdminPass", session, adminPass }),
  admin: (session: string, action: string, p: Record<string, unknown> = {}) =>
    post<Record<string, unknown>>({ action, session, ...p }),
};

export function sessionGet(): string {
  return sessionStorage.getItem("mx_admin_session") || "";
}
export function sessionSet(t: string) {
  if (t) sessionStorage.setItem("mx_admin_session", t);
  else sessionStorage.removeItem("mx_admin_session");
}
