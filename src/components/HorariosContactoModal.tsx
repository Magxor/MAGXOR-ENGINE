import React, { useState, useEffect } from "react";
import { X, Clock, MapPin, Send, Phone, CheckCircle2 } from "lucide-react";
import { checkShopStatus } from "../utils";
import { WORK_HOURS, LOCATIONS } from "../data";
import { motion, AnimatePresence } from "motion/react";

interface HorariosContactoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactoMinorista?: string;
  contactoMayorista?: string;
  direccion?: string;
  horariosText?: string;
  nombreWeb?: string;
}

export default function HorariosContactoModal({ 
  isOpen, 
  onClose,
  contactoMinorista,
  contactoMayorista,
  direccion,
  horariosText,
  nombreWeb,
}: HorariosContactoModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Push history state to intercept phone back button
      window.history.pushState({ modalId: "horarios-contacto-modal" }, "");

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
    if (window.history.state && window.history.state.modalId === "horarios-contacto-modal") {
      window.history.back();
    } else {
      onClose();
    }
  };

  const status = checkShopStatus();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop glass blur overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleSafeClose}
          className="absolute inset-0 bg-[#000000]/80 backdrop-blur-md cursor-pointer pointer-events-auto"
        />

        {/* Modal wrapper card dimensions */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="relative max-w-4xl w-full bg-[#111111] dark:bg-[#111111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-20 flex flex-col max-h-[90vh] md:max-h-[85vh]"
        >
          {/* Top header title line plus X close action button */}
          <div className="p-5 md:p-6 border-b border-white/5 flex items-center justify-between bg-[#151515] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/15 border border-blue-500/15 text-blue-400 rounded-lg shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg md:text-xl text-white">
                  Horarios y Contacto
                </h3>
                <p className="text-[10px] md:text-xs text-slate-400">
                  Ubicación, atención semanal y consultas directas
                </p>
              </div>
            </div>
            <button
              onClick={handleSafeClose}
              className="p-2.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              id="btn-close-horarios-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal scrollable body */}
          <div className="overflow-y-auto p-6 md:p-8 space-y-8 flex-grow">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* LEFT COLUMN: Hours & Location Map */}
              <div className="space-y-6">
                
                {/* Shop hours schedule block */}
                <div className="bg-[#151515]/50 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Cronograma de Horarios
                    </span>
                    
                    {/* Live indicator badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      status.isOpen 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15 animate-pulse" 
                        : "bg-rose-500/10 text-rose-400 border-rose-500/15"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {status.isOpen ? "Abierto Ahora" : "Cerrado"}
                    </span>
                  </div>

                  <div className="divide-y divide-white/5 text-xs text-slate-300 font-semibold">
                    {horariosText ? (
                      <div className="py-2.5 text-slate-300 leading-relaxed font-bold bg-[#0F0F0F] p-4 rounded-xl border border-white/5">
                        {horariosText}
                      </div>
                    ) : (
                      WORK_HOURS.map((wh) => (
                        <div key={wh.day} className="flex justify-between py-2.5">
                          <span className="text-white font-bold">{wh.day}</span>
                          <span className="font-mono text-slate-400">{wh.hours}</span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-400 leading-relaxed bg-[#0F0F0F] p-3 rounded-lg border border-white/5 font-medium">
                    {status.text}
                  </p>
                </div>

                {/* Location address and Google map */}
                <div className="bg-[#151515]/50 border border-white/5 rounded-2xl p-5 space-y-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Dirección Comercial
                  </span>
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-extrabold text-white">
                        {direccion || LOCATIONS[0].address}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {LOCATIONS[0].city}, {LOCATIONS[0].province}, {LOCATIONS[0].country}
                      </p>
                    </div>
                  </div>

                  {/* Open Maps button */}
                  <div className="grid grid-cols-1 gap-2.5 font-bold">
                    <a
                      href={LOCATIONS[0].mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-550 text-white rounded-xl text-xs font-bold transition-all text-center block"
                      id="btn-modal-gmaps"
                    >
                      Abrir en Google Maps
                    </a>
                  </div>

                  {/* Tiny embed iframe */}
                  <div className="h-36 rounded-xl overflow-hidden border border-white/5 relative bg-[#0F0F0F]">
                    <iframe
                      title="Modal Maps"
                      src={LOCATIONS[0].iframeSrc}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: Contact Options */}
              <div className="bg-[#151515]/50 border border-white/5 rounded-2xl p-5 md:p-6 space-y-5">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Contactanos Directamente
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                    Hacé clic en cualquiera de nuestras líneas oficiales para chatear por consultas, asesoramiento o pedidos:
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Minorista Card/Button */}
                  <a
                    href={`https://api.whatsapp.com/send?phone=${contactoMinorista || ""}&text=${encodeURIComponent(`Hola! Me comunico desde la tienda de ${nombreWeb || "Magxor Engine"} para realizar una consulta por compra Minorista.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/35 rounded-2xl transition-all cursor-pointer group hover:scale-[1.01]"
                    id="btn-whatsapp-minorista"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black text-white block">Atención Minorista</span>
                        <span className="text-[10px] text-emerald-450 font-mono">
                          {contactoMinorista ? `+${contactoMinorista}` : "A coordinar"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/10 group-hover:bg-emerald-500/20 transition-all">
                      Chatear
                    </span>
                  </a>

                  {/* Mayorista Card/Button */}
                  <a
                    href={`https://api.whatsapp.com/send?phone=${contactoMayorista || ""}&text=${encodeURIComponent(`Hola! Me comunico desde la tienda de ${nombreWeb || "Magxor Engine"} para realizar una consulta por compra Mayorista.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 hover:border-blue-500/35 rounded-2xl transition-all cursor-pointer group hover:scale-[1.01]"
                    id="btn-whatsapp-mayorista"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black text-white block">Atención Mayorista</span>
                        <span className="text-[10px] text-blue-450 font-mono">
                          {contactoMayorista ? `+${contactoMayorista}` : "+54 9 358 570-6343"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/10 group-hover:bg-blue-500/20 transition-all">
                      Chatear
                    </span>
                  </a>
                </div>

                <div className="p-3 bg-[#0F0F0F] rounded-xl border border-white/5 text-[10px] text-slate-400 leading-relaxed">
                  📌 <strong className="text-slate-300">¿Sos comercio o revendedor?</strong> Tocá el botón de <strong className="text-blue-400 font-bold">Atención Mayorista</strong> para acceder a nuestra lista de precios especiales y condiciones comerciales.
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
