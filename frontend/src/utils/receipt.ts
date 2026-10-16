import { jsPDF } from "jspdf";
import type { Customer } from "../services/customerService";
import { getSettings, type BusinessSettings } from "../services/settingService";
import type { CartItem, PaymentMethod } from "../types/api";
import { resolveMediaUrl } from "./media";
import { getBusinessPrintPreferences, normalizePrintPreferences, PAPER_FORMATS, type PrintPreferences } from "./printPreferences";
import { createReceiptLayout, type ReceiptBlock } from "./receiptLayout";
import { buildReceiptPrintHtml, printReceiptDocument, type ReceiptPrintDocument, type ReceiptPrintPage } from "./receiptPrintDocument";

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
  paymentMethodName?: string | null;
  receivedAmount?: number;
  changeAmount?: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  businessSettings: BusinessSettings;
  logoUrl: string;
}

async function loadLogo(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) return url;
  if (typeof Image === "undefined" || !url) return null;
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(null), 3000);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    image.onerror = () => { window.clearTimeout(timeout); resolve(null); };
    image.src = url;
  });
}

export async function prepareReceiptDocument(data: ReceiptData, options?: PrintPreferences): Promise<ReceiptPrintDocument> {
  const preferences = normalizePrintPreferences(options ?? getBusinessPrintPreferences(data.businessSettings));
  const paper = PAPER_FORMATS[preferences.format];
  const brandLogo = await loadLogo(data.logoUrl);
  if (!brandLogo) throw new Error("No fue posible cargar el logo obligatorio de MeynaPOS.");
  const logo = preferences.showLogo
    ? await loadLogo(resolveMediaUrl(data.businessSettings.logo_url) ?? data.logoUrl) : null;
  const blocks = createReceiptLayout(data, preferences).filter((block) => block.logo !== "business" || logo);
  const footer = blocks.filter((block) => block.footer);
  const footerHeight = footer.reduce((sum, block) => sum + block.height, 0);
  const height = paper.height ?? Math.min(5000, Math.max(paper.width,
    blocks.reduce((sum, block) => sum + block.height, 0) + preferences.margin * 2 + 4));
  const pdf = new jsPDF({ unit: "mm", format: [paper.width, height], orientation: "portrait" });
  const pages: ReceiptPrintPage[] = [{ width: paper.width, height, commands: [] }];
  let currentPage = pages[0];
  const margin = preferences.margin;
  let bottom = height - margin - footerHeight;
  const tableHeader = blocks.find((block) => block.tableHeader);
  let y = margin;

  function newPage(): void {
    if (!paper.height) currentPage.height = Math.max(1, y + margin);
    currentPage = { width: paper.width, height, commands: [] };
    pages.push(currentPage);
    y = margin;
  }
  function draw(block: ReceiptBlock, allowHeader = true): void {
    if (block.divider) {
      currentPage.commands.push({ kind: "line", x1: margin, x2: paper.width - margin, y: y + 1, color: "#6b7280", width: 0.25 });
      y += block.height;
      return;
    }
    if (block.logo) {
      if (y + block.height > bottom) newPage();
      const imageData = block.logo === "brand" ? brandLogo : logo;
      if (imageData) {
        const image = pdf.getImageProperties(imageData);
        const imageSize = block.logo === "brand" ? 10 : 18;
        const factor = Math.min(imageSize / image.width, imageSize / image.height);
        const imageWidth = image.width * factor;
        currentPage.commands.push({ kind: "image", data: imageData, x: (paper.width - imageWidth) / 2, y,
          width: imageWidth, height: image.height * factor });
      }
      y += block.height;
      return;
    }
    const available = height - margin * 2;
    if (y + block.height > bottom && block.height <= available) {
      newPage();
      if (block.tableRow && tableHeader && allowHeader) draw(tableHeader, false);
    }
    const lines = Math.max(1, ...block.cells.map((cell) => cell.length));
    for (let line = 0; line < lines; line += 1) {
      if (y + block.lineHeight > bottom) {
        newPage();
        if (block.tableRow && tableHeader && allowHeader) draw(tableHeader, false);
      }
      let x = margin;
      block.cells.forEach((cell, index) => {
        if (cell[line]) {
          const rightAligned = index > 0 && !block.tableHeader;
          currentPage.commands.push({ kind: "text", text: cell[line],
            x: block.centered ? paper.width / 2 : rightAligned ? x + block.widths[index] - 1 : x + 1,
            y: y + block.lineHeight * 0.78, size: block.size, bold: block.bold,
            align: block.centered ? "center" : rightAligned ? "right" : "left" });
        }
        x += block.widths[index];
      });
      y += block.lineHeight;
    }
    if (block.tableRow || block.tableHeader) {
      currentPage.commands.push({ kind: "line", x1: margin, x2: paper.width - margin, y: y + 0.5, color: "#d1d5db", width: 0.2 });
    }
    y += 2;
  }
  const content = blocks.filter((block) => !block.footer);
  const totalsHeight = content.filter((block) => block.group === "totals").reduce((sum, block) => sum + block.height, 0);
  content.forEach((block, index) => {
    if (block.group === "totals" && content[index - 1]?.group !== "totals"
      && totalsHeight <= bottom - margin && y + totalsHeight > bottom) newPage();
    draw(block);
  });
  if (paper.height) y = height - margin - footerHeight;
  else if (y + footerHeight > height - margin) newPage();
  bottom = height - margin;
  footer.forEach((block) => draw(block));
  if (!paper.height) currentPage.height = Math.max(1, y + margin);
  return { title: `Factura ${data.sale.invoice_number}`, pages };
}

