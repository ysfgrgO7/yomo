// app/pos/page.tsx (or wherever you want the POS page)
"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "@/app/styles.module.css";
import BarcodeScanner from "./scanner"; // Adjust path as needed
import { db } from "@/lib/firebase";
import {
  collectionGroup,
  query,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  ShoppingCart,
  Loader2,
  Minus,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CreditCard,
  DollarSign,
} from "lucide-react";

// Existing Item interface
interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category: string;
  quantity: number; // Available quantity
  total: number;
  sold: number;
}

// Interface for items in the cart
interface CartItem extends Item {
  cartQuantity: number;
  subtotal: number;
}

const getItemRefPath = (category: string, id?: string) => {
  const path = `inventory/${category}/items`;
  return id ? `${path}/${id}` : path;
};

export default function POSPage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "processing" | "success" | "failure"
  >("idle");
  const [lastScan, setLastScan] = useState<string | null>(null);

  // --- 1. Load Inventory Data ---
  useEffect(() => {
    // Note: Reusing the inventory loading logic from InventoryPage,
    // but simplifying to assume auth is ready for a real app context.
    if (db) {
      setLoading(true);
      const q = query(collectionGroup(db, "items"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: Item[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data() as Omit<Item, "id">;
            const soldQty = Number(data.sold) || 0;
            const totalQty = Number(data.total) || 0;
            const availableQty = totalQty - soldQty;

            items.push({
              id: doc.id,
              ...data,
              total: totalQty,
              sold: soldQty,
              quantity: availableQty, // Available stock
            });
          });
          setInventory(items);
          setLoading(false);
        },
        (e) => {
          console.error("Snapshot Listener Error:", e);
          setError("Failed to load inventory for POS.");
          setLoading(false);
        }
      );
      return () => unsubscribe();
    }
  }, []);

  // --- 2. Cart Management Logic ---

  const handleScan = (barcode: string) => {
    if (!scannerActive || checkoutStatus === "processing") return;

    // Throttle repeated scans of the same item
    if (lastScan === barcode) {
      setLastScan(null); // Reset after successful add
      return;
    }

    setLastScan(barcode);

    const itemToAdd = inventory.find((item) => item.barcode === barcode);

    if (!itemToAdd) {
      setError(`Item with barcode ${barcode} not found.`);
      setTimeout(() => setError(null), 2000);
      return;
    }

    if (itemToAdd.quantity <= 0) {
      setError(`"${itemToAdd.name}" is out of stock!`);
      setTimeout(() => setError(null), 2000);
      return;
    }

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (i) => i.id === itemToAdd.id
      );

      if (existingItemIndex > -1) {
        const updatedCart = [...prevCart];
        const currentCartQty = updatedCart[existingItemIndex].cartQuantity;

        // Check if adding one more exceeds available stock
        if (currentCartQty + 1 > itemToAdd.quantity) {
          setError(
            `Only ${itemToAdd.quantity} of "${itemToAdd.name}" available.`
          );
          setTimeout(() => setError(null), 2000);
          return prevCart;
        }

        updatedCart[existingItemIndex].cartQuantity += 1;
        updatedCart[existingItemIndex].subtotal =
          updatedCart[existingItemIndex].cartQuantity *
          updatedCart[existingItemIndex].price;
        return updatedCart;
      } else {
        // Add new item to cart
        const newItem: CartItem = {
          ...itemToAdd,
          cartQuantity: 1,
          subtotal: itemToAdd.price,
        };
        return [...prevCart, newItem];
      }
    });

    // Clear last scan after a small delay to allow next unique scan
    setTimeout(() => setLastScan(null), 500);
    setError(null);
  };

  const updateCartQuantity = (itemId: string, change: number) => {
    const itemInInventory = inventory.find((i) => i.id === itemId);
    if (!itemInInventory) return;

    setCart((prevCart) => {
      const updatedCart = prevCart
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.cartQuantity + change;

            if (newQuantity < 1) {
              // Remove item if quantity drops to 0
              return null;
            }

            // Check against current available stock
            if (newQuantity > itemInInventory.quantity) {
              setError(
                `Cannot add more. Only ${itemInInventory.quantity} available.`
              );
              setTimeout(() => setError(null), 2000);
              return item; // return item unmodified
            }

            return {
              ...item,
              cartQuantity: newQuantity,
              subtotal: newQuantity * item.price,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null); // Filter out nulls (removed items)

      return updatedCart;
    });
  };

  const removeItemFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  }, [cart]);

  // --- 3. Checkout Logic ---
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty. Please scan items.");
      setTimeout(() => setError(null), 2000);
      return;
    }

    setCheckoutStatus("processing");
    setError(null);

    const updates = cart.map(async (cartItem) => {
      try {
        const itemRef = doc(db, getItemRefPath(cartItem.category, cartItem.id));

        // Find the current inventory state (it might have changed during checkout)
        const currentItem = inventory.find((i) => i.id === cartItem.id);

        if (!currentItem || currentItem.quantity < cartItem.cartQuantity) {
          throw new Error(`Insufficient stock for ${cartItem.name}.`);
        }

        // Calculate new sold and available quantities
        const newSold = currentItem.sold + cartItem.cartQuantity;
        const newAvailable = currentItem.total - newSold; // Should be currentItem.quantity - cartItem.cartQuantity

        await updateDoc(itemRef, {
          sold: newSold,
          quantity: newAvailable, // Update the available stock
        });
        return true;
      } catch (e) {
        console.error("Failed to update stock:", e);
        return false;
      }
    });

    const results = await Promise.all(updates);

    if (results.every((r) => r === true)) {
      setCheckoutStatus("success");
      setCart([]); // Clear the cart on success
      setTimeout(() => setCheckoutStatus("idle"), 3000);
    } else {
      setCheckoutStatus("failure");
      setError(
        "Checkout failed for one or more items. Inventory was not fully updated."
      );
      setTimeout(() => setCheckoutStatus("idle"), 5000);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.loader} />
        <p className={styles.loadingText}>Loading POS inventory...</p>
      </div>
    );
  }

  return (
    <div
      className={styles.page}
      style={{ display: "flex", gap: "2rem", height: "100vh", padding: "2rem" }}
    >
      {/* Left Panel: Scanner and Cart */}
      <div
        style={{
          flex: "1 1 60%",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        <h1 className={styles.title} style={{ marginBottom: 0 }}>
          <DollarSign /> Point of Sale
        </h1>
        <p className={styles.subtitle}>Scan items to add to cart.</p>

        {/* Scanner Area */}
        <div
          style={{
            padding: "1rem",
            border: "1px solid #ddd",
            borderRadius: "8px",
            backgroundColor: "#f9f9f9",
          }}
        >
          <BarcodeScanner
            onScan={handleScan}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Error/Status Box */}
        {error && (
          <div
            className={styles.errorBox}
            style={{
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fca5a5",
            }}
          >
            <AlertTriangle size={20} /> <strong>Scan Error:</strong> {error}
          </div>
        )}

        {checkoutStatus === "success" && (
          <div
            className={styles.errorBox}
            style={{
              backgroundColor: "#d1fae5",
              color: "#065f46",
              border: "1px solid #34d399",
            }}
          >
            Transaction Complete!
          </div>
        )}

        {checkoutStatus === "failure" && (
          <div
            className={styles.errorBox}
            style={{
              backgroundColor: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fca5a5",
            }}
          >
            <X /> Transaction Failed! {error}
          </div>
        )}

        {/* Cart Display */}
        <div
          style={{
            flexGrow: 1,
            overflowY: "auto",
            border: "1px solid #ccc",
            borderRadius: "8px",
            padding: "1rem",
          }}
        >
          <h2
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderBottom: "1px solid #eee",
              paddingBottom: "0.5rem",
            }}
          >
            <ShoppingCart /> Current Sale ({cart.length} items)
          </h2>
          {cart.length === 0 ? (
            <p
              style={{ textAlign: "center", paddingTop: "2rem", color: "#666" }}
            >
              Scan an item to begin a transaction.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "1rem",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6" }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Item</th>
                  <th style={{ padding: "8px" }}>Qty</th>
                  <th style={{ padding: "8px" }}>Price</th>
                  <th style={{ padding: "8px" }}>Subtotal</th>
                  <th style={{ padding: "8px" }}>Remove</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ textAlign: "left", padding: "8px" }}>
                      {item.name}
                    </td>
                    <td
                      style={{
                        padding: "8px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <button
                        className={styles.button}
                        onClick={() => updateCartQuantity(item.id, -1)}
                        disabled={checkoutStatus === "processing"}
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          lineHeight: "1",
                          backgroundColor: "#ef4444",
                        }}
                        title="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ minWidth: "20px", textAlign: "center" }}>
                        {item.cartQuantity}
                      </span>
                      <button
                        className={styles.button}
                        onClick={() => updateCartQuantity(item.id, 1)}
                        disabled={
                          checkoutStatus === "processing" ||
                          item.cartQuantity >= item.quantity
                        }
                        style={{
                          padding: "4px 8px",
                          fontSize: "12px",
                          lineHeight: "1",
                          backgroundColor: "#10b981",
                        }}
                        title="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </td>
                    <td style={{ textAlign: "right", padding: "8px" }}>
                      {item.price.toFixed(2)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "8px",
                        fontWeight: "bold",
                      }}
                    >
                      {item.subtotal.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center", padding: "8px" }}>
                      <button
                        className={styles.button}
                        onClick={() => removeItemFromCart(item.id)}
                        disabled={checkoutStatus === "processing"}
                        style={{
                          backgroundColor: "#9ca3af",
                          padding: "4px 8px",
                        }}
                        title="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right Panel: Checkout Summary */}
      <div
        style={{
          flex: "0 0 35%",
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1.5rem",
          backgroundColor: "#f9fafb",
        }}
      >
        <h2
          style={{
            borderBottom: "2px solid #3b82f6",
            paddingBottom: "1rem",
            color: "#3b82f6",
          }}
        >
          Order Summary
        </h2>

        <div
          style={{
            fontSize: "1.2rem",
            margin: "1rem 0",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Subtotal:</span>
          <span style={{ fontWeight: "normal" }}>
            {cartTotal.toFixed(2)} EGP
          </span>
        </div>

        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            margin: "1rem 0",
            padding: "1rem 0",
            borderTop: "1px dashed #ccc",
            borderBottom: "1px dashed #ccc",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>GRAND TOTAL:</span>
          <span>{cartTotal.toFixed(2)} EGP</span>
        </div>

        <button
          className={styles.button}
          onClick={handleCheckout}
          disabled={cart.length === 0 || checkoutStatus === "processing"}
          style={{
            width: "100%",
            marginTop: "1.5rem",
            padding: "1rem",
            fontSize: "1.2rem",
            backgroundColor:
              checkoutStatus === "processing" ? "#9ca3af" : "#10b981",
          }}
        >
          {checkoutStatus === "processing" ? (
            <>
              <Loader2 className={styles.loader} /> Processing...
            </>
          ) : (
            <>
              <CreditCard /> Process Payment ({cartTotal.toFixed(2)} EGP)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
