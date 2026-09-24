import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mx_pwa_dismissed";
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  } catch {
    /* noop */
  }
  return false;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function dismissedRecently(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - parseInt(v, 10) < DISMISS_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;
    setIsIos(isIOS());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!dismissedRecently()) {
        const t = setTimeout(() => setVisible(true), 4000);
        return () => clearTimeout(t);
      }
    };
    window.addEventListener("beforeinstallprompt", onPrompt as EventListener);
    // En iOS no hay evento: mostrar guía manual una vez
    if (isIOS() && !dismissedRecently()) {
      const t = setTimeout(() => setVisible(true), 5000);
      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
        clearTimeout(t);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt as EventListener);
  }, []);

  // Mostrar también en desktop si llegó el evento aunque no sea iOS
  useEffect(() => {
    if (deferred && !dismissedRecently() && !isStandalone()) {
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }
  }, [deferred]);

  if (!visible || isStandalone()) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          setVisible(false);
          setDeferred(null);
          return;
        }
      } catch {
        /* noop */
      }
    }
    dismiss();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4 md:justify-end md:pr-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-[#151515] border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-black/60 animate-slide-in-up">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-600/15 text-blue-400 rounded-xl shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white">Instalá la tienda en tu dispositivo</p>
            {isIos && !deferred ? (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed flex items-start gap-1.5">
                <Share className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Tocá Compartir y elegí “Añadir a pantalla de inicio”.</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Acceso directo, pantalla completa y carga más rápida.
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {(!isIos || deferred) && (
                <button
                  onClick={install}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
                >
                  Instalar app
                </button>
              )}
              <button
                onClick={dismiss}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Ahora no
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-slate-500 hover:text-white p-1 cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