export async function createReceiptPdf(data: ReceiptData, options?: PrintPreferences): Promise<jsPDF> {
  const document = await prepareReceiptDocument(data, options);
  const first = document.pages[0];
  const orientation = (page: ReceiptPrintPage) => page.width > page.height ? "landscape" as const : "portrait" as const;
  const pdf = new jsPDF({ unit: "mm", format: [first.width, first.height], orientation: orientation(first) });
  document.pages.forEach((page, index) => {
    if (index > 0) pdf.addPage([page.width, page.height], orientation(page));
    page.commands.forEach((command) => {
      if (command.kind === "image") pdf.addImage(command.data, "PNG", command.x, command.y, command.width, command.height);
      else if (command.kind === "line") {
        pdf.setDrawColor(command.color);
        pdf.setLineWidth(command.width);
        pdf.line(command.x1, command.y, command.x2, command.y);
      } else {
        pdf.setFont("helvetica", command.bold ? "bold" : "normal");
        pdf.setFontSize(command.size);
        pdf.setTextColor(command.bold ? "#166534" : "#111827");
        pdf.text(command.text, command.x, command.y, { align: command.align });
      }
    });
  });
  pdf.setDisplayMode("fullwidth", "continuous");
  return pdf;
}

export async function resolveReceiptForPrinting(data: ReceiptData): Promise<ReceiptData> {
  const settings = await getSettings();
  if (settings.id !== data.businessSettings.id) {
    throw new Error("El comprobante no pertenece al negocio activo.");
  }
  return { ...data, businessSettings: settings };
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const pdf = await createReceiptPdf(await resolveReceiptForPrinting(data));
  pdf.save(`recibo-${data.sale.invoice_number}.pdf`);
}

export async function printReceiptPdf(data: ReceiptData, preferences?: PrintPreferences): Promise<void> {
  const current = preferences ? data : await resolveReceiptForPrinting(data);
  await printReceiptDocument(await prepareReceiptDocument(current, preferences));
}

export async function buildReceiptHtml(data: ReceiptData, options?: PrintPreferences): Promise<string> {
  return buildReceiptPrintHtml(await prepareReceiptDocument(data, options));
}

export function openReceiptWindow(data: ReceiptData): void {
  void printReceiptPdf(data);
}
