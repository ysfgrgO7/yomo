"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "@/app/styles.module.css";
import { db, auth } from "../../../lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  collectionGroup,
} from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import {
  Package,
  X,
  Check,
  Edit,
  Trash2,
  Plus,
  Loader2,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

declare global {
  interface Window {
    __initial_auth_token: string | undefined;
  }
}

interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category: string;
  quantity: number; // Storing Available quantity (Total - Sold)
  total: number; // Storing Total Initial Stock
  sold: number; // Storing Sold quantity
}

const generateBarcodeNumber = () => {
  const productCode = "900";
  const uniquePart = Math.floor(Math.random() * 1e10)
    .toString()
    .padStart(10, "0");
  return productCode + uniquePart;
};

const QrCodeDisplay: React.FC<{ value: string; size?: number }> = ({
  value,
  size = 40,
}) => {
  return (
    <div
      style={{
        padding: "2px",
        height: `${size}px`,
        width: `${size}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
      />
    </div>
  );
};

export default function InventoryPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Item>>({});
  const [generatingPdfFor, setGeneratingPdfFor] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<Omit<Item, "id">>({
    barcode: generateBarcodeNumber(),
    name: "",
    price: 0,
    category: "T-Shirt",
    quantity: 0,
    total: 0,
    sold: 0,
  });

  const CATEGORIES = [
    "T-Shirt",
    "Sweatshirt",
    "Pants",
    "Dress",
    "Jacket",
    "Skirts",
    "Set",
  ];

  const getItemRefPath = (category: string, id?: string) => {
    const path = `inventory/${category}/items`;
    return id ? `${path}/${id}` : path;
  };

  useEffect(() => {
    const initialAuthToken =
      typeof window.__initial_auth_token !== "undefined"
        ? window.__initial_auth_token
        : null;

    const authenticate = async () => {
      try {
        if (initialAuthToken)
          await signInWithCustomToken(auth, initialAuthToken);
        setUserId(auth.currentUser?.uid || crypto.randomUUID());
      } catch (err) {
        console.error("Firebase Auth Error:", err);
        setUserId(crypto.randomUUID());
      } finally {
        setIsAuthReady(true);
      }
    };

    authenticate();
  }, []);

  useEffect(() => {
    if (db && userId) {
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

            // Core logic: Available = Total - Sold
            const availableQty = totalQty - soldQty;

            items.push({
              id: doc.id,
              ...data,
              total: totalQty,
              sold: soldQty,
              quantity: availableQty, // quantity is used for available stock
            });
          });
          setInventory(items);
          setLoading(false);
        },
        (e) => {
          console.error("Snapshot Listener Error:", e);
          setError("Real-time connection error.");
          setLoading(false);
        }
      );
      return () => unsubscribe();
    }
  }, [userId]);

  const handleNewItemChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const numValue = type === "number" ? parseFloat(value) || 0 : value;

    setNewItem((prev) => {
      const updated = {
        ...prev,
        [name]: numValue,
      };

      // When adding, Sold is always 0 initially.
      const total = Number(updated.total) || 0;
      const sold = 0; // Sold is fixed at 0 for initial creation

      // Calculate available (stored in 'quantity' field)
      updated.quantity = Math.max(0, total - sold);
      updated.sold = sold; // Ensure sold is explicitly 0

      return updated;
    });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || newItem.price <= 0 || newItem.total <= 0) {
      setError("Please fill in all required fields correctly.");
      return;
    }

    try {
      setLoading(true);
      const itemsCollectionPath = getItemRefPath(newItem.category);

      // Sold is 0 when adding a new item. Available quantity = Total quantity.
      const initialTotal = Number(newItem.total);
      const initialSold = 0;
      const availableQty = initialTotal;

      await addDoc(collection(db, itemsCollectionPath), {
        ...newItem,
        createdAt: new Date().toISOString(),
        price: Number(newItem.price),
        total: initialTotal,
        sold: initialSold,
        quantity: availableQty,
      });

      setNewItem({
        barcode: generateBarcodeNumber(),
        name: "",
        price: 0,
        category: "T-Shirt",
        quantity: 0,
        total: 0,
        sold: 0,
      });
      setIsAdding(false);
      setError(null);
    } catch (err) {
      console.error("Error adding document: ", err);
      setError("Failed to add item to inventory.");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item: Item) => {
    setEditingItemId(item.id);
    // Use the item's current values for editing
    setEditFormData({
      ...item,
      total: item.total,
      sold: item.sold,
    });
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const numValue = type === "number" ? parseFloat(value) : value;

    setEditFormData((prev) => {
      const updated = {
        ...prev,
        [name]: numValue,
      };

      const total = Number(updated.total) || 0;
      const sold = Number(updated.sold) || 0;

      // Recalculate 'quantity' (available) based on the updated total or sold values
      updated.quantity = Math.max(0, total - sold);

      return updated;
    });
  };

  const handleUpdateItem = async (itemId: string) => {
    const currentCategory = editFormData.category;
    const updatedTotal = Number(editFormData.total) || 0;
    const updatedSold = Number(editFormData.sold) || 0;
    const updatedAvailable = updatedTotal - updatedSold;

    const updatedData = {
      name: editFormData.name,
      price: Number(editFormData.price),
      category: editFormData.category,
      total: updatedTotal,
      sold: updatedSold,
      quantity: updatedAvailable, // This is the available stock
    };

    if (
      !updatedData.name ||
      !currentCategory ||
      updatedData.price <= 0 ||
      updatedTotal < updatedSold
    ) {
      setError(
        "Invalid data for update. Total must be greater than or equal to Sold."
      );
      return;
    }

    try {
      setLoading(true);
      const itemRef = doc(
        db,
        getItemRefPath(currentCategory || "T-Shirt", itemId)
      );
      await updateDoc(itemRef, updatedData);
      setEditingItemId(null);
      setError(null);
    } catch (err) {
      console.error("Error updating document: ", err);
      setError("Failed to update item.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const itemToDelete = inventory.find((item) => item.id === itemId);
    if (!itemToDelete) {
      setError("Item not found for deletion.");
      return;
    }

    if (
      !window.confirm(`Are you sure you want to delete ${itemToDelete.name}?`)
    )
      return;

    try {
      setLoading(true);
      const itemRef = doc(db, getItemRefPath(itemToDelete.category, itemId));
      await deleteDoc(itemRef);
      setError(null);
    } catch (err) {
      console.error("Error deleting document: ", err);
      setError("Failed to delete item.");
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF for a specific item with multiple QR codes based on quantity (KEEPING FOR COMPLETENESS, NO CHANGE)
  const handleGenerateItemPdf = async (item: Item) => {
    setGeneratingPdfFor(item.id);

    try {
      // Create a temporary container
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "210mm";
      container.style.padding = "10mm";
      container.style.backgroundColor = "white";
      container.style.zIndex = "-1";
      container.style.opacity = "0";
      document.body.appendChild(container);

      // Create header
      const header = document.createElement("h1");
      header.textContent = `${item.name} - QR Codes (${item.quantity} stickers)`;
      header.style.textAlign = "center";
      header.style.marginBottom = "20px";
      header.style.fontSize = "20px";
      container.appendChild(header);

      // Create grid container
      const grid = document.createElement("div");
      grid.style.display = "flex";
      grid.style.flexWrap = "wrap";
      grid.style.gap = "8px";
      grid.style.justifyContent = "flex-start";
      container.appendChild(grid);

      // Generate stickers for each quantity
      for (let i = 0; i < item.quantity; i++) {
        const sticker = document.createElement("div");
        sticker.style.border = "1px solid #ddd";
        sticker.style.padding = "6px";
        sticker.style.width = "calc(25% - 8px)";
        sticker.style.maxWidth = "100px";
        sticker.style.textAlign = "center";
        sticker.style.backgroundColor = "white";
        sticker.style.boxSizing = "border-box";

        const name = document.createElement("p");
        name.textContent = item.name;
        name.style.fontWeight = "bold";
        name.style.margin = "2px 0";
        name.style.fontSize = "9px";
        name.style.overflow = "hidden";
        name.style.textOverflow = "ellipsis";
        name.style.whiteSpace = "nowrap";
        sticker.appendChild(name);

        const qrContainer = document.createElement("div");
        qrContainer.style.margin = "4px 0";
        qrContainer.style.display = "flex";
        qrContainer.style.justifyContent = "center";
        qrContainer.id = `qr-temp-${i}`;
        sticker.appendChild(qrContainer);

        const price = document.createElement("p");
        price.textContent = `${item.price.toFixed(2)} EGP`;
        price.style.margin = "2px 0";
        price.style.fontSize = "10px";
        price.style.fontWeight = "600";
        sticker.appendChild(price);

        const barcode = document.createElement("p");
        barcode.textContent = item.barcode;
        barcode.style.margin = "2px 0";
        barcode.style.fontSize = "7px";
        barcode.style.color = "#666";
        sticker.appendChild(barcode);

        grid.appendChild(sticker);
      }

      // Wait a bit for DOM to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Generate QR codes as SVG and append
      const { renderToString } = await import("react-dom/server");
      for (let i = 0; i < item.quantity; i++) {
        const qrContainer = document.getElementById(`qr-temp-${i}`);
        if (qrContainer) {
          // Create QR code SVG string
          const qrSvgString = renderToString(
            <QRCodeSVG value={item.barcode} size={70} level="M" />
          );
          qrContainer.innerHTML = qrSvgString;
        }
      }

      // Wait for SVGs to render
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Make visible for capture
      container.style.opacity = "1";

      // Capture with html2canvas
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Save PDF
      pdf.save(`${item.name.replace(/[^a-z0-9]/gi, "_")}_qr_codes.pdf`);

      // Cleanup
      document.body.removeChild(container);
      setError(null);
    } catch (err) {
      console.error("Error generating PDF:", err);
      setError(`Failed to generate PDF for ${item.name}.`);
    } finally {
      setGeneratingPdfFor(null);
    }
  };

  const filteredInventory = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.barcode.includes(term) ||
        item.category.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  if (!isAuthReady || loading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.loader} />
        <p className={styles.loadingText}>
          {loading ? "Processing..." : "Loading inventory..."}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.mainContent}>
        <h1 className={styles.title}>
          <Package /> Inventory Management
        </h1>
        <p className={styles.subtitle}>Manage clothing pieces and stock</p>

        {error && (
          <div className={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <button
            className={styles.button}
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? <X /> : <Plus />}
            {isAdding ? "Cancel" : "Add New Item"}
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleAddItem} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="itemName" className={styles.label}>
                Name:
              </label>
              <input
                id="itemName"
                className={styles.input}
                name="name"
                placeholder="Product Name"
                value={newItem.name}
                onChange={handleNewItemChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itemPrice" className={styles.label}>
                Price (EGP):
              </label>
              <input
                id="itemPrice"
                className={styles.input}
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={newItem.price}
                onChange={handleNewItemChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itemTotal" className={styles.label}>
                Total Stock:
              </label>
              <input
                id="itemTotal"
                className={styles.input}
                name="total"
                type="number"
                min="1"
                placeholder="0"
                value={newItem.total}
                onChange={handleNewItemChange}
                required
              />
            </div>
            {/* REMOVED: Sold input field */}
            <div className={styles.formGroup}>
              <label htmlFor="itemCategory" className={styles.label}>
                Category:
              </label>
              <select
                id="itemCategory"
                className={styles.input}
                name="category"
                value={newItem.category}
                onChange={handleNewItemChange}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="itemBarcode" className={styles.label}>
                New Barcode:
              </label>
              <input
                id="itemBarcode"
                className={styles.input}
                name="barcode"
                value={newItem.barcode}
                readOnly
                disabled
              />
            </div>

            <button type="submit" className={styles.button}>
              <Plus /> Save Item
            </button>
          </form>
        )}

        <br style={{ height: "1rem" }} />

        <input
          className={styles.input}
          placeholder="Search by name, barcode, or category"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <table>
          <thead>
            <tr>
              <th>QR Code</th>
              <th>Name</th>
              <th>Price</th>
              <th>Total Stock</th>
              <th>Sold</th>
              <th>Available Stock</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <tr key={item.id}>
                  {editingItemId === item.id ? (
                    <>
                      <td>
                        <QrCodeDisplay value={item.barcode} />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          name="name"
                          value={editFormData.name || ""}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          name="price"
                          type="number"
                          value={editFormData.price?.toString() || ""}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          name="total"
                          type="number"
                          value={editFormData.total?.toString() || ""}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <input
                          className={styles.input}
                          name="sold"
                          type="number"
                          value={editFormData.sold?.toString() || ""}
                          onChange={handleEditChange}
                        />
                      </td>
                      <td>
                        <p>
                          {(Number(editFormData.total) || 0) -
                            (Number(editFormData.sold) || 0)}
                        </p>
                      </td>
                      <td>
                        <select
                          className={styles.input}
                          name="category"
                          value={editFormData.category || ""}
                          onChange={handleEditChange}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className={styles.button}
                          onClick={() => handleUpdateItem(item.id)}
                        >
                          <Check />
                        </button>
                        <button
                          className={styles.button}
                          onClick={() => setEditingItemId(null)}
                        >
                          <X />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <QrCodeDisplay value={item.barcode} />
                      </td>
                      <td>{item.name}</td>
                      <td>{item.price.toFixed(2)} EGP</td>
                      <td>{item.total}</td>
                      <td>{item.sold}</td>
                      <td>{item.quantity}</td>
                      <td>{item.category}</td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className={styles.button}
                            onClick={() => startEditing(item)}
                            title="Edit item"
                          >
                            <Edit />
                          </button>
                          <button
                            className={styles.button}
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete item"
                            style={{ backgroundColor: "#ef4444" }}
                          >
                            <Trash2 />
                          </button>
                          <button
                            className={styles.button}
                            onClick={() => handleGenerateItemPdf(item)}
                            disabled={generatingPdfFor === item.id}
                            title={`Download ${item.quantity} QR code stickers`}
                            style={{ backgroundColor: "#10b981" }}
                          >
                            {generatingPdfFor === item.id ? (
                              <Loader2
                                style={{ animation: "spin 1s linear infinite" }}
                              />
                            ) : (
                              <Download />
                            )}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
