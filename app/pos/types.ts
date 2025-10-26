// app/pos/types.ts

export interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  total: number;
  sold: number;
}

export interface CartItem extends Item {
  id: string;
  name: string;
  price: number;
  cartQuantity: number;
  subtotal: number;
}

export type CheckoutStatus = "idle" | "processing" | "success" | "failure";

export interface InvoiceItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Invoice {
  invoiceNumber: string;
  date: string;
  timestamp: number;
  items: InvoiceItem[];
  subtotal: number;
  isRefund: boolean;
}

export const getItemRefPath = (category: string, id?: string) => {
  const path = `inventory/${category}/items`;
  return id ? `${path}/${id}` : path;
};
