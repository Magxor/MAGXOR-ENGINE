import { Product, ReviewItem, FAQItem, LocationInfo, WorkHours } from "./types";

export const DEFAULT_PRODUCTS: Product[] = [];

export const REVIEWS: ReviewItem[] = [
  {
    name: "Cliente verificado",
    rating: 5,
    comment: "Excelente atención y productos de calidad. Muy recomendados.",
    date: "Hace poco"
  },
  {
    name: "Cliente verificado",
    rating: 5,
    comment: "Compra rápida y simple por WhatsApp. Volvería a comprar.",
    date: "Hace poco"
  }
];

export const FAQS: FAQItem[] = [
  {
    question: "¿Cómo puedo realizar una compra?",
    answer: "Navegá por el catálogo, agregá productos al carrito, elegí día y horario de retiro y completá el pedido. Te redirigimos a WhatsApp con el detalle listo."
  },
  {
    question: "¿Cuáles son los métodos de pago disponibles?",
    answer: "Coordinamos el pago por WhatsApp al confirmar tu pedido (efectivo, transferencia u otros medios publicados en la tienda)."
  },
  {
    question: "¿Qué pasa si compro fuera de horario?",
    answer: "Tu pedido queda registrado como programado y se prepara en el próximo horario de atención."
  }
];

export const LOCATIONS: LocationInfo[] = [
  {
    name: "Sucursal Principal",
    address: "",
    city: "",
    province: "",
    country: "",
    whatsapp: "",
    mapsUrl: "",
    parkingInfo: "",
    busInfo: "",
    iframeSrc: ""
  }
];

export const WORK_HOURS: WorkHours[] = [
  { day: "Lun / Vier", hours: "09:00 - 13:00, 16:00 - 20:00", openTime: "09:00", closeTime: "20:00", isOpen: true },
  { day: "Sábado", hours: "09:00 - 13:00", openTime: "09:00", closeTime: "13:00", isOpen: true },
  { day: "Domingo", hours: "Cerrado", openTime: "00:00", closeTime: "00:00", isOpen: false }
];
