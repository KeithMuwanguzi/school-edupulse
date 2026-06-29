"use client";

/**
 * Report card PDF export — always re-renders the same React preview at full A4
 * size, then captures with html-to-image (browser-native layout, WYSIWYG).
 */
import { createElement } from "react";
import type { ReportCardPreviewOut } from "@/lib/types";
import { reportCardFontClassName } from "@/lib/reportCardFonts";
import { REPORT_CARD_A4_WIDTH_PX } from "./reportCardConstants";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const CAPTURE_PIXEL_RATIO = 2;

function sanitizeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "report";
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
    ),
  );
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((r) => setTimeout(r, 100));
}

/** Mount a full-size report card off-screen (no viewport scaling). */
async function mountReportCard(
  data: ReportCardPreviewOut,
  host: HTMLElement,
): Promise<{ target: HTMLElement; cleanup: () => void }> {
  host.className = reportCardFontClassName;
  host.replaceChildren();

  const { createRoot } = await import("react-dom/client");
  const { ReportCardPreview } = await import("./ReportCardPreview");
  const root = createRoot(host);

  await new Promise<void>((resolve) => {
    root.render(createElement(ReportCardPreview, { data }));
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  await waitForImages(host);
  await waitForLayout();

  const target = host.querySelector(".report-card-print") as HTMLElement | null;
  if (!target) {
    root.unmount();
    throw new Error("Report card did not render for export.");
  }

  target.classList.add("report-card-exporting");

  return {
    target,
    cleanup: () => {
      root.unmount();
      host.replaceChildren();
    },
  };
}

async function captureElementToCanvas(target: HTMLElement): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  try {
    return await toCanvas(target, {
      pixelRatio: CAPTURE_PIXEL_RATIO,
      cacheBust: true,
      backgroundColor: "#ffffff",
      fetchRequestInit: { mode: "cors", credentials: "include" },
    });
  } catch {
    // Fallback if foreignObject capture fails (e.g. restricted images).
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(target, {
      scale: CAPTURE_PIXEL_RATIO,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
    });
  }
}

/** Render preview data at full A4 and capture to canvas. */
export async function captureReportCardCanvas(data: ReportCardPreviewOut): Promise<HTMLCanvasElement> {
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${REPORT_CARD_A4_WIDTH_PX}px`,
    background: "#ffffff",
    overflow: "visible",
  });
  document.body.appendChild(host);

  try {
    const { target, cleanup } = await mountReportCard(data, host);
    try {
      return await captureElementToCanvas(target);
    } finally {
      cleanup();
    }
  } finally {
    host.remove();
  }
}

async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const imgData = canvas.toDataURL("image/png");
  const ratio = canvas.height / canvas.width;
  let renderW = A4_WIDTH_MM;
  let renderH = renderW * ratio;
  if (renderH > A4_HEIGHT_MM) {
    renderH = A4_HEIGHT_MM;
    renderW = renderH / ratio;
  }
  const offsetX = (A4_WIDTH_MM - renderW) / 2;
  pdf.addImage(imgData, "PNG", offsetX, 0, renderW, renderH, undefined, "SLOW");
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

/** Export one learner's report card — matches on-screen preview exactly. */
export async function exportReportCardToPdf(
  data: ReportCardPreviewOut,
  filename: string,
): Promise<void> {
  const canvas = await captureReportCardCanvas(data);
  const blob = await canvasToPdfBlob(canvas);
  triggerDownload(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
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

/** Bundle one PDF per learner into a ZIP folder. */
export async function exportClassZip(
  items: ClassExportItem[],
  options: {
    className: string;
    termLabel: string;
    onProgress?: (p: ClassExportProgress) => void;
  },
): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folderName = sanitizeName(`${options.className} - ${options.termLabel}`);
  const folder = zip.folder(folderName) ?? zip;

  let done = 0;
  for (const item of items) {
    options.onProgress?.({ done, total: items.length, currentName: item.display_name });
    const canvas = await captureReportCardCanvas(item.data);
    const blob = await canvasToPdfBlob(canvas);
    folder.file(`${sanitizeName(item.display_name)}.pdf`, blob);
    done += 1;
    options.onProgress?.({ done, total: items.length, currentName: item.display_name });
  }

  const archive = await zip.generateAsync({ type: "blob" });
  triggerDownload(archive, `${folderName}.zip`);
}
