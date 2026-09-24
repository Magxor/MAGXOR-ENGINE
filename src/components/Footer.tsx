import { Send, MapPin, Phone, Mail, Sparkles, ExternalLink } from "lucide-react";
import React, { useState } from "react";

interface FooterProps {
  onNavigateToSection: (sectionId: string) => void;
  onSubscribeNewsletter: (phone: string) => void;
  onAdminClick: () => void;
  nombreWeb?: string;
  slogan?: string;
  logoUrl?: string;
  direccion?: string;
  contactoMinorista?: string;
}

export default function Footer({ onNavigateToSection, onSubscribeNewsletter, onAdminClick, nombreWeb, slogan, logoUrl, direccion, contactoMinorista }: FooterProps) {
  const [newsPhone, setNewsPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsPhone.trim()) return;
    onSubscribeNewsletter(newsPhone);
    setNewsPhone("");
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0A0A0A] text-slate-400 pt-16 pb-8 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        {/* Brand Block */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0F0F0F] rounded-lg flex items-center justify-center shadow-lg overflow-hidden border border-white/10 select-none shrink-0">
              <img src={logoUrl || "/logo.png"} alt={`${nombreWeb || "Magxor Engine"} Logo`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <span className="text-white font-extrabold text-lg tracking-tight">
              {nombreWeb || "Magxor Engine"}
            </span>
          </div>
          {slogan && <p className="text-[11px] text-blue-400/90 font-medium uppercase tracking-widest">{slogan}</p>}
          <p className="text-xs leading-relaxed text-slate-500">
            {direccion ? `${direccion}. ` : ""}Tu tienda online de confianza.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full bg-[#151515] border border-white/5 hover:border-blue-500/50 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer text-xs"
              aria-label="Ir a Facebook"
              id="lnk-footer-fb"
            >
              F
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-full bg-[#151515] border border-white/5 hover:border-blue-500/50 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer text-xs"
              aria-label="Ir a Instagram"
              id="lnk-footer-ig"
            >
              I
            </a>
          </div>
        </div>

        {/* Sitemap / Enlaces rápidos */}
        <div className="space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider">Mapa del Sitio</h3>
          <ul className="space-y-2.5 text-xs">
            <li>
              <button
                onClick={() => onNavigateToSection("home")}
                className="hover:text-blue-400 transition-colors cursor-pointer text-left"
                id="btn-footer-sitemap-home"
              >
                Inicio
              </button>
            </li>
            <li>
              <button
                onClick={() => onNavigateToSection("catalogo")}
                className="hover:text-blue-400 transition-colors cursor-pointer text-left"
                id="btn-footer-sitemap-catalog"
              >
                Catálogo de Productos
              </button>
            </li>           
          </ul>
        </div>

        {/* Contact info snippets */}
        <div className="space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider">Contacto</h3>
          <ul className="space-y-3 text-xs text-slate-400">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>{direccion || "Retiro en local a coordinar."}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-blue-500 shrink-0" />
              <span>{contactoMinorista || "WhatsApp en la tienda"}</span>
            </li>
          </ul>
        </div>

        {/* WhatsApp subscription box */}
        <div className="space-y-4">
          <h3 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> WhatsApp Club
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unite y recibí promociones exclusivas, cupones de descuentos semanales y avisos de stock directamente en tu celular.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="tel"
              required
              placeholder="Tu número (Ej. 3584...)"
              value={newsPhone}
              onChange={(e) => setNewsPhone(e.target.value)}
              className="bg-[#151515] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 flex-grow"
              id="inp-footer-newsletter"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer font-bold shrink-0"
              title="Suscribirse"
              id="btn-footer-newsletter-submit"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      </div>

      {/* Under footer */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="space-y-1.5 text-center md:text-left">
          <p>© {currentYear} {nombreWeb || "Magxor Engine"}. Todos los derechos reservados.</p>
          <button
            onClick={onAdminClick}
            className="text-[10px] text-neutral-850 hover:text-neutral-700 font-medium transition-colors cursor-pointer select-none block mx-auto md:mx-0"
            id="btn-footer-admin"
          >
            Panel de control
          </button>
        </div>
        <div className="flex items-center gap-2 bg-[#151515]/50 px-4 py-2 rounded-xl border border-white/5">
          <span>Sitio web creado por <strong>Magxor Digital</strong></span>
          <a
            href="https://magxor.short.gy/magxor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border border-blue-500/10 hover:border-transparent"
            id="btn-footer-magxor-credit"
          >
            Visítanos <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
