// components/BarcodeScanner.tsx
"use client";

import React from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Camera } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onError }) => {
  // Use a ref to track the last successful scan to prevent immediate re-scans
  const lastScannedRef = React.useRef<string | null>(null);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const barcode = detectedCodes[0].rawValue;

      // Implement a simple throttle mechanism
      if (lastScannedRef.current === barcode) {
        return;
      }

      // Perform the scan action
      onScan(barcode);
      lastScannedRef.current = barcode; // Set the current successful scan

      // Clear the ref after a brief pause so the same item can be scanned again if needed
      setTimeout(() => {
        lastScannedRef.current = null;
      }, 1000); // Allow re-scan after 1 second
    }
  };

  const handleError = (error: unknown) => {
    console.error("Scanner Error:", error);
    // Only show a critical error to the user once
    if (
      error instanceof Error &&
      (error.name === "NotAllowedError" || error.name === "NotFoundError")
    ) {
      onError(
        "Camera access denied or not found. Check permissions and device."
      );
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "350px",
        margin: "0 auto",
        border: "3px solid #3b82f6",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.75rem",
          backgroundColor: "#3b82f6",
          color: "white",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <Camera size={18} /> Point of Sale Scanner
      </div>
      <Scanner
        onScan={handleScan}
        onError={handleError}
        formats={["qr_code"]}
        allowMultiple={false}
        scanDelay={200}
        components={{
          finder: true,
          onOff: true,
        }}
        styles={{
          container: { width: "100%", height: "auto", paddingTop: "100%" },
          video: {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          },
        }}
      />
    </div>
  );
};

export default BarcodeScanner;
