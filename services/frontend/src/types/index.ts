export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  categories: string[];
  category?: string;
  rating?: number;
  reviewCount?: number;
  isBestSeller?: boolean;
  isAmazonChoice?: boolean;
  dealPercentage?: number;
  specs?: Record<string, string>;
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  imageUrl?: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  grandTotalCents: number;
  currency: string;
  updatedAt?: string;
}

export interface OrderItem {
  productId: string;
  name?: string;
  nameSnapshot?: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderSummary {
  orderId: string;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
}

export interface OrderListResponse {
  items: OrderSummary[];
  total: number;
}

export interface OrderSnapshot {
  orderId: string;
  userId: string;
  status: string;
  items: OrderItem[];
  totalCents: number;
  currency: string;
  createdAt: string;
  shippingAddress?: ShippingAddress;
  deliveryOption?: string;
  trackingNumber?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
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

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  country?: string;
}

export interface DeliveryOption {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  estimatedDate: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  productName: string;
  priceCents: number;
  quantity: number;
  cartTotalCents: number;
  currency: string;
}
