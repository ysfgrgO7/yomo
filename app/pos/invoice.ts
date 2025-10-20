// app/pos/utils/invoice.ts

export interface CartItem {
  id: string;
  name: string;
  price: number;
  cartQuantity: number;
  subtotal: number;
}

export function generateInvoicePDF(
  cart: CartItem[],
  cartTotal: number,
  isRefund: boolean = false
) {
  if (cart.length === 0) return;

  const invoiceDate = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const invoiceNumber = `${isRefund ? "REF" : "INV"}-${Date.now()}`;
  const documentTitle = isRefund ? "REFUND RECEIPT" : "SALES INVOICE";
  const headerColor = isRefund ? "#ef4444" : "#3b82f6";

  const invoiceHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${isRefund ? "Refund" : "Invoice"}</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        padding: 40px;
        max-width: 800px;
        margin: 0 auto;
        background-color: #fff;
        color: #333;
      }
      .header {
        text-align: center;
        margin-bottom: 40px;
        border-bottom: 3px solid ${headerColor};
        padding-bottom: 20px;
      }
      .logo {
        height: 70px;
        margin-bottom: 10px;
        background-color: ${headerColor};
        padding: 1rem;
      }
      .store-info {
        text-align: center;
        font-size: 0.9em;
        color: #666;
        margin-bottom: 10px;
      }
      .invoice-title {
        font-size: 1.8em;
        letter-spacing: 1px;
        color: ${headerColor};
        margin: 10px 0 0;
      }
      .invoice-info {
        margin-top: 20px;
        margin-bottom: 30px;
        display: flex;
        justify-content: space-between;
        font-size: 0.95em;
      }
      ${
        isRefund
          ? `
      .refund-notice {
        background-color: #fef3c7;
        border: 2px solid #f59e0b;
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 20px;
        text-align: center;
        font-weight: bold;
        color: #92400e;
      }
      `
          : ""
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        border: 1px solid #ddd;
      }
      th {
        background-color: ${headerColor};
        color: white;
        padding: 12px;
        text-align: left;
        font-weight: 600;
      }
      td {
        padding: 10px;
        border-bottom: 1px solid #ddd;
      }
      tbody tr:nth-child(even) {
        background-color: #f9fafb;
      }
      .text-right {
        text-align: right;
      }
      .total-box {
        float: right;
        width: 300px;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 15px;
        background-color: #f9fafb;
      }
      .total-box table {
        width: 100%;
        border: none;
      }
      .total-box td {
        border: none;
        padding: 6px 0;
      }
      .total-box .final {
        font-weight: bold;
        font-size: 1.1em;
        color: #111;
      }
      .footer {
        margin-top: 60px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        font-size: 0.9em;
        color: #555;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="/BIGLOGO.svg" alt="Store Logo" class="logo" />
      <h1 class="invoice-title">${documentTitle}</h1>
      <div class="store-info">
        <p><strong>Yomo</strong> — Manshiyet el Bakri, Cairo</p>
        <p>Phone: 0120 1675335 </p>
      </div>
    </div>
    
    ${
      isRefund
        ? `
    <div class="refund-notice">
      ⚠️ THIS IS A REFUND TRANSACTION
    </div>
    `
        : ""
    }
    
    <div class="invoice-info">
      <p><strong>${
        isRefund ? "Refund" : "Invoice"
      } #:</strong> ${invoiceNumber}</p>
      <p><strong>Date:</strong> ${invoiceDate}</p>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Price</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${cart
          .map(
            (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${isRefund ? "-" : ""}${item.price.toFixed(2)} EGP</td>
            <td class="text-right">${item.cartQuantity}</td>
            <td class="text-right">${
              isRefund ? "-" : ""
            }${item.subtotal.toFixed(2)} EGP</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="total-box">
      <table>
        <tr>
          <td><strong>Subtotal:</strong></td>
          <td class="text-right">${isRefund ? "-" : ""}${cartTotal.toFixed(
    2
  )} EGP</td>
        </tr>
        <tr class="final">
          <td>${isRefund ? "Refund Amount:" : "Total Due:"}</td>
          <td class="text-right">${isRefund ? "-" : ""}${cartTotal.toFixed(
    2
  )} EGP</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <h3>Terms & Conditions</h3>
      ${
        isRefund
          ? `
      <p>This refund has been processed and the items have been returned to inventory.</p>
      <p>Please retain this receipt for your records.</p>
      `
          : `
      <p>Exchanges are allowed within 3 days of purchase.</p>
      <p>Items must be returned in their original condition, unused, and with all tags and packaging intact.</p>
      <p>No cash refunds are issued; exchanges only.</p>
      `
      }
      <p style="margin-top: 10px;">Thank you for shopping with us!</p>
    </div>
  </body>
  </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  }
}
