import { jsPDF } from "jspdf";

import type { Customer } from "../services/customerService";
import type { BusinessSettings } from "../services/settingService";
import type { CartItem, PaymentMethod } from "../types/api";
import { resolveMediaUrl } from "./media";
import { formatMoney } from "./money";

export interface ReceiptSale {
  id: number;
  invoice_number: string;
  created_at: string;
}

export interface ReceiptData {
  sale: ReceiptSale;
  items: CartItem[];
  customer: Customer;
  cashierName: string;
  paymentMethod: PaymentMethod;
  receivedAmount: number;
  changeAmount: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  businessSettings: BusinessSettings;
  logoUrl: string;
}

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[char];
  });
}

function businessLogoUrl(data: ReceiptData): string {
  return resolveMediaUrl(data.businessSettings.logo_url) ?? data.logoUrl;
}

async function toImageDataUrl(url: string): Promise<string | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image could not be loaded"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function buildReceiptHtml(data: ReceiptData): string {
  const rows = data.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.product.name)}</td>
          <td>${item.quantity}</td>
          <td>${formatMoney(Number(item.product.price), data.businessSettings.currency)}</td>
          <td>${formatMoney(Number(item.product.price) * item.quantity, data.businessSettings.currency)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Recibo ${escapeHtml(data.sale.invoice_number)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
          header { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 16px; }
          img { width: 72px; height: 72px; object-fit: contain; }
          h1 { margin: 0; color: #1B8A5A; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
          th { background: #ecfdf5; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
          .totals { margin-left: auto; width: 320px; margin-top: 24px; }
          .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
          .total { color: #1B8A5A; font-weight: 700; font-size: 20px; }
          footer { border-top: 1px solid #d1d5db; margin-top: 32px; padding-top: 16px; display: flex; gap: 12px; align-items: center; color: #1E4E5F; }
          footer img { width: 42px; height: 42px; }
          @media print { button { display: none; } body { margin: 18px; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <header>
          <img src="${businessLogoUrl(data)}" alt="Logo del negocio" />
          <div>
            <h1>${escapeHtml(data.businessSettings.business_name)}</h1>
            <p>NIT/Documento: ${escapeHtml(data.businessSettings.tax_id)}</p>
            <p>${escapeHtml(data.businessSettings.address)} - ${escapeHtml(data.businessSettings.city)}</p>
            <p>Tel: ${escapeHtml(data.businessSettings.phone)} | ${escapeHtml(data.businessSettings.email)}</p>
          </div>
        </header>
        <div class="grid">
          <div><strong>Factura:</strong> ${escapeHtml(data.sale.invoice_number)}</div>
          <div><strong>Fecha:</strong> ${new Date(data.sale.created_at).toLocaleString()}</div>
          <div><strong>Cajero:</strong> ${escapeHtml(data.cashierName)}</div>
          <div><strong>Cliente:</strong> ${escapeHtml(data.customer.name)}</div>
          <div><strong>Documento:</strong> ${escapeHtml(data.customer.document_number ?? "N/A")}</div>
          <div><strong>Pago:</strong> ${paymentLabels[data.paymentMethod]}</div>
        </div>
        <table>
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="totals">
          <div><span>Subtotal</span><span>${formatMoney(data.subtotal, data.businessSettings.currency)}</span></div>
          <div><span>Impuesto ${Number(data.businessSettings.tax_percentage).toFixed(2)}%</span><span>${formatMoney(data.tax, data.businessSettings.currency)}</span></div>
          <div><span>Descuento</span><span>-${formatMoney(data.discount, data.businessSettings.currency)}</span></div>
          <div class="total"><span>Total final</span><span>${formatMoney(data.total, data.businessSettings.currency)}</span></div>
          <div><span>Recibido</span><span>${formatMoney(data.receivedAmount, data.businessSettings.currency)}</span></div>
          <div><span>Cambio</span><span>${formatMoney(data.changeAmount, data.businessSettings.currency)}</span></div>
        </section>
        <footer>
          <img src="${data.logoUrl}" alt="Logo MeynaPOS" />
          <div>
            <strong>MeynaPOS</strong>
            <div>Tecnología desarrollada por MeynaPOS — Tecnología para crecer juntos</div>
          </div>
        </footer>
      </body>
    </html>
  `;
}

function writeLine(pdf: jsPDF, text: string, x: number, y: number, options?: { bold?: boolean; size?: number }) {
  pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
  pdf.setFontSize(options?.size ?? 10);
  pdf.text(text, x, y);
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const pdf = await createReceiptPdf(data);
  pdf.save(`recibo-${data.sale.invoice_number}.pdf`);
}

async function createReceiptPdf(data: ReceiptData): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const businessLogo = await toImageDataUrl(businessLogoUrl(data));
  const meynaLogo = await toImageDataUrl(data.logoUrl);

  if (businessLogo) pdf.addImage(businessLogo, "PNG", 40, 32, 64, 64);
  writeLine(pdf, data.businessSettings.business_name, 120, 48, { bold: true, size: 16 });
  writeLine(pdf, `NIT/Documento: ${data.businessSettings.tax_id}`, 120, 66);
  writeLine(pdf, `${data.businessSettings.address} - ${data.businessSettings.city}`, 120, 82);
  writeLine(pdf, `Tel: ${data.businessSettings.phone} | ${data.businessSettings.email}`, 120, 98);

  writeLine(pdf, `Factura: ${data.sale.invoice_number}`, 40, 138, { bold: true });
  writeLine(pdf, `Fecha: ${new Date(data.sale.created_at).toLocaleString()}`, 320, 138);
  writeLine(pdf, `Cajero: ${data.cashierName}`, 40, 156);
  writeLine(pdf, `Cliente: ${data.customer.name}`, 320, 156);
  writeLine(pdf, `Documento cliente: ${data.customer.document_number ?? "N/A"}`, 40, 174);
  writeLine(pdf, `Método de pago: ${paymentLabels[data.paymentMethod]}`, 320, 174);

  let y = 220;
  writeLine(pdf, "Producto", 40, y, { bold: true });
  writeLine(pdf, "Cant.", 310, y, { bold: true });
  writeLine(pdf, "Precio", 380, y, { bold: true });
  writeLine(pdf, "Subtotal", 470, y, { bold: true });
  y += 18;
  data.items.forEach((item) => {
    const name = item.product.name.slice(0, 38);
    writeLine(pdf, name, 40, y);
    writeLine(pdf, String(item.quantity), 310, y);
    writeLine(pdf, formatMoney(Number(item.product.price), data.businessSettings.currency), 380, y);
    writeLine(pdf, formatMoney(Number(item.product.price) * item.quantity, data.businessSettings.currency), 470, y);
    y += 18;
  });

  y += 22;
  writeLine(pdf, `Subtotal general: ${formatMoney(data.subtotal, data.businessSettings.currency)}`, 360, y);
  y += 18;
  writeLine(pdf, `Impuesto aplicado: ${Number(data.businessSettings.tax_percentage).toFixed(2)}%`, 360, y);
  y += 18;
  writeLine(pdf, `Valor del impuesto: ${formatMoney(data.tax, data.businessSettings.currency)}`, 360, y);
  y += 18;
  writeLine(pdf, `Descuento: -${formatMoney(data.discount, data.businessSettings.currency)}`, 360, y);
  y += 18;
  writeLine(pdf, `Total final: ${formatMoney(data.total, data.businessSettings.currency)}`, 360, y, { bold: true, size: 13 });
  y += 18;
  writeLine(pdf, `Valor recibido: ${formatMoney(data.receivedAmount, data.businessSettings.currency)}`, 360, y);
  y += 18;
  writeLine(pdf, `Cambio: ${formatMoney(data.changeAmount, data.businessSettings.currency)}`, 360, y);

  const footerY = 710;
  pdf.line(40, footerY - 18, 572, footerY - 18);
  if (meynaLogo) pdf.addImage(meynaLogo, "PNG", 40, footerY, 36, 36);
  writeLine(pdf, "MeynaPOS", 86, footerY + 12, { bold: true, size: 12 });
  writeLine(pdf, "Tecnología desarrollada por MeynaPOS — Tecnología para crecer juntos", 86, footerY + 30);

  return pdf;
}

export async function printReceiptPdf(data: ReceiptData): Promise<void> {
  const pdf = await createReceiptPdf(data);
  pdf.autoPrint();
  const blobUrl = pdf.output("bloburl");
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = String(blobUrl);
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
}

export function openReceiptWindow(data: ReceiptData): void {
  const receiptWindow = window.open("", "_blank", "width=900,height=720");
  if (!receiptWindow) {
    void downloadReceiptPdf(data);
    return;
  }
  receiptWindow.document.write(buildReceiptHtml(data));
  receiptWindow.document.close();
}
