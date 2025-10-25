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
    <Scanner
      onScan={handleScan}
      onError={handleError}
      formats={["qr_code"]}
      allowMultiple={false}
      scanDelay={200}
      components={{
        onOff: false, // Show camera on/off button
        torch: true, // Show torch/flashlight button (if supported)
        zoom: false, // Show zoom control (if supported)
        finder: true, // Show finder overlay
      }}
      styles={{
        container: {
          border: "3px solid var(--blue)",
          boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
          width: "100%",
          height: "100%",
        },
        video: {
          width: "100%",
          height: "100%",
        },
      }}
    />
  );
};

export function FullscreenScanner({
  onScan,
  onError,
}: {
  onScan: (code: string) => void;
  onError: (msg: string) => void;
}) {
  return <BarcodeScanner onScan={onScan} onError={onError} />;
}

export default BarcodeScanner;
