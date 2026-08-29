export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  categories: string[];
}
