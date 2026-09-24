import { useMemo, useState } from "react";
import { Users, Phone, MessageSquare, Eye, X, RefreshCw, Search, Calendar, ShoppingBag } from "lucide-react";
import { formatPrice } from "../utils";
import { formatearFechaES, parseOrderDateEs } from "../lib/fecha";

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

interface Props {
  orders: OrderRow[];
  isLoading: boolean;
  onRefresh: () => void;
}

interface OrderClient {
  key: string;
  nombre: string;
  telefono: string;
  pedidos: OrderRow[];
  compras: number;
  ultimaCompra: string;
  gastado: number;
  entrega: string;
}

function waLink(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${clean}`;
}

export default function OrderClientsCards({ orders, isLoading, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);

  const orderClients: OrderClient[] = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    orders.forEach((o) => {
      const digits = (o.telefono || "").replace(/[^0-9]/g, "");
      const key = digits.length >= 6 ? digits : `nom:${o.cliente.trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return Array.from(map.entries())
      .map(([key, list]) => {
        const sorted = [...list].sort(
          (a, b) => parseOrderDateEs(b.fecha).getTime() - parseOrderDateEs(a.fecha).getTime()
        );
        return {
          key,
          nombre: sorted[0].cliente,
          telefono: sorted[0].telefono,
          pedidos: sorted,
          compras: sorted.length,
          ultimaCompra: sorted[0].fecha,
          gastado: sorted.reduce((s, o) => s + o.total, 0),
          entrega: sorted[0].entrega,
        };
      })
      .sort((a, b) => b.gastado - a.gastado);
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orderClients;
    return orderClients.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        c.telefono.toLowerCase().includes(term) ||
        c.ultimaCompra.toLowerCase().includes(term)
    );
  }, [orderClients, search]);

  const detail = detailKey ? orderClients.find((c) => c.key === detailKey) || null : null;

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Clientes Registrados</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Clientes que realizaron pedidos desde la tienda.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3.5 py-2 self-start sm:self-center bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs rounded-xl hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
          <span>Actualizar Lista</span>
        </button>
      </div>

      {/* Tarjeta total */}
      <div className="bg-[#111111]/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de clientes registrados</span>
          <span className="text-lg font-black text-white block mt-0.5">{orderClients.length}</span>
        </div>
      </div>

      {/* Buscador */}
      {orderClients.length > 0 && (
        <div className="relative w-full md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#151515] border border-white/5 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex-grow flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
          Cargando clientes...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-grow bg-white/[0.02] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-400 font-bold">No se encontraron clientes.</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-sm">
            Los clientes aparecen aquí automáticamente cuando envían su primer pedido.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.key} className="bg-[#151515] border border-white/10 rounded-2xl p-4 space-y-3 hover:border-blue-500/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-sm uppercase shrink-0">
                  {c.nombre.charAt(0) || "C"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-white truncate">{c.nombre}</p>
                  <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {c.telefono}
                  </p>
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${c.compras > 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>
                  {c.compras > 1 ? "Recurrente" : "Nuevo"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Compras</span>
                  <span className="text-sm font-black text-white">{c.compras}</span>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Última</span>
                  <span className="text-[11px] font-black text-white">{formatearFechaES(c.ultimaCompra)}</span>
                </div>
                <div className="bg-white/[0.03] rounded-xl p-2">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Gastado</span>
                  <span className="text-[11px] font-black text-emerald-400">{formatPrice(c.gastado)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDetailKey(c.key)}
                  className="flex-1 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/15 text-[11px] font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver detalles
                </button>
                <a
                  href={waLink(c.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-black rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Contactar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle cliente */}
      {detail && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={() => setDetailKey(null)}>
          <div className="bg-[#111111] border border-white/10 rounded-3xl w-full max-w-lg p-5 md:p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-lg uppercase">
                  {detail.nombre.charAt(0)}
                </div>
                <div>
                  <h4 className="text-base font-black text-white">{detail.nombre}</h4>
                  <p className="text-xs text-slate-400 font-mono">{detail.telefono}</p>
                </div>
              </div>
              <button onClick={() => setDetailKey(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-white/[0.03] rounded-xl p-2.5">
                <ShoppingBag className="w-4 h-4 text-blue-400 mx-auto" />
                <p className="text-base font-black text-white mt-1">{detail.compras}</p>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Cantidad de compras</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2.5">
                <Calendar className="w-4 h-4 text-amber-400 mx-auto" />
                <p className="text-[13px] font-black text-white mt-1">{formatearFechaES(detail.ultimaCompra)}</p>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Última compra</p>
              </div>
              <div className="bg-white/[0.03] rounded-xl p-2.5">
                <p className="text-base font-black text-emerald-400 mt-1">{formatPrice(detail.gastado)}</p>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Monto gastado</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historial de pedidos</p>
              {detail.pedidos.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2.5 text-xs">
                  <div>
                    <p className="font-bold text-white font-mono">{p.id}</p>
                    <p className="text-[10px] text-slate-500">{formatearFechaES(p.fecha)} · {p.entrega}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-white">{formatPrice(p.total)}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{p.estado}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={waLink(detail.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black rounded-xl flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> Contactar directo por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
