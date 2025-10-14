// app/utils/qrGenerators.ts
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { renderToString } from "react-dom/server";

export interface Item {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category: string;
  quantity: number; // Available quantity
  total: number; // Total initial stock
  sold: number; // Sold quantity
}

// === Helper to generate PDF for a specific item ===
export async function generateItemQRCodesPdf(
  item: Item,
  setError: (msg: string | null) => void,
  setGenerating: (id: string | null) => void
) {
  setGenerating(item.id);

  try {
    const stickersPerRow = 7;
    const stickersPerColumn = 5;
    const pagePaddingMm = 8;
    const gapMm = 1.5;
    const stickerWidthMm =
      (210 - pagePaddingMm * 2 - (stickersPerRow - 1) * gapMm) / stickersPerRow;
    const stickerHeightMm =
      (297 - pagePaddingMm * 2 - (stickersPerColumn - 1) * gapMm) /
      stickersPerColumn;
    const qrSizePx = Math.floor(stickerWidthMm * 3.78 * 0.8);

    // Hidden temporary container
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "210mm";
    container.style.height = "297mm";
    container.style.backgroundColor = "#FFFFFF";
    container.style.color = "#000000";
    container.style.zIndex = "-1";
    container.style.opacity = "0";
    document.body.appendChild(container);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${stickersPerRow}, 1fr)`;
    grid.style.gridAutoRows = "auto";
    grid.style.gap = `${gapMm}mm`;
    container.appendChild(grid);

    // Add all stickers
    for (let i = 0; i < item.quantity; i++) {
      const sticker = document.createElement("div");
      sticker.style.width = `${stickerWidthMm}mm`;
      sticker.style.height = `${stickerHeightMm}mm`;
      sticker.style.border = "2px solid #000";
      sticker.style.display = "flex";
      sticker.style.flexDirection = "column";
      sticker.style.alignItems = "center";
      sticker.style.justifyContent = "space-between";
      sticker.style.fontSize = "8px";
      sticker.style.backgroundColor = "#FFFFFF";
      sticker.style.color = "#000000";
      sticker.style.padding = "2px";
      sticker.style.boxSizing = "border-box";

      const name = document.createElement("p");
      name.textContent = item.name;
      name.style.margin = "1px 0";
      name.style.fontWeight = "600";
      name.style.fontSize = "8px";
      name.style.color = "#000000";
      sticker.appendChild(name);

      const qrContainer = document.createElement("div");
      qrContainer.innerHTML = renderToString(
        <QRCodeSVG
          value={item.barcode}
          size={qrSizePx}
          level="M"
          fgColor="#000000"
          bgColor="#FFFFFF"
        />
      );
      qrContainer.style.flex = "1";
      qrContainer.style.display = "flex";
      qrContainer.style.alignItems = "center";
      qrContainer.style.justifyContent = "center";
      sticker.appendChild(qrContainer);

      const price = document.createElement("p");
      price.textContent = `${item.price.toFixed(2)} EGP`;
      price.style.margin = "1px 0";
      price.style.fontSize = "8px";
      price.style.fontWeight = "600";
      price.style.color = "#000000";
      sticker.appendChild(price);

      grid.appendChild(sticker);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const stickersPerPage = stickersPerRow * stickersPerColumn;
    const totalPages = Math.ceil(item.quantity / stickersPerPage);

    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * stickersPerPage;
      const endIndex = Math.min(startIndex + stickersPerPage, item.quantity);

      const pageContainer = document.createElement("div");
      pageContainer.style.width = "210mm";
      pageContainer.style.height = "297mm";
      pageContainer.style.padding = `${pagePaddingMm}mm`;
      pageContainer.style.backgroundColor = "#FFFFFF";
      pageContainer.style.color = "#000000";
      pageContainer.style.display = "grid";
      pageContainer.style.gridTemplateColumns = `repeat(${stickersPerRow}, 1fr)`;
      pageContainer.style.gridTemplateRows = `repeat(${stickersPerColumn}, ${stickerHeightMm}mm)`;
      pageContainer.style.gap = `${gapMm}mm`;

      for (let i = startIndex; i < endIndex; i++) {
        pageContainer.appendChild(grid.children[i].cloneNode(true));
      }

      document.body.appendChild(pageContainer);
      const canvas = await html2canvas(pageContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      document.body.removeChild(pageContainer);
    }

    pdf.save(`${item.name.replace(/[^a-z0-9]/gi, "_")}_qr_codes.pdf`);
    document.body.removeChild(container);
    setError(null);
  } catch (err) {
    console.error("QR Generation Error:", err);
    setError(`Failed to generate PDF for ${item.name}.`);
  } finally {
    setGenerating(null);
  }
}

// === Helper to generate PDF for all items ===
export async function generateAllQRCodesPdf(
  inventory: Item[],
  setError: (msg: string | null) => void,
  setGenerating: (id: string | null) => void
) {
  if (inventory.length === 0) {
    setError("No items in inventory to generate QR codes.");
    return;
  }

  setGenerating("ALL");

  try {
    const stickersPerRow = 7;
    const stickersPerColumn = 5;
    const pagePaddingMm = 8;
    const gapMm = 1.5;
    const stickerWidthMm =
      (210 - pagePaddingMm * 2 - (stickersPerRow - 1) * gapMm) / stickersPerRow;
    const stickerHeightMm =
      (297 - pagePaddingMm * 2 - (stickersPerColumn - 1) * gapMm) /
      stickersPerColumn;
    const stickersPerPage = stickersPerRow * stickersPerColumn;
    const qrSizePx = Math.floor(stickerWidthMm * 3.78 * 0.8);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "210mm";
    container.style.height = "297mm";
    container.style.zIndex = "-1";
    container.style.opacity = "0";
    container.style.backgroundColor = "#FFFFFF";
    container.style.color = "#000000";
    document.body.appendChild(container);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${stickersPerRow}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${stickersPerColumn}, ${stickerHeightMm}mm)`;
    grid.style.gap = `${gapMm}mm`;
    container.appendChild(grid);

    const allStickers: HTMLElement[] = [];

    for (const item of inventory) {
      for (let i = 0; i < item.quantity; i++) {
        const sticker = document.createElement("div");
        sticker.style.width = `${stickerWidthMm}mm`;
        sticker.style.height = `${stickerHeightMm}mm`;
        sticker.style.border = "2px solid #000";
        sticker.style.display = "flex";
        sticker.style.flexDirection = "column";
        sticker.style.alignItems = "center";
        sticker.style.justifyContent = "space-between";
        sticker.style.fontSize = "8px";
        sticker.style.backgroundColor = "#FFFFFF";
        sticker.style.color = "#000000";
        sticker.style.padding = "2px";
        sticker.style.boxSizing = "border-box";

        const name = document.createElement("p");
        name.textContent = item.name;
        name.style.fontWeight = "600";
        name.style.fontSize = "8px";
        name.style.color = "#000000";
        sticker.appendChild(name);

        const qrContainer = document.createElement("div");
        qrContainer.innerHTML = renderToString(
          <QRCodeSVG
            value={item.barcode}
            size={qrSizePx}
            level="M"
            fgColor="#000000"
            bgColor="#FFFFFF"
          />
        );
        qrContainer.style.flex = "1";
        qrContainer.style.display = "flex";
        qrContainer.style.alignItems = "center";
        qrContainer.style.justifyContent = "center";
        sticker.appendChild(qrContainer);

        const price = document.createElement("p");
        price.textContent = `${item.price.toFixed(2)} EGP`;
        price.style.fontSize = "8px";
        price.style.fontWeight = "600";
        price.style.color = "#000000";
        sticker.appendChild(price);

        allStickers.push(sticker);
      }
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const totalPages = Math.ceil(allStickers.length / stickersPerPage);

    for (let page = 0; page < totalPages; page++) {
      const startIndex = page * stickersPerPage;
      const endIndex = Math.min(
        startIndex + stickersPerPage,
        allStickers.length
      );

      const pageContainer = document.createElement("div");
      pageContainer.style.width = "210mm";
      pageContainer.style.height = "297mm";
      pageContainer.style.padding = `${pagePaddingMm}mm`;
      pageContainer.style.backgroundColor = "#FFFFFF";
      pageContainer.style.color = "#000000";
      pageContainer.style.display = "grid";
      pageContainer.style.gridTemplateColumns = `repeat(${stickersPerRow}, 1fr)`;
      pageContainer.style.gridTemplateRows = `repeat(${stickersPerColumn}, ${stickerHeightMm}mm)`;
      pageContainer.style.gap = `${gapMm}mm`;

      for (let i = startIndex; i < endIndex; i++) {
        pageContainer.appendChild(allStickers[i].cloneNode(true));
      }

      document.body.appendChild(pageContainer);
      const canvas = await html2canvas(pageContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      document.body.removeChild(pageContainer);
    }

    pdf.save("all_inventory_qr_codes.pdf");
    document.body.removeChild(container);
    setError(null);
  } catch (err) {
    console.error("All QR PDF Error:", err);
    setError("Failed to generate all QR codes.");
  } finally {
    setGenerating(null);
  }
}
