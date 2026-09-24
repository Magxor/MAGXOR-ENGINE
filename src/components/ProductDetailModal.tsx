import React, { useState, useEffect } from "react";
import { X, ShoppingCart, Info, Check, ShieldCheck, Sparkles, Star, MessageSquare, Send, Download } from "lucide-react";
import { Product, ReviewItem } from "../types";
import { formatPrice } from "../utils";
import { formatearFechaES } from "../lib/fecha";

interface ProductDetailProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (p: Product, quantity: number) => void;
  reviews: ReviewItem[];
  onAddReview: (productId: string, name: string, rating: number, comment: string) => void;
  nombreWeb?: string;
  // true con la cuenta suspendida: oculta las vías de contacto (WhatsApp)
  bloqueada?: boolean;
}

export default function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
  reviews = [],
  onAddReview,
  nombreWeb = "Magxor Engine",
  bloqueada = false
}: ProductDetailProps) {
  const [activeImage, setActiveImage] = useState(product.image || "https://placehold.co/450?text=Sin+Imagen");
  const [quantity, setQuantity] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadImage = async (url: string, filename: string) => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(url, { referrerPolicy: "no-referrer" });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || "imagen-articulo.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback if CORS prevents blob fetch
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = filename || "imagen-articulo.jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsDownloading(false);
    }
  };

  // Form states for leaving a review
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  useEffect(() => {
    // Push history state to intercept phone back button
    window.history.pushState({ modalId: `product-detail-${product.id}` }, "");

    const handlePopState = (event: PopStateEvent) => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [product.id, onClose]);

  const handleSafeClose = () => {
    if (window.history.state && window.history.state.modalId === `product-detail-${product.id}`) {
      window.history.back();
    } else {
      onClose();
    }
  };

  const handleShareWhatsApp = () => {
    const titleSlug = encodeURIComponent(
      product.name
        .toLowerCase()
        .trim()
        .replace(/[^a-zñáéíóúü0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
    const productUrl = `${window.location.origin}${window.location.pathname}?p=${product.id}&title=${titleSlug}`;
    const text = `¡Hola! Mirá este artículo en ${nombreWeb}: *${product.name}*\n\n💵 Precio: ${formatPrice(product.price)}\n📝 Categoría: ${product.category}\n\nPodés ver más detalles y comprarlo acá:\n🔗 ${productUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopyLink = () => {
    const titleSlug = encodeURIComponent(
      product.name
        .toLowerCase()
        .trim()
        .replace(/[^a-zñáéíóúü0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
    const productUrl = `${window.location.origin}${window.location.pathname}?p=${product.id}&title=${titleSlug}`;
    navigator.clipboard.writeText(productUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const images = [product.image];
  if (product.secondaryImage) {
    images.push(product.secondaryImage);
  }

  const handleQtyChange = (val: number) => {
    if (val < 1 || val > product.stock) return;
    setQuantity(val);
  };

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      handleSafeClose();
    }, 1200);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    onAddReview(product.id, reviewName.trim(), reviewRating, reviewComment.trim());
    setReviewSubmitSuccess(true);
    setReviewName("");
    setReviewComment("");
    setReviewRating(5);

    setTimeout(() => {
      setReviewSubmitSuccess(false);
    }, 3000);
  };

  // Filter existing reviews for this specific product
  const productReviews = reviews.filter((r) => r.productId === product.id);

  // Calculate average rating
  const avgRating =
    productReviews.length > 0
      ? Number((productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1))
      : 5;

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleSafeClose}
      />

      {/* Modal element */}
      <div className="relative bg-[#0F0F0F] w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col animate-scale-in max-h-[92vh] overflow-y-auto text-slate-200">
        
        {/* Close Button top-right */}
        <button
          onClick={handleSafeClose}
          className="absolute top-4 right-4 z-20 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full cursor-pointer shadow-sm transition-colors"
          title="Cerrar modal"
          id="btn-close-detail"
        >
          <X className="w-4 h-4" />
        </button>

        {/* TOP SECTION: Gallery & Info columns */}
        <div className="flex flex-col md:flex-row w-full border-b border-white/5">
          {/* Gallery Column (Left) */}
          <div className="w-full md:w-1/2 p-4 md:p-6 flex flex-col gap-3.5 bg-[#080808] md:border-r border-white/5 justify-center">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#0F0F0F] shadow-sm border border-white/5 flex items-center justify-center">
              {product.badge === "Oferta" && (
                <span className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider z-10 shadow-md">
                  Liquidación -{discountPercent}%
                </span>
              )}
              <img
                src={activeImage}
                alt={product.name}
                className="max-h-full max-w-full object-contain transition-transform duration-500 hover:scale-105"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = "https://placehold.co/450?text=Error+en+Imagen";
                }}
              />
            </div>

            {/* Multiple Image Gallery Thumbs */}
            {images.length > 1 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer bg-[#0F0F0F] transition-all shadow-sm ${
                      activeImage === img ? "border-blue-500 scale-102" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img 
                      src={img} 
                      alt={`${product.name} preview ${i+1}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/150?text=Error";
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Download Image Button */}
            <button
              type="button"
              onClick={() => downloadImage(activeImage, `${product.name.replace(/\s+/g, "-").toLowerCase()}.jpg`)}
              className="mt-1 py-2 px-4 bg-white/5 hover:bg-white/10 active:scale-98 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer self-stretch text-center select-none"
              title="Descargar imagen del producto"
            >
              <Download className={`w-4 h-4 text-blue-400 ${isDownloading ? "animate-bounce" : ""}`} />
              <span>{isDownloading ? "Descargando..." : "Descargar Imagen"}</span>
            </button>
          </div>

          {/* Info Column (Right) */}
          <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
            <div>
              {/* Category tag */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-blue-400 uppercase tracking-widest font-bold">
                  {product.category}
                </span>
                
                {/* Visual stars summary header */}
                <div className="flex items-center gap-1">
                  <div className="flex items-center text-amber-450 gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 font-mono">
                    ({productReviews.length || 0})
                  </span>
                </div>
              </div>

              {/* Product Title */}
              <h2 className="text-lg md:text-xl font-bold text-white mt-1.5 leading-snug">
                {product.name}
              </h2>

              {/* Pricing Details */}
              <div className="flex items-baseline gap-3 my-4">
                <span className="text-2xl font-black text-white font-mono">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-base font-semibold text-slate-500 line-through font-mono">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>

              {/* Product Detailed Description */}
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Descripción del Producto
              </h4>
              <p className="text-xs leading-relaxed text-slate-300 mb-4 bg-white/5 p-3 rounded-2xl border border-white/5">
                {product.description}
              </p>

              {/* Technical Highlights / Commitments */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Garantía escrita y soporte directo post-venta por Dani.</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>Retiro sin cargo por San Lorenzo 1063.</span>
                </div>
              </div>

              {/* Share Actions Segment */}
              <div className="pt-3.5 border-t border-white/5 flex flex-wrap items-center gap-2.5 mb-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Compartir:
                </span>
                
                {!bloqueada && (
                <button
                  onClick={handleShareWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/20 hover:bg-emerald-600/25 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer hover:scale-103 active:scale-97"
                  title="Compartir por WhatsApp"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.739-1.453L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.388 1.983 13.907 1.05 11.997 1.047c-5.43 0-9.851 4.372-9.855 9.802-.001 1.745.485 3.447 1.406 4.966L2.6 21.052l5.047-1.898zm12.181-4.825c-.152-.254-.559-.407-1.168-.711-.609-.304-3.615-1.781-4.173-1.983-.558-.203-.964-.304-1.37.304-.406.609-1.574 1.983-1.929 2.388-.356.406-.711.457-1.32.152-.61-.304-2.573-1.013-4.902-3.193-1.813-1.62-3.037-3.626-3.393-4.234-.355-.609-.038-.938.267-1.24.275-.271.61-.711.914-1.065.304-.355.406-.609.609-1.015.203-.406.102-.761-.051-1.066-.152-.304-1.37-3.302-1.878-4.522-.496-1.196-.999-1.033-1.37-1.053-.356-.019-.761-.023-1.168-.023-.406 0-1.065.152-1.623.761-.558.609-2.132 2.083-2.132 5.08 0 2.997 2.183 5.892 2.487 6.297.304.406 4.296 6.568 10.407 9.206 1.454.628 2.59.1.02 3.528 1.411 2.937 1.413 5.312 1.41 7.218-.003.558-.304 1.015-.914 1.32z"/>
                  </svg>
                  <span>WhatsApp</span>
                </button>
                )}

                <button
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer hover:scale-103 active:scale-97 ${
                    copied
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-400"
                      : "bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"
                  }`}
                  title="Copiar enlace del producto"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copiar Enlace</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Setup controls for buy */}
            <div>
              <div className="mb-4">
                {product.stock === 0 ? (
                  <div className="bg-rose-500/10 text-rose-505 rounded-xl p-3 text-xs font-bold flex items-center gap-2 justify-center">
                    🚫 Producto Temporalmente Sin Stock
                  </div>
                ) : (
                  <div className="flex items-center justify-between border border-white/10 rounded-2xl p-2 bg-white/5">
                    <span className="text-xs font-bold pl-2 text-slate-300">
                      Cantidad
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleQtyChange(quantity - 1)}
                        disabled={quantity <= 1}
                        className="w-8 h-8 rounded-xl bg-[#151515] hover:bg-[#202020] disabled:opacity-40 font-bold border border-white/5 cursor-pointer text-xs text-white flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="text-sm font-bold w-6 text-center font-mono text-white">
                        {quantity}
                      </span>
                      <button
                        onClick={() => handleQtyChange(quantity + 1)}
                        disabled={quantity >= product.stock}
                        className="w-8 h-8 rounded-xl bg-[#151515] hover:bg-[#202020] disabled:opacity-40 font-bold border border-white/5 cursor-pointer text-xs text-white flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
                {product.stock > 0 && product.stock <= 3 && (
                  <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1.5 mt-2 ml-1 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Súper exclusivo: ¡Solo quedan {product.stock} unidades en el local!
                  </span>
                )}
              </div>

              {product.stock > 0 && (
                <button
                  onClick={handleAddToCart}
                  disabled={isSuccess}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                    isSuccess
                      ? "bg-emerald-500 text-white shadow-emerald-500/20"
                      : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.01] active:scale-95 shadow-blue-600/20"
                  }`}
                  id="btn-modal-add-cart"
                >
                  {isSuccess ? (
                    <>
                      <Check className="w-4 h-4 animate-bounce" />
                      ¡Agregado exitosamente!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      Agregar {quantity} al Carrito (Total: {formatPrice(product.price * quantity)})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Reviews Display and Star Submission Form */}
        <div className="bg-[#0A0A0A] p-6 md:p-8 space-y-8">
          <div className="border-b border-white/5 pb-4">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" /> Opiniones y Calificaciones de Clientes
            </h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">
              {nombreWeb}
            </p>
          </div>

          <div className="space-y-8">
            {/* Left side column: Reviews List */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/5">
                <div className="text-center">
                  <span className="text-3xl font-black font-mono text-white tracking-tighter">
                    {avgRating}
                  </span>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    de 5 estrellas
                  </p>
                </div>
                <div className="h-10 w-[1px] bg-white/10" />
                <div className="space-y-1">
                  <div className="flex items-center gap-0.5 text-amber-450">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Calificación de {productReviews.length} clientes
                  </p>
                </div>
              </div>

              {/* Iteration on actual reviews */}
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {productReviews.length === 0 ? (
                  <div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-white/5">
                    <Star className="w-8 h-8 text-white/5 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">Aún no hay reseñas para este artículo.</p>
                    <p className="text-[10px] text-slate-500 mt-1">¡Sé el primero en calificar tu compra realizada en Río Cuarto!</p>
                  </div>
                ) : (
                  productReviews.map((r, index) => (
                    <div
                      key={r.id || index}
                      className="bg-[#0F0F0F] p-4 rounded-2xl border border-white/5 relative space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-100">{r.name}</span>
                        <span className="text-[10px] text-slate-500">{formatearFechaES(r.date)}</span>
                      </div>
                      
                      {/* Review stars */}
                      <div className="flex text-amber-450 gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < r.rating ? "fill-amber-400 text-amber-400" : "text-white/5"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Comment text */}
                      <p className="text-slate-300 leading-relaxed font-normal italic">
                        "{r.comment}"
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right side column: Leave Review Form */}
            <div className="bg-white/5 p-5 rounded-3xl border border-white/5 h-fit">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-400" /> ¿Compraste este producto?
              </h4>
              <p className="text-[10px] text-slate-400 mb-4 font-semibold">
                Dejanos tu calificación oficial sobre este producto.
              </p>

              {reviewSubmitSuccess ? (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded-2xl p-4 flex flex-col items-center text-center gap-1 text-xs animate-scale-in">
                  <Check className="w-8 h-8 bg-emerald-500 text-white rounded-full p-2 mb-1 shadow-md" />
                  <p className="font-extrabold text-slate-100 text-[13px]">¡Muchas gracias por tu reseña!</p>
                  <p className="text-[10px] text-slate-400">Fue registrada y estará disponible en breves instantes en la web.</p>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-3.5">
                  {/* Name field */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Facundo Gómez"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="w-full text-xs bg-black/40 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Star selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Calificación (Estrellas) *
                    </label>
                    <div className="flex items-center gap-1 bg-black/20 px-3 py-2 rounded-xl border border-white/5 w-fit">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const starValue = i + 1;
                        const isStarred = starValue <= (hoveredStar ?? reviewRating);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setReviewRating(starValue)}
                            onMouseEnter={() => setHoveredStar(starValue)}
                            onMouseLeave={() => setHoveredStar(null)}
                            className="p-1 text-amber-450 hover:scale-120 transition-transform cursor-pointer"
                            title={`Calificar con ${starValue} estrellas`}
                          >
                            <Star
                              className={`w-5 h-5 transition-colors ${
                                isStarred ? "fill-amber-400 text-amber-400 animate-pulse" : "text-white/10"
                              }`}
                            />
                          </button>
                        );
                      })}
                      <span className="text-xs font-bold text-amber-400 ml-1.5 font-mono">
                        {reviewRating} de 5
                      </span>
                    </div>
                  </div>

                  {/* Comment box */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      Tu Opinión *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Escribe aquí qué te pareció este producto, su calidad..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full text-xs bg-black/40 text-white rounded-xl border border-white/10 px-3.5 py-2.5 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.01] transition-all"
                  >
                    Publicar Reseña <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
