"use client";

import { useState, useEffect } from "react";
import { Package, Smartphone, Loader2 } from "lucide-react";
import styles from "./home.module.css";

export default function HomePage() {
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

  if (isAuthenticated === null) {
    return (
      <div className="loadingContainer">
        <Loader2 className="loader" />
        <p className="loadingText">Checking authentication status...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className={styles.mainContent}>
        <h1>Welcome to the Yomo Shop System</h1>
        <p>Please select the section you need to access.</p>
        <br />

        <div className={styles.buttonGrid}>
          <button
            onClick={() => (window.location.href = "/inventory")}
            className={`${styles.cardButton} ${styles.inventoryButton}`}
          >
            <Package className={styles.iconBlue} />
            <h2 className={styles.cardTitle}>Inventory (Admin)</h2>
            <p className={styles.cardText}>
              Manage stock levels, prices, categories, and generate barcodes.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/pos")}
            className={`${styles.cardButton} ${styles.posButton}`}
          >
            <Smartphone className={styles.iconPurple} />
            <h2 className={styles.cardTitle}>Point of Sale (POS)</h2>
            <p className={styles.cardText}>
              Process transactions, scan items using the camera, and generate
              receipts.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
