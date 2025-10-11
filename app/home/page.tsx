"use client";

import { useState, useEffect } from "react";
import { Package, Smartphone, LogOut, Loader2 } from "lucide-react";
import styles from "@/app/styles.module.css";

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

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    localStorage.removeItem("accessCode");
    window.location.href = "/";
  };

  if (isAuthenticated === null) {
    return (
      <div className={styles.loadingContainer}>
        <Loader2 className={styles.loader} />
        <p className={styles.loadingText}>Checking authentication status...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.logoutContainer}>
        <button onClick={handleLogout} className={styles.logoutButton}>
          <LogOut className={styles.logoutIcon} />
          <span className={styles.logoutText}>Logout</span>
        </button>
      </div>

      <div className={styles.mainContent}>
        <h1 className={styles.title}>Welcome to the Shop System</h1>
        <p className={styles.subtitle}>
          Please select the section you need to access.
        </p>

        <div className={styles.buttonGrid}>
          <button
            onClick={() => (window.location.href = "/home/inventory")}
            className={`${styles.cardButton} ${styles.inventoryButton}`}
          >
            <Package className={styles.iconBlue} />
            <h2 className={styles.cardTitle}>Inventory (Admin)</h2>
            <p className={styles.cardText}>
              Manage stock levels, prices, categories, and generate barcodes.
            </p>
          </button>

          <button
            onClick={() => (window.location.href = "/home/pos")}
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
