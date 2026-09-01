export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  categories: string[];
  category?: string;
  stock?: number;
  rating?: number;
  reviewCount?: number;
  isBestSeller?: boolean;
  isFeaturedChoice?: boolean;
  dealPercentage?: number;
  specs?: Record<string, string>;
  images?: string[];
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export interface CartItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents?: number;
  stock?: number;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  currency: string;
  grandTotalCents: number;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  nameSnapshot?: string;
  name?: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents?: number;
}

export interface OrderSnapshot {
  orderId: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: "PENDING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "CANCELLED" | "FAILED";
  items: OrderItem[];
  createdAt: string;
  updatedAt?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface OrderSummary {
  orderId: string;
  userId: string;
  totalCents: number;
  currency: string;
  status: string;
  createdAt: string;
  itemCount?: number;
}

export interface OrderListResponse {
  items: OrderSummary[];
  total: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

export interface RatingDistribution {
  stars: number;
  count: number;
  percentage: number;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  country: string;
}

export interface DeliveryOption {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  estimatedDate: string;
}

export interface ToastMessage {
  id?: string;
  title: string;
  productName: string;
  priceCents: number;
  quantity: number;
  cartTotalCents: number;
  currency: string;
}

export interface MicroserviceEventLog {
  id: string;
  timestamp: string;
  service: "api-gateway" | "auth-service" | "cart-service" | "catalog-service" | "order-service" | "payment-service" | "notification-service";
  eventType: string;
  topic?: string;
  latencyMs: number;
  status: "success" | "pending" | "failed";
  payloadSummary: string;
}

export interface PriceDropAlert {
  productId: string;
  productName: string;
  currentPriceCents: number;
  targetPriceCents: number;
  email: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  role?: string;
}

