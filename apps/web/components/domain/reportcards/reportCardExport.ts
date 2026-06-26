/**
 * Client-side report-card export helpers.
 *
 * Individual export renders an on-screen card element to an A4 PDF.
 * Class export renders each learner's card off-screen, then bundles every PDF
 * into a ZIP with a folder named after the class.
 *
 * Heavy libraries (html2canvas, jspdf, jszip) are imported dynamically so they
 * never bloat the initial bundle or run during SSR.
 */
import type { ReportCardPreviewOut } from "@/lib/types";
import { REPORT_CARD_A4_WIDTH_MM } from "./reportCardConstants";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function sanitizeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "report";
}

async function elementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const imgData = canvas.toDataURL("image/png");
  const ratio = canvas.height / canvas.width;
  let renderW = A4_WIDTH_MM;
  let renderH = renderW * ratio;
  if (renderH > A4_HEIGHT_MM) {
    renderH = A4_HEIGHT_MM;
    renderW = renderH / ratio;
  }
  const offsetX = (A4_WIDTH_MM - renderW) / 2;
  pdf.addImage(imgData, "PNG", offsetX, 0, renderW, renderH, undefined, "FAST");
  return pdf.output("blob");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export a single report-card element to a downloaded PDF (always full A4). */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const page = element.closest(".report-card-page") ?? element;
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = REPORT_CARD_A4_WIDTH_MM;
  host.style.background = "#ffffff";
  document.body.appendChild(host);
  const clone = page.cloneNode(true) as HTMLElement;
  host.appendChild(clone);
  await new Promise((r) => setTimeout(r, 80));
  try {
    const canvas = await elementToCanvas(clone.querySelector(".report-card-print") as HTMLElement ?? clone);
    const blob = await canvasToPdfBlob(canvas);
    triggerDownload(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    host.remove();
  }
}

export interface ClassExportItem {
  student_id: string;
  display_name: string;
  data: ReportCardPreviewOut;
}

export interface ClassExportProgress {
  done: number;
  total: number;
  currentName: string;
}

/**
 * Render each learner's report card off-screen and bundle the resulting PDFs
 * into a ZIP under a folder named after the class.
 */
export async function exportClassZip(
  items: ClassExportItem[],
  options: {
    className: string;
    termLabel: string;
    renderCard: (data: ReportCardPreviewOut, host: HTMLElement) => Promise<() => void>;
    onProgress?: (p: ClassExportProgress) => void;
  },
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folderName = sanitizeName(`${options.className} - ${options.termLabel}`);
  const folder = zip.folder(folderName) ?? zip;

  // Off-screen host kept in the DOM (off-canvas) so layout/fonts resolve.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = REPORT_CARD_A4_WIDTH_MM;
  host.style.background = "#ffffff";
  document.body.appendChild(host);

  try {
    let done = 0;
    for (const item of items) {
      options.onProgress?.({ done, total: items.length, currentName: item.display_name });
      const cleanup = await options.renderCard(item.data, host);
      // Allow images/fonts to settle before capture.
      await new Promise((r) => setTimeout(r, 120));
      const target = (host.querySelector(".report-card-print") as HTMLElement) ?? host;
      const canvas = await elementToCanvas(target);
      const blob = await canvasToPdfBlob(canvas);
      folder.file(`${sanitizeName(item.display_name)}.pdf`, blob);
      cleanup();
      done += 1;
      options.onProgress?.({ done, total: items.length, currentName: item.display_name });
    }

    const archive = await zip.generateAsync({ type: "blob" });
    triggerDownload(archive, `${folderName}.zip`);
  } finally {
    host.remove();
  }
}
