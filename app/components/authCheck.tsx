"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const authStatus = localStorage.getItem("authenticated") === "true";
    setIsAuthenticated(authStatus);
  }, []);

  useEffect(() => {
    // Don’t redirect if already on login page
    if (isAuthenticated === false && pathname !== "/") {
      router.push("/");
    }
  }, [isAuthenticated, pathname, router]);

  if (isAuthenticated === null) return <div>Loading...</div>;

  return <>{children}</>;
}
