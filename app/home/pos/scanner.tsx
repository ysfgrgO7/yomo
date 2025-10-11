"use client";

import React from "react";
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Camera } from "lucide-react";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onError: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onError }) => {
  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      // Assuming the barcode is the rawValue of the first detected code
      const barcode = detectedCodes[0].rawValue;
      onScan(barcode);
    }
  };

  const handleError = (error: unknown) => {
    console.error("Scanner Error:", error);
    onError(
      "Camera error. Please ensure permissions are granted and you are on HTTPS."
    );
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "300px",
        margin: "0 auto",
        border: "2px solid #3b82f6",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.5rem",
          backgroundColor: "#3b82f6",
          color: "white",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <Camera size={16} /> QR Scanner
      </div>
      <Scanner
        onScan={handleScan}
        onError={handleError}
        formats={["qr_code"]} // Focus on QR codes (which your barcodes are)
        allowMultiple={false} // Only process one code at a time
        scanDelay={500} // Half-second delay between scans
        styles={{
          container: { width: "100%", height: "auto", paddingTop: "100%" }, // 1:1 aspect ratio container
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
