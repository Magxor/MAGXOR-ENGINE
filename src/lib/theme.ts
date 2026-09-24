export const COLOR_PRESETS: Record<string, { primary: string; secondary: string }> = {
  Azul: { primary: "#2563EB", secondary: "#4F46E5" },
  Cian: { primary: "#06B6D4", secondary: "#0E7490" },
  Esmeralda: { primary: "#10B981", secondary: "#047857" },
  Índigo: { primary: "#6366F1", secondary: "#4338CA" },
  Rosa: { primary: "#EC4899", secondary: "#BE185D" },
  Naranja: { primary: "#F97316", secondary: "#C2410C" },
};

export function isHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test((v || "").trim());
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mix(hex: string, target: [number, number, number], amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number, t: number) => Math.round(c + (t - c) * amt);
  return `rgb(${m(r, target[0])}, ${m(g, target[1])}, ${m(b, target[2])})`;
}

export function resolveTheme(preset: string, primario: string, secundario: string) {
  const base = COLOR_PRESETS[preset] || COLOR_PRESETS.Azul;
  const primary = isHex(primario) ? primario.trim() : base.primary;
  const secondary = isHex(secundario) ? secundario.trim() : base.secondary;
  const [r, g, b] = hexToRgb(primary);
  return {
    primary,
    secondary,
    hover: mix(primary, [0, 0, 0], 0.15),
    soft: `rgba(${r}, ${g}, ${b}, 0.12)`,
    rgb: `${r}, ${g}, ${b}`,
  };
}

export function applyTheme(preset: string, primario: string, secundario: string) {
  const t = resolveTheme(preset, primario, secundario);
  const root = document.documentElement.style;
  root.setProperty("--mx-primary", t.primary);
  root.setProperty("--mx-primary-hover", t.hover);
  root.setProperty("--mx-primary-soft", t.soft);
  root.setProperty("--mx-secondary", t.secondary);
  root.setProperty("--mx-primary-rgb", t.rgb);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.primary);
  return t;
}

// Colores sembrados por el instalador (defaults). Se usan para detectar si una
// tienda nunca personalizó los campos COLOR_* de la hoja DATOS.
export const DEFAULT_PRIMARIO = "#2563EB";
export const DEFAULT_SECUNDARIO = "#4F46E5";

/**
 * Resuelve el tema efectivo con compatibilidad hacia atrás:
 * 1. Si COLOR_PRIMARIO/SECUNDARIO fueron personalizados (distintos de los
 *    sembrados), mandan ellos.
 * 2. Si COLOR_PRESET está seteado (y no es el Azul por defecto), manda el preset.
 * 3. Si los campos nuevos quedaron intactos, busca un preset conocido en la
 *    columna legacy PALETA DE COLORES (ej: "Cian / Oscuro") para no romper
 *    tiendas ya configuradas con el sistema viejo.
 * Devuelve primario/secundario vacíos cuando corresponde usar los colores
 * del preset (applyTheme/resolveTheme los resuelven solos).
 */
export function resolveEffectiveTheme(
  colorPreset: string,
  colorPrimario: string,
  colorSecundario: string,
  paletaLegacy: string
): { preset: string; primario: string; secundario: string } {
  const prim = String(colorPrimario || "").trim();
  const sec = String(colorSecundario || "").trim();
  const presetIn = String(colorPreset || "").trim();

  const primCustom = isHex(prim) && prim.toUpperCase() !== DEFAULT_PRIMARIO;
  const secCustom = isHex(sec) && sec.toUpperCase() !== DEFAULT_SECUNDARIO;
  const presetCustom = presetIn !== "" && presetIn !== "Azul";

  if (primCustom || secCustom) {
    return {
      preset: presetIn || "Azul",
      primario: primCustom ? prim : "",
      secundario: secCustom ? sec : "",
    };
  }
  if (presetCustom) {
    return { preset: presetIn, primario: "", secundario: "" };
  }
  // Fallback legacy: PALETA DE COLORES tipo "Cian / Oscuro"
  const legacy = String(paletaLegacy || "");
  for (const name of Object.keys(COLOR_PRESETS)) {
    if (name !== "Azul" && legacy.includes(name)) {
      return { preset: name, primario: "", secundario: "" };
    }
  }
  return { preset: presetIn || "Azul", primario: "", secundario: "" };
}

