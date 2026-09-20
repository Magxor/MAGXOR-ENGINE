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
