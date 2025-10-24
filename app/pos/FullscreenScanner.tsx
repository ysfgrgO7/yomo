// app/pos/FullscreenScanner.tsx
"use client";

import React from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onError }) => {
  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const barcode = detectedCodes[0].rawValue;
      onScan(barcode);
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
        backgroundColor: "var(--bg)",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            onOff: true, // Show camera on/off button
            torch: true, // Show torch/flashlight button (if supported)
            zoom: true, // Show zoom control (if supported)
            finder: true, // Show finder overlay
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

export function FullscreenScanner({
  onScan,
  onError,
}: {
  onScan: (code: string) => void;
  onError: (msg: string) => void;
}) {
  return (
    <div className="page">
      <BarcodeScanner onScan={onScan} onError={onError} />
    </div>
  );
}

export default BarcodeScanner;
