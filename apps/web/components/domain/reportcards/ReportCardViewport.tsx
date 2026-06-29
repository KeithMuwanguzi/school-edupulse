"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  REPORT_CARD_A4_HEIGHT_PX,
  REPORT_CARD_A4_WIDTH_PX,
} from "./reportCardConstants";

interface ReportCardViewportProps {
  children: ReactNode;
}

/**
 * Screen-only wrapper: keeps the report at true A4 dimensions and scales it down
 * to fit narrow viewports (miniature WYSIWYG preview). Print/export ignore this
 * wrapper and use the inner `.report-card-page` at full A4 size.
 */
export function ReportCardViewport({ children }: ReportCardViewportProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    function update() {
      if (!shell) return;
      const pad = 32;
      const available = shell.clientWidth - pad;
      const next = Math.min(1, available / REPORT_CARD_A4_WIDTH_PX);
      setScale(Number(next.toFixed(4)));
    }

    update();
    const ro = new ResizeObserver(update);
    ro.observe(shell);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="report-card-preview-shell">
      <p className="report-card-no-print mb-3 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
        A4 preview
        {scale < 1 ? (
          <span className="normal-case tracking-normal text-slate-400">
            {" "}
            · scaled to fit screen — print and PDF use full size
          </span>
        ) : null}
      </p>
      <div ref={shellRef} className="flex justify-center">
        <div
          className="report-card-viewport-slot"
          style={{
            width: Math.round(REPORT_CARD_A4_WIDTH_PX * scale),
            height: Math.round(REPORT_CARD_A4_HEIGHT_PX * scale),
          }}
        >
          <div
            className="report-card-viewport-scaler"
            style={{
              width: REPORT_CARD_A4_WIDTH_PX,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
