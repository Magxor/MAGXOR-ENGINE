import { useState, useEffect, useRef } from "react";

interface CounterProps {
  end: number;
  duration?: number;
  suffix?: string;
  label: string;
}

export default function AnimatedCounters({ end, duration = 1500, suffix = "", label }: CounterProps) {
  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.2 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let start = 0;
    const increment = end / (duration / 16); // ~ 60fps
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.ceil(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [hasStarted, end, duration]);

  return (
    <div
      ref={elementRef}
      className="p-6 bg-[#0D0D0D] border border-white/5 rounded-3xl text-center shadow-sm hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] hover:border-blue-500/20 transition-all duration-300"
    >
      <div className="text-2xl md:text-3.5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 font-mono select-none">
        {count.toLocaleString("es-AR")}
        {suffix}
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
        {label}
      </p>
    </div>
  );
}
