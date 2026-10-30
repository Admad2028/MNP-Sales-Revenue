import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MonthFilter, OriginAnalyticsSummary } from "./originCityParser";
import { formatINR } from "./sheetParser";
import { getStateColorInfo } from "./heatColorScale";

export interface DownloadHeatMapPdfOptions {
  monthFilter: MonthFilter;
  selectedRep: string;
  analytics: OriginAnalyticsSummary;
  svgElement: SVGSVGElement | null;
}

/**
 * Converts the live SVG map element into a high-resolution PNG Data URL via offscreen canvas.
 * Strips animation classes, resets interactive zoom transforms, and ensures solid white background.
 */
export async function captureSvgAsDataUrl(
  svgElement: SVGSVGElement | null
): Promise<string | null> {
  if (!svgElement) return null;

  try {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;

    // Remove ping animation elements to prevent visual motion blur in PDF
    const pingCircles = clone.querySelectorAll(".animate-ping");
    pingCircles.forEach((el) => el.remove());

    // Reset any interactive CSS transforms / zoom level
    clone.style.transform = "none";
    clone.style.width = "600px";
    clone.style.height = "680px";
    clone.setAttribute("width", "600");
    clone.setAttribute("height", "680");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Standardize fonts on text nodes
    const textNodes = clone.querySelectorAll("text");
    textNodes.forEach((t) => {
      t.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    });

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clone);

    if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgString = svgString.replace(
        "<svg ",
        '<svg xmlns="http://www.w3.org/2000/svg" '
      );
    }

    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 3500);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          // 2x scale for crisp print quality
          canvas.width = 1200;
          canvas.height = 1360;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          // Opaque white background
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  } catch (err) {
    console.warn("SVG capture fallback triggered:", err);
    return null;
  }
}

/**
 * Generates and downloads a comprehensive, board-ready PDF report of the India Client Origin Heat Map,
 * Ranked Client Origin Hubs ledger with percentages, and Regional State Aggregation.
 */
