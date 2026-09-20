import React, { useState } from "react";
import { Eye, ShoppingCart, AlertCircle, Sparkles } from "lucide-react";
import { Product } from "../types";
import { formatPrice } from "../utils";

interface ProductCardProps {
  product: Product;
  onAddToCart: (p: Product) => void;
  onViewDetail: (p: Product) => void;
  key?: string;
}

export default function ProductCard({ product, onAddToCart, onViewDetail }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [addAnim, setAddAnim] = useState(false);

  // Check discount percentage
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    if (product.stock === 0) return;
    setAddAnim(true);
    onAddToCart(product);
    setTimeout(() => {
      setAddAnim(false);
    }, 1200);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("svg")) {
      return;
    }
    onViewDetail(product);
  };

  return (
    <div
      className="group relative bg-[#151515] rounded-2xl border border-white/5 hover:border-blue-500/30 shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Product Image Stage */}
      <div className="relative aspect-square w-full bg-[#0A0A0A] overflow-hidden">
        {/* Badges container */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 pointer-events-none">
          {product.badge === "Oferta" && (
            <span className="bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md animate-pulse">
              Liquidación -{discountPercent}%
            </span>
          )}
          {product.badge === "Nuevo" && (
            <span className="bg-blue-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              Nuevo
            </span>
          )}
          {product.badge === "Últimas unidades" && (
            <span className="bg-amber-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              ¡Últimos!
            </span>
          )}
          {product.stock === 0 && (
            <span className="bg-neutral-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
              Agotado
            </span>
          )}
        </div>

        {/* Hover quick action panel */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 flex items-center justify-center gap-3">
          <button
            onClick={() => onViewDetail(product)}
            className="p-3 bg-[#151515] hover:bg-blue-600 text-slate-200 hover:text-white rounded-full transition-all border border-white/10 hover:border-blue-500 shadow-xl hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center"
            title="Ver Detalles"
            id={`btn-view-${product.id}`}
          >
            <Eye className="w-4.5 h-4.5" />
          </button>
          
          {product.stock > 0 && (
            <button
              onClick={handleAddToCart}
              className={`p-3 bg-[#151515] hover:bg-blue-600 text-slate-200 hover:text-white rounded-full transition-all border border-white/10 hover:border-blue-500 shadow-xl hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center ${
                addAnim ? "bg-blue-600 text-white scale-110 rotate-12" : ""
              }`}
              title="Añadir al Carrito"
              id={`btn-add-quick-${product.id}`}
            >
              <ShoppingCart className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

        {/* Secondary image flip effect */}
        <img
          src={isHovered && product.secondaryImage ? product.secondaryImage : (product.image || "https://placehold.co/450?text=Sin+Imagen")}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-700 ${
            isHovered ? "scale-105" : "scale-100"
          }`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/450?text=Error+en+Imagen";
          }}
        />
      </div>

      {/* Info Card Body */}
      <div className="p-4 flex flex-col flex-grow justify-between">
        <div>
          {/* Category */}
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1">
            {product.category}
          </span>
          {/* Product Name */}
          <h3 className="text-sm font-bold text-slate-200 line-clamp-2 leading-tight min-h-[36px] hover:text-blue-400 cursor-pointer mb-2 transition-colors duration-200" onClick={() => onViewDetail(product)}>
            {product.name}
          </h3>
        </div>

        <div>
          {/* Stock state details */}
          <div className="mb-3 select-none">
            {product.stock === 0 ? (
              <span className="text-[11px] font-bold text-rose-500 flex items-center gap-1.5 bg-rose-500/10 px-2 my-1.5 py-0.5 rounded-lg w-max">
                <AlertCircle className="w-3 h-3" />
                Sin stock disponible
              </span>
            ) : product.stock <= 3 ? (
              <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1.5 bg-amber-500/10 px-2 my-1.5 py-0.5 rounded-lg w-max animate-pulse">
                <Sparkles className="w-3 h-3" />
                ¡Últimas {product.stock} unidades!
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-slate-500 block py-0.5">
                Producto Disponible
              </span>
            )}
          </div>

          {/* Pricing Row */}
          <div className="flex items-baseline gap-2.5 mb-3.5">
            <span className="text-lg font-black text-blue-405 font-mono">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && (
              <span className="text-xs font-semibold text-slate-500 line-through font-mono">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Direct add button with fly-cart animation or success checkbox */}
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              product.stock === 0
                ? "bg-neural-800 text-neutral-500 border-transparent cursor-not-allowed"
                : addAnim
                ? "bg-emerald-600 text-white border-transparent shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "bg-white/5 hover:bg-blue-600 text-slate-200 hover:text-white border-white/5 hover:border-blue-500/50"
            }`}
            id={`btn-add-cart-${product.id}`}
          >
            <ShoppingCart className={`w-3.5 h-3.5 ${addAnim ? "animate-bounce" : ""}`} />
            {product.stock === 0 ? "Sin Stock" : addAnim ? "✔ ¡Agregado!" : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}
