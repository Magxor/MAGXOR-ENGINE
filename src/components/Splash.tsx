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
    const ms = Math.min(3000, Math.max(800, duracionMs || 2000));
    const t = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("mx_splash_seen", "1");
    }, ms);
    return () => clearTimeout(t);
  }, [logoAnimadoUrl, activo, duracionMs]);

  if (!visible) return null;
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(logoAnimadoUrl);
  return (
    <div
      onClick={() => {
        setVisible(false);
        sessionStorage.setItem("mx_splash_seen", "1");
      }}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 md:hidden overflow-hidden"
      style={{ background: fondo || "#0A0A0A" }}
    >
      {isVideo ? (
        <video
          src={logoAnimadoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img
          src={logoAnimadoUrl}
          alt={`${nombreWeb} portada`}
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-center">
        <p className="text-white font-bold tracking-tight">{nombreWeb}</p>
      </div>
    </div>
  );
}
