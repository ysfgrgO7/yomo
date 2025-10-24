"use client";
import { LogOut } from "lucide-react";
import styles from "./components.module.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";
import { Package, Smartphone, Home } from "lucide-react";

export default function Topbar({}) {
  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    localStorage.removeItem("accessCode");
    window.location.href = "/";
  };

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  return (
    <div className={styles.topbarContainer}>
      <div style={{ display: "flex" }} ref={menuRef}>
        <img
          src="/BIGLOGO.svg"
          onClick={() => setOpen((prev) => !prev)}
          alt="LOGO"
          style={{
            margin: "8px",
            padding: "10px",
            borderRadius: "10px",
            backgroundColor: "var(--blue)",
          }}
        />
        <div className={styles.dropdown}>
          {open && (
            <div className={styles.menu}>
              <ul className={styles.links}>
                <li className={pathname === "/home" ? styles.active : ""}>
                  <Link href="/home">
                    <Home className={styles.icon} />
                    <span>Home</span>
                  </Link>
                </li>
                <li className={pathname === "/inventory" ? styles.active : ""}>
                  <Link href="/inventory">
                    <Package className={styles.icon} />
                    <span>Inventory</span>
                  </Link>
                </li>
                <li className={pathname === "/pos" ? styles.active : ""}>
                  <Link href="/pos">
                    <Smartphone className={styles.icon} />
                    <span>POS</span>
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
