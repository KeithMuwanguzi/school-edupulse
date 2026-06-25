/**
 * SkulPulse — lightweight inline-SVG chart kit.
 * No dependencies. Every chart returns an SVG/HTML string, themes off CSS
 * variables, and animates on insertion (innerHTML swap re-triggers keyframes).
 */
const Charts = (() => {
  const PALETTE = [
    "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"
  ];

  const fmtDefault = (v) => v;

  /** Score → colour ramp (red → amber → green). Used by heatmaps/risk. */
  function scoreColor(v) {
    if (v == null) return "var(--surface-2)";
    if (v >= 80) return "oklch(0.62 0.14 155)";
    if (v >= 70) return "oklch(0.68 0.13 150)";
    if (v >= 60) return "oklch(0.75 0.13 120)";
    if (v >= 50) return "oklch(0.78 0.13 85)";
    if (v >= 40) return "oklch(0.72 0.15 55)";
    return "oklch(0.62 0.17 28)";
  }

  function uid() { Charts._n = (Charts._n || 0) + 1; return `cg${Charts._n}`; }

  /* ---------------- Vertical bar chart ---------------- */
  function bars(opts) {
    const data = opts.data || [];
    const H = opts.height || 170;
    const W = opts.width || 460;
    const pad = { t: 16, r: 8, b: 26, l: 8 };
    const max = opts.max || Math.max(1, ...data.map((d) => d.value));
    const fmt = opts.format || fmtDefault;
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const gap = 0.32;
    const step = innerW / data.length;
    const bw = step * (1 - gap);

    const bars = data.map((d, i) => {
      const x = pad.l + step * i + (step - bw) / 2;
      const h = Math.max(2, (d.value / max) * innerH);
      const y = pad.t + innerH - h;
      const color = d.color || (d.highlight ? "var(--brand)" : "url(#barFill)");
      const delay = (i * 0.05).toFixed(2);
      return `
        <g>
          <rect class="cbar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}"
            rx="4" fill="${color}" style="animation-delay:${delay}s"/>
          ${opts.showValues !== false ? `<text class="cval" x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" style="animation-delay:${(+delay + 0.25)}s">${fmt(d.value)}</text>` : ""}
          <text class="caxis" x="${(x + bw / 2).toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle">${d.label}</text>
        </g>`;
    }).join("");

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--brand)"/>
          <stop offset="100%" stop-color="var(--brand)" stop-opacity="0.55"/>
        </linearGradient>
      </defs>${bars}</svg>`;
  }

  /* ---------------- Line / area chart ---------------- */
  function line(opts) {
    const values = opts.values || [];
    const labels = opts.labels || values.map((_, i) => i + 1);
    const H = opts.height || 180;
    const W = opts.width || 480;
    const pad = { t: 16, r: 14, b: 26, l: 28 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const min = opts.min != null ? opts.min : Math.min(...values) - 6;
    const max = opts.max != null ? opts.max : Math.max(...values) + 6;
    const span = Math.max(1, max - min);
    const id = uid();

    const pts = values.map((v, i) => {
      const x = pad.l + (innerW * i) / Math.max(1, values.length - 1);
      const y = pad.t + innerH - ((v - min) / span) * innerH;
      return [x, y];
    });
    const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)} ${(pad.t + innerH)} L${pts[0][0].toFixed(1)} ${(pad.t + innerH)} Z`;

    const grid = [0, 0.5, 1].map((g) => {
      const y = pad.t + innerH * g;
      const val = Math.round(max - span * g);
      return `<line class="cgrid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>
        <text class="caxis" x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${val}</text>`;
    }).join("");

    const dots = pts.map((p, i) =>
      `<circle class="cdot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" style="animation-delay:${(0.5 + i * 0.08).toFixed(2)}s"/>`
    ).join("");
    const xlabels = labels.map((l, i) =>
      `<text class="caxis" x="${pts[i][0].toFixed(1)}" y="${H - 8}" text-anchor="middle">${l}</text>`
    ).join("");

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--brand)" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#${id})" class="carea"/>
      <path d="${linePath}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="cline"/>
      ${dots}${xlabels}</svg>`;
  }

  /* ---------------- Donut chart ---------------- */
  function donut(opts) {
    const segs = (opts.segments || []).filter((s) => s.value > 0);
    const total = segs.reduce((a, s) => a + s.value, 0) || 1;
    const size = opts.size || 168;
    const stroke = opts.stroke || 22;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;

    const arcs = segs.map((s, i) => {
      const frac = s.value / total;
      const len = frac * c;
      const dash = `${len} ${c - len}`;
      const dashOffset = -offset;
      offset += len;
      const color = s.color || PALETTE[i % PALETTE.length];
      return `<circle class="cdonut" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${dash}" stroke-dashoffset="${dashOffset}"
        stroke-linecap="butt" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>`;
    }).join("");

    const center = opts.centerValue != null ? `
      <text class="cdonut-val" x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle">${opts.centerValue}</text>
      <text class="cdonut-lab" x="${size / 2}" y="${size / 2 + 16}" text-anchor="middle">${opts.centerLabel || ""}</text>` : "";

    const legend = opts.legend !== false ? `<div class="chart-legend">${segs.map((s, i) =>
      `<span class="legend-item"><i style="background:${s.color || PALETTE[i % PALETTE.length]}"></i>${s.label} <b>${s.value}</b></span>`
    ).join("")}</div>` : "";

    return `<div class="donut-wrap">
      <svg class="chart donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
        <g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g>
        ${center}
      </svg>${legend}</div>`;
  }

  /* ---------------- Semicircle gauge ---------------- */
  function gauge(opts) {
    const value = opts.value || 0;
    const max = opts.max || 100;
    const W = 200, H = 116, cx = W / 2, cy = 100, r = 82, stroke = 16;
    const frac = Math.max(0, Math.min(1, value / max));
    const semi = Math.PI * r;
    const dash = `${frac * semi} ${semi}`;
    const color = opts.color || (frac >= 0.75 ? "oklch(0.6 0.14 155)" : frac >= 0.5 ? "var(--brand)" : "oklch(0.7 0.15 55)");
    return `<svg class="chart gauge" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}" stroke-linecap="round"/>
      <path class="cgauge" d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash}"/>
      <text class="gauge-val" x="${cx}" y="${cy - 12}" text-anchor="middle">${opts.format ? opts.format(value) : value}</text>
      <text class="gauge-lab" x="${cx}" y="${cy + 8}" text-anchor="middle">${opts.label || ""}</text>
    </svg>`;
  }

  /* ---------------- Circular progress ring ---------------- */
  function ring(opts) {
    const value = opts.value || 0;
    const max = opts.max || 100;
    const size = opts.size || 96;
    const stroke = opts.stroke || 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const frac = Math.max(0, Math.min(1, value / max));
    const color = opts.color || "var(--brand)";
    return `<svg class="chart ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
      <g transform="rotate(-90 ${size / 2} ${size / 2})">
        <circle class="cring" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-dasharray="${(frac * c).toFixed(1)} ${c.toFixed(1)}"/>
      </g>
      <text class="ring-val" x="${size / 2}" y="${size / 2 + 1}" text-anchor="middle" dominant-baseline="middle">${opts.label || value}</text>
    </svg>`;
  }

  /* ---------------- Sparkline (inline, tiny) ---------------- */
  function sparkline(values, opts = {}) {
    if (!values || values.length < 2) return "";
    const W = opts.width || 84, H = opts.height || 26, pad = 3;
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.max(1, max - min);
    const pts = values.map((v, i) => {
      const x = pad + ((W - pad * 2) * i) / (values.length - 1);
      const y = pad + (H - pad * 2) - ((v - min) / span) * (H - pad * 2);
      return [x, y];
    });
    const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const up = values[values.length - 1] >= values[0];
    const color = opts.color || (up ? "oklch(0.6 0.13 155)" : "oklch(0.62 0.17 28)");
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.2" fill="${color}"/>
    </svg>`;
  }

  /* ---------------- Heatmap grid ---------------- */
  function heatmap(opts) {
    const subjects = opts.subjects || [];
    const rows = opts.rows || [];
    const cellH = 30;
    const labelW = opts.labelW || 96;
    const head = `<div class="hm-row hm-head"><div class="hm-rowlabel" style="width:${labelW}px"></div>
      ${subjects.map((s) => `<div class="hm-collabel">${s.length > 7 ? s.slice(0, 6) + "…" : s}</div>`).join("")}</div>`;
    const body = rows.map((r, ri) => `
      <div class="hm-row" style="animation-delay:${(ri * 0.04).toFixed(2)}s">
        <div class="hm-rowlabel" style="width:${labelW}px">${r.label}</div>
        ${r.values.map((v) => `<div class="hm-cell" style="background:${scoreColor(v)}" title="${v ?? "—"}">${v ?? "—"}</div>`).join("")}
      </div>`).join("");
    return `<div class="heatmap" style="--cell-h:${cellH}px">${head}${body}</div>`;
  }

  /* ---------------- Horizontal bar list ---------------- */
  function hbars(opts) {
    const data = opts.data || [];
    const max = opts.max || Math.max(1, ...data.map((d) => d.value));
    const fmt = opts.format || fmtDefault;
    return `<div class="hbars">${data.map((d, i) => `
      <div class="hbar-row">
        <div class="hbar-label">${d.label}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${((d.value / max) * 100).toFixed(1)}%;background:${d.color || "var(--brand)"};animation-delay:${(i * 0.06).toFixed(2)}s"></div></div>
        <div class="hbar-val">${fmt(d.value)}</div>
      </div>`).join("")}</div>`;
  }

  return { bars, line, donut, gauge, ring, sparkline, heatmap, hbars, scoreColor, PALETTE };
})();
