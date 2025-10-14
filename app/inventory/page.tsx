"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./inventory.module.css";
import { db, auth } from "@/lib/firebase";
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
import { generateItemQRCodesPdf, generateAllQRCodesPdf } from "./qrCode";
import { Item } from "./qrCode";

declare global {
  interface Window {
    __initial_auth_token: string | undefined;
  }
}

const generateBarcodeNumber = () => {
  const productCode = "900";
  const uniquePart = Math.floor(Math.random() * 1e10)
    .toString()
    .padStart(10, "0");
  return productCode + uniquePart;
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

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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

  // const handleUpdateItem = async (itemId: string) => {
  //   const currentCategory = editFormData.category;
  //   const updatedTotal = Number(editFormData.total) || 0;
  //   const updatedSold = Number(editFormData.sold) || 0;
  //   const updatedAvailable = updatedTotal - updatedSold;

  //   const updatedData = {
  //     name: editFormData.name,
  //     price: Number(editFormData.price),
  //     category: editFormData.category,
  //     total: updatedTotal,
  //     sold: updatedSold,
  //     quantity: updatedAvailable, // This is the available stock
  //   };

  //   if (
  //     !updatedData.name ||
  //     !currentCategory ||
  //     updatedData.price <= 0 ||
  //     updatedTotal < updatedSold
  //   ) {
  //     setError(
  //       "Invalid data for update. Total must be greater than or equal to Sold."
  //     );
  //     return;
  //   }

  //   try {
  //     setLoading(true);
  //     const itemRef = doc(
  //       db,
  //       getItemRefPath(currentCategory || "T-Shirt", itemId)
  //     );
  //     await updateDoc(itemRef, updatedData);
  //     setEditingItemId(null);
  //     setError(null);
  //   } catch (err) {
  //     console.error("Error updating document: ", err);
  //     setError("Failed to update item.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const handleUpdateItem = async (itemId: string) => {
    const originalItem = inventory.find((item) => item.id === itemId);
    if (!originalItem) {
      setError("Item not found for update.");
      return;
    }

    const originalCategory = originalItem.category;
    const newCategory = editFormData.category;
    const updatedTotal = Number(editFormData.total) || 0;
    const updatedSold = Number(editFormData.sold) || 0;
    const updatedAvailable = updatedTotal - updatedSold;

    const updatedData = {
      barcode: originalItem.barcode,
      name: editFormData.name,
      price: Number(editFormData.price),
      category: editFormData.category,
      total: updatedTotal,
      sold: updatedSold,
      quantity: updatedAvailable,
    };

    if (
      !updatedData.name ||
      !newCategory ||
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

      // If category changed, delete old document and create new one
      if (originalCategory !== newCategory) {
        const oldItemRef = doc(db, getItemRefPath(originalCategory, itemId));
        const newItemsCollectionPath = getItemRefPath(newCategory);

        await deleteDoc(oldItemRef);
        await addDoc(collection(db, newItemsCollectionPath), updatedData);
      } else {
        // Category didn't change, just update the existing document
        const itemRef = doc(db, getItemRefPath(originalCategory, itemId));
        await updateDoc(itemRef, updatedData);
      }

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

  // Generate PDF for all items with multiple QR codes based on quantity
  const handleGenerateAllQRCodesPdf = () =>
    generateAllQRCodesPdf(inventory, setError, setGeneratingPdfFor);

  const handleGenerateItemPdf = (item: Item) =>
    generateItemQRCodesPdf(item, setError, setGeneratingPdfFor);

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
      <div className="loadingContainer">
        <Loader2 className="loader" />
        <p className="loadingText">
          {loading ? "Processing..." : "Loading inventory..."}
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>
        <Package /> Inventory Management
      </h1>
      <p>Manage clothing pieces and stock</p>
      <br />

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setIsAdding(!isAdding)}
          style={{ backgroundColor: "var(--blue)" }}
        >
          {isAdding ? <X /> : <Plus />}
          {isAdding ? "Cancel" : "Add New Item"}
        </button>

        <button
          onClick={handleGenerateAllQRCodesPdf}
          disabled={generatingPdfFor === "ALL"}
          style={{ backgroundColor: "var(--green)" }}
        >
          {generatingPdfFor === "ALL" ? (
            <>Processing...</>
          ) : (
            <>
              <Download /> Download All QR Codes
            </>
          )}
        </button>
      </div>

      <div style={{ width: "100%" }}>
        {isAdding && (
          <form onSubmit={handleAddItem}>
            <div className="formGroup">
              <label htmlFor="itemName">Name:</label>
              <input
                id="itemName"
                name="name"
                placeholder="Product Name"
                value={newItem.name}
                onChange={handleNewItemChange}
                required
              />
            </div>
            <div className="formGroup">
              <label htmlFor="itemPrice">Price (EGP):</label>
              <input
                id="itemPrice"
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
            <div className="formGroup">
              <label htmlFor="itemTotal">Total Stock:</label>
              <input
                id="itemTotal"
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
            <div className="formGroup">
              <label htmlFor="itemCategory">Category:</label>
              <select
                id="itemCategory"
                name="category"
                value={newItem.category}
                onChange={handleNewItemChange}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="formGroup">
              <label htmlFor="itemBarcode">New Barcode:</label>
              <input
                id="itemBarcode"
                name="barcode"
                value={newItem.barcode}
                readOnly
                disabled
              />
            </div>

            <button type="submit" style={{ backgroundColor: "var(--blue)" }}>
              <Plus /> Save Item
            </button>
          </form>
        )}
      </div>

      <br style={{ height: "1rem" }} />

      <input
        placeholder="Search by name, barcode, or category"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Price</th>
            <th className={styles.th}>Total Stock</th>
            <th className={styles.th}>Sold</th>
            <th className={styles.th}>Available Stock</th>
            <th className={styles.th}>Category</th>
            <th className={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {filteredInventory.length > 0 ? (
            filteredInventory.map((item) => (
              <tr key={item.id}>
                {editingItemId === item.id ? (
                  <>
                    <td className={styles.td}>
                      <input
                        name="name"
                        value={editFormData.name || ""}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className={styles.td}>
                      <input
                        name="price"
                        type="number"
                        value={editFormData.price?.toString() || ""}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className={styles.td}>
                      <input
                        name="total"
                        type="number"
                        value={editFormData.total?.toString() || ""}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className={styles.td}>
                      <input
                        name="sold"
                        type="number"
                        value={editFormData.sold?.toString() || ""}
                        onChange={handleEditChange}
                      />
                    </td>
                    <td className={styles.td}>
                      <p style={{ color: "white" }}>
                        {(Number(editFormData.total) || 0) -
                          (Number(editFormData.sold) || 0)}
                      </p>
                    </td>
                    <td className={styles.td}>
                      <select
                        name="category"
                        value={editFormData.category || ""}
                        onChange={handleEditChange}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button
                          style={{ backgroundColor: "var(--green)" }}
                          onClick={() => handleUpdateItem(item.id)}
                        >
                          <Check />
                        </button>
                        <button
                          style={{ backgroundColor: "var(--red)" }}
                          onClick={() => setEditingItemId(null)}
                        >
                          <X />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={styles.td}>{item.name}</td>
                    <td className={styles.td}>{item.price.toFixed(2)} EGP</td>
                    <td className={styles.td}>{item.total}</td>
                    <td className={styles.td}>{item.sold}</td>
                    <td className={styles.td}>{item.quantity}</td>
                    <td className={styles.td}>{item.category}</td>
                    <td className={styles.td}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button
                          onClick={() => handleGenerateItemPdf(item)}
                          disabled={generatingPdfFor === item.id}
                          title={`Download ${item.quantity} QR code stickers`}
                          style={{ backgroundColor: "var(--green)" }}
                        >
                          {generatingPdfFor === item.id ? (
                            <>Processing...</>
                          ) : (
                            <Download />
                          )}
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          title="Edit item"
                          style={{ backgroundColor: "var(--blue)" }}
                        >
                          <Edit />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          title="Delete item"
                          style={{ backgroundColor: "var(--red)" }}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td className={styles.td} colSpan={8}>
                No items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
