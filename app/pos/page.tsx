// app/pos/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FullscreenScanner } from "./FullscreenScanner";
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
  AlertTriangle,
  CreditCard,
  Printer,
  Keyboard,
} from "lucide-react";
import style from "./pos.module.css";
import { Item, CartItem, CheckoutStatus, getItemRefPath } from "./types";
import { generateInvoicePDF, saveInvoiceToFirebase } from "./invoice";

export default function POSPage() {
  const [inventory, setInventory] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>("idle");
  const [showCart, setShowCart] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isRefundMode, setIsRefundMode] = useState(false);

  // Check if all items in cart have sales (can be refunded)
  const canEnableRefundMode = useMemo(() => {
    if (cart.length === 0) return false; // Disable if cart is empty
    return cart.every((cartItem) => {
      const inventoryItem = inventory.find((i) => i.id === cartItem.id);
      return inventoryItem && inventoryItem.sold >= cartItem.cartQuantity;
    });
  }, [cart, inventory]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const authStatus = localStorage.getItem("authenticated") === "true";
      setIsAuthenticated(authStatus);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated === false) window.location.href = "/";
  }, [isAuthenticated]);

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

    // Validate based on mode
    if (isRefundMode) {
      // Refund mode: Check if item has sales to refund
      if (itemToAdd.sold <= 0) {
        setError(`Cannot refund "${itemToAdd.name}". No units were sold yet.`);
        setTimeout(() => setError(null), 2000);
        return;
      }
    } else {
      // Sale mode: Check if item is in stock
      if (itemToAdd.quantity <= 0) {
        setError(`"${itemToAdd.name}" is out of stock!`);
        setTimeout(() => setError(null), 2000);
        return;
      }
    }

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (i) => i.id === itemToAdd.id
      );

      if (existingItemIndex > -1) {
        // Item already in cart - update quantity
        const updatedCart = [...prevCart];
        const currentCartQty = updatedCart[existingItemIndex].cartQuantity;
        const newQuantity = currentCartQty + 1;

        // Check limits based on mode
        const limit = isRefundMode ? itemToAdd.sold : itemToAdd.quantity;
        if (newQuantity > limit) {
          setError(
            `Only ${limit} of "${itemToAdd.name}" ${
              isRefundMode ? "were sold (refund limit)" : "available"
            }.`
          );
          setTimeout(() => setError(null), 2000);
          return prevCart;
        }

        updatedCart[existingItemIndex].cartQuantity = newQuantity;
        updatedCart[existingItemIndex].subtotal =
          newQuantity * updatedCart[existingItemIndex].price;
        return updatedCart;
      } else {
        // New item - add to cart
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

            // Remove if quantity drops below 1
            if (newQuantity < 1) {
              return null;
            }

            // Check limits based on mode
            const limit = isRefundMode
              ? itemInInventory.sold
              : itemInInventory.quantity;

            if (newQuantity > limit) {
              setError(
                `Cannot ${
                  isRefundMode ? "refund" : "add"
                } more. Only ${limit} ${
                  isRefundMode ? "were sold" : "available"
                }.`
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

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty. Please scan items.");
      setTimeout(() => setError(null), 2000);
      return;
    }

    setCheckoutStatus("processing");
    setError(null);

    try {
      // First, save the invoice to Firebase and get the invoice number
      const invoiceNumber = await saveInvoiceToFirebase(
        cart,
        cartTotal,
        isRefundMode
      );

      // Then update the inventory
      const updates = cart.map(async (cartItem) => {
        try {
          const itemRef = doc(
            db,
            getItemRefPath(cartItem.category, cartItem.id)
          );
          const currentItem = inventory.find((i) => i.id === cartItem.id);

          if (!currentItem) {
            throw new Error(`Item ${cartItem.name} not found.`);
          }

          if (isRefundMode) {
            // Refund: Validate and add back to inventory
            if (cartItem.cartQuantity > currentItem.sold) {
              throw new Error(
                `Cannot refund ${cartItem.cartQuantity} of ${cartItem.name}. Only ${currentItem.sold} were sold.`
              );
            }

            const newSold = currentItem.sold - cartItem.cartQuantity;
            const newAvailable = currentItem.total - newSold;

            await updateDoc(itemRef, {
              sold: newSold,
              quantity: newAvailable,
            });
          } else {
            // Sale: Validate and deduct from inventory
            if (currentItem.quantity < cartItem.cartQuantity) {
              throw new Error(`Insufficient stock for ${cartItem.name}.`);
            }

            const newSold = currentItem.sold + cartItem.cartQuantity;
            const newAvailable = currentItem.total - newSold;

            await updateDoc(itemRef, {
              sold: newSold,
              quantity: newAvailable,
            });
          }
          return true;
        } catch (e) {
          console.error("Failed to update stock:", e);
          return false;
        }
      });

      const results = await Promise.all(updates);

      if (results.every((r) => r === true)) {
        setCheckoutStatus("success");

        // Generate invoice PDF with the saved invoice number
        generateInvoicePDF(cart, cartTotal, isRefundMode, invoiceNumber);

        setCart([]);
        setIsRefundMode(false);
        setTimeout(() => setCheckoutStatus("idle"), 3000);
      } else {
        setCheckoutStatus("failure");
        setError(
          `${
            isRefundMode ? "Refund" : "Checkout"
          } failed for one or more items. Inventory was not fully updated.`
        );
        setTimeout(() => setCheckoutStatus("idle"), 5000);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      setCheckoutStatus("failure");
      setError(
        `Failed to ${
          isRefundMode ? "process refund" : "complete checkout"
        }. Please try again.`
      );
      setTimeout(() => setCheckoutStatus("idle"), 5000);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="loadingContainer">
        <Loader2 className="loader" />
        <p className="loadingText">Checking authentication status...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loadingContainer">
        <Loader2 className="loader" />
        <p className="loadingText">Loading POS inventory...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className={style.scannerContainer}>
        <FullscreenScanner
          onScan={handleScan}
          onError={(msg) => setError(msg)}
        />
      </div>

      {/* Floating Cart Button */}
      <div className={style.buttonContainer}>
        <button
          onClick={() => setShowManualEntry(true)}
          className={style.PosButton}
          style={{ backgroundColor: "var(--yellow)" }}
        >
          <Keyboard size={28} />
        </button>
        <button
          onClick={() => setShowCart(true)}
          className={style.PosButton}
          style={{
            backgroundColor: isRefundMode ? "var(--red)" : "var(--blue)",
          }}
        >
          <ShoppingCart size={28} />
          {cart.length > 0 && (
            <span className={style.numberBadge}>{cart.length}</span>
          )}
        </button>
      </div>

      {/* Error/Success Toast */}
      {error && (
        <div className="error">
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {checkoutStatus === "success" && (
        <div className={style.transactionDoneMessage}>
          ✓ {isRefundMode ? "Refund" : "Transaction"} Complete!
        </div>
      )}

      {/* Cart Popup */}
      {showCart && (
        <div className={style.popup} onClick={() => setShowCart(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--bg)",
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
                borderBottom: "1px solid var(--grey)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "var(--fg)",
                backgroundColor: "var(--bg)",
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
                <ShoppingCart /> {isRefundMode ? "Refund" : "Cart"} (
                {cart.length})
              </h2>
              <button
                onClick={() => {
                  if (!isRefundMode && !canEnableRefundMode) {
                    if (cart.length === 0) {
                      setError(
                        "Add items to cart before switching to refund mode."
                      );
                    } else {
                      setError(
                        "Cannot switch to refund mode. Some items in cart have no sales."
                      );
                    }
                    setTimeout(() => setError(null), 3000);
                    return;
                  }
                  setIsRefundMode(!isRefundMode);
                }}
                disabled={!isRefundMode && !canEnableRefundMode}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor:
                    !isRefundMode && !canEnableRefundMode
                      ? "var(--bg)"
                      : isRefundMode
                      ? "var(--yellow)"
                      : "var(--red)",
                  color: "var(--fg)",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    !isRefundMode && !canEnableRefundMode
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  opacity: !isRefundMode && !canEnableRefundMode ? 0.5 : 1,
                }}
              >
                {isRefundMode ? "Switch to Sale" : "Refund Mode"}
              </button>
            </div>

            {/* Cart Items */}
            <div style={{ flexGrow: 1, overflowY: "auto", padding: "1rem" }}>
              {cart.length === 0 ? (
                <p>Cart is empty. Scan items to begin.</p>
              ) : (
                <div>
                  {cart.map((item) => (
                    <div key={item.id} className={style.cartitemsContainer}>
                      <div style={{ flex: 1 }}>
                        <h4>
                          <b>{item.name}</b>
                        </h4>
                        <p>{item.price.toFixed(2)} EGP each</p>
                      </div>
                      <div className={style.cartAction}>
                        <div className={style.cartAction}>
                          <button
                            onClick={() => updateCartQuantity(item.id, -1)}
                            disabled={checkoutStatus === "processing"}
                            style={{ backgroundColor: "var(--red)" }}
                            className={style.cartactionButton}
                          >
                            <Minus size={18} />
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
                              (isRefundMode
                                ? item.cartQuantity >= item.sold
                                : item.cartQuantity >= item.quantity)
                            }
                            style={{ backgroundColor: "var(--green)" }}
                            className={style.cartactionButton}
                          >
                            <Plus size={18} />
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
                          style={{ backgroundColor: "var(--red)" }}
                          className={style.cartactionButton}
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
            <div style={{ padding: "1.5rem" }}>
              {isRefundMode && (
                <div
                  style={{
                    backgroundColor: "var(--yellow)",
                    color: "var(--bg)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    marginBottom: "1rem",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  ⚠️ REFUND MODE ACTIVE
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "0.5rem",
                }}
              >
                <h2>Total:</h2>{" "}
                <h3>
                  {isRefundMode ? "-" : ""}
                  {cartTotal.toFixed(2)} EGP
                </h3>
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
                      ? "var(--grey)"
                      : isRefundMode
                      ? "var(--red)"
                      : "var(--green)",
                  color: cart.length === 0 ? "var(--bg)" : "var(--fg)",
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
                    <Loader2 className="loader" />
                    Processing...
                  </>
                ) : isRefundMode ? (
                  <>
                    <CreditCard /> Process Refund
                  </>
                ) : (
                  <>
                    <CreditCard /> Process Payment & Print
                  </>
                )}
              </button>

              <button
                onClick={() => generateInvoicePDF(cart, cartTotal)}
                disabled={cart.length === 0}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  backgroundColor:
                    cart.length === 0 ? "var(--grey)" : "var(--blue)",
                  color: cart.length === 0 ? "var(--bg)" : "var(--fg)",
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
        <div className={style.popup} onClick={() => setShowManualEntry(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              color: "var(--fg)",
              backgroundColor: "var(--bg)",
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
            </div>

            <form onSubmit={handleManualEntry}>
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="barcode-input">Enter Barcode/QR Code:</label>
                <input
                  id="barcode-input"
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  autoFocus
                  placeholder="Type or paste code here"
                />
              </div>

              <button
                type="submit"
                disabled={!manualBarcode.trim()}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  backgroundColor: manualBarcode.trim()
                    ? "var(--green)"
                    : "var(--grey)",
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
