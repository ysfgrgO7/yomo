// app/pos/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "@/app/styles.module.css";
import BarcodeScanner from "./scanner";
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
  Printer,
  Keyboard,
} from "lucide-react";

interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category: string;
  quantity: number;
  total: number;
  sold: number;
}

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
  const [checkoutStatus, setCheckoutStatus] = useState<
    "idle" | "processing" | "success" | "failure"
  >("idle");
  const [showCart, setShowCart] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  useEffect(() => {
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
              quantity: availableQty,
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

  // Manual Entry Handler
  const handleManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      handleScan(manualBarcode.trim());
      setManualBarcode("");
      setShowManualEntry(false);
    }
  };

  const handleScan = (barcode: string) => {
    if (checkoutStatus === "processing") return;

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
        const newItem: CartItem = {
          ...itemToAdd,
          cartQuantity: 1,
          subtotal: itemToAdd.price,
        };
        return [...prevCart, newItem];
      }
    });

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
              return null;
            }

            if (newQuantity > itemInInventory.quantity) {
              setError(
                `Cannot add more. Only ${itemInInventory.quantity} available.`
              );
              setTimeout(() => setError(null), 2000);
              return item;
            }

            return {
              ...item,
              cartQuantity: newQuantity,
              subtotal: newQuantity * item.price,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);

      return updatedCart;
    });
  };

  const removeItemFromCart = (itemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== itemId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  }, [cart]);

  // Generate Invoice PDF
  // const generateInvoicePDF = () => {
  //   if (cart.length === 0) return;

  //   const invoiceDate = new Date().toLocaleString("en-GB", {
  //     day: "2-digit",
  //     month: "2-digit",
  //     year: "numeric",
  //     hour: "2-digit",
  //     minute: "2-digit",
  //   });

  //   const invoiceHTML = `
  //     <!DOCTYPE html>
  //     <html>
  //     <head>
  //       <meta charset="utf-8">
  //       <title>Invoice</title>
  //       <style>
  //         body {
  //           font-family: Arial, sans-serif;
  //           padding: 40px;
  //           max-width: 800px;
  //           margin: 0 auto;
  //         }
  //         .header {
  //           text-align: center;
  //           margin-bottom: 30px;
  //           border-bottom: 2px solid #3b82f6;
  //           padding-bottom: 20px;
  //         }
  //         .header h1 {
  //           margin: 0;
  //         }
  //         .invoice-info {
  //           margin-bottom: 30px;
  //         }
  //         table {
  //           width: 100%;
  //           border-collapse: collapse;
  //           margin-bottom: 30px;
  //         }
  //         th {
  //           background-color: #3b82f6;
  //           color: white;
  //           padding: 12px;
  //           text-align: left;
  //           font-weight: bold;
  //         }
  //         td {
  //           padding: 10px;
  //           border-bottom: 1px solid #ddd;
  //         }
  //         .text-right {
  //           text-align: right;
  //         }
  //         .total-row {
  //           font-weight: bold;
  //           font-size: 1.2em;
  //           background-color: #f3f4f6;
  //         }
  //         .footer {
  //           margin-top: 40px;
  //           padding-top: 20px;
  //           border-top: 1px solid #ddd;
  //           color: #666;
  //         }
  //       </style>
  //     </head>
  //     <body>
  //       <div class="header">
  //         <img src="/BIGLOGO.svg" alt="Store Logo" style="background-color: #3b82f6; height: 60px; margin-bottom: 10px; padding: 1rem;" />
  //         <h1>SALES INVOICE</h1>
  //       </div>

  //       <div class="invoice-info">
  //         <p><strong>Date:</strong> ${invoiceDate}</p>
  //         <p><strong>Invoice #:</strong> INV-${Date.now()}</p>
  //       </div>

  //       <table>
  //         <thead>
  //           <tr>
  //             <th>Item</th>
  //             <th>Price</th>
  //             <th class="text-right">Quantity</th>
  //             <th class="text-right">Subtotal</th>
  //           </tr>
  //         </thead>
  //         <tbody>
  //           ${cart
  //             .map(
  //               (item) => `
  //             <tr>
  //               <td>${item.name}</td>
  //               <td>${item.price.toFixed(2)} EGP</td>
  //               <td class="text-right">${item.cartQuantity}</td>
  //               <td class="text-right">${item.subtotal.toFixed(2)} EGP</td>
  //             </tr>
  //           `
  //             )
  //             .join("")}
  //           <tr class="total-row">
  //             <td colspan="3" class="text-right">TOTAL:</td>
  //             <td class="text-right">${cartTotal.toFixed(2)} EGP</td>
  //           </tr>
  //         </tbody>
  //       </table>

  //       <div class="footer">
  //         <p>Terms and Conditions</p>
  //         <p>Exchanges are allowed within 3 days of purchase.</p>
  //         <p>Items must be returned in their original condition, unused, and with all tags and packaging intact.</p>
  //         <p>No cash refunds are issued; exchanges only.</p>
  //         <p>Thank you for shopping with us!</p>
  //       </div>
  //     </body>
  //     </html>
  //   `;

  //   const printWindow = window.open("", "_blank");
  //   if (printWindow) {
  //     printWindow.document.write(invoiceHTML);
  //     printWindow.document.close();
  //     printWindow.focus();

  //     printWindow.onload = () => {
  //       printWindow.print();
  //     };
  //   }
  // };
  const generateInvoicePDF = () => {
    if (cart.length === 0) return;

    const invoiceDate = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const invoiceNumber = `INV-${Date.now()}`;

    const invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice</title>
      <style>
        body {
          font-family: "Segoe UI", Arial, sans-serif;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
          background-color: #fff;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 3px solid #3b82f6;
          padding-bottom: 20px;
        }
        .logo {
          height: 70px;
          margin-bottom: 10px;
          background-color: #3b82f6;
          padding : 1rem;
        }
        .store-info {
          text-align: center;
          font-size: 0.9em;
          color: #666;
          margin-bottom: 10px;
        }
        .invoice-title {
          font-size: 1.8em;
          letter-spacing: 1px;
          color: #3b82f6;
          margin: 10px 0 0;
        }
        .invoice-info {
          margin-top: 20px;
          margin-bottom: 30px;
          display: flex;
          justify-content: space-between;
          font-size: 0.95em;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          border: 1px solid #ddd;
        }
        th {
          background-color: #3b82f6;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        tbody tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .text-right {
          text-align: right;
        }
        .total-box {
          float: right;
          width: 300px;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 15px;
          background-color: #f9fafb;
        }
        .total-box table {
          width: 100%;
          border: none;
        }
        .total-box td {
          border: none;
          padding: 6px 0;
        }
        .total-box .final {
          font-weight: bold;
          font-size: 1.1em;
          color: #111;
        }
        .footer {
          margin-top: 60px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 0.9em;
          color: #555;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="/BIGLOGO.svg" alt="Store Logo" class="logo" />
        <h1 class="invoice-title">SALES INVOICE</h1>
        <div class="store-info">
          <p><strong>Yomo</strong> — Manshiyet el Bakri, Cairo</p>
          <p>Phone: 0120 1675335 </p>
        </div>
      </div>
      
      <div class="invoice-info">
        <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
        <p><strong>Date:</strong> ${invoiceDate}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${cart
            .map(
              (item) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.price.toFixed(2)} EGP</td>
              <td class="text-right">${item.cartQuantity}</td>
              <td class="text-right">${item.subtotal.toFixed(2)} EGP</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div class="total-box">
        <table>
          <tr>
            <td><strong>Subtotal:</strong></td>
            <td class="text-right">${cartTotal.toFixed(2)} EGP</td>
          </tr>
          <tr class="final">
            <td>Total Due:</td>
            <td class="text-right">${cartTotal.toFixed(2)} EGP</td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <h3>Terms & Conditions</h3>
        <p>Exchanges are allowed within 3 days of purchase.</p>
        <p>Items must be returned in their original condition, unused, and with all tags and packaging intact.</p>
        <p>No cash refunds are issued; exchanges only.</p>
        <p style="margin-top: 10px;">Thank you for shopping with us!</p>
      </div>
    </body>
    </html>
  `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

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
        const currentItem = inventory.find((i) => i.id === cartItem.id);

        if (!currentItem || currentItem.quantity < cartItem.cartQuantity) {
          throw new Error(`Insufficient stock for ${cartItem.name}.`);
        }

        const newSold = currentItem.sold + cartItem.cartQuantity;
        const newAvailable = currentItem.total - newSold;

        await updateDoc(itemRef, {
          sold: newSold,
          quantity: newAvailable,
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
      generateInvoicePDF();
      setCart([]);
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
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Fullscreen Camera */}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <FullscreenScanner
          onScan={handleScan}
          onError={(msg) => setError(msg)}
        />
      </div>

      {/* Floating Cart Button */}
      <button
        onClick={() => setShowCart(true)}
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "2rem",
          width: "70px",
          height: "70px",
          borderRadius: "50%",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 999,
        }}
      >
        <ShoppingCart size={28} />
        {cart.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              backgroundColor: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {cart.length}
          </span>
        )}
      </button>

      {/* Floating Manual Entry Button */}
      <button
        onClick={() => setShowManualEntry(true)}
        style={{
          position: "fixed",
          bottom: "2rem",
          right: "7rem",
          width: "70px",
          height: "70px",
          borderRadius: "50%",
          backgroundColor: "#8b5cf6",
          color: "white",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 999,
        }}
      >
        <Keyboard size={28} />
      </button>

      {/* Error/Success Toast */}
      {error && (
        <div
          style={{
            position: "fixed",
            top: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#fee2e2",
            color: "#b91c1c",
            padding: "1rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #fca5a5",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {checkoutStatus === "success" && (
        <div
          style={{
            position: "fixed",
            top: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#d1fae5",
            color: "#065f46",
            padding: "1rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #34d399",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            fontSize: "1.1rem",
            fontWeight: "bold",
          }}
        >
          ✓ Transaction Complete!
        </div>
      )}

      {/* Cart Popup */}
      {showCart && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setShowCart(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#f9fafb",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <ShoppingCart /> Cart ({cart.length})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.5rem",
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Cart Items */}
            <div style={{ flexGrow: 1, overflowY: "auto", padding: "1rem" }}>
              {cart.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#666",
                  }}
                >
                  Cart is empty. Scan items to begin.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "#666" }}>
                          {item.price.toFixed(2)} EGP each
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            disabled={checkoutStatus === "processing"}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: "none",
                              backgroundColor: "#ef4444",
                              color: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Minus size={16} />
                          </button>
                          <span
                            style={{
                              minWidth: "30px",
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          >
                            {item.cartQuantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.id, 1)}
                            disabled={
                              checkoutStatus === "processing" ||
                              item.cartQuantity >= item.quantity
                            }
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: "none",
                              backgroundColor: "#10b981",
                              color: "white",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div
                          style={{
                            fontWeight: "bold",
                            minWidth: "80px",
                            textAlign: "right",
                          }}
                        >
                          {item.subtotal.toFixed(2)} EGP
                        </div>
                        <button
                          onClick={() => removeItemFromCart(item.id)}
                          disabled={checkoutStatus === "processing"}
                          style={{
                            padding: "0.5rem",
                            border: "none",
                            backgroundColor: "#f3f4f6",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Total and Checkout */}
            <div
              style={{
                padding: "1.5rem",
                borderTop: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                }}
              >
                <span>Total:</span>
                <span>{cartTotal.toFixed(2)} EGP</span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || checkoutStatus === "processing"}
                style={{
                  width: "100%",
                  padding: "1rem",
                  fontSize: "1.1rem",
                  backgroundColor:
                    checkoutStatus === "processing" || cart.length === 0
                      ? "#9ca3af"
                      : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: cart.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontWeight: "bold",
                  marginBottom: "0.75rem",
                }}
              >
                {checkoutStatus === "processing" ? (
                  <>
                    <Loader2 style={{ animation: "spin 1s linear infinite" }} />{" "}
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard /> Process Payment & Print
                  </>
                )}
              </button>

              <button
                onClick={generateInvoicePDF}
                disabled={cart.length === 0}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  backgroundColor: cart.length === 0 ? "#e5e7eb" : "#3b82f6",
                  color: cart.length === 0 ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: cart.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontWeight: "bold",
                }}
              >
                <Printer size={18} /> Preview Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Popup */}
      {showManualEntry && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setShowManualEntry(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              maxWidth: "400px",
              width: "100%",
              padding: "2rem",
              boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Keyboard /> Manual Entry
              </h2>
              <button
                onClick={() => setShowManualEntry(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.5rem",
                }}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleManualEntry}>
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="barcode-input"
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "bold",
                    color: "#374151",
                  }}
                >
                  Enter Barcode/QR Code:
                </label>
                <input
                  id="barcode-input"
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  autoFocus
                  placeholder="Type or paste code here"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1rem",
                    border: "2px solid #d1d5db",
                    borderRadius: "8px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
                />
              </div>

              <button
                type="submit"
                disabled={!manualBarcode.trim()}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  backgroundColor: manualBarcode.trim() ? "#10b981" : "#9ca3af",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: manualBarcode.trim() ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                }}
              >
                Add to Cart
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Fullscreen Scanner Component
function FullscreenScanner({
  onScan,
  onError,
}: {
  onScan: (code: string) => void;
  onError: (msg: string) => void;
}) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <BarcodeScanner onScan={onScan} onError={onError} />
      <div
        style={{
          position: "absolute",
          top: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "1rem 2rem",
          borderRadius: "8px",
          fontSize: "1.2rem",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <DollarSign size={24} /> Point of Sale - Scan Items
      </div>
    </div>
  );
}
