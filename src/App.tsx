import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin,
  Phone,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Sparkles,
  Percent,
  Heart,
  Filter,
  Calendar,
  TrendingUp,
  Compass,
  Database,
  HelpCircle,
  Send,
  MessageSquare,
  BadgeDollarSign
} from "lucide-react";

// Components
import Header from "./components/Header";
import Footer from "./components/Footer";
import ProductCard from "./components/ProductCard";
import ProductDetailModal from "./components/ProductDetailModal";
import CartDrawer from "./components/CartDrawer";
import WelcomePopup from "./components/WelcomePopup";
import AnimatedCounters from "./components/AnimatedCounters";
import SheetsConfigModal from "./components/SheetsConfigModal";
import HorariosContactoModal from "./components/HorariosContactoModal";
import AdminPortal from "./components/AdminPortal";
import Toast, { ToastMessage } from "./components/Toast";

// Data & Helpers
import { REVIEWS, FAQS, LOCATIONS, WORK_HOURS } from "./data";
import { Product, CartItem, ReviewItem } from "./types";
import { checkShopStatus, parseCSV, mapRecordsToProducts, mapRecordsToReviews, submitToAppsScript, formatPrice } from "./utils";
import { api, isEndpointConfigured, type MxConfig } from "./lib/api";
import { applyTheme, resolveEffectiveTheme, resolveTheme, buildPaletteOverrides } from "./lib/theme";
import { applyStoreSeo, applyProductSeo, restoreProductSeo } from "./lib/seo";
import Splash from "./components/Splash";
import InstallPWA from "./components/InstallPWA";
import { formatearFechaES, fechaActualES } from "./lib/fecha";
import { pushModal } from "./lib/modalHistory";

