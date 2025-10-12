// components/BarcodeScanner.tsx
"use client";

import React from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onError }) => {
  const lastScannedRef = React.useRef<{
    barcode: string;
    timestamp: number;
  } | null>(null);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const barcode = detectedCodes[0].rawValue;
      const now = Date.now();

      // Only prevent duplicate scans within 400ms to avoid accidental double-scans
      if (
        lastScannedRef.current?.barcode === barcode &&
        now - lastScannedRef.current.timestamp < 400
      ) {
        return;
      }

      onScan(barcode);
      lastScannedRef.current = { barcode, timestamp: now };
    }
  };

  const handleError = (error: unknown) => {
    console.error("Scanner Error:", error);
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
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(90vw, 500px)",
          height: "min(90vw, 500px)",
          maxWidth: "500px",
          maxHeight: "500px",
          border: "3px solid #3b82f6",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
        }}
      >
        <Scanner
          onScan={handleScan}
          onError={handleError}
          formats={["qr_code"]}
          allowMultiple={false}
          scanDelay={200}
          components={{
            finder: true,
            onOff: false,
          }}
          styles={{
            container: {
              width: "100%",
              height: "100%",
            },
            video: {
              width: "100%",
              height: "100%",
              objectFit: "cover",
            },
          }}
        />
      </div>
    </div>
  );
};

export default BarcodeScanner;
