import { useState, useEffect, useRef } from "react";
import { ShoppingBag, Sun, Moon, Menu, X, Search, Sparkles, Clock } from "lucide-react";
import { checkShopStatus } from "../utils";
import { Product } from "../types";

interface HeaderProps {
  cartItemsCount: number;
  onCartOpen: () => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
  allProducts: Product[];
  onSelectProduct: (p: Product) => void;
  onNavigateToSection: (sectionId: string) => void;
  webSettings?: {
    nombreWeb: string;
    horarios: string;
    direccion: string;
    contactoMinorista: string;
    contactoMayorista: string;
    paletaColores: string;
    anuncioHeader?: string;
    logoUrl?: string;
  };
}

export default function Header({
  cartItemsCount,
  onCartOpen,
  allProducts,
  onSelectProduct,
  onNavigateToSection,
  webSettings,
}: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shopStatus, setShopStatus] = useState(checkShopStatus());
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Update shop status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setShopStatus(checkShopStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll effect on header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle autocomplete search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    const term = searchTerm.toLowerCase();
    const filtered = allProducts
      .filter((p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
      .slice(0, 5);
    setSuggestions(filtered);
  }, [searchTerm, allProducts]);

  // Click outside to collapse suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (product: Product) => {
    onSelectProduct(product);
    setSearchTerm("");
    setIsSearchFocused(false);
  };

  const navLinks = [
    { name: "Catálogo", target: "catalogo" },
    { name: "Liquidación", target: "liquidacion" },
    { name: "Preguntas Frecuentes", target: "preguntas-frecuentes" },
    { name: "Horario y Contacto", target: "horarios-contacto" },
  ];
  return (
    <header className="fixed top-0 left-0 w-full z-45 transition-all duration-300">
      {/* Top Banner de Anuncios */}
      {webSettings?.anuncioHeader && (
        <div className="h-7 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-[10px] md:text-xs font-bold flex items-center justify-center tracking-widest uppercase shadow-inner overflow-hidden">
          <div className="flex justify-center items-center gap-2 animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-center truncate">
              {webSettings.anuncioHeader}
            </span>
          </div>
        </div>
      )}

      {/* Main Header Container */}
      <div
        className={`w-full py-3.5 px-4 md:px-8 flex items-center justify-between transition-all duration-300 bg-[#0F0F0F]/80 backdrop-blur-md border-b border-white/10 ${
          isScrolled ? "shadow-lg shadow-black/40 bg-[#0F0F0F]/95" : ""
        }`}
      >
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => onNavigateToSection("catalogo")}
            className="flex items-center gap-1.5 sm:gap-3 font-display font-bold text-xl cursor-pointer select-none"
            id="btn-logo"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#0F0F0F] rounded-lg flex items-center justify-center shadow-lg shadow-black/40 overflow-hidden border border-white/10 select-none shrink-0">
              <img src={webSettings?.logoUrl || "/logo.png"} alt={`${webSettings?.nombreWeb || "Magxor Engine"} Logo`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-base sm:text-lg font-bold tracking-tighter text-white">
                {webSettings?.nombreWeb || "Magxor Engine"}
              </h1>
              <p className="hidden sm:block text-[9px] text-blue-400 font-medium uppercase tracking-widest leading-none mt-0.5">Precios Competentes</p>
            </div>
          </button>

          {/* Shop Status Badge (desktop) */}
          <div className="hidden border border-white/10 rounded-full px-4 py-1.5 items-center gap-2 md:inline-flex select-none bg-white/5">
            <span className={`relative flex h-2 w-2`}>
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  shopStatus.isOpen ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  shopStatus.isOpen ? "bg-green-500" : "bg-red-500"
                }`}
              ></span>
            </span>
            <span
              className={`text-[11px] font-bold tracking-wide uppercase ${
                shopStatus.isOpen ? "text-green-500" : "text-red-500"
              }`}
            >
              {shopStatus.isOpen ? "ABIERTO AHORA" : "CERRADO"}
            </span>
          </div>
        </div>

        {/* Navigation Links - Desktop */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-400">
          {navLinks.map((link) => (
            <button
              key={link.target}
              onClick={() => onNavigateToSection(link.target)}
              className="hover:text-white transition-colors cursor-pointer relative py-1 group"
              id={`nav-lnk-${link.target}`}
            >
              {link.name}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-500 transition-all group-hover:w-full"></span>
            </button>
          ))}
        </nav>

        {/* Right side controls: Cart, Burger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cart Icon trigger */}
          <button
            onClick={onCartOpen}
            className="relative p-2.5 bg-blue-600 hover:bg-blue-550 text-white rounded-full shadow-lg shadow-blue-500/25 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
            id="btn-cart-trigger"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-blue-600 text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-blue-600 animate-bounce">
                {cartItemsCount}
              </span>
            )}
          </button>

          {/* Mobile menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 lg:hidden border border-white/10 rounded-full text-slate-200 cursor-pointer bg-white/5 hover:bg-white/10"
            id="btn-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation & Search */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-[#0F0F0F] border-b border-white/10 shadow-2xl p-4 flex flex-col gap-4 animate-slide-in-down z-30">
          {/* Shop status (mobile) */}
          <div className="flex border border-white/10 rounded-2xl px-4 py-2.5 items-center justify-between select-none bg-white/5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    shopStatus.isOpen ? "bg-emerald-400" : "bg-red-400"
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    shopStatus.isOpen ? "bg-emerald-500" : "bg-red-500"
                  }`}
                ></span>
              </span>
              <span
                className={`text-xs font-bold tracking-wide uppercase ${
                  shopStatus.isOpen ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {shopStatus.isOpen ? "Abierto" : "Cerrado"}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {shopStatus.text}
            </span>
          </div>

          {/* Mobile links */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
            {navLinks.map((link) => (
              <button
                key={link.target}
                onClick={() => {
                  onNavigateToSection(link.target);
                  setMobileMenuOpen(false);
                }}
                className="text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 p-3 rounded-xl text-left transition-all cursor-pointer"
                id={`nav-lnk-mob-${link.target}`}
              >
                {link.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
