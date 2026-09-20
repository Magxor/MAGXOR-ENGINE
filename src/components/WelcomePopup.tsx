import React, { useState, useEffect } from "react";
import { X, Sparkles, Send, Check } from "lucide-react";

interface WelcomePopupProps {
  onCapturePhone: (phone: string) => void;
  nombreWeb?: string;
}

export default function WelcomePopup({ onCapturePhone, nombreWeb }: WelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [phone, setPhone] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem("mx_welcome_seen");
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      window.history.pushState({ modalId: "welcome-popup" }, "");

      const handlePopState = (event: PopStateEvent) => {
        setIsVisible(false);
        sessionStorage.setItem("mx_welcome_seen", "true");
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [isVisible]);

  const handleClose = () => {
    if (window.history.state && window.history.state.modalId === "welcome-popup") {
      window.history.back();
    } else {
      setIsVisible(false);
      sessionStorage.setItem("mx_welcome_seen", "true");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    onCapturePhone(phone.trim());
    setIsSubmitted(true);
    sessionStorage.setItem("mx_welcome_seen", "true");
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ minHeight: "100dvh" }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Popup layout */}
      <div className="relative bg-[#0F0F0F] border border-white/10 rounded-3xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 md:p-8 shadow-2xl text-center animate-scale-in scrollbar-none">
        {/* Background ambient lighting */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer bg-neutral-900/40 hover:bg-neutral-900/90 border border-white/5 z-20"
          title="Cerrar"
          id="btn-close-welcome"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center pt-2 md:pt-0">
          {/* Badge */}
          <div className="w-11 h-11 bg-gradient-to-tr from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg transform rotate-6 hover:rotate-0 transition-transform mb-3 shrink-0">
            <Sparkles className="w-5.5 h-5.5 animate-pulse" />
          </div>

          <h3 className="text-base md:text-xl font-bold text-white leading-snug px-4">
            ¡Unite al Club {nombreWeb}! 🎮⚡
          </h3>
          <p className="text-xs text-slate-300 mt-2.5 max-w-[320px] px-2 leading-relaxed">
            Unite a nuestro <strong className="text-emerald-400 font-extrabold">Club de WhatsApp</strong> y recibí promociones exclusivas, y notificaciones de ingresos antes que nadie!
          </p>

          {/* Form and CTA Buttons */}
          {!isSubmitted ? (
            <div className="w-full mt-5 space-y-2.5">
              {/* Direct Link to Whatsapp Group */}
              <a
                href="https://chat.whatsapp.com/ElW4j8Bj7r5CzMvZsfGO2R"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  sessionStorage.setItem("mx_welcome_seen", "true");
                }}
                className="w-full py-2.5 px-4 bg-emerald-505 bg-[#10B981] hover:bg-[#059669] text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/20 hover:scale-101 active:scale-99 min-h-[44px]"
                id="btn-welcome-group-join"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.739-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.388 1.983 13.907 1.05 11.997 1.047c-5.43 0-9.851 4.372-9.855 9.802-.001 1.745.485 3.447 1.406 4.966L2.6 21.052l5.047-1.898zm12.181-4.825c-.152-.254-.559-.407-1.168-.711-.609-.304-3.615-1.781-4.173-1.983-.558-.203-.964-.304-1.37.304-.406.609-1.574 1.983-1.929 2.388-.356.406-.711.457-1.32.152-.61-.304-2.573-1.013-4.902-3.193-1.813-1.62-3.037-3.626-3.393-4.234-.355-.609-.038-.938.267-1.24.275-.271.61-.711.914-1.065.304-.355.406-.609.609-1.015.203-.406.102-.761-.051-1.066-.152-.304-1.37-3.302-1.878-4.522-.496-1.196-.999-1.033-1.37-1.053-.356-.019-.761-.023-1.168-.023-.406 0-1.065.152-1.623.761-.558.609-2.132 2.083-2.132 5.08 0 2.997 2.183 5.892 2.487 6.297.304.406 4.296 6.568 10.407 9.206 1.454.628 2.59.1.02 3.528 1.411 2.937 1.413 5.312 1.41 7.218-.003.558-.304 1.015-.914 1.32z"/>
                </svg>
                Unirme al Grupo de WhatsApp
              </a>

              <div className="flex items-center gap-2 py-0.5">
                <div className="h-px bg-white/5 grow" />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">ó por mensaje privado</span>
                <div className="h-px bg-white/5 grow" />
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-2">
                <input
                  type="tel"
                  required
                  placeholder="Ingresá tu WhatsApp (Ej: 3584123456)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs text-center font-semibold bg-white/5 text-white rounded-xl border border-white/10 px-4 py-2.5 focus:outline-none focus:border-emerald-500 min-h-[44px]"
                  id="inp-welcome-phone"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                  id="btn-welcome-submit"
                >
                  Registrarme para Recibir Avisos <Send className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-5 bg-emerald-500/10 text-emerald-400 rounded-2xl p-4 w-full flex flex-col items-center gap-1.5 animate-fade-in border border-emerald-500/15">
              <Check className="w-7 h-7 animate-bounce bg-emerald-500 text-white rounded-full p-1.5 shadow-md shrink-0" />
              <p className="text-xs font-black">¡Registrado con éxito!</p>
              <p className="text-[10px] text-slate-300 leading-normal">Te agregaremos al listado del WhatsApp Club a la brevedad.</p>
            </div>
          )}

          <button
            onClick={handleClose}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-300 mt-4 cursor-pointer hover:underline py-1.5 px-3 min-h-[44px] flex items-center justify-center"
            id="btn-welcome-no-thanks"
          >
            No, gracias. Prefiero ver la tienda
          </button>
        </div>
      </div>
    </div>
  );
}