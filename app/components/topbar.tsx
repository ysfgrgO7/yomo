"use client";
import { LogOut } from "lucide-react";
import styles from "./components.module.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";
import { Package, Smartphone, Home, Receipt } from "lucide-react";

export default function Topbar({}) {
  const [isClient, setIsClient] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Ensure we're on the client before doing anything with localStorage
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("authenticated");
      localStorage.removeItem("accessCode");
      window.location.href = "/";
    }
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className={styles.topbarContainer}>
        <div style={{ display: "flex" }} ref={menuRef}>
          <img
            src="/BIGLOGO.svg"
            alt="LOGO"
            draggable={false}
            style={{
              margin: "8px",
              padding: "10px",
              borderRadius: "10px",
              backgroundColor: "var(--blue)",
              cursor: "pointer",
            }}
          />
        </div>
        <button className={styles.logoutButton}>
          <LogOut className={styles.logoutIcon} />
          <span className={styles.logoutText}>Logout</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.topbarContainer}>
      <div style={{ display: "flex" }} ref={menuRef}>
        <img
          src="/BIGLOGO.svg"
          onClick={() => setOpen((prev) => !prev)}
          alt="LOGO"
          draggable={false}
          className={styles.logo}
        />
        <div className={styles.dropdown}>
          {open && (
            <div className={styles.menu}>
              <ul className={styles.links}>
                <li
                  className={pathname === "/home" ? styles.active : ""}
                  onClick={() => setOpen((prev) => !prev)}
                >
                  <Link href="/home">
                    <Home className={styles.icon} />
                    <span>Home</span>
                  </Link>
                </li>
                <li
                  className={pathname === "/inventory" ? styles.active : ""}
                  onClick={() => setOpen((prev) => !prev)}
                >
                  <Link href="/inventory">
                    <Package className={styles.icon} />
                    <span>Inventory</span>
                  </Link>
                </li>
                <li
                  className={pathname === "/pos" ? styles.active : ""}
                  onClick={() => setOpen((prev) => !prev)}
                >
                  <Link href="/pos">
                    <Smartphone className={styles.icon} />
                    <span>POS</span>
                  </Link>
                </li>

                <li
                  className={pathname === "/invoices" ? styles.active : ""}
                  onClick={() => setOpen((prev) => !prev)}
                >
                  <Link href="/invoices">
                    <Receipt className={styles.icon} />
                    <span>Invoices</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <button onClick={handleLogout} className={styles.logoutButton}>
        <LogOut className={styles.logoutIcon} />
        <span className={styles.logoutText}>Logout</span>
      </button>
    </div>
  );
}
