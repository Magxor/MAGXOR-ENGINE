export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  secondaryImage?: string;
  stock: number;
  badge?: "Oferta" | "Nuevo" | "Últimas unidades" | "";
  isBestSeller?: boolean;
  isNew?: boolean;
  isPromo?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ReviewItem {
  id?: string;
  productId?: string; // Links reviews to specific product sheets
  name: string;
  rating: number;
  comment: string;
  date: string;
}

export interface LocationInfo {
  name: string;
  address: string;
  city: string;
  province: string;
  country: string;
  whatsapp: string;
  mapsUrl: string;
  parkingInfo: string;
  busInfo: string;
  iframeSrc: string;
}

export interface WorkHours {
  day: string;
  hours: string;
  openTime: string; // "HH:MM" format
  closeTime: string; // "HH:MM" format
  isOpen: boolean;
}
