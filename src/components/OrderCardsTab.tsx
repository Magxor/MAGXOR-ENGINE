import { useMemo, useState } from "react";
import { Receipt, RefreshCw, Search, Filter, Eye, X, Phone, MessageSquare, Trash2, Minus, Plus, Printer } from "lucide-react";
import { formatPrice } from "../utils";
import { formatearFechaES, parseOrderDateEs, splitFechaHora } from "../lib/fecha";

export interface OrderRow {
  id: string;
  fecha: string;
  cliente: string;
  telefono: string;
  productos: string;
  total: number;
  entrega: string;
  estado: string;
}

export interface EditedItem {
  qty: number;
  name: string;
}

interface Props {
  orders: OrderRow[];
  isLoading: boolean;
  onRefresh: () => void;
  onUpdateStatus: (id: string, estado: string) => void;
  onDelete: (id: string) => void;
  onSaveDetail: (id: string, productos: string, total: number) => Promise<void>;
  canEdit: boolean;
  parseProducts: (s: string) => { qty: number; name: string }[];
  priceOf: (name: string) => number;
}

const ESTADOS = ["PENDIENTE", "CONFIRMADO", "ENTREGADO", "CANCELADO", "ARCHIVADO"] as const;

function estadoColor(e: string): string {
  switch (e) {
    case "PENDIENTE": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "CONFIRMADO": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "ENTREGADO": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "CANCELADO": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  }
}

