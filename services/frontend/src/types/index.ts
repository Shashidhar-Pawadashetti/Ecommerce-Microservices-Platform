export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  categories: string[];
}

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
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
}

export interface User {
  id: string;
  email: string;
  name?: string;
}
