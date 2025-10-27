"use client";

import { Package, Smartphone } from "lucide-react";
import styles from "./home.module.css";

export default function HomePage() {
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
