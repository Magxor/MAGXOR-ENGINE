import { useEffect, useState } from "react";

interface SplashProps {
  logoAnimadoUrl: string;
  nombreWeb: string;
  fondo: string;
  duracionMs: number;
  activo: string;
}

export default function Splash({ logoAnimadoUrl, nombreWeb, fondo, duracionMs, activo }: SplashProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ((activo || "").toUpperCase() !== "SI" || !logoAnimadoUrl) return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    if (sessionStorage.getItem("mx_splash_seen")) return;
    setVisible(true);
    const ms = Math.min(4000, Math.max(800, duracionMs || 2000));
    const t = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("mx_splash_seen", "1");
    }, ms);
    return () => clearTimeout(t);
  }, [logoAnimadoUrl, activo, duracionMs]);

  if (!visible) return null;
  return (
    <div
      onClick={() => {
        setVisible(false);
        sessionStorage.setItem("mx_splash_seen", "1");
      }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 md:hidden"
      style={{ background: fondo || "#0A0A0A" }}
    >
      <img
        src={logoAnimadoUrl}
        alt={`${nombreWeb} logo animado`}
        className="w-36 h-36 object-contain"
        referrerPolicy="no-referrer"
      />
      <p className="text-white font-bold tracking-tight">{nombreWeb}</p>
    </div>
  );
}
