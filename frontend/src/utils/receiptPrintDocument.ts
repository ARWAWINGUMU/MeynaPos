export type ReceiptPrintCommand =
  | { kind: "text"; text: string; x: number; y: number; size: number; bold: boolean; align: "left" | "center" | "right" }
  | { kind: "image"; data: string; x: number; y: number; width: number; height: number }
  | { kind: "line"; x1: number; x2: number; y: number; color: string; width: number };

export interface ReceiptPrintPage {
  width: number;
  height: number;
  commands: ReceiptPrintCommand[];
}

export interface ReceiptPrintDocument {
  title: string;
  pages: ReceiptPrintPage[];
}

function escapeMarkup(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function buildReceiptPrintHtml(document: ReceiptPrintDocument): string {
  const styles = document.pages.map((page, index) =>
    `@page receipt${index}{size:${page.width}mm ${page.height}mm;margin:0}`
    + `.receipt-page-${index}{page:receipt${index};width:${page.width}mm;height:${page.height}mm}`).join("\n");
  const pages = document.pages.map((page, index) => {
    const elements = page.commands.map((command) => {
      if (command.kind === "image") return `<image href="${escapeMarkup(command.data)}" x="${command.x}" y="${command.y}" width="${command.width}" height="${command.height}" />`;
      if (command.kind === "line") return `<line x1="${command.x1}" x2="${command.x2}" y1="${command.y}" y2="${command.y}" stroke="${command.color}" stroke-width="${command.width}" />`;
      const anchor = command.align === "center" ? "middle" : command.align === "right" ? "end" : "start";
      return `<text x="${command.x}" y="${command.y}" font-size="${command.size * 25.4 / 72}" font-weight="${command.bold ? 700 : 400}" text-anchor="${anchor}" fill="${command.bold ? "#166534" : "#111827"}">${escapeMarkup(command.text)}</text>`;
    }).join("");
    return `<section class="receipt-page receipt-page-${index}" aria-label="Página ${index + 1}"><svg xmlns="http://www.w3.org/2000/svg" width="${page.width}mm" height="${page.height}mm" viewBox="0 0 ${page.width} ${page.height}" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="Comprobante">${elements}</svg></section>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeMarkup(document.title)}</title>
    <style>${styles}
    *{box-sizing:border-box}html,body{margin:0;padding:0}body{background:white}
    .receipt-page{margin:0;padding:0;break-inside:avoid;break-after:page}.receipt-page:last-child{break-after:auto}
    svg{display:block} @media print{html,body{margin:0;padding:0}svg{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style>
    </head><body>${pages}</body></html>`;
}

export async function printReceiptDocument(document: ReceiptPrintDocument): Promise<void> {
  const frame = window.document.createElement("iframe");
  frame.title = document.title;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1024px;height:768px;border:0";
  const previousFrame = window.document.querySelector("iframe[data-receipt-print]");
  previousFrame?.remove();
  frame.dataset.receiptPrint = "true";
  await new Promise<void>((resolve, reject) => {
    let expired = false;
    let started = false;
    const timeout = window.setTimeout(() => {
      expired = true;
      frame.remove();
      reject(new Error("No fue posible preparar el documento para imprimir."));
    }, 15000);
    frame.onload = () => {
      if (started) return;
      started = true;
      void (async () => {
        try {
          const content = frame.contentDocument;
          const target = frame.contentWindow;
          if (!content || !target) throw new Error("No fue posible abrir la impresión.");
          await content.fonts.ready;
          const images = Array.from(content.querySelectorAll<SVGImageElement>("image"));
          await Promise.all(images.map((element) => new Promise<void>((loaded, failed) => {
            const image = new Image();
            image.onload = () => loaded();
            image.onerror = () => failed(new Error("No fue posible cargar un logo de impresión."));
            image.src = element.getAttribute("href") ?? "";
          })));
          await new Promise<void>((ready) => target.requestAnimationFrame(() => target.requestAnimationFrame(() => ready())));
          if (expired) return;
          window.clearTimeout(timeout);
          target.addEventListener("afterprint", () => frame.remove(), { once: true });
          target.focus();
          target.print();
          resolve();
        } catch (error) {
          window.clearTimeout(timeout);
          frame.remove();
          reject(error);
        }
      })();
    };
    frame.srcdoc = buildReceiptPrintHtml(document);
    window.document.body.appendChild(frame);
  });
}