export default function OrderCardsTab({ orders, isLoading, onRefresh, onUpdateStatus, onDelete, onSaveDetail, canEdit, parseProducts, priceOf }: Props) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [edited, setEdited] = useState<EditedItem[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (term && !(o.id.toLowerCase().includes(term) || o.cliente.toLowerCase().includes(term) || o.telefono.toLowerCase().includes(term) || o.productos.toLowerCase().includes(term))) return false;
      if (status === "all") return o.estado !== "ARCHIVADO";
      return o.estado === status;
    });
  }, [orders, search, status]);

  const detail = detailId ? orders.find((o) => o.id === detailId) || null : null;
  const detailCount = detail ? orders.filter((o) => {
    const d1 = (o.telefono || "").replace(/[^0-9]/g, "");
    const d2 = (detail.telefono || "").replace(/[^0-9]/g, "");
    if (d1.length >= 6 && d1 === d2) return true;
    return o.cliente.trim().toLowerCase() === detail.cliente.trim().toLowerCase();
  }).length : 0;
  const isNew = detailCount <= 1;

  const openDetail = (o: OrderRow) => {
    setDetailId(o.id);
    setEdited(parseProducts(o.productos));
  };

  const editedTotal = useMemo(() => {
    if (!edited) return detail?.total || 0;
    return edited.reduce((s, it) => s + it.qty * priceOf(it.name), 0);
  }, [edited, detail, priceOf]);

  const saveEdited = async () => {
    if (!detail || !edited) return;
    setIsSaving(true);
    try {
      const str = edited.map((it) => `[${it.qty} uni] ${it.name}`).join("\n");
      await onSaveDetail(detail.id, str, editedTotal);
      setEdited(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-400" />
            <span>Gestión de Pedidos</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Administrá las solicitudes generadas por tu checkout.</p>
        </div>
        <button onClick={onRefresh} disabled={isLoading} className="px-3.5 py-2 self-start sm:self-center bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
          <span>Actualizar Pedidos</span>
        </button>
      </div>

      {!isLoading && orders.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pedidos Totales</span>
            <span className="text-lg font-black text-white block mt-0.5">{orders.length}</span>
          </div>
          <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendientes</span>
            <span className="text-lg font-black text-amber-400 block mt-0.5">{orders.filter((o) => o.estado === "PENDIENTE").length}</span>
          </div>
          <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Facturado (Conf/Entr)</span>
            <span className="text-lg font-black text-emerald-400 block mt-0.5">{formatPrice(orders.filter((o) => o.estado === "CONFIRMADO" || o.estado === "ENTREGADO").reduce((s, o) => s + o.total, 0))}</span>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center p-3.5 bg-[#111111]/60 border border-white/5 rounded-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar por ID, nombre o celular..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#151515] border border-white/5 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 focus:outline-none" />
          </div>
          <button onClick={() => setShowFilters((v) => !v)} className="px-4 py-2.5 text-xs font-bold rounded-xl border bg-[#151515] border-white/5 text-slate-400 hover:text-white cursor-pointer flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> {showFilters ? "Ocultar" : "Filtrar por Estado"}
          </button>
          {showFilters && (
            <div className="flex gap-1.5 overflow-x-auto">
              {(["all", ...ESTADOS] as string[]).map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-xs font-bold rounded-xl border cursor-pointer shrink-0 ${status === s ? "bg-blue-600/10 border-blue-500/20 text-blue-400" : "bg-[#151515] border-white/5 text-slate-400"}`}>
                  {s === "all" ? "Activos" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" /> Cargando pedidos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-grow bg-white/[0.02] border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-xs text-slate-400 font-bold">No se encontraron pedidos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((o) => {
            const { fecha, hora } = splitFechaHora(o.fecha || "");
            const isEnvio = String(o.entrega || "").toLowerCase().includes("env");
            const items = parseProducts(o.productos);
            const qty = items.reduce((s, i) => s + i.qty, 0);
            return (
              <div key={o.id} className="bg-[#151515] border border-white/10 rounded-2xl p-4 space-y-3 hover:border-blue-500/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{o.cliente}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{o.telefono}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 ${estadoColor(o.estado)}`}>{o.estado}</span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2">{qty} art. · {items.slice(0, 2).map((i) => `${i.qty}x ${i.name}`).join(", ")}{items.length > 2 ? "…" : ""}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Fecha</span>
                    <span className="text-white font-bold">{formatearFechaES(o.fecha) || fecha}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Hora</span>
                    <span className="text-white font-bold">{hora}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Método</span>
                    <span className="text-white font-bold">{isEnvio ? "Envío" : "Retiro en local"}</span>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Total</span>
                    <span className="text-emerald-400 font-black">{formatPrice(o.total)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDetail(o)} className="flex-1 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/15 text-[11px] font-bold rounded-xl cursor-pointer flex items-center justify-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Ver Pedido
                  </button>
                  {canEdit && (
                    confirmDeleteId === o.id ? (
                      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-2">
                        <button onClick={() => { onDelete(o.id); setConfirmDeleteId(null); }} className="text-[10px] font-black text-red-400 cursor-pointer">SÍ</button>
                        <span className="text-slate-600">/</span>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-black text-slate-400 cursor-pointer">NO</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(o.id)} className="p-2 bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 border border-white/5 rounded-xl cursor-pointer" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Ver Pedido */}
      {detail && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => { setDetailId(null); setEdited(null); }}>
          <div className="bg-[#111111] border border-white/10 rounded-3xl w-full max-w-2xl p-5 md:p-6 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-black text-white font-mono">{detail.id}</h4>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${isNew ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                    {isNew ? "Cliente Nuevo" : "Cliente Recurrente"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{formatearFechaES(detail.fecha)} · {splitFechaHora(detail.fecha).hora} · {String(detail.entrega || "").toLowerCase().includes("env") ? "Envío" : "Retiro en local"}</p>
              </div>
              <button onClick={() => { setDetailId(null); setEdited(null); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-xs space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Datos del cliente</p>
              <p className="text-white font-bold">{detail.cliente}</p>
              <p className="text-slate-300 font-mono flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {detail.telefono}</p>
              <p className="text-slate-300">Forma de entrega: <strong className="text-white">{detail.entrega || "Retiro en local"}</strong></p>
              <a href={`https://wa.me/${detail.telefono.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-black rounded-lg">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Detalle de productos {canEdit && "(editable por falta de stock)"}</p>
                {edited && <span className="text-[11px] font-black text-emerald-400">Nuevo total: {formatPrice(editedTotal)}</span>}
              </div>
              {(edited || []).map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                  <span className="text-xs text-white font-bold flex-1 min-w-0 truncate">{it.name}</span>
                  {canEdit ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setEdited((prev) => prev!.map((p, i) => i === idx ? { ...p, qty: Math.max(1, p.qty - 1) } : p))} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"><Minus className="w-3 h-3 mx-auto" /></button>
                      <span className="text-xs font-black text-white w-5 text-center">{it.qty}</span>
                      <button onClick={() => setEdited((prev) => prev!.map((p, i) => i === idx ? { ...p, qty: p.qty + 1 } : p))} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"><Plus className="w-3 h-3 mx-auto" /></button>
                      <button onClick={() => setEdited((prev) => prev!.filter((_, i) => i !== idx))} className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"><X className="w-3 h-3 mx-auto" /></button>
                    </div>
                  ) : (
                    <span className="text-xs font-black text-white shrink-0">x{it.qty}</span>
                  )}
                </div>
              ))}
              {canEdit && edited && (
                <button onClick={saveEdited} disabled={isSaving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl cursor-pointer">
                  {isSaving ? "Guardando..." : `Guardar cambios (${formatPrice(editedTotal)})`}
                </button>
              )}
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Estado del pedido</p>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map((s) => (
                  <button key={s} disabled={!canEdit} onClick={() => onUpdateStatus(detail.id, s)} className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border cursor-pointer ${detail.estado === s ? estadoColor(s) + " border" : "bg-white/5 border-white/5 text-slate-400"} ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => window.print()} className="mt-4 w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold rounded-xl cursor-pointer flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export para evitar imports circulares en AdminPortal
export function getOrderHour(fecha: string): string {
  try {
    return splitFechaHora(fecha).hora;
  } catch {
    return "—";
  }
}
export function getOrderDate(fecha: string): string {
  try {
    return formatearFechaES(parseOrderDateEs(fecha));
  } catch {
    return fecha;
  }
}