function getGoogleSheetTabUrl(url: string, sheetName: string): string {
  if (!url) return "";
  
  const publishedMatch = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (publishedMatch) {
    const id = publishedMatch[1];
    if (sheetName === "PRODUCTOS" || sheetName === "PRODUCTS") {
      return `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv`;
    }
    return `https://docs.google.com/spreadsheets/d/e/${id}/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`;
  }
  
  const regularMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (regularMatch) {
    const id = regularMatch[1];
    if (id === "e") {
      const matchAfterE = url.match(/\/d\/e\/([a-zA-Z0-9-_]+)/);
      if (matchAfterE) {
        const idAfterE = matchAfterE[1];
        if (sheetName === "PRODUCTOS" || sheetName === "PRODUCTS") {
          return `https://docs.google.com/spreadsheets/d/e/${idAfterE}/pub?output=csv`;
        }
        return `https://docs.google.com/spreadsheets/d/e/${idAfterE}/pub?output=csv&sheet=${encodeURIComponent(sheetName)}`;
      }
    }
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}&headers=1`;
  }
  
  return url;
}

export default function App() {
  // Theme & Layout state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("mx_dark_mode");
    return saved === "true";
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Products & Sheets State
  const [allProducts, setAllProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem("mx_products");
    if (saved) {
      try {
        const parsed: Product[] = JSON.parse(saved);
        return parsed.map((p) => (p.price <= 0 ? { ...p, stock: 0, badge: p.badge === "Últimas unidades" ? "" : p.badge } : p));
      } catch (e) {
        console.error("Error loading cached sheets products", e);
      }
    }
    return [];
  });
  const [sheetsUrl, setSheetsUrl] = useState(() => {
    return localStorage.getItem("mx_sheets_url") || "";
  });
  const [isSheetLoading, setIsSheetLoading] = useState(true);
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);

  const [reviews, setReviews] = useState<ReviewItem[]>(() => {
    const saved = localStorage.getItem("mx_reviews");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading cached reviews", e);
      }
    }
    return REVIEWS;
  });

  const [backendUrl, setBackendUrl] = useState(() => {
    const stored = localStorage.getItem("mx_backend_url");
    const envUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_APPS_SCRIPT_URL || "";
    if (!stored && envUrl) {
      localStorage.setItem("mx_backend_url", envUrl);
      return envUrl;
    }
    return stored || envUrl || "";
  });

  // Selection & Modal States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);
  const [showHorariosContactoModal, setShowHorariosContactoModal] = useState(false);
  const [showAdminPortal, setShowAdminPortal] = useState(() => {
    return localStorage.getItem("mx_admin_logged") === "true";
  });
  const [webSettings, setWebSettings] = useState(() => {
    const saved = localStorage.getItem("mx_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing settings", e);
      }
    }
    return {
      nombreWeb: "Magxor Engine",
      slogan: "",
      horarios: "Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00",
      direccion: "",
      contactoMinorista: "",
      contactoMayorista: "",
      contactoTicket: "",
      paletaColores: "Azul / Oscuro",
      anuncioHeader: "",
      colorPreset: "Azul",
      colorPrimario: "#2563EB",
      colorSecundario: "#4F46E5",
      logoUrl: "",
      faviconUrl: "",
      logoAnimadoUrl: "",
      splashActivo: "NO",
      splashDuracionMs: 2000,
      splashFondo: "#0A0A0A",
      seoTitulo: "Magxor Engine — Tienda online",
      seoDescripcion: "Catálogo online de Magxor Engine.",
      seoKeywords: "tienda online, catálogo, ofertas",
      seoUrlCanonica: "",
      seoRobots: "index, follow",
      estadoCuenta: "SI",
      suspensionImageUrl: "",
      suspensionMensaje: "",
      endpointAppsScript: ""
    };
  });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [showCategoriesBox, setShowCategoriesBox] = useState(false);
  const [showFiltersBox, setShowFiltersBox] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("mx_cart");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading cart", e);
      }
    }
    return [];
  });

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Hero Carousels index state
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const heroSlides = [
    {
      title: "Tu Portal Tecnológico de Confianza",
      subtitle: "Estilo, innovación y vanguardia en un polirubro completo para potenciar tu vida cotidiana.",
      bgImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=80",
      cta: "Ver Catálogo",
      targetSection: "catalogo"
    },
    {
      title: "Soportes 3D y Regalos Exclusivos",
      subtitle: "Piezas de diseño únicas impresas en PLA biodegradable de alta definición. Customizá tu setup.",
      bgImage: "https://images.unsplash.com/photo-1511385348-a52b4a160dc2?w=1600&auto=format&fit=crop&q=80",
      cta: "Ver Regalería",
      targetSection: "catalogo"
    },
    {
      title: "Ofertas de Fin de Temporada",
      subtitle: "Descuentos súper agresivos en auriculares gamer, accesorios para celulares y cargadores rápidos.",
      bgImage: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=1600&auto=format&fit=crop&q=80",
      cta: "Revisar Ofertas",
      targetSection: "ofertas"
    }
  ];

  // Daily Countdown States
  const [dailyMinutes, setDailyMinutes] = useState(0);
  const [dailyHours, setDailyHours] = useState(0);
  const [dailySeconds, setDailySeconds] = useState(0);

  // Season Countdown States (Fin de temporada)
  const [seasonDays, setSeasonDays] = useState(3);
  const [seasonHours, setSeasonHours] = useState(12);
  const [seasonMinutes, setSeasonMinutes] = useState(45);
  const [seasonSeconds, setSeasonSeconds] = useState(50);

  // Filter & Search state
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [priceRange, setPriceRange] = useState(45000);
  const [filterDiscount, setFilterDiscount] = useState(false);
  const [filterStock, setFilterStock] = useState(false);
  const [sortBy, setSortBy] = useState("default");

  // Contact form States
  const [contactName, setContactName] = useState("");
  const [contactMail, setContactMail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const [contactSuccess, setContactSuccess] = useState(false);

  // Floating WhatsApp balloons state
  const [showHelperBubble, setShowHelperBubble] = useState(false);

  // Local clock state for Header state update triggers
  const [, setClockSeconds] = useState(0);

  // --- Theme Toggler ---
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const mode = !prev;
      localStorage.setItem("mx_dark_mode", String(mode));
      return mode;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // --- Realtime clocks & countdowns ---
  useEffect(() => {
    const handleTick = () => {
      const now = new Date();
      setClockSeconds(now.getSeconds());

      // Midnight daily counter
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const mSecs = tomorrow.getTime() - now.getTime();
      const s = Math.floor(mSecs / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3605) / 60);
      const sec = s % 60;

      setDailyHours(h);
      setDailyMinutes(m);
      setDailySeconds(sec);
    };

    handleTick();
    const timer = setInterval(handleTick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fin de temporada season sale countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSeasonSeconds((prev) => {
        if (prev > 0) return prev - 1;
        setSeasonMinutes((prevMin) => {
          if (prevMin > 0) return prevMin - 1;
          setSeasonHours((prevHr) => {
            if (prevHr > 0) return prevHr - 1;
            setSeasonDays((prevDs) => {
              if (prevDs > 0) return prevDs - 1;
              return 0; // Countdown over
            });
            return 23;
          });
          return 59;
        });
        return 59;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Automated Hero Slideshow Control
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // Scroll visibility controls
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Floating helper prompt periodic timer (Every 30 secs, shows for 6 secs)
  useEffect(() => {
    const triggerBubble = () => {
      setShowHelperBubble(true);
      setTimeout(() => {
        setShowHelperBubble(false);
      }, 6000);
    };

    const interval = setInterval(triggerBubble, 30000);
    // Initial trigger
    const initialTimer = setTimeout(triggerBubble, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimer);
    };
  }, []);

  // Load products & reviews: endpoint Apps Script primero, CSV legacy solo como fallback
  useEffect(() => {
    const loadFromEndpoint = async (): Promise<boolean> => {
      if (!isEndpointConfigured() && !backendUrl) return false;
      try {
        const [cfgRes, prodRes, revRes] = await Promise.all([
          api.getConfig().catch(() => null),
          api.getProducts().catch(() => null),
          api.getReviews().catch(() => null),
        ]);
        let ok = false;
        if (cfgRes?.config) {
          const c = cfgRes.config as MxConfig & Record<string, string>;
          const loadedSettings = {
            nombreWeb: String(c.nombreWeb || "Magxor Engine"),
            slogan: String(c.slogan || c.SLOGAN || ""),
            horarios: String(c.horarios || "Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00"),
            direccion: String(c.direccion || ""),
            contactoMinorista: String(c.contactoMinorista || ""),
            contactoMayorista: String(c.contactoMayorista || ""),
            contactoTicket: String(c.contactoTicket || c.contactoMinorista || ""),
            paletaColores: String(c.paletaColores || "Azul / Oscuro"),
            anuncioHeader: String(c.anuncioHeader || ""),
            colorPreset: String(c.colorPreset || "Azul"),
            colorPrimario: String(c.colorPrimario || "#2563EB"),
            colorSecundario: String(c.colorSecundario || "#4F46E5"),
            logoUrl: String(c.logoUrl || ""),
            faviconUrl: String(c.faviconUrl || ""),
            logoAnimadoUrl: String(c.logoAnimadoUrl || ""),
            splashActivo: String(c.splashActivo || "NO"),
            splashDuracionMs: Number(c.splashDuracionMs || 2000),
            splashFondo: String(c.splashFondo || "#0A0A0A"),
            seoTitulo: String(c.seoTitulo || `${c.nombreWeb || "Magxor Engine"} — Tienda online`),
            seoDescripcion: String(c.seoDescripcion || `Catálogo online de ${c.nombreWeb || "Magxor Engine"}.`),
            seoKeywords: String(c.seoKeywords || "tienda online, catálogo, ofertas"),
            seoUrlCanonica: String(c.seoUrlCanonica || ""),
            seoRobots: String(c.seoRobots || "index, follow"),
            estadoCuenta: String(c.estadoCuenta || "SI").toUpperCase(),
            suspensionImageUrl: String(c.suspensionImageUrl || ""),
            suspensionMensaje: String(c.suspensionMensaje || ""),
            endpointAppsScript: backendUrl || "",
          };
          setWebSettings(loadedSettings);
          localStorage.setItem("mx_settings", JSON.stringify(loadedSettings));
          ok = true;
        }
        if (prodRes?.products?.length) {
          const mapped = prodRes.products.map((r, i) => ({
            id: r.id || `mx-prod-${i + 1}`,
            nombre: r.nombre, categoria: r.categoria, descripcion: r.descripcion,
            precio: r.precio, precioOferta: r.precioOferta, disponible: r.disponible,
            oferta: r.oferta, fotos: r.fotos,
          }));
          const parsed = mapRecordsToProducts(mapped as unknown as Record<string, string>[]);
          setAllProducts(parsed);
          localStorage.setItem("mx_products", JSON.stringify(parsed));
          ok = true;
        }
        if (revRes?.reviews?.length) {
          const parsed = revRes.reviews.map((r, i) => ({
            id: `mx-rev-${i + 1}`, productId: r.productId, name: r.name,
            rating: r.rating, comment: r.comment, date: r.date,
          }));
          setReviews((prev) => {
            const local = prev.filter((x) => x.id?.startsWith("local-"));
            const combined = [...parsed, ...local];
            localStorage.setItem("mx_reviews", JSON.stringify(combined));
            return combined;
          });
          ok = true;
        }
        return ok;
      } catch (e) {
        console.warn("Endpoint no disponible, fallback CSV:", e);
        return false;
      }
    };

    if (!sheetsUrl && !isEndpointConfigured() && !backendUrl) {
      setIsSheetLoading(false);
      return;
    }

    const loadSheetData = async () => {
      try {
        // 1. Fetch catalog products (prioritize INVENTARIO, fall back to PRODUCTOS)
        let productsCsvUrl = getGoogleSheetTabUrl(sheetsUrl, "INVENTARIO");
        let resProd = await fetch(productsCsvUrl);
        
        if (!resProd.ok) {
          productsCsvUrl = getGoogleSheetTabUrl(sheetsUrl, "PRODUCTOS");
          resProd = await fetch(productsCsvUrl);
        }

        if (resProd.ok) {
          const csvText = await resProd.text();
          const records = parseCSV(csvText);
          if (records.length > 0) {
            const parsedProducts = mapRecordsToProducts(records);
            if (parsedProducts.length > 0) {
              setAllProducts(parsedProducts);
              localStorage.setItem("mx_products", JSON.stringify(parsedProducts));
            }
          }
        }

        // 2. Fetch reviews
        const reviewsCsvUrl = getGoogleSheetTabUrl(sheetsUrl, "RESEÑAS");
        const resRev = await fetch(reviewsCsvUrl);
        if (resRev.ok) {
          const csvText = await resRev.text();
          const records = parseCSV(csvText);
          if (records.length > 0) {
            const parsedReviews = mapRecordsToReviews(records);
            if (parsedReviews.length > 0) {
              setReviews((prev) => {
                const localReviews = prev.filter((r) => r.id?.startsWith("local-"));
                const combined = [...parsedReviews, ...localReviews];
                localStorage.setItem("mx_reviews", JSON.stringify(combined));
                return combined;
              });
            }
          }
        }

        // 3. Fetch web DATOS configuration
        try {
          const datosCsvUrl = getGoogleSheetTabUrl(sheetsUrl, "DATOS");
          const resDatos = await fetch(datosCsvUrl);
          if (resDatos.ok) {
            const csvText = await resDatos.text();
            const records = parseCSV(csvText);
            if (records.length > 0) {
              const rec = records[0];
              const getField = (keys: string[]): string => {
                for (const k of keys) {
                  const foundKey = Object.keys(rec).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
                  if (foundKey) return rec[foundKey];
                }
                return "";
              };
              const nombreWeb = getField(["nombre web", "nombre_web", "nombre", "web name", "title"]);
              const slogan = getField(["slogan", "lema", "tagline"]);
              const horarios = getField(["horarios", "horario", "hours", "horas", "work hours", "schedules"]);
              const direccion = getField(["dirección", "direccion", "address", "location", "dir"]);
              const contactoMinorista = getField(["contacto minorista", "contacto_minorista", "minorista", "retail contact", "phone minorista"]);
              const contactoMayorista = getField(["contacto mayorista", "contacto_mayorista", "mayorista", "wholesale contact", "phone mayorista"]);
              const contactoTicket = getField(["contacto ticket", "contacto_ticket", "ticket contact", "phone ticket", "telefono ticket"]) || contactoMinorista;
              const paletaColores = getField(["paleta de colores", "paleta_colores", "paleta", "colors", "color palette"]);
              const anuncioHeader = getField(["anuncio header", "anuncio_header", "anuncio", "header announcement", "banner", "banner texto"]) || "";
              const endpointAppsScript = getField(["endpoint apps script", "endpoint_apps_script", "backend url", "backend_url", "apps script", "url apps script", "endpoint", "url_apps_script", "endpoint_apps_script"]);

              const loadedSettings = {
                nombreWeb: nombreWeb || "Magxor Engine",
                slogan: slogan || "",
                horarios: horarios || "Lun/Vie: 09:00-13:00, 16:00-20:00 - Sáb: 09:00-13:00",
                direccion: direccion || "",
                contactoMinorista: contactoMinorista || "",
                contactoMayorista: contactoMayorista || "",
                contactoTicket: contactoTicket || contactoMinorista || "",
                paletaColores: paletaColores || "Azul / Oscuro",
                anuncioHeader: anuncioHeader,
                estadoCuenta: "SI",
                suspensionImageUrl: "",
                suspensionMensaje: "",
                endpointAppsScript: endpointAppsScript || ""
              };

              setWebSettings(loadedSettings);
              localStorage.setItem("mx_settings", JSON.stringify(loadedSettings));

              if (endpointAppsScript && endpointAppsScript.startsWith("https://")) {
                setBackendUrl(endpointAppsScript);
                localStorage.setItem("mx_backend_url", endpointAppsScript);
              }
            }
          }
        } catch (e) {
          console.error("Error auto-loading DATOS tab:", e);
        }
      } catch (err) {
        console.error("Error auto-loading Sheets data on mount:", err);
      } finally {
        setIsSheetLoading(false);
      }
    };

    setIsSheetLoading(true);
    loadFromEndpoint().then((ok) => {
      if (ok) {
        setIsSheetLoading(false);
      } else {
        loadSheetData();
      }
    });
  }, [sheetsUrl]);

  // Check for deep link to product once sheet loaded completely
  useEffect(() => {
    if (!isSheetLoading && allProducts.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get("p");
      if (productId) {
        const prod = allProducts.find(
          (p) => String(p.id).toLowerCase().trim() === productId.toLowerCase().trim()
        );
        if (prod) {
          setSelectedProduct(prod);
          // Gently remove parameter from address bar to avoid keeping it in state forever, but preserving clean routes
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    }
  }, [isSheetLoading, allProducts]);

  // Aplica color dinámico + SEO de tienda cuando cambia la config.
  // resolveEffectiveTheme maneja la compatibilidad con la columna legacy
  // PALETA DE COLORES de tiendas configuradas con el sistema viejo.
  useEffect(() => {
    try {
      const eff = resolveEffectiveTheme(
        String(webSettings.colorPreset || ""),
        String(webSettings.colorPrimario || ""),
        String(webSettings.colorSecundario || ""),
        String(webSettings.paletaColores || "")
      );
      applyTheme(eff.preset, eff.primario, eff.secundario);
    } catch { /* noop */ }
    try {
      const cats: string[] = (allProducts as Product[]).map((p) => String(p.category || "")).filter((c) => c !== "").slice(0, 12);
      applyStoreSeo(webSettings as unknown as MxConfig, cats);
    } catch { /* noop */ }
  }, [webSettings, allProducts]);

  // SEO por producto al abrir/cerrar detalle
  useEffect(() => {
    if (selectedProduct) {
      try {
        applyProductSeo(selectedProduct.name, selectedProduct.image, selectedProduct.price, webSettings as unknown as MxConfig);
      } catch { /* noop */ }
    } else {
      try {
        restoreProductSeo(webSettings as unknown as MxConfig);
      } catch { /* noop */ }
    }
  }, [selectedProduct]);

  // --- Toasts management ---
  const showToast = (text: string, type: "success" | "info" | "error" | "warning" = "success") => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // --- Cart Operations ---
  const handleAddToCart = (product: Product, quantity = 1) => {
    if (!exigirTiendaActiva()) return;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      } else {
        updated = [...prev, { product, quantity }];
      }
      localStorage.setItem("mx_cart", JSON.stringify(updated));
      return updated;
    });
    showToast(`✔ "${product.name}" agregado al carrito.`);
  };

  const handleUpdateQty = (pId: string, quantity: number) => {
    setCartItems((prev) => {
      const updated = prev.map((item) =>
        item.product.id === pId ? { ...item, quantity } : item
      );
      localStorage.setItem("mx_cart", JSON.stringify(updated));
      return updated;
    });
  };

  const handleRemoveItem = (pId: string) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.product.id !== pId);
      localStorage.setItem("mx_cart", JSON.stringify(updated));
      return updated;
    });
    showToast("Producto removido del carrito.", "info");
  };

  const handleClearCart = () => {
    setCartItems([]);
    localStorage.removeItem("mx_cart");
    showToast("Has vaciado el carrito de compras.", "info");
  };

  // --- New Review Submission ---
  const handleAddReview = async (productId: string, name: string, rating: number, comment: string) => {
    if (!exigirTiendaActiva()) return;
    const newReview: ReviewItem = {
      id: `local-rev-${Date.now()}`,
      productId,
      name,
      rating,
      comment,
      date: formatearFechaES(new Date())
    };

    // Keep unique reviews list and save locally
    setReviews((prev) => {
      const updated = [newReview, ...prev];
      localStorage.setItem("mx_reviews", JSON.stringify(updated));
      return updated;
    });

    showToast(`📝 ¡Tu reseña fue publicada con éxito!`, "success");

    // Write via endpoint seguro primero, legacy GET como fallback
    if (isEndpointConfigured()) {
      try {
        await api.addReview({
          productId,
          name,
          rating,
          comment,
          date: formatearFechaES(new Date()),
        });
      } catch (e) {
        console.warn("addReview endpoint falló:", e);
      }
    } else if (backendUrl) {
      const params = {
        action: "addReview",
        productId,
        name,
        rating,
        comment,
        date: formatearFechaES(new Date())
      };
      await submitToAppsScript(backendUrl, params);
    }
  };

  // --- Newsletter Signup ---
  const handleSubscribeNewsletter = async (phone: string) => {
    if (!exigirTiendaActiva()) return;
    showToast(`📱 ¡Número ${phone} adherido al WhatsApp Club!`, "success");

    // Save locally
    const savedPhones = JSON.parse(localStorage.getItem("mx_promo_phones") || "[]");
    if (!savedPhones.includes(phone)) {
      savedPhones.push(phone);
      localStorage.setItem("mx_promo_phones", JSON.stringify(savedPhones));
    }

    // Capture to Sheets via endpoint seguro primero
    if (isEndpointConfigured()) {
      try {
        await api.addClient({
          phone,
          date: formatearFechaES(new Date()),
          metodo: "Club WhatsApp",
          contacto: "NO",
        });
      } catch (e) {
        console.warn("addClient endpoint falló:", e);
      }
    } else if (backendUrl) {
      const params = {
        action: "addClient",
        phone,
        date: formatearFechaES(new Date()),
        metodo: "Club WhatsApp",
        contacto: "NO"
      };
      await submitToAppsScript(backendUrl, params);
    }
  };

  // --- Sheets Sync Trigger ---
  const handleSyncSuccess = (products: Product[], sheetUrl: string, bUrl: string) => {
    setAllProducts(products);
    setSheetsUrl(sheetUrl);
    setBackendUrl(bUrl);
    localStorage.setItem("mx_products", JSON.stringify(products));
    localStorage.setItem("mx_sheets_url", sheetUrl);
    localStorage.setItem("mx_backend_url", bUrl);
    showToast(`🚀 Configuración guardada. ${products.length} productos sincronizados con éxito.`, "success");
  };

  // --- Contact form Submit ---
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exigirTiendaActiva()) return;
    if (!contactName.trim() || !contactMsg.trim()) return;

    // Send WhatsApp query
    let query = `*💬 CONSULTA WEB - ${webSettings.nombreWeb || "Magxor Engine"}*\n\n`;
    query += `• *Nombre:* ${contactName.trim()}\n`;
    if (contactMail.trim()) query += `• *Correo:* ${contactMail.trim()}\n`;
    if (contactPhone.trim()) query += `• *Teléfono:* ${contactPhone.trim()}\n\n`;
    query += `*Su Mensaje:*\n"${contactMsg.trim()}"\n\n`;
    query += `_Agradecemos su interés en el Polirubro de Río Cuarto._`;

    const encoded = encodeURIComponent(query);
    const link = `https://api.whatsapp.com/send?phone=5493584164396&text=${encoded}`;

    setContactSuccess(true);
    setTimeout(() => {
      setContactSuccess(false);
      setContactName("");
      setContactMail("");
      setContactPhone("");
      setContactMsg("");
      window.open(link, "_blank");
    }, 1500);
  };

  // --- Dynamic Category extractor ---
  const categoriesList = useMemo(() => {
    const list = new Set<string>(
      allProducts
        .map((p) => p.category?.trim() || "")
        .filter((c) => c !== "" && c.toLowerCase() !== "todos" && c.toLowerCase() !== "varios")
    );
    
    const sortedCategories = Array.from(list).sort((a: string, b: string) => {
      const isANov = a.toLowerCase().trim() === "novedad" || a.toLowerCase().trim() === "novedades";
      const isBNov = b.toLowerCase().trim() === "novedad" || b.toLowerCase().trim() === "novedades";
      if (isANov && !isBNov) return -1;
      if (!isANov && isBNov) return 1;
      return a.localeCompare(b);
    });

    return ["Todos", ...sortedCategories];
  }, [allProducts]);

  // Max pricing helper
  const maxProductPrice = useMemo(() => {
    if (allProducts.length === 0) return 45000;
    return Math.max(...allProducts.map((p) => p.price));
  }, [allProducts]);

  // Adjust default price range to max
  useEffect(() => {
    setPriceRange(maxProductPrice);
  }, [maxProductPrice]);

  // Reset page when any filter details change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, priceRange, filterDiscount, filterStock, sortBy, catalogSearch, itemsPerPage]);

  const isFirstPageMount = useRef(true);
  useEffect(() => {
    if (isFirstPageMount.current) {
      isFirstPageMount.current = false;
      return;
    }
    const element = document.getElementById("catalogo");
    if (element) {
      const offset = 100; // offset for the sticky header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  }, [currentPage]);

  // --- Combined filter logic ---
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // Category check
    if (selectedCategory !== "Todos") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Max Price check
    list = list.filter((p) => p.price <= priceRange);

    // Discounts Check
    if (filterDiscount) {
      list = list.filter((p) => p.originalPrice !== undefined || p.badge === "Oferta");
    }

    // Availability stock check
    if (filterStock) {
      list = list.filter((p) => p.stock > 0);
    }

    // Search query check
    if (catalogSearch.trim()) {
      const term = catalogSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term)
      );
    }

    // Helper to identify "NOVEDAD" / "novedades" / "NOVEDADES" products
    const isNovedadProduct = (p: Product) => {
      const cat = (p.category || "").toLowerCase().trim();
      return cat === "novedad" || cat === "novedades";
    };

    // Sort evaluations: Novedad/Novedades category products are ALWAYS FIRST
    list.sort((a, b) => {
      const isANov = isNovedadProduct(a);
      const isBNov = isNovedadProduct(b);
      
      if (isANov && !isBNov) return -1;
      if (!isANov && isBNov) return 1;

      // Secondary sorting if both are novedades or neither is
      if (sortBy === "priceAsc") {
        return a.price - b.price;
      } else if (sortBy === "priceDesc") {
        return b.price - a.price;
      } else if (sortBy === "bestSeller") {
        return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
      } else if (sortBy === "newest") {
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      }
      return 0; // maintain relative Google Sheets order
    });

    return list;
  }, [allProducts, selectedCategory, priceRange, filterDiscount, filterStock, sortBy, catalogSearch]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  }, [filteredProducts, itemsPerPage]);

  // Extract specials lists for sliders
  const bestSellersList = useMemo(() => {
    return allProducts.filter((p) => p.isBestSeller && p.stock > 0);
  }, [allProducts]);

  const newsProductsList = useMemo(() => {
    return allProducts.filter((p) => p.isNew && p.stock > 0);
  }, [allProducts]);

  const dealsProductsList = useMemo(() => {
    return allProducts.filter((p) => (p.originalPrice !== undefined || p.badge === "Oferta") && p.stock > 0);
  }, [allProducts]);

  // --- Scroll router navigation helper ---
  const navigateToSection = (sectionId: string) => {
    if (sectionId === "home") {
      // "Inicio" restores all filters and scrolls up to the catalog/top
      setSelectedCategory("Todos");
      setCatalogSearch("");
      setFilterDiscount(false);
      setFilterStock(false);
      const el = document.getElementById("catalogo");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (sectionId === "catalogo") {
      // "Catálogo" scrolls to the catalog and clears liquidación-only filter
      setFilterDiscount(false);
      const el = document.getElementById("catalogo");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (sectionId === "liquidacion") {
      // "Liquidación" scrolls to catalog and applies the discount filter (Formerly "Ofertas")
      setFilterDiscount(true);
      const el = document.getElementById("catalogo");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (sectionId === "horarios-contacto") {
      // Opends Horarios y Contacto modal
      setShowHorariosContactoModal(true);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const estadoCuenta = String((webSettings as Record<string, unknown>).estadoCuenta || "SI").toUpperCase();
  const isSuspended = !isSheetLoading && estadoCuenta === "NO";
  const isAtraso = estadoCuenta === "ATRASO" || estadoCuenta === "ATRASADO";
  // Cuenta pausada: se inhabilitan carrito, consultas, reseñas y newsletter
  const isTiendaBloqueada = estadoCuenta === "NO";

  const exigirTiendaActiva = (): boolean => {
    if (isTiendaBloqueada) {
      showToast("Cuenta pausada por falta de pago. Tu web seguirá activa, pero no podrás administrarla ni recibir pedidos.", "error");
      return false;
    }
    return true;
  };

  // Botón físico atrás cierra el detalle de producto en móvil
  useEffect(() => {
    if (!selectedProduct) return;
    pushModal("product-detail");
    const handler = () => setSelectedProduct(null);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [selectedProduct]);

  // Favicon + título dinámicos desde Datos de la tienda
  useEffect(() => {
    try {
      document.title = String(webSettings.seoTitulo || `${webSettings.nombreWeb || "Magxor Engine"} — Tienda online`);
      const fav = String(webSettings.faviconUrl || webSettings.logoUrl || "/logo.png");
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = fav;
      const apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (apple) apple.href = fav;
    } catch { /* noop */ }
  }, [webSettings.faviconUrl, webSettings.logoUrl, webSettings.seoTitulo, webSettings.nombreWeb]);

  if (isSuspended) {
    const suspImg = String((webSettings as Record<string, unknown>).suspensionImageUrl || "");
    const suspMsg = String((webSettings as Record<string, unknown>).suspensionMensaje || "Tienda suspendida. Contactanos por WhatsApp.");
    return (
      <div className="font-sans min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] text-slate-200 p-6 text-center">
        {suspImg ? (
          <img src={suspImg} alt="Tienda suspendida" className="max-w-md w-full rounded-3xl border border-white/10 mb-6" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-6">⏸</div>
        )}
        <h1 className="text-xl font-bold text-white">{webSettings.nombreWeb || "Magxor Engine"}</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">{suspMsg}</p>
      </div>
    );
  }

  return (
    <div className="font-sans min-h-screen flex flex-col justify-between bg-[#0A0A0A] text-slate-200 transition-colors duration-300">
      {isAtraso && (
        <div className="bg-amber-500 text-black text-xs font-bold text-center px-4 py-2 z-[60] animate-pulse sticky top-0">
          ⚠️ Tu Cuenta Puede ser Pausada por Falta de Pago — regularizá tu cuenta para mantener la tienda activa.
        </div>
      )}
      {/* Dynamic Style Overrides for Color Palette (repinta las clases azules
          hardcodeadas con el color primario efectivo de la tienda) */}
      {(() => {
        try {
          const eff = resolveEffectiveTheme(
            String(webSettings.colorPreset || ""),
            String(webSettings.colorPrimario || ""),
            String(webSettings.colorSecundario || ""),
            String(webSettings.paletaColores || "")
          );
          const t = resolveTheme(eff.preset, eff.primario, eff.secundario);
          const css = buildPaletteOverrides(t.primary);
          if (!css) return null;
          return <style dangerouslySetInnerHTML={{ __html: css }} />;
        } catch {
          return null;
        }
      })()}
      
      {/* Dynamic Popups, Toasts, Header, drawlers */}
      {isSheetLoading && window.location.search.includes("p=") && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <Compass className="w-6 h-6 text-blue-400 absolute animate-pulse" />
            </div>
            <div className="space-y-1.5 mt-2">
              <h3 className="text-base font-bold text-white tracking-tight">Cargando Artículo</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Sincronizando inventario de {webSettings.nombreWeb || "Magxor Engine"} de forma segura...
              </p>
            </div>
          </div>
        </div>
      )}

      <Header
        cartItemsCount={cartItems.reduce((acc, it) => acc + it.quantity, 0)}
        onCartOpen={() => setCartOpen(true)}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        allProducts={allProducts}
        onSelectProduct={(p) => setSelectedProduct(p)}
        onNavigateToSection={navigateToSection}
        webSettings={webSettings}
      />

      <WelcomePopup onCapturePhone={handleSubscribeNewsletter} nombreWeb={webSettings.nombreWeb} />
      <Splash
        logoAnimadoUrl={String(webSettings.logoAnimadoUrl || "")}
        nombreWeb={String(webSettings.nombreWeb || "Magxor Engine")}
        fondo={String(webSettings.splashFondo || "#0A0A0A")}
        duracionMs={Number(webSettings.splashDuracionMs || 2000)}
        activo={String(webSettings.splashActivo || "NO")}
      />
      <Toast toasts={toasts} removeToast={removeToast} />
      <InstallPWA />

      {/* Cart Slider drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        contactoMinorista={webSettings.contactoMinorista}
        backendUrl={backendUrl}
        webSettings={webSettings}
      />


      {/* Individual detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          reviews={reviews}
          onAddReview={handleAddReview}
          nombreWeb={webSettings.nombreWeb}
        />
      )}

      {/* Horarios y contacto Pop Up modal */}
      {showHorariosContactoModal && (
        <HorariosContactoModal
          isOpen={showHorariosContactoModal}
          onClose={() => setShowHorariosContactoModal(false)}
          contactoMinorista={webSettings.contactoMinorista}
          contactoMayorista={webSettings.contactoMayorista}
          direccion={webSettings.direccion}
          horariosText={webSettings.horarios}
          nombreWeb={webSettings.nombreWeb}
        />
      )}

      {/* Main layout sections spacing down */}
      <main className="flex-grow pt-[104px] space-y-20">
        
        {/* SECTION 5: CATALOG COMPLEX INTERFACE AND FILTERS */}
        <section id="catalogo" className="max-w-7xl mx-auto px-6 md:px-8 space-y-8">
          
          {/* Tres botones: Buscar / Categorías / Filtros + Limpiar */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
              <button
                onClick={() => { setShowSearchBox((v) => !v); setShowCategoriesBox(false); setShowFiltersBox(false); }}
                className={`text-xs px-4 py-3 rounded-xl font-bold transition-all cursor-pointer border ${showSearchBox ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-[#0F0F0F] text-slate-300 border-white/10 hover:bg-[#151515] hover:text-white"}`}
                id="btn-toggle-search"
              >
                🔍 Buscar
              </button>
              <button
                onClick={() => { setShowCategoriesBox((v) => !v); setShowSearchBox(false); setShowFiltersBox(false); }}
                className={`text-xs px-4 py-3 rounded-xl font-bold transition-all cursor-pointer border ${showCategoriesBox || selectedCategory !== "Todos" ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-[#0F0F0F] text-slate-300 border-white/10 hover:bg-[#151515] hover:text-white"}`}
                id="btn-toggle-cats"
              >
                🗂 Categorías{selectedCategory !== "Todos" ? `: ${selectedCategory}` : ""}
              </button>
              <button
                onClick={() => { setShowFiltersBox((v) => !v); setShowSearchBox(false); setShowCategoriesBox(false); }}
                className={`text-xs px-4 py-3 rounded-xl font-bold transition-all cursor-pointer border ${showFiltersBox || sortBy !== "default" ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25" : "bg-[#0F0F0F] text-slate-300 border-white/10 hover:bg-[#151515] hover:text-white"}`}
                id="btn-toggle-filters"
              >
                🎛 Filtros
              </button>
              {(catalogSearch || selectedCategory !== "Todos" || sortBy !== "default" || filterDiscount || filterStock) && (
                <button
                  onClick={() => {
                    setSelectedCategory("Todos");
                    setSortBy("default");
                    setCatalogSearch("");
                    setFilterDiscount(false);
                    setFilterStock(false);
                    setShowSearchBox(false);
                    setShowCategoriesBox(false);
                    setShowFiltersBox(false);
                    showToast("Filtros restablecidos.", "info");
                  }}
                  className="col-span-3 sm:col-span-1 text-xs font-bold px-4 py-3 rounded-xl border bg-rose-600/10 text-rose-400 border-rose-500/20 hover:bg-rose-600/20 transition-all cursor-pointer"
                  id="btn-clear-filters"
                >
                  🧹 Limpiar
                </button>
              )}
            </div>

            {showSearchBox && (
              <div className="bg-[#0F0F0F] p-4 rounded-2xl border border-white/10 animate-slide-in-down">
                <div className="relative w-full">
                  <input
                    type="text"
                    autoFocus
                    placeholder="🔍 Buscar productos por nombre o descripción..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full text-xs bg-[#151515] text-white rounded-xl border border-white/10 px-4 py-3 focus:border-blue-500 focus:outline-none placeholder-slate-500 transition-colors font-medium"
                    id="search-catalog-input"
                  />
                  {catalogSearch && (
                    <button
                      onClick={() => setCatalogSearch("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold font-mono cursor-pointer"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
            )}

            {showCategoriesBox && (
              <div className="bg-[#0F0F0F] p-4 rounded-2xl border border-blue-500/25 shadow-xl animate-slide-in-down" role="dialog" aria-label="Categorías">
                <span className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider font-extrabold leading-none mb-3">
                  Seleccionar Categoría
                </span>
                <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setShowCategoriesBox(false); }}
                      className={`text-xs px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer border ${
                        selectedCategory === cat
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/25"
                          : "bg-[#151515] text-slate-300 border-white/10 hover:bg-[#1c1c1c] hover:text-white"
                      }`}
                      id={`btn-cat-sel-${cat}`}
                    >
                      {cat}
                      <span className={`text-[10px] font-mono font-bold whitespace-nowrap px-2 py-0.5 rounded-full ml-2 ${
                        selectedCategory === cat ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"
                      }`}>
                        {cat === "Todos" ? allProducts.length : allProducts.filter((p) => p.category === cat).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showFiltersBox && (
              <div className="bg-[#0F0F0F] p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row gap-4 items-stretch md:items-center animate-slide-in-down">
                <div className="flex items-center gap-2 bg-[#151515] px-3.5 py-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Orden:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none cursor-pointer font-bold focus:ring-0"
                    id="sel-sort-catalog"
                  >
                    <option value="default" className="bg-[#111111] text-white">Por defecto</option>
                    <option value="priceAsc" className="bg-[#111111] text-white">Menor precio</option>
                    <option value="priceDesc" className="bg-[#111111] text-white">Mayor precio</option>
                    <option value="bestSeller" className="bg-[#111111] text-white">Más vendidos</option>
                    <option value="newest" className="bg-[#111111] text-white">Novedades</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-[#151515] px-3.5 py-2.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ver por pág:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-transparent text-xs text-white outline-none cursor-pointer font-bold focus:ring-0"
                    id="items-per-page-select"
                  >
                    <option value={20} className="bg-[#111111] text-white">20 art.</option>
                    <option value={50} className="bg-[#111111] text-white">50 art.</option>
                    <option value={100} className="bg-[#111111] text-white">100 art.</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Right Products feed block containing the list */}
          <div className="space-y-5">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Se encontraron {filteredProducts.length} productos coincidentes</span>
              {filteredProducts.length > itemsPerPage && (
                <span>Visualizando página {currentPage} de {totalPages}</span>
              )}
            </div>

            {/* Products Feed Responsive Grid */}
            {filteredProducts.length === 0 ? (
              <div className="bg-[#0F0F0F] rounded-3xl p-12 text-center border border-white/5">
                <p className="text-sm font-bold text-white">
                  No se encontraron productos coincidentes
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Probá restableciendo los filtros de categoría, precio o borrando tu campo de búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {paginatedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onAddToCart={handleAddToCart}
                    onViewDetail={(item) => setSelectedProduct(item)}
                  />
                ))}
              </div>
            )}

{/* Dynamic Pagination Controls */}
{totalPages > 1 && (() => {
  const delta = 1;
  const pages: (number | "...")[] = [];
  const left = currentPage - delta;
  const right = currentPage + delta;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      pages.push(i);
    } else if (i === left - 1 || i === right + 1) {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        disabled={currentPage === 1}
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-white/10 bg-[#151515] disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5 text-white cursor-pointer transition-colors"
      >
        ‹
      </button>

      <div className="flex gap-1.5 items-center">
        {pages.map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="text-slate-500 text-xs px-1">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                currentPage === page
                  ? "bg-blue-600 border-blue-500 text-white shadow-md"
                  : "bg-[#151515] border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        disabled={currentPage === totalPages}
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        className="px-3.5 py-2 rounded-xl text-xs font-bold border border-white/10 bg-[#151515] disabled:opacity-45 disabled:cursor-not-allowed hover:bg-white/5 text-white cursor-pointer transition-colors"
      >
        ›
      </button>
    </div>
  );
})()}
          </div>
        </section>

        {/* SECTION 8: REVIEWS CAROUSEL */}
        <section className="max-w-7xl mx-auto px-6 md:px-8 space-y-6">
          <div className="text-center">
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest font-black block">
              Comentarios de Clientes
            </span>
            <h2 className="font-display font-bold text-2xl md:text-3.5xl text-white mt-1">
              Google Reviews ★★★★★
            </h2>
          </div>

          {/* Reviews flex grids container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {reviews.slice(0, 8).map((r, i) => {
              // Dynamically associate a review with a product
              const getReviewProduct = () => {
                if (allProducts.length === 0) return null;
                if (r.productId) {
                  const found = allProducts.find(
                    (p) => String(p.id).toLowerCase().trim() === String(r.productId).toLowerCase().trim()
                  );
                  if (found) return found;
                }
                const lowerComment = r.comment.toLowerCase();
                if (lowerComment.includes("mouse")) {
                  const found = allProducts.find(p => p.name.toLowerCase().includes("mouse"));
                  if (found) return found;
                }
                if (lowerComment.includes("lámpara") || lowerComment.includes("lampara") || lowerComment.includes("luz")) {
                  const found = allProducts.find(p => p.name.toLowerCase().includes("lámpara") || p.name.toLowerCase().includes("lampara") || p.name.toLowerCase().includes("luz"));
                  if (found) return found;
                }
                if (lowerComment.includes("auricular") || lowerComment.includes("auric") || lowerComment.includes("audio")) {
                  const found = allProducts.find(p => p.name.toLowerCase().includes("auric") || p.name.toLowerCase().includes("audio") || p.name.toLowerCase().includes("parlante"));
                  if (found) return found;
                }
                if (lowerComment.includes("soporte") || lowerComment.includes("3d")) {
                  const found = allProducts.find(p => p.name.toLowerCase().includes("soporte") || p.name.toLowerCase().includes("3d") || p.category.toLowerCase().includes("3d"));
                  if (found) return found;
                }
                // Index-based fallback to always display a beautiful relevant product
                return allProducts[i % allProducts.length] || allProducts[0];
              };

              const matchedProduct = getReviewProduct();

              return (
                <div
                  key={i}
                  className="bg-[#0F0F0F] border border-white/10 p-5 rounded-3xl flex flex-col justify-between shadow-sm hover:shadow transition-all relative overflow-hidden text-xs"
                >
                  <div className="space-y-3.5">
                    {/* Tiny Product Preview Header */}
                    {matchedProduct && (
                      <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
                        <img
                          src={matchedProduct.image}
                          alt={matchedProduct.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-cover rounded-xl border border-white/5 shrink-0 bg-white/5 animate-fade-in"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-300 font-extrabold block truncate">
                            {matchedProduct.name}
                          </span>
                          <span className="text-[9px] text-blue-400 font-mono font-bold block mt-0.5">
                            {formatPrice(matchedProduct.price)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Google review style five stars */}
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, st) => (
                        <Star
                          key={st}
                          className={`w-3.5 h-3.5 ${
                            st < r.rating ? "fill-amber-400 text-amber-400" : "text-white/10"
                          }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed italic pr-1">
                      "{r.comment}"
                    </p>
                  </div>

                  <div className="border-t border-white/5 pt-3.5 mt-5 space-y-3.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-white truncate max-w-[130px]">{r.name}</span>
                      <span className="text-slate-500 font-medium shrink-0">{formatearFechaES(r.date)}</span>
                    </div>

                    {matchedProduct && (
                      <button
                        onClick={() => setSelectedProduct(matchedProduct)}
                        className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 border border-blue-500/15 hover:border-blue-500/25 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center active:scale-98"
                      >
                        Ver Producto
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 11: FAQS ACCORDIONS COMPONENT */}
        <section id="preguntas-frecuentes" className="max-w-4xl mx-auto px-6 md:px-8 space-y-6">
          <div className="text-center">
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest font-black block">
              Dudas Comunes
            </span>
            <h2 className="font-display font-bold text-2xl md:text-3.5xl text-white mt-1">
              Preguntas Frecuentes
            </h2>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((faq, i) => {
              const isOpen = faqOpenIndex === i;
              return (
                <div
                  key={i}
                  className="bg-[#0F0F0F] rounded-2xl border border-white/10 shadow-sm overflow-hidden"
                >
                  <button
                    onClick={() => setFaqOpenIndex(isOpen ? null : i)}
                    className="w-full p-4 md:p-5 flex justify-between items-center text-left font-bold text-xs md:text-sm text-white cursor-pointer hover:bg-white/5"
                    id={`btn-faq-accordion-${i}`}
                  >
                    <span>{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-blue-400 shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-4" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 md:px-5 pb-5 pt-1 text-xs text-slate-300 leading-relaxed border-t border-white/5 bg-[#151515]/30">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* FOOTER SECTION COMPONENT */}
      <Footer 
        onNavigateToSection={navigateToSection} 
        onSubscribeNewsletter={handleSubscribeNewsletter} 
        onAdminClick={() => setShowAdminPortal(true)}
        nombreWeb={webSettings.nombreWeb}
        slogan={webSettings.slogan}
        logoUrl={webSettings.logoUrl}
        direccion={webSettings.direccion}
        contactoMinorista={webSettings.contactoMinorista}
      />

      {showAdminPortal && (
        <AdminPortal
          isOpen={showAdminPortal}
          onClose={() => setShowAdminPortal(false)}
          sheetsUrl={sheetsUrl}
          backendUrl={backendUrl}
          onUpdateConnection={(sheetUrl, bUrl) => {
            setSheetsUrl(sheetUrl);
            setBackendUrl(bUrl);
            localStorage.setItem("mx_sheets_url", sheetUrl);
            localStorage.setItem("mx_backend_url", bUrl);
          }}
          allProducts={allProducts}
          onUpdateProducts={(prods) => {
            setAllProducts(prods);
            localStorage.setItem("mx_products", JSON.stringify(prods));
          }}
          webSettings={webSettings}
          onupdateConfig={(settings) => {
            setWebSettings(settings);
            localStorage.setItem("mx_settings", JSON.stringify(settings));
          }}
          showToast={showToast}
        />
      )}

      {/* FLOAT ACTION BUTTONS: VOLVER ARRIBA */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-5 z-30 p-3 bg-[#151515] border border-white/10 text-white rounded-full shadow-2xl hover:bg-blue-600 hover:text-white cursor-pointer transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center animate-bounce animate-duration-1000"
          title="Subir al inicio"
          id="btn-scroll-top-float"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Light placeholder icons for inline elements
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
