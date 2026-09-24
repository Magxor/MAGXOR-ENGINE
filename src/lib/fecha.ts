// Helpers centrales de fecha en español (DD/MM/YYYY).
// Toda fecha visible en la web debe pasar por aquí.

export function parseOrderDateEs(fechaStr: string): Date {
  if (!fechaStr) return new Date();
  const cleaned = fechaStr.trim();
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    return new Date(
      parseInt(slashMatch[3], 10),
      parseInt(slashMatch[2], 10) - 1,
      parseInt(slashMatch[1], 10),
      slashMatch[4] ? parseInt(slashMatch[4], 10) : 0,
      slashMatch[5] ? parseInt(slashMatch[5], 10) : 0,
      slashMatch[6] ? parseInt(slashMatch[6], 10) : 0
    );
  }
  const dashMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dashMatch) {
    return new Date(
      parseInt(dashMatch[1], 10),
      parseInt(dashMatch[2], 10) - 1,
      parseInt(dashMatch[3], 10),
      dashMatch[4] ? parseInt(dashMatch[4], 10) : 0,
      dashMatch[5] ? parseInt(dashMatch[5], 10) : 0,
      dashMatch[6] ? parseInt(dashMatch[6], 10) : 0
    );
  }
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date();
}

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const fmtFechaHora = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const fmtHora = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

/** "20/09/2026" — acepta Date, DD/MM/YYYY, YYYY-MM-DD o strings de Sheets/JS. */
export function formatearFechaES(v: string | Date | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = v instanceof Date ? v : typeof v === "number" ? new Date(v) : parseOrderDateEs(String(v));
    if (isNaN(d.getTime())) return String(v);
    return fmtFecha.format(d);
  } catch {
    return String(v);
  }
}

/** "20/09/2026 14:30" */
export function formatearFechaHoraES(v: string | Date | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = v instanceof Date ? v : typeof v === "number" ? new Date(v) : parseOrderDateEs(String(v));
    if (isNaN(d.getTime())) return String(v);
    return fmtFechaHora.format(d);
  } catch {
    return String(v);
  }
}

/** "14:30" */
export function formatearHoraES(v: string | Date | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  try {
    const d = v instanceof Date ? v : typeof v === "number" ? new Date(v) : parseOrderDateEs(String(v));
    if (isNaN(d.getTime())) return String(v);
    return fmtHora.format(d);
  } catch {
    return String(v);
  }
}

/** "20/09/2026 14:30" para guardar pedidos en Sheets. */
export function fechaActualES(): string {
  return fmtFechaHora.format(new Date());
}

/** Separa "DD/MM/YYYY HH:MM" en {fecha, hora}. */
export function splitFechaHora(v: string): { fecha: string; hora: string } {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)$/);
  if (m) return { fecha: m[1], hora: (m[2] || "").trim() || "—" };
  const d = parseOrderDateEs(s);
  if (!isNaN(d.getTime())) return { fecha: fmtFecha.format(d), hora: fmtHora.format(d) };
  return { fecha: s || "—", hora: "—" };
}
