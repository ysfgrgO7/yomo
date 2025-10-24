"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

// --- Login Form Component ---
function LoginForm({
  setIsAuthenticated,
}: {
  setIsAuthenticated: (status: boolean) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const codeDoc = doc(db, "codes", code);
      const docSnap = await getDoc(codeDoc);

      if (docSnap.exists()) {
        localStorage.setItem("authenticated", "true");
        localStorage.setItem("accessCode", code);

        try {
          const date = new Date();
          const timestamp = date.toISOString();
          const safeTimestamp = timestamp.replace(/[^a-zA-Z0-9]/g, "");
          const docId = `${safeTimestamp}_${code}`;

          await setDoc(doc(db, "logins", docId), {
            code,
            timestamp,
            status: "success",
            authDocId: docSnap.id,
          });
        } catch (logError) {
          console.error("Failed to write login log:", logError);
        }

        setIsAuthenticated(true);
      } else {
        setError("Invalid access code");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      if (!localStorage.getItem("authenticated")) setLoading(false);
    }
  };

  return (
    <div className="page">
      <div>
        <h1>Yomo Shop System</h1>
        <p>Enter your access code to continue</p>
      </div>

      <form onSubmit={handleLogin}>
        <div className="formGroup">
          <label htmlFor="code">Access Code</label>
          <input
            type="password"
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter your code"
            required
            disabled={loading}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Login"}
        </button>
      </form>
    </div>
  );
}

// --- Root Authentication Wrapper ---
export default function AuthRoot() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const authenticatedStatus =
      localStorage.getItem("authenticated") === "true";
    setIsAuthenticated(authenticatedStatus);
  }, []);

  useEffect(() => {
    if (isAuthenticated === true) window.location.href = "/home";
  }, [isAuthenticated]);

  if (isAuthenticated === null) {
    return (
      <div className="loading">
        <p>Checking authentication status...</p>
      </div>
    );
  }

  return <LoginForm setIsAuthenticated={setIsAuthenticated} />;
}