/**
 * Genera los overrides CSS que repintan las clases azules hardcodeadas de la
 * tienda con el color primario elegido. Es el reemplazo generalizado del viejo
 * getPaletteCSS(): ahora funciona con CUALQUIER hex (no solo 3 nombres de
 * paleta), por lo que soporta los presets Rosa/Naranja y colores a medida.
 */
export function buildPaletteOverrides(primaryHex: string): string {
  if (!isHex(primaryHex)) return "";
  const [r, g, b] = hexToRgb(primaryHex.trim());
  const darker = (c: number) => Math.max(0, Math.round(c * 0.85));
  const lighter = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.3));
  const primaryRGB = `${r}, ${g}, ${b}`;
  const primaryHoverRGB = `${darker(r)}, ${darker(g)}, ${darker(b)}`;
  const primaryLightRGB = `${lighter(r)}, ${lighter(g)}, ${lighter(b)}`;

  return `
    /* OVERRIDES DE PALETA: ${primaryHex.trim()} */
    .text-blue-400 { color: rgb(${primaryLightRGB}) !important; }
    .text-blue-505 { color: rgb(${primaryRGB}) !important; }
    .text-blue-500 { color: rgb(${primaryRGB}) !important; }
    .text-blue-600 { color: rgb(${primaryHoverRGB}) !important; }
    .bg-blue-600 { background-color: rgb(${primaryHoverRGB}) !important; }
    .bg-blue-500 { background-color: rgb(${primaryRGB}) !important; }
    .bg-blue-600\\/10 { background-color: rgba(${primaryHoverRGB}, 0.1) !important; }
    .bg-blue-600\\/20 { background-color: rgba(${primaryHoverRGB}, 0.2) !important; }
    .bg-blue-500\\/10 { background-color: rgba(${primaryRGB}, 0.1) !important; }
    .bg-blue-500\\/20 { background-color: rgba(${primaryRGB}, 0.2) !important; }
    .border-blue-500\\/10 { border-color: rgba(${primaryRGB}, 0.1) !important; }
    .border-blue-500\\/15 { border-color: rgba(${primaryRGB}, 0.15) !important; }
    .border-blue-500\\/20 { border-color: rgba(${primaryRGB}, 0.2) !important; }
    .border-blue-500\\/25 { border-color: rgba(${primaryRGB}, 0.25) !important; }
    .border-blue-504\\/20 { border-color: rgba(${primaryRGB}, 0.2) !important; }
    .border-blue-500 { border-color: rgb(${primaryRGB}) !important; }
    .focus\\:border-blue-500:focus { border-color: rgb(${primaryRGB}) !important; }
    .accent-blue-500 { accent-color: rgb(${primaryRGB}) !important; }
    .border-t-blue-500 { border-top-color: rgb(${primaryRGB}) !important; }
    .shadow-blue-500\\/25 { --tw-shadow-color: rgba(${primaryRGB}, 0.25) !important; }
    .shadow-blue-500\\/20 { --tw-shadow-color: rgba(${primaryRGB}, 0.2) !important; }
    .hover\\:bg-blue-600:hover { background-color: rgb(${primaryHoverRGB}) !important; }
    .hover\\:text-blue-400:hover { color: rgb(${primaryLightRGB}) !important; }
    .hover\\:border-blue-500\\/25:hover { border-color: rgba(${primaryRGB}, 0.25) !important; }
    .hover\\:bg-blue-600\\/20:hover { background-color: rgba(${primaryHoverRGB}, 0.2) !important; }
  `;
}
