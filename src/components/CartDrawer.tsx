import React, { useState, useEffect, useMemo } from "react";
import { X, Trash2, ShoppingBag, MapPin, Loader, ChevronRight, Calendar, Clock } from "lucide-react";
import { CartItem } from "../types";
import { checkShopStatus, formatPrice, submitToAppsScript } from "../utils";
import { api, isEndpointConfigured } from "../lib/api";
import { formatearFechaES, fechaActualES } from "../lib/fecha";

const getNextDaysOptions = (): string[] => {
  const days: string[] = [];
  const DAYS_OF_WEEK = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayName = DAYS_OF_WEEK[d.getDay()];
    const dateStr = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    
    let label = `${dayName} ${dateStr}`;
    if (i === 1) {
      label = `Mañana (${dayName} ${dateStr})`;
    }
    days.push(label);
  }
  return days;
};

const getDynamicHoursOptions = (horariosString: string): string[] => {
  if (!horariosString) {
    return [
      "09:30 a 11:30 hs",
      "11:30 a 12:30 hs",
      "16:30 a 18:30 hs",
      "18:30 a 19:30 hs"
    ];
  }

  const rangeRegex = /(\d{2}:\d{2})\s*(?:-|a)\s*(\d{2}:\d{2})/g;
  let match;
  const uniqueSlots = new Set<string>();

  while ((match = rangeRegex.exec(horariosString)) !== null) {
    const startStr = match[1];
    const endStr = match[2];

    const parseTimeToMin = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const formatMinToTime = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const startMin = parseTimeToMin(startStr);
    const endMin = parseTimeToMin(endStr);

    const pickerStartMin = startMin + 30;
    const pickerEndMin = endMin - 30;

    let current = pickerStartMin;
    while (current < pickerEndMin) {
      const next = Math.min(current + 120, pickerEndMin);
      if (next > current) {
        uniqueSlots.add(`${formatMinToTime(current)} a ${formatMinToTime(next)} hs`);
      }
      current = next;
    }
  }

  const result = Array.from(uniqueSlots);
  if (result.length === 0) {
    return [
      "09:30 a 11:30 hs",
      "11:30 a 12:30 hs",
      "16:30 a 18:30 hs",
      "18:30 a 19:30 hs"
    ];
  }

  return result.sort();
};

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (pId: string, quantity: number) => void;
  onRemoveItem: (pId: string) => void;
  onClearCart: () => void;
  contactoMinorista?: string;
  backendUrl?: string;
  webSettings?: {
    nombreWeb: string;
    horarios: string;
    direccion: string;
    contactoMinorista: string;
    contactoMayorista: string;
    paletaColores: string;
    estadoCuenta?: string;
  };
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  contactoMinorista,
  backendUrl,
  webSettings,
}: CartDrawerProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Generate date/time options
  const daysOptions = useMemo(() => getNextDaysOptions(), []);
  const hoursOptions = useMemo(() => getDynamicHoursOptions(webSettings?.horarios || ""), [webSettings?.horarios]);

  // Date and hour pickers
  const [deliveryDay, setDeliveryDay] = useState(() => daysOptions[0] || "");
  const [deliveryHour, setDeliveryHour] = useState(() => hoursOptions[0] || "");

  // Sync state if options list updates
  useEffect(() => {
    if (daysOptions.length > 0 && !daysOptions.includes(deliveryDay)) {
      setDeliveryDay(daysOptions[0]);
    }
  }, [daysOptions, deliveryDay]);

  useEffect(() => {
    if (hoursOptions.length > 0 && !hoursOptions.includes(deliveryHour)) {
      setDeliveryHour(hoursOptions[0]);
    }
  }, [hoursOptions, deliveryHour]);

  useEffect(() => {
    if (isOpen) {
      // Push history state to intercept phone back button
      window.history.pushState({ modalId: "cart-drawer" }, "");

      const handlePopState = (event: PopStateEvent) => {
        onClose();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [isOpen, onClose]);

  const handleSafeClose = () => {
    if (window.history.state && window.history.state.modalId === "cart-drawer") {
      window.history.back();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const totalWeight = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (String(webSettings?.estadoCuenta || "SI").toUpperCase() === "NO") {
      alert("Cuenta pausada por falta de pago. Tu web seguirá activa, pero no podrás administrarla ni recibir pedidos.");
      return;
    }
    if (!clientName.trim()) {
      alert("Por favor, ingresá tu nombre completo.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { isOpen: shopIsOpen } = checkShopStatus();
      
      // Header based on store open state
      const orderHeader = shopIsOpen
        ? "🔥 *Pedido para Preparar Ahora*"
        : "📅 *Pedido Programado* (Tu pedido será preparado en nuestros horarios de atención)";

      const orderId = "PED-" + Math.floor(100000 + Math.random() * 900000);
      const dateFormatted = fechaActualES();

      // Submit to Apps Script endpoint seguro primero (fallback legacy GET)
      const prodSummary = cartItems.map(item => `[${item.quantity} uni] ${item.product.name}`).join("\n");
      const orderParams = {
        action: "addOrder",
        id: orderId,
        fecha: dateFormatted,
        cliente: clientName.trim(),
        telefono: clientPhone.trim() || "-",
        productos: prodSummary,
        total: subtotal,
        entrega: `${deliveryDay} - ${deliveryHour}`,
        estado: "PENDIENTE"
      };
      if (isEndpointConfigured()) {
        await api.addOrder(orderParams).catch(err => {
          console.error("Error logging order via endpoint:", err);
        });
      } else if (backendUrl) {
        // We await the submission to ensure Google Sheets receives the data before we leave the page
        await submitToAppsScript(backendUrl, orderParams).catch(err => {
          console.error("Error logging order to sheet:", err);
        });
      }

      // Compile message text for WhatsApp
      let msg = `*🛍️ NUEVO PEDIDO - ${(webSettings?.nombreWeb || "Magxor Engine").toUpperCase()}*\n`;
      msg += `_Formulado desde la plataforma virtual_\n\n`;
      msg += `*Nº de Pedido:* ${orderId}\n`;
      msg += `${orderHeader}\n\n`;
      msg += `*👤 DATOS DEL CLIENTE:*\n`;
      msg += `• *Nombre:* ${clientName.trim()}\n`;
      if (clientPhone.trim()) {
        msg += `• *Teléfono:* ${clientPhone.trim()}\n`;
      }
      msg += `• *Entrega:* Retiro en local\n`;
      msg += `• *Programación:* ${deliveryDay} - ${deliveryHour}\n\n`;
      msg += `*🛒 DETALLE DEL PEDIDO:*\n`;
      
      cartItems.forEach((item) => {
        const itemSub = item.product.price * item.quantity;
        msg += `• [${item.quantity} uni] ${item.product.name} - ${formatPrice(item.product.price)} c/u (Sub: ${formatPrice(itemSub)})\n`;
      });

      msg += `\n*━━━━━━━━━━━━━━━━━━━━━━*\n`;
      msg += `🔥 *TOTAL DE LA COMPRA: ${formatPrice(subtotal)}*\n`;
      msg += `*━━━━━━━━━━━━━━━━━━━━━━*\n\n`;
      msg += `_Páginas web creadas con Magxor Digital._`;

      const encodedText = encodeURIComponent(msg);
      const targetPhone = webSettings?.contactoMayorista || "5493585706343";
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodedText}`;
      
      // Clear cart and close drawer
      onClearCart();
      onClose();

      // Redirect with desktop popup support & mobile fallback
      const newWindow = window.open(whatsappUrl, "_blank");
      if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
        window.location.href = whatsappUrl;
      }
    } catch (err) {
      console.error("Error on checkout:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={handleSafeClose} />

      {/* Drawer wrapper */}
      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-[#0F0F0F] shadow-2xl flex flex-col justify-between animate-slide-in-right border-l border-white/10 h-full text-slate-200">
        {/* Header block */}
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#151515] border border-white/5 text-blue-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                Tu Carrito
              </h2>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {totalWeight} {totalWeight === 1 ? "artículo" : "artículos"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
            id="btn-close-cart"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Products list */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-600 mb-4 animate-pulse">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-white">
                Tu carrito está vacío
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                Explorá el catálogo e incorporá productos para iniciar tu solicitud.
              </p>
              <button
                onClick={handleSafeClose}
                className="mt-6 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                id="btn-cart-empty-action"
              >
                Volver a la Tienda
              </button>
            </div>
          ) : (
            <>
              {/* Reset trigger */}
              <div className="flex justify-between items-center text-xs border-b border-dashed border-white/5 pb-3">
                <span className="font-semibold text-slate-500">¿Querés reiniciar la lista?</span>
                <button
                  onClick={onClearCart}
                  className="text-rose-450 hover:text-rose-405 font-extrabold cursor-pointer flex items-center gap-1 hover:underline text-rose-400 leading-none"
                  id="btn-clear-cart-items"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Vaciar Carrito
                </button>
              </div>

              {/* Items feed */}
              <div className="space-y-3.5">
                {cartItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex gap-3 bg-[#151515] p-3 rounded-2xl border border-white/5 group"
                  >
                    {/* Item Thumb */}
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-14 h-14 rounded-xl object-cover bg-[#0F0F0F] border border-white/5 shrink-0"
                      referrerPolicy="no-referrer"
                    />

                    {/* Item Content info */}
                    <div className="flex-grow overflow-hidden flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                          {item.product.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-medium uppercase font-mono tracking-wider">
                          {item.product.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        {/* Interactive counts */}
                        <div className="flex items-center gap-2 border border-white/10 rounded-lg p-1 bg-[#0F0F0F]">
                          <button
                            onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 font-bold text-[10px] flex items-center justify-center cursor-pointer text-white disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="text-11px font-black w-4 text-center font-mono text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 font-bold text-[10px] flex items-center justify-center cursor-pointer text-white disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>

                        {/* Calculated sum */}
                        <span className="text-xs font-black text-white font-mono">
                          {formatPrice(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>

                    {/* Trash remove trigger */}
                    <button
                      onClick={() => onRemoveItem(item.product.id)}
                      className="text-slate-500 hover:text-rose-450 self-center p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
                      title="Eliminar producto"
                      id={`btn-remove-item-${item.product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Checkout, Shipping Details Form (only visible if products exist) */}
        {cartItems.length > 0 && (
          <form
            onSubmit={handleCheckout}
            className="p-4 border-t border-white/5 bg-[#0A0A0A] space-y-4"
          >
            {/* General client information inputs */}
            <div className="space-y-3.5">
              {/* clientName, with beautiful floating design concept */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="Ej. Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs bg-white/5 text-white rounded-xl border border-white/10 px-3 py-2.5 focus:border-blue-500/50 focus:outline-none transition-colors disabled:opacity-50"
                  id="inp-cart-name"
                />
              </div>

              {/* clientPhone */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Celular de Contacto
                </label>
                <input
                  type="tel"
                  disabled={isSubmitting}
                  placeholder="Ej. 3584123456"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full text-xs bg-white/5 text-white rounded-xl border border-white/10 px-3 py-2.5 focus:border-blue-500/50 focus:outline-none disabled:opacity-50"
                  id="inp-cart-phone"
                />
              </div>

              {/* Schedulers grids */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-blue-500" /> Día de Retiro
                  </label>
                  <select
                    value={deliveryDay}
                    disabled={isSubmitting}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    className="w-full text-xs bg-white/5 text-white rounded-xl border border-white/10 p-2.5 focus:outline-none cursor-pointer disabled:opacity-50"
                    id="sel-delivery-day"
                  >
                    {daysOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#0F0F0F] text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-500" /> Horario de Retiro
                  </label>
                  <select
                    value={deliveryHour}
                    disabled={isSubmitting}
                    onChange={(e) => setDeliveryHour(e.target.value)}
                    className="w-full text-xs bg-white/5 text-white rounded-xl border border-white/10 p-2.5 focus:outline-none cursor-pointer disabled:opacity-50"
                    id="sel-delivery-hour"
                  >
                    {hoursOptions.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#0F0F0F] text-white">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Totals panel */}
            <div className="bg-[#151515] rounded-2xl p-4 border border-white/5 space-y-1.5 shadow-sm transition-all text-slate-300">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal productos</span>
                <span className="font-mono">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Retiro en local</span>
                <span className="text-blue-400 font-bold uppercase text-[10px]">
                  Sin cargo
                </span>
              </div>
              <div className="border-t border-white/5 pt-2.5 flex justify-between items-baseline">
                <span className="text-sm font-extrabold text-white">Total</span>
                <span className="text-xl font-black text-white font-mono">
                  {formatPrice(subtotal)}
                </span>
              </div>
            </div>

            {/* Finish purchase CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#25D366] hover:bg-[#20ba5a] text-black font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed disabled:scale-100"
              id="btn-cart-checkout"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 text-black animate-spin" />
                  Validando y registrando pedido...
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-black" />
                  Finalizar Compra vía WhatsApp
                  <ChevronRight className="w-4 h-4 ml-0.5 text-black" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
