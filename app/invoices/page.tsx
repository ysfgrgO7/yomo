"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Download, Receipt } from "lucide-react";
import { Invoice } from "../pos/types";
import { generateInvoicePDF } from "../pos/invoice";
import styles from "./invoice.module.css";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<(Invoice & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "sales" | "refunds">("all");

  useEffect(() => {
    if (db) {
      setLoading(true);
      const invoicesCollection = collection(db, "invoices");
      const q = query(invoicesCollection, orderBy("timestamp", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const invoicesList: (Invoice & { id: string })[] = [];
          snapshot.forEach((doc) => {
            invoicesList.push({
              id: doc.id,
              ...(doc.data() as Invoice),
            });
          });
          setInvoices(invoicesList);
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching invoices:", err);
          setError("Failed to load invoices.");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, []);

  const handleDownloadInvoice = (invoice: Invoice) => {
    const cartItems = invoice.items.map((item, index) => ({
      id: `temp-${index}`,
      barcode: "",
      name: item.name,
      price: item.price,
      category: "",
      quantity: 0,
      total: 0,
      sold: 0,
      cartQuantity: item.quantity,
      subtotal: item.total,
    }));

    generateInvoicePDF(
      cartItems,
      invoice.subtotal,
      invoice.isRefund,
      invoice.invoiceNumber
    );
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === "sales") return !invoice.isRefund;
    if (filter === "refunds") return invoice.isRefund;
    return true;
  });

  const totalSales = invoices
    .filter((inv) => !inv.isRefund)
    .reduce((sum, inv) => sum + inv.subtotal, 0);

  const totalRefunds = invoices
    .filter((inv) => inv.isRefund)
    .reduce((sum, inv) => sum + inv.subtotal, 0);

  return (
    <div className="page">
      <h1 className={styles.header}>
        <Receipt size={32} /> Invoices
      </h1>

      {/* Stats */}
      <div className={styles.statsContainer}>
        <div className={`${styles.card} ${styles.cardBlue}`}>
          <h3>Total Sales</h3>
          <p className={styles.value}>{totalSales.toFixed(2)} EGP</p>
          <p className={styles.subText}>
            {invoices.filter((inv) => !inv.isRefund).length} invoices
          </p>
        </div>

        <div className={`${styles.card} ${styles.cardRed}`}>
          <h3>Total Refunds</h3>
          <p className={styles.value}>{totalRefunds.toFixed(2)} EGP</p>
          <p className={styles.subText}>
            {invoices.filter((inv) => inv.isRefund).length} refunds
          </p>
        </div>

        <div className={`${styles.card} ${styles.cardGreen}`}>
          <h3>Net Revenue</h3>
          <p className={styles.value}>
            {(totalSales - totalRefunds).toFixed(2)} EGP
          </p>
          <p className={styles.subText}>{invoices.length} total transactions</p>
        </div>
      </div>

      {/* Filter */}
      <div className={styles.filterButtons}>
        <button
          onClick={() => setFilter("all")}
          className={`${styles.filterBtn} ${
            filter === "all" ? styles.activeAll : ""
          }`}
        >
          All ({invoices.length})
        </button>
        <button
          onClick={() => setFilter("sales")}
          className={`${styles.filterBtn} ${
            filter === "sales" ? styles.activeSales : ""
          }`}
        >
          Sales ({invoices.filter((inv) => !inv.isRefund).length})
        </button>
        <button
          onClick={() => setFilter("refunds")}
          className={`${styles.filterBtn} ${
            filter === "refunds" ? styles.activeRefunds : ""
          }`}
        >
          Refunds ({invoices.filter((inv) => inv.isRefund).length})
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {filteredInvoices.length === 0 ? (
        <div className={styles.emptyBox}>
          <Receipt size={64} className={styles.emptyIcon} />
          <h3>No invoices found</h3>
          <p className={styles.emptyText}>
            {filter !== "all"
              ? `No ${filter} to display. Try changing the filter.`
              : "Start making sales to see invoices here."}
          </p>
        </div>
      ) : (
        <div className={styles.invoiceList}>
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`${styles.invoiceCard} ${
                invoice.isRefund ? styles.refund : styles.sale
              }`}
            >
              <div className={styles.invoiceInfo}>
                <div className={styles.invoiceHeader}>
                  <h3>{invoice.invoiceNumber}</h3>
                  {invoice.isRefund && (
                    <span className={styles.refundBadge}>REFUND</span>
                  )}
                  {!invoice.isRefund && (
                    <span className={styles.saleBadge}>SALE</span>
                  )}
                </div>
                <p className={styles.date}>{invoice.date}</p>
                <p className={styles.amount}>
                  {invoice.isRefund ? "-" : ""}
                  {invoice.subtotal.toFixed(2)} EGP
                </p>
              </div>

              <div className={styles.items}>
                <p className={styles.itemCount}>
                  Items: {invoice.items.length}
                </p>
                <div className={styles.itemList}>
                  {invoice.items.slice(0, 2).map((item, idx) => (
                    <div key={idx}>
                      {item.name} x{item.quantity}
                    </div>
                  ))}
                  {invoice.items.length > 2 && (
                    <div>+ {invoice.items.length - 2} more...</div>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDownloadInvoice(invoice)}
                className={`${styles.downloadBtn} ${
                  invoice.isRefund ? styles.red : styles.blue
                }`}
              >
                <Download size={18} /> Download PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