export async function downloadHeatMapPdf({
  monthFilter,
  selectedRep,
  analytics,
  svgElement,
}: DownloadHeatMapPdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182mm

  // Timeframe description label
  const timeframeLabel =
    monthFilter === "september"
      ? "September 2026"
      : monthFilter === "october"
      ? "October 2026"
      : "September + October 2026 (Consensus)";

  const repLabel =
    !selectedRep || selectedRep === "All"
      ? "Whole Team (All Reps)"
      : selectedRep;

  const totalOrders = analytics.totalAttributedOrders || 1;
  const topHub = analytics.topCity || analytics.cities[0] || null;
  const topHubPct = topHub
    ? ((topHub.orderCount / totalOrders) * 100).toFixed(1)
    : "0.0";

  const maxOrders = Math.max(...analytics.cities.map((c) => c.orderCount), 1);
  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Attempt SVG capture
  const mapImagePng = await captureSvgAsDataUrl(svgElement);

  // =========================================================================
  // PAGE 1: EXECUTIVE DASHBOARD & VISUAL HEAT MAP
  // =========================================================================

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 26, "F");

  // Accent bar
  doc.setFillColor(220, 38, 38); // red-600
  doc.rect(0, 25.2, pageWidth, 0.8, "F");

  // Left Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("MnP SALES PERFORMANCE ANALYTICS", leftMargin, 9);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(254, 205, 211); // rose-200
  doc.text(
    "Client Origin Heat Map & Regional Intelligence Report",
    leftMargin,
    15
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Time Frame: ${timeframeLabel}   |   Sales Rep: ${repLabel}`,
    leftMargin,
    21
  );

  // Right Metadata
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${dateFormatted}, ${timeFormatted}`, pageWidth - rightMargin, 10, {
    align: "right",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(251, 146, 60); // orange-400
  doc.text(`Deals Tracked: ${analytics.totalAttributedOrders} Closed Deals`, pageWidth - rightMargin, 16, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text("Col I Deals & Col K Consensus", pageWidth - rightMargin, 21, {
    align: "right",
  });

  // 2. High-Level KPI Summary Strip (4 Cards)
  const kpiY = 30;
  const kpiH = 15;
  const kpiGap = 3.5;
  const kpiW = (contentWidth - kpiGap * 3) / 4;

  const kpis = [
    {
      title: "ATTRIBUTED ORDERS",
      value: `${analytics.totalAttributedOrders} Deals`,
      sub: `${analytics.totalDealsClosed} Total Sheet Deals`,
      bg: [254, 242, 242], // red-50
      border: [254, 202, 202], // red-200
      valColor: [185, 28, 28], // red-700
    },
    {
      title: "ATTRIBUTED REVENUE",
      value: formatINR(analytics.totalRevenue),
      sub: "Consensus Deal Volume",
      bg: [236, 253, 245], // emerald-50
      border: [167, 243, 208], // emerald-200
      valColor: [4, 120, 87], // emerald-700
    },
    {
      title: "CLIENT ORIGIN HUBS",
      value: `${analytics.uniqueCitiesCount} Cities`,
      sub: `Across ${Object.keys(analytics.stateMetrics).length} States`,
      bg: [255, 247, 237], // orange-50
      border: [254, 215, 170], // orange-200
      valColor: [194, 65, 12], // orange-700
    },
    {
      title: "TOP CLIENT ORIGIN HUB",
      value: topHub ? topHub.name : "None",
      sub: topHub ? `${topHub.orderCount} orders (${topHubPct}%)` : "No Deals",
      bg: [254, 242, 242], // red-50
      border: [252, 165, 165], // red-300
      valColor: [127, 29, 29], // red-900
    },
  ];

  kpis.forEach((kpi, idx) => {
    const x = leftMargin + idx * (kpiW + kpiGap);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(kpi.border[0], kpi.border[1], kpi.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, kpiY, kpiW, kpiH, 1.8, 1.8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.title, x + 2.5, kpiY + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(kpi.valColor[0], kpi.valColor[1], kpi.valColor[2]);
    doc.text(kpi.value, x + 2.5, kpiY + 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, x + 2.5, kpiY + 13);
  });

  // 3. Two-Column Visual Section:
  // Left: Geographic Map (96mm width x 108mm height)
  // Right: Regional State Aggregation & Top Hubs Snapshot
  const visualY = 48;
  const leftColW = 98;
  const rightColX = leftMargin + leftColW + 4;
  const rightColW = contentWidth - leftColW - 4;

  if (mapImagePng) {
    // Map container border box
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(leftMargin, visualY, leftColW, 114, 2, 2, "FD");

    // Title label over map
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text("Interactive India Client Density Map", leftMargin + 3, visualY + 4.5);

    // Render captured map image
    doc.addImage(mapImagePng, "PNG", leftMargin + 2, visualY + 6, leftColW - 4, 96);

    // Heat Intensity Scale legend inside map box
    const legendY = visualY + 104;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(71, 85, 105);
    doc.text("Heat Intensity Scale (White -> Orange -> Darkest Red):", leftMargin + 3, legendY);

    const swatches = [
      { name: "0 Orders", color: [255, 255, 255], border: [203, 213, 225], text: [100, 116, 139] },
      { name: "1 Order", color: [253, 186, 116], border: [251, 146, 60], text: [124, 45, 18] },
      { name: "Mid", color: [234, 88, 12], border: [194, 65, 12], text: [255, 255, 255] },
      { name: "High", color: [220, 38, 38], border: [185, 28, 28], text: [255, 255, 255] },
      { name: `Max (${maxOrders})`, color: [127, 29, 29], border: [69, 10, 10], text: [255, 255, 255] },
    ];

    const swatchW = 16.5;
    const swatchH = 4;
    swatches.forEach((sw, i) => {
      const sx = leftMargin + 3 + i * (swatchW + 2);
      doc.setFillColor(sw.color[0], sw.color[1], sw.color[2]);
      doc.setDrawColor(sw.border[0], sw.border[1], sw.border[2]);
      doc.setLineWidth(0.2);
      doc.roundedRect(sx, legendY + 1.5, swatchW, swatchH, 0.8, 0.8, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(5.2);
      doc.setTextColor(sw.text[0], sw.text[1], sw.text[2]);
      doc.text(sw.name, sx + swatchW / 2, legendY + 4.2, { align: "center" });
    });
  } else {
    // Fallback graphic box if image capture was unavailable
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(leftMargin, visualY, leftColW, 114, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("India Client Origin Heat Map", leftMargin + 6, visualY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Visual mapping active for ${timeframeLabel}.\nFull origin ledger detailed in tables below.`,
      leftMargin + 6,
      visualY + 18
    );
  }

  // Right Column 1: Regional State Aggregation Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("REGIONAL STATE AGGREGATION", rightColX, visualY + 3.5);

  const stateRows = Object.values(analytics.stateMetrics)
    .sort((a, b) => b.orderCount - a.orderCount)
    .map((s, idx) => {
      const pct = ((s.orderCount / totalOrders) * 100).toFixed(1);
      return [
        `#${idx + 1}`,
        s.name,
        `${s.orderCount} ${s.orderCount === 1 ? "order" : "orders"}`,
        `${pct}%`,
      ];
    });

  autoTable(doc, {
    startY: visualY + 5.5,
    margin: { left: rightColX, right: rightMargin },
    tableWidth: rightColW,
    head: [["#", "State", "Orders", "Share (%)"]],
    body: stateRows.slice(0, 6),
    theme: "striped",
    headStyles: {
      fillColor: [185, 28, 28], // red-700
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: "bold",
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { fontStyle: "bold" },
      2: { halign: "right", fontStyle: "bold" },
      3: { cellWidth: 16, halign: "right" },
    },
  });

  const stateTableEnd = (doc as any).lastAutoTable.finalY || visualY + 50;

  // Right Column 2: Top Origin Hubs Snapshot
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("TOP CLIENT ORIGIN HUBS SNAPSHOT", rightColX, stateTableEnd + 5);

  const topHubsSnapshotRows = analytics.cities.slice(0, 6).map((c, idx) => {
    const pct = ((c.orderCount / totalOrders) * 100).toFixed(1);
    return [
      `#${idx + 1}`,
      c.name,
      c.state,
      `${c.orderCount}`,
      `${pct}%`,
    ];
  });

  autoTable(doc, {
    startY: stateTableEnd + 7,
    margin: { left: rightColX, right: rightMargin },
    tableWidth: rightColW,
    head: [["#", "City Hub", "State", "Orders", "Share"]],
    body: topHubsSnapshotRows,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42], // slate-900
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: "bold",
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { fontStyle: "bold" },
      2: { textColor: [100, 116, 139] },
      3: { cellWidth: 13, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 14, halign: "right" },
    },
  });

  // 4. Bottom Table of Page 1: Top Ranked Client Origin Hubs Complete Ledger Preview
  const bottomTableY = 168;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `RANKED CLIENT ORIGIN HUBS (TOP HUBS - ${timeframeLabel})`,
    leftMargin,
    bottomTableY
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Showing top client origin hubs ranked by attributed closed deal volume with share percentages & revenue.`,
    leftMargin,
    bottomTableY + 4
  );

  const bottomTableRows = analytics.cities.slice(0, 8).map((city, idx) => {
    const pctRaw = (city.orderCount / totalOrders) * 100;
    const pct = pctRaw % 1 === 0 ? `${pctRaw}%` : `${pctRaw.toFixed(1)}%`;
    return [
      `#${idx + 1}`,
      city.name,
      city.state,
      `${city.orderCount} ${city.orderCount === 1 ? "order" : "orders"}`,
      pct,
      formatINR(city.totalDealRevenue),
      city.executives.slice(0, 2).join(", ") || "Whole Team",
    ];
  });

  autoTable(doc, {
    startY: bottomTableY + 6,
    margin: { left: leftMargin, right: rightMargin },
    head: [
      [
        "Rank",
        "City Hub Name",
        "State",
        "Attributed Orders",
        "Share of Total (%)",
        "Deal Revenue (Rs.)",
        "Active Executives",
      ],
    ],
    body: bottomTableRows,
    theme: "striped",
    headStyles: {
      fillColor: [185, 28, 28], // red-700
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { fontStyle: "bold" },
      2: { textColor: [100, 116, 139] },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "right" },
      6: { cellWidth: 42, textColor: [71, 85, 105] },
    },
  });

  // Bottom Notice on Page 1
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "* Detailed geographic breakdown and consensus methodology continued on Page 2.",
    leftMargin,
    pageHeight - 12
  );

  // =========================================================================
  // PAGE 2: COMPLETE ORIGIN HUBS LEDGER & CONSENSUS METHODOLOGY
  // =========================================================================
  doc.addPage();

  // Header Banner Page 2
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 21.2, pageWidth, 0.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("COMPLETE CLIENT ORIGIN HUBS LEDGER & ATTRIBUTION AUDIT", leftMargin, 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Comprehensive ledger of all ${analytics.cities.length} client origin cities mapped to closed deals for ${timeframeLabel}`,
    leftMargin,
    16
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Time Frame: ${timeframeLabel}  |  Rep: ${repLabel}`, pageWidth - rightMargin, 16, {
    align: "right",
  });

  // Complete Origin Hubs Table (All Cities)
  const allCitiesRows = analytics.cities.map((city, idx) => {
    const pctRaw = (city.orderCount / totalOrders) * 100;
    const pct = pctRaw % 1 === 0 ? `${pctRaw}%` : `${pctRaw.toFixed(1)}%`;
    const isMax = city.orderCount >= maxOrders;
    const tier = isMax
      ? "Peak Max (Darkest Red)"
      : city.orderCount > 1
      ? "Repeat Hub (Orange/Red)"
      : "Single Order (Light Orange)";

    return [
      `#${idx + 1}`,
      city.name,
      city.state,
      `${city.orderCount}`,
      pct,
      formatINR(city.totalDealRevenue),
      city.executives.join(", ") || "Whole Team",
      tier,
    ];
  });

  // Summary footer row
  const summaryFooterRow = [
    "",
    `Total Attributed Hubs (${analytics.cities.length})`,
    `${Object.keys(analytics.stateMetrics).length} States`,
    `${analytics.totalAttributedOrders} orders`,
    "100.0%",
    formatINR(analytics.totalRevenue),
    repLabel,
    "100% Attributed",
  ];

  autoTable(doc, {
    startY: 28,
    margin: { left: leftMargin, right: rightMargin },
    head: [
      [
        "Rank",
        "Origin Hub City",
        "State",
        "Orders",
        "Share (%)",
        "Revenue (Rs.)",
        "Sales Executives",
        "Heat Tier",
      ],
    ],
    body: [...allCitiesRows, summaryFooterRow],
    theme: "striped",
    headStyles: {
      fillColor: [185, 28, 28],
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: "bold",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 6.8,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { fontStyle: "bold" },
      2: { textColor: [100, 116, 139] },
      3: { cellWidth: 14, halign: "right", fontStyle: "bold" },
      4: { cellWidth: 16, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 42, textColor: [71, 85, 105] },
      7: { cellWidth: 32, textColor: [127, 29, 29] },
    },
    didParseCell: (data) => {
      // Highlight summary row at bottom of table
      if (data.row.index === allCitiesRows.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [254, 242, 242]; // red-50
        data.cell.styles.textColor = [153, 27, 27]; // red-800
      }
    },
  });

  const p2TableEnd = (doc as any).lastAutoTable.finalY || 160;

  // Regional State Summary Cards Box
  const stateBoxY = p2TableEnd + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("REGIONAL STATE AGGREGATION AUDIT", leftMargin, stateBoxY);

  const stateAuditRows = Object.values(analytics.stateMetrics)
    .sort((a, b) => b.orderCount - a.orderCount)
    .map((s, idx) => {
      const pct = ((s.orderCount / totalOrders) * 100).toFixed(1);
      return [
        `#${idx + 1}`,
        s.name,
        `${s.orderCount} orders`,
        `${pct}%`,
        s.cities.join(", "),
      ];
    });

  autoTable(doc, {
    startY: stateBoxY + 2,
    margin: { left: leftMargin, right: rightMargin },
    head: [["Rank", "State Name", "Attributed Orders", "State Share (%)", "Included Origin Cities"]],
    body: stateAuditRows,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: "bold",
      cellPadding: 1.8,
    },
    bodyStyles: {
      fontSize: 6.5,
      cellPadding: 1.4,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { fontStyle: "bold" },
      2: { cellWidth: 26, halign: "right", fontStyle: "bold" },
      3: { cellWidth: 24, halign: "right" },
      4: { textColor: [71, 85, 105] },
    },
  });

  const stateAuditEnd = (doc as any).lastAutoTable.finalY || stateBoxY + 30;

  // Consensus Methodology Callout Box at bottom of Page 2
  const methodY = Math.min(stateAuditEnd + 6, pageHeight - 48);
  const methodH = 34;

  doc.setFillColor(254, 252, 232); // amber-50
  doc.setDrawColor(253, 224, 71); // amber-300
  doc.setLineWidth(0.3);
  doc.roundedRect(leftMargin, methodY, contentWidth, methodH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text("CONSENSUS ATTRIBUTION METHODOLOGY & HEAT RULES", leftMargin + 4, methodY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(120, 53, 15); // amber-900
  const lines = [
    "1. Column I Deals Closed Attribution: Deals closed are recorded from Column I and mapped to client origin hubs in Column K.",
    "2. Single-City Multi-Deal Rule: When only 1 city is mentioned for multiple deals closed, all deals in that row are attributed to that city (e.g. 2 deals closed + 'Pune' = 2 Pune deals).",
    "3. Multi-City Proportional Rule: When 2 cities are mentioned for 3 deals closed, 2 deals are attributed to the primary city and 1 to the secondary city (e.g. 'Mumbai, Pune' = 2 Mumbai, 1 Pune).",
    "4. Sequential Heat Color Standard: 0 orders = Pure White (#FFFFFF). Orders > 0 scale progressively from Light Orange through Dark Orange to Darkest Red (#7F1D1D) strictly reserved for maximum volume.",
    "5. Bubble Radius Scaling: Visual circle dimensions scale strictly monotonically with order volume, ensuring higher-volume hubs possess strictly larger diameters.",
  ];

  lines.forEach((line, li) => {
    doc.text(line, leftMargin + 4, methodY + 10.5 + li * 4.4);
  });

  // =========================================================================
  // PAGE FOOTER & NUMBERS (PAGES 1 & 2)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      "Confidential | Generated by MnP Sales Performance Analytics - Client Origin Geographic Intelligence",
      leftMargin,
      pageHeight - 6
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - rightMargin, pageHeight - 6, {
      align: "right",
    });
  }

  // Trigger download
  const safeTimeframe = timeframeLabel.replace(/[^a-zA-Z0-9]/g, "_");
  const safeRep = repLabel.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `MnP_Client_Origin_HeatMap_${safeTimeframe}_${safeRep}.pdf`;
  doc.save(fileName);
}
