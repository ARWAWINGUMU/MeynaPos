import { jsPDF } from "jspdf";
import type { ReceiptData } from "./receipt";
import { formatMoney } from "./money";
import { PAPER_FORMATS, type PrintPreferences } from "./printPreferences";

export const BRAND_NAME = "MeynaPOS";
export const BRAND_CREDIT = "Desarrollado por MeynaTech Soluciones";
export const BRAND_SLOGAN = "Tecnología para crecer juntos";

export interface ReceiptBlock {
  cells: string[][];
  widths: number[];
  size: number;
  lineHeight: number;
  height: number;
  bold: boolean;
  tableRow?: boolean;
  tableHeader?: boolean;
  logo?: "business" | "brand";
  centered?: boolean;
  footer?: boolean;
  divider?: boolean;
  group?: "totals";
}

export function createReceiptLayout(data: ReceiptData, preferences: PrintPreferences): ReceiptBlock[] {
  const paper = PAPER_FORMATS[preferences.format];
  const thermal = paper.height === null;
  const width = paper.width - preferences.margin * 2;
  const size = thermal ? 9 : 10;
  const metrics = new jsPDF({ unit: "mm" });
  const blocks: ReceiptBlock[] = [];
  const money = (value: number) => formatMoney(value, data.businessSettings.currency).replace(/\u00a0|\u202f/g, " ");
  function row(values: string[], widths: number[], bold = false, fontSize = size, tableRow = false, tableHeader = false): void {
    metrics.setFont("helvetica", bold ? "bold" : "normal");
    metrics.setFontSize(fontSize);
    const cells = values.map((value, index) => metrics.splitTextToSize(value, widths[index] - 2) as string[]);
    const lineHeight = fontSize * 0.352778 * 1.35;
    blocks.push({ cells, widths, bold, size: fontSize, lineHeight,
      height: Math.max(1, ...cells.map((cell) => cell.length)) * lineHeight + 2, tableRow, tableHeader });
  }
  const text = (value: string, bold = false, fontSize = size) => row([value], [width], bold, fontSize);
  const optional = (value?: string | null) => Boolean(value?.trim() && value.trim() !== "N/A");
  if (preferences.showLogo) blocks.push({ cells: [], widths: [], size, lineHeight: 0, height: 20, bold: false, logo: "business" });
  text(data.businessSettings.business_name, true, thermal ? 12 : 18);
  blocks[blocks.length - 1].centered = true;
  if (optional(data.businessSettings.tax_id)) text(`NIT/Documento: ${data.businessSettings.tax_id}`);
  if (preferences.showContact) {
    const address = [data.businessSettings.address, data.businessSettings.city].filter(optional).join(" - ");
    const contact = [data.businessSettings.phone, data.businessSettings.email].filter(optional).join(" | ");
    if (address) text(address);
    if (contact) text(contact);
  }
  const invoice = `Factura: ${data.sale.invoice_number}`;
  const date = `Fecha: ${new Date(data.sale.created_at).toLocaleString("es-CO")}`;
  if (thermal) {
    text(invoice, true);
    text(date);
  } else {
    row([invoice, date], [width * 0.5, width * 0.5], true);
  }
  if (preferences.showCashier && optional(data.cashierName)) text(`Cajero: ${data.cashierName}`);
  if (preferences.showCustomer) {
    text(`Cliente: ${data.customer.name}`);
    if (optional(data.customer.document_number)) text(`Documento: ${data.customer.document_number}`);
  }
  const paymentLabels = { CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia" };
  text(`Método de pago: ${data.paymentMethodName ?? paymentLabels[data.paymentMethod]}`);
  const columns = [width * 0.44, width * 0.12, width * 0.22, width * 0.22];
  if (!thermal) row(["Producto", "Cantidad", "Precio", "Subtotal"], columns, true, size, false, true);
  data.items.forEach((item) => {
    const price = Number(item.product.price);
    if (thermal) {
      text(item.product.name, true);
      text(`${item.quantity} x ${money(price)}`);
      row(["Subtotal", money(price * item.quantity)], [width * 0.35, width * 0.65]);
    } else {
      row([item.product.name, String(item.quantity), money(price), money(price * item.quantity)], columns, false, size, true);
    }
  });
  const totalsStart = blocks.length;
  row(["Subtotal", money(data.subtotal)], [width * 0.4, width * 0.6]);
  if (data.tax !== 0) row(["Impuesto", money(data.tax)], [width * 0.4, width * 0.6]);
  if (data.discount !== 0) row(["Descuento", `-${money(data.discount)}`], [width * 0.4, width * 0.6]);
  if (thermal) {
    text("Total final", true, 11);
    text(money(data.total), true, 11);
  } else {
    row(["Total final", money(data.total)], [width * 0.4, width * 0.6], true, 13);
  }
  if (data.paymentMethod === "CASH") {
    if (data.receivedAmount !== undefined) row(["Recibido", money(data.receivedAmount)], [width * 0.4, width * 0.6]);
    if (data.changeAmount !== undefined) row(["Cambio", money(data.changeAmount)], [width * 0.4, width * 0.6]);
  }
  blocks.slice(totalsStart).forEach((block) => { block.group = "totals"; });
  const footerStart = blocks.length;
  blocks.push({ cells: [], widths: [], size, lineHeight: 0, height: 4, bold: false, divider: true });
  blocks.push({ cells: [], widths: [], size, lineHeight: 0, height: 12, bold: false, logo: "brand" });
  text(BRAND_NAME, true, 10);
  text(BRAND_CREDIT, false, 8);
  text(BRAND_SLOGAN, false, 8);
  blocks.slice(footerStart).forEach((block) => { block.footer = true; block.centered = true; });
  return blocks;
}
