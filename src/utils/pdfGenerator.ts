import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CalculationSummary, SheetRecord, SalespersonMetric } from "../types";
import { formatDateDDMMYY, parseDateToISO } from "./sheetParser";
import { drawMonthlyTrajectoryChart } from "./pdfChartRenderer";

interface DownloadPdfOptions {
  summary: CalculationSummary;
  records?: SheetRecord[];
  individualMetrics?: SalespersonMetric[];
}

export interface TopPerformerCategory {
  categoryTitle: string;
  executiveName: string;
  metricDisplay: string;
  metricSubtext: string;
  rawMetricValue: number;
}

export interface TopPerformersSummary {
  revenue: TopPerformerCategory;
  commission: TopPerformerCategory;
  calls: TopPerformerCategory;
  conversion: TopPerformerCategory;
}

/**
 * Draws a sharp 5-pointed vector gold star on the jsPDF canvas
 */
function drawVectorStar(
  doc: jsPDF,
  cx: number,
  cy: number,
  spikes = 5,
  outerRadius = 2.4,
  innerRadius = 1.1,
  fillColor = [245, 158, 11], // Amber-500
  strokeColor = [217, 119, 6] // Amber-600
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  const points: [number, number][] = [];

  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    points.push([x, y]);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    points.push([x, y]);
    rot += step;
  }

  doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
  doc.setDrawColor(strokeColor[0], strokeColor[1], strokeColor[2]);
  doc.setLineWidth(0.2);

  const startX = points[0][0];
  const startY = points[0][1];
  const deltaLines: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    deltaLines.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]]);
  }
  deltaLines.push([startX - points[points.length - 1][0], startY - points[points.length - 1][1]]);

  (doc as any).lines(deltaLines, startX, startY, [1, 1], "FD", true);
}

/**
 * Computes the top performing sales executives across Revenue, AA Commission,
 * Number of Calls Done, and Highest Conversion Percentage.
 */
function calculateTopPerformers(metrics: SalespersonMetric[]): TopPerformersSummary {
  const eligibleReps = metrics.filter(
    (m) => m.name !== "Storage Team" && m.name !== "All"
  );

  // 1. Highest Revenue
  let topRevRep = eligibleReps[0] || null;
  let maxRev = -1;
  eligibleReps.forEach((m) => {
    if (m.totalDealAmount > maxRev) {
      maxRev = m.totalDealAmount;
      topRevRep = m;
    }
  });

  // 2. Highest AA Commission
  let topCommRep = eligibleReps[0] || null;
  let maxComm = -1;
  eligibleReps.forEach((m) => {
    if (m.totalAaCommission > maxComm) {
      maxComm = m.totalAaCommission;
      topCommRep = m;
    }
  });

  // 3. Most Calls Done
  let topCallsRep = eligibleReps[0] || null;
  let maxCalls = -1;
  eligibleReps.forEach((m) => {
    const calls = m.enteredCalls || 0;
    if (calls > maxCalls) {
      maxCalls = calls;
      topCallsRep = m;
    }
  });

  // 4. Highest Conversion Rate (require at least 1 call or deal)
  let topConvRep = eligibleReps[0] || null;
  let maxConv = -1;
  eligibleReps.forEach((m) => {
    if ((m.enteredCalls > 0 || m.totalDeals > 0) && m.conversionRate > maxConv) {
      maxConv = m.conversionRate;
      topConvRep = m;
    }
  });

  return {
    revenue: {
      categoryTitle: "TOP REVENUE",
      executiveName: topRevRep ? topRevRep.name : "N/A",
      metricDisplay: topRevRep ? `Rs. ${topRevRep.totalDealAmount.toLocaleString("en-IN")}` : "Rs. 0",
      metricSubtext: topRevRep ? `${topRevRep.totalDeals} deal${topRevRep.totalDeals === 1 ? "" : "s"}` : "",
      rawMetricValue: topRevRep ? topRevRep.totalDealAmount : 0,
    },
    commission: {
      categoryTitle: "TOP AA COMMISSION",
      executiveName: topCommRep ? topCommRep.name : "N/A",
      metricDisplay: topCommRep ? `Rs. ${topCommRep.totalAaCommission.toLocaleString("en-IN")}` : "Rs. 0",
      metricSubtext:
        topCommRep && topCommRep.totalDealAmount > 0
          ? `${((topCommRep.totalAaCommission / topCommRep.totalDealAmount) * 100).toFixed(1)}% rate`
          : "",
      rawMetricValue: topCommRep ? topCommRep.totalAaCommission : 0,
    },
    calls: {
      categoryTitle: "MOST CALLS DONE",
      executiveName: topCallsRep ? topCallsRep.name : "N/A",
      metricDisplay: topCallsRep ? `${topCallsRep.enteredCalls} Calls` : "0 Calls",
      metricSubtext:
        topCallsRep && topCallsRep.totalDeals > 0
          ? `${(topCallsRep.enteredCalls / topCallsRep.totalDeals).toFixed(1)} calls/deal`
          : "Logged",
      rawMetricValue: topCallsRep ? topCallsRep.enteredCalls : 0,
    },
    conversion: {
      categoryTitle: "HIGHEST CONVERSION",
      executiveName: topConvRep ? topConvRep.name : "N/A",
      metricDisplay: topConvRep ? `${topConvRep.conversionRate.toFixed(1)}%` : "0.0%",
      metricSubtext: topConvRep ? `${topConvRep.totalDeals} deals closed` : "",
      rawMetricValue: topConvRep ? topConvRep.conversionRate : 0,
    },
  };
}

export function downloadPdfReport({ summary, records = [], individualMetrics }: DownloadPdfOptions) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const isWholeTeam = summary.salesperson === "All";

  // Use either the passed individualMetrics or the ones attached to summary
  const teamMetrics: SalespersonMetric[] =
    individualMetrics || summary.individualMetrics || [];

  const coreTeamMetrics = teamMetrics.filter(
    (m) =>
      m.name !== "Storage Team" ||
      m.totalDealAmount > 0 ||
      m.totalDeals > 0 ||
      m.enteredCalls > 0
  );

  const topPerformers = calculateTopPerformers(teamMetrics);

  const dateRangeText =
    summary.startDate && summary.endDate
      ? `${formatDateDDMMYY(summary.startDate)} to ${formatDateDDMMYY(summary.endDate)}`
      : "Full Available Range";

  const nowStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // =========================================================================
  // HELPER: RENDER EXECUTIVE HEADER BANNER
  // =========================================================================
  const renderHeaderBanner = (title: string, subtitle: string, height = 28) => {
    doc.setFillColor(24, 24, 27); // zinc-900
    doc.rect(0, 0, pageWidth, height, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13.5);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 13);

    // Subtitle
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(52, 211, 153); // emerald-400
    doc.text(subtitle, 14, 20.5);

    // Metadata Date / Time
    doc.setTextColor(161, 161, 170); // zinc-400
    doc.setFontSize(7);
    doc.text(`Generated: ${nowStr}`, pageWidth - 14, 20.5, { align: "right" });
  };

  // =========================================================================
  // HELPER: RENDER TOP PERFORMERS SHOWCASE BANNER (TOP OF REPORT)
  // =========================================================================
  const renderTopPerformersShowcase = (startY: number, isIndividual = false) => {
    const containerW = pageWidth - 28;
    const containerH = 26;

    // Outer Container with amber highlight border & soft luxury background
    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(251, 191, 36); // amber-400
    doc.setLineWidth(0.4);
    doc.roundedRect(14, startY, containerW, containerH, 2.5, 2.5, "FD");

    // Top Gold Ribbon
    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(14, startY, containerW, 1.2, "F");

    // Section Header with Star Icon
    drawVectorStar(doc, 19, startY + 4.8, 5, 2.2, 1.0, [217, 119, 6], [180, 83, 9]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(146, 64, 14); // amber-900
    const bannerTitle = isIndividual
      ? `EXECUTIVE BENCHMARK & TEAM CATEGORY LEADERS`
      : `TOP EXECUTIVE PERFORMERS - CATEGORY CHAMPIONS`;
    doc.text(bannerTitle, 23.5, startY + 5.8);

    const colW = (containerW - 9) / 4;
    const cardY = startY + 8;
    const cardH = 15.5;

    const cards = [
      {
        label: topPerformers.revenue.categoryTitle,
        name: topPerformers.revenue.executiveName,
        val: topPerformers.revenue.metricDisplay,
        detail: topPerformers.revenue.metricSubtext,
        color: [16, 185, 129], // Emerald
        isRepStar: isIndividual && topPerformers.revenue.executiveName === summary.salesperson,
      },
      {
        label: topPerformers.commission.categoryTitle,
        name: topPerformers.commission.executiveName,
        val: topPerformers.commission.metricDisplay,
        detail: topPerformers.commission.metricSubtext,
        color: [14, 165, 233], // Sky
        isRepStar: isIndividual && topPerformers.commission.executiveName === summary.salesperson,
      },
      {
        label: topPerformers.calls.categoryTitle,
        name: topPerformers.calls.executiveName,
        val: topPerformers.calls.metricDisplay,
        detail: topPerformers.calls.metricSubtext,
        color: [245, 158, 11], // Amber
        isRepStar: isIndividual && topPerformers.calls.executiveName === summary.salesperson,
      },
      {
        label: topPerformers.conversion.categoryTitle,
        name: topPerformers.conversion.executiveName,
        val: topPerformers.conversion.metricDisplay,
        detail: topPerformers.conversion.metricSubtext,
        color: [139, 92, 246], // Violet
        isRepStar: isIndividual && topPerformers.conversion.executiveName === summary.salesperson,
      },
    ];

    cards.forEach((c, idx) => {
      const cx = 15.5 + idx * (colW + 2);

      // Card Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(253, 230, 138); // amber-200
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, cardY, colW, cardH, 1.8, 1.8, "FD");

      // Star Icon
      drawVectorStar(doc, cx + 4, cardY + 3.8, 5, 1.6, 0.75, [245, 158, 11], [217, 119, 6]);

      // Category Label
      doc.setFontSize(5.8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120, 53, 15); // amber-900
      doc.text(c.label, cx + 7.2, cardY + 4.2);

      // Executive Name (Highlight if current rep is the star)
      doc.setFontSize(8.2);
      doc.setFont("helvetica", "bold");
      if (c.isRepStar) {
        doc.setTextColor(16, 185, 129); // Highlighted
      } else {
        doc.setTextColor(24, 24, 27); // zinc-900
      }
      doc.text(c.name, cx + 3.5, cardY + 8.4);
      if (c.isRepStar) {
        const nameW = doc.getTextWidth(c.name);
        drawVectorStar(doc, cx + 3.5 + nameW + 2.5, cardY + 7.2, 5, 1.2, 0.6, [245, 158, 11], [217, 119, 6]);
      }

      // Metric Value
      doc.setFontSize(7.2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(c.color[0], c.color[1], c.color[2]);
      doc.text(c.val, cx + 3.5, cardY + 12.2);

      // Subtext
      if (c.detail) {
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(113, 113, 122);
        doc.text(c.detail, cx + colW - 3, cardY + 12.2, { align: "right" });
      }
    });

    return startY + containerH;
  };

  // =========================================================================
  // HELPER: RENDER 4 PRIMARY KPI SUMMARY CARDS
  // =========================================================================
  const renderKpiCards = (startY: number) => {
    const colW = (pageWidth - 28 - 6) / 2;
    const rowH = 18;

    const mainMetrics = [
      {
        title: isWholeTeam ? "Total Team Sales Revenue" : "Total Sales Revenue",
        value: `Rs. ${summary.dealAmount.toLocaleString("en-IN")}`,
        detail: `${summary.dealsClosed} deal${summary.dealsClosed === 1 ? "" : "s"} closed`,
        accentColor: [16, 185, 129], // Emerald
      },
      {
        title: isWholeTeam ? "Total Team AA Commission" : "Total AA Commission",
        value: `Rs. ${summary.aaCommission.toLocaleString("en-IN")}`,
        detail: `Effective rate: ${summary.commissionPercentage.toFixed(1)}%`,
        accentColor: [14, 165, 233], // Sky blue
      },
      {
        title: isWholeTeam ? "Overall Revenue per Call" : "Revenue per Call",
        value:
          summary.revenuePerCall > 0
            ? `Rs. ${Math.round(summary.revenuePerCall).toLocaleString("en-IN")}`
            : "Rs. 0",
        detail:
          summary.numberOfCalls > 0
            ? `From ${summary.numberOfCalls} entered calls`
            : "No calls logged",
        accentColor: [245, 158, 11], // Amber
      },
      {
        title: isWholeTeam ? "Overall AA Comm. per Call" : "AA Commission per Call",
        value:
          summary.aaCommissionPerCall > 0
            ? `Rs. ${Math.round(summary.aaCommissionPerCall).toLocaleString("en-IN")}`
            : "Rs. 0",
        detail:
          summary.numberOfCalls > 0
            ? `Net yield per call`
            : "No calls logged",
        accentColor: [139, 92, 246], // Violet
      },
    ];

    mainMetrics.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = 14 + col * (colW + 6);
      const cy = startY + row * (rowH + 3.5);

      // Card container
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(228, 228, 231);
      doc.roundedRect(cx, cy, colW, rowH, 2, 2, "FD");

      // Top Accent Line
      doc.setFillColor(m.accentColor[0], m.accentColor[1], m.accentColor[2]);
      doc.rect(cx, cy, colW, 1.2, "F");

      // Title
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 113, 122);
      doc.text(m.title.toUpperCase(), cx + 4, cy + 5.8);

      // Value
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      doc.text(m.value, cx + 4, cy + 11.8);

      // Detail
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(m.detail, cx + 4, cy + 15.8);
    });

    return startY + 2 * (rowH + 3.5);
  };

  // =========================================================================
  // REPORT STRUCTURE: WHOLE TEAM VS INDIVIDUAL EXECUTIVE
  // =========================================================================

  if (isWholeTeam) {
    // -----------------------------------------------------------------------
    // WHOLE TEAM: PAGE 1 (Overview, Category Champions & Line Graphs)
    // -----------------------------------------------------------------------
    renderHeaderBanner(
      "MnP Sales Performance Report - Whole Team",
      "Executive Performance Overview, Revenue Trajectory & AA Commission Forecasting",
      28
    );

    // Scope Card (y: 31..47)
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(14, 31, pageWidth - 28, 15, 2, 2, "F");

    doc.setTextColor(39, 39, 42);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE SCOPE:", 18, 37.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Whole Team (${coreTeamMetrics.length} Sales Representatives)`, 55, 37.5);

    doc.setFont("helvetica", "bold");
    doc.text("DATE RANGE:", 18, 43);
    doc.setFont("helvetica", "normal");
    doc.text(dateRangeText, 55, 43);

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL CALLS:", 126, 37.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${summary.numberOfCalls} calls entered`, 154, 37.5);

    doc.setFont("helvetica", "bold");
    doc.text("CLOSED DEALS:", 126, 43);
    doc.setFont("helvetica", "normal");
    doc.text(`${summary.dealsClosed} closed deals`, 154, 43);

    // ⭐ TOP PERFORMERS SECTION AT THE TOP OF THE REPORT ⭐ (y: 49..75)
    renderTopPerformersShowcase(49, false);

    // KPI Cards (y: 78..118)
    renderKpiCards(78);

    // 1. Monthly Cumulative Sales Revenue Trajectory Line Graph (y: 122..196)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 122,
      width: pageWidth - 28,
      height: 74,
      title: "Monthly Cumulative Sales Revenue Trajectory (Rs.)",
      subtitle: "Day 1 to 31 cumulative sales progression vs prior month benchmark & projected month-end target",
      metricType: "sales",
      records,
      salesperson: "All",
    });

    // 2. Monthly Cumulative AA Commission Trajectory Line Graph (y: 200..274)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 200,
      width: pageWidth - 28,
      height: 74,
      title: "Monthly Cumulative AA Commission Trajectory (Rs.)",
      subtitle: "Day 1 to 31 cumulative AA Commission earnings pace vs prior month benchmark",
      metricType: "commission",
      records,
      salesperson: "All",
    });

    // -----------------------------------------------------------------------
    // WHOLE TEAM: PAGE 2 (Deals Trajectory, Synopsis Table & Distribution)
    // -----------------------------------------------------------------------
    doc.addPage();
    renderHeaderBanner(
      "Team Performance Breakdown & Synopsis Matrix",
      "Executive Individual Call Yields, Conversion Rates & Movement Distribution",
      26
    );

    // 3. Monthly Closed Deals Trajectory Line Graph (y: 29..103)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 29,
      width: pageWidth - 28,
      height: 74,
      title: "Monthly Closed Deals Trajectory (Deal Volume Count)",
      subtitle: "Day 1 to 31 deal velocity pace & projected month-end deal closure forecast",
      metricType: "deals",
      records,
      salesperson: "All",
    });

    // Individual Performance Synopsis Table (y: 107)
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text("Individual Performance Synopsis Table", 14, 108);

    const individualTableHead = [
      [
        "Sales Executive",
        "Calls",
        "Deals",
        "Total Revenue",
        "AA Comm.",
        "Rev / Call",
        "Comm / Call",
        "Conv. %",
        "Avg Deal",
      ],
    ];

    const individualTableBody = coreTeamMetrics.map((m) => {
      const isTopRev = m.name === topPerformers.revenue.executiveName;
      const isTopComm = m.name === topPerformers.commission.executiveName;
      const isTopCalls = m.name === topPerformers.calls.executiveName;
      const isTopConv = m.name === topPerformers.conversion.executiveName;

      return [
        m.name + (isTopRev || isTopComm || isTopCalls || isTopConv ? " *" : ""),
        `${m.enteredCalls}`,
        `${m.totalDeals}`,
        `Rs. ${m.totalDealAmount.toLocaleString("en-IN")}`,
        `Rs. ${m.totalAaCommission.toLocaleString("en-IN")}`,
        m.revenuePerCall > 0 ? `Rs. ${Math.round(m.revenuePerCall).toLocaleString("en-IN")}` : "Rs. 0",
        m.commissionPerCall > 0 ? `Rs. ${Math.round(m.commissionPerCall).toLocaleString("en-IN")}` : "Rs. 0",
        m.conversionRate > 0 ? `${m.conversionRate.toFixed(1)}%` : "0.0%",
        m.averageDealSize > 0 ? `Rs. ${Math.round(m.averageDealSize).toLocaleString("en-IN")}` : "Rs. 0",
      ];
    });

    // Whole Team Aggregate Row
    individualTableBody.push([
      "WHOLE TEAM (TOTAL)",
      `${summary.numberOfCalls}`,
      `${summary.dealsClosed}`,
      `Rs. ${summary.dealAmount.toLocaleString("en-IN")}`,
      `Rs. ${summary.aaCommission.toLocaleString("en-IN")}`,
      summary.revenuePerCall > 0 ? `Rs. ${Math.round(summary.revenuePerCall).toLocaleString("en-IN")}` : "Rs. 0",
      summary.aaCommissionPerCall > 0 ? `Rs. ${Math.round(summary.aaCommissionPerCall).toLocaleString("en-IN")}` : "Rs. 0",
      summary.conversionRate > 0 ? `${summary.conversionRate.toFixed(1)}%` : "0.0%",
      summary.averageDealAmount > 0 ? `Rs. ${Math.round(summary.averageDealAmount).toLocaleString("en-IN")}` : "Rs. 0",
    ]);

    autoTable(doc, {
      startY: 111,
      head: individualTableHead,
      body: individualTableBody,
      theme: "striped",
      headStyles: {
        fillColor: [24, 24, 27],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [39, 39, 42],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 28 },
        1: { halign: "center", cellWidth: 15 },
        2: { halign: "center", cellWidth: 12 },
        3: { halign: "right", cellWidth: 26 },
        4: { halign: "right", cellWidth: 25 },
        5: { halign: "right", cellWidth: 20 },
        6: { halign: "right", cellWidth: 20 },
        7: { halign: "center", cellWidth: 16 },
        8: { halign: "right", cellWidth: 20 },
      },
      didParseCell: (data) => {
        if (data.row.index === individualTableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [238, 242, 255]; // Soft indigo
          data.cell.styles.textColor = [17, 24, 39];
        } else if (data.section === "body") {
          const person = coreTeamMetrics[data.row.index];
          if (person) {
            if (data.column.index === 1 && person.name === topPerformers.calls.executiveName && person.enteredCalls > 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [254, 243, 199]; // amber-100
              data.cell.styles.textColor = [146, 64, 14];
            } else if (data.column.index === 3 && person.name === topPerformers.revenue.executiveName && person.totalDealAmount > 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [236, 253, 245]; // emerald-100
              data.cell.styles.textColor = [6, 95, 70];
            } else if (data.column.index === 4 && person.name === topPerformers.commission.executiveName && person.totalAaCommission > 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [224, 242, 254]; // sky-100
              data.cell.styles.textColor = [7, 89, 133];
            } else if (data.column.index === 7 && person.name === topPerformers.conversion.executiveName && person.conversionRate > 0) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [243, 232, 255]; // violet-100
              data.cell.styles.textColor = [107, 33, 168];
            }
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    const afterTableY = (doc as any).lastAutoTable?.finalY || 185;

    // Movement Type Distribution Section
    const movementY = afterTableY + 6;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text("Movement Type Distribution (Deals Breakdown)", 14, movementY);

    const mDist = summary.movementDistribution;
    const movementRows = [
      ["Intracity Deals (Local Movement)", `${mDist.intracityDeals} deals`, `${mDist.intracityPercentage.toFixed(1)}% of total movement deals`],
      ["Intercity Deals (Long Distance Movement)", `${mDist.intercityDeals} deals`, `${mDist.intercityPercentage.toFixed(1)}% of total movement deals`],
      ["Total Movement Deals Classified", `${mDist.totalMovementDeals} deals`, "100.0%"],
    ];

    autoTable(doc, {
      startY: movementY + 3,
      head: [["Movement Category", "Deal Volume", "Proportion"]],
      body: movementRows,
      theme: "striped",
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [39, 39, 42],
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "center", cellWidth: 35 },
        2: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.row.index === movementRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [243, 244, 246];
        }
      },
      margin: { left: 14, right: 14 },
    });

    // -----------------------------------------------------------------------
    // WHOLE TEAM: PAGE 3 (Individual Rep Synopsis Cards)
    // -----------------------------------------------------------------------
    doc.addPage();
    renderHeaderBanner(
      "Executive Individual Performance Synopses",
      `Detailed call yield, deal conversion & revenue synopsis for ${dateRangeText}`,
      26
    );

    let cardY = 32;
    const cardWidth = pageWidth - 28;
    const cardHeight = 35;

    coreTeamMetrics.forEach((person, idx) => {
      if (cardY + cardHeight > pageHeight - 20) {
        doc.addPage();
        renderHeaderBanner("Executive Individual Performance Synopses (Cont.)", `Period: ${dateRangeText}`, 26);
        cardY = 32;
      }

      const isTopRev = person.name === topPerformers.revenue.executiveName;
      const isTopComm = person.name === topPerformers.commission.executiveName;
      const isTopCalls = person.name === topPerformers.calls.executiveName;
      const isTopConv = person.name === topPerformers.conversion.executiveName;

      // Container
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(228, 228, 231);
      doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, "FD");

      // Left Accent (Gold if any category champion, otherwise Zinc)
      if (isTopRev || isTopComm || isTopCalls || isTopConv) {
        doc.setFillColor(245, 158, 11); // Gold
      } else {
        doc.setFillColor(24, 24, 27); // Zinc
      }
      doc.rect(14, cardY, 3, cardHeight, "F");

      // Executive Name
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(24, 24, 27);
      const isChamp = isTopRev || isTopComm || isTopCalls || isTopConv;
      doc.text(
        `${idx + 1}. ${person.name}${isChamp ? " (Category Leader)" : ""}`,
        22,
        cardY + 7
      );

      // Revenue Headline
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129);
      doc.text(
        `Total Sales: Rs. ${person.totalDealAmount.toLocaleString("en-IN")}`,
        pageWidth - 20,
        cardY + 7,
        { align: "right" }
      );

      // Divider
      doc.setDrawColor(244, 244, 245);
      doc.line(22, cardY + 10, pageWidth - 18, cardY + 10);

      const colStep = (cardWidth - 14) / 4;

      // Col 1: Calls & Deals
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 113, 122);
      doc.text("CALLS & DEALS", 22, cardY + 15);
      doc.setFontSize(8);
      doc.setTextColor(24, 24, 27);
      doc.text(`${person.enteredCalls} calls | ${person.totalDeals} deals`, 22, cardY + 20.5);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(`Conversion: ${person.conversionRate.toFixed(1)}%`, 22, cardY + 25.5);

      // Col 2: Commission
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 113, 122);
      doc.text("AA COMMISSION", 22 + colStep, cardY + 15);
      doc.setFontSize(8);
      doc.setTextColor(24, 24, 27);
      doc.text(`Rs. ${person.totalAaCommission.toLocaleString("en-IN")}`, 22 + colStep, cardY + 20.5);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(`Avg Rate: ${person.averageCommissionRate.toFixed(1)}%`, 22 + colStep, cardY + 25.5);

      // Col 3: Revenue / Call
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 113, 122);
      doc.text("REVENUE / CALL", 22 + colStep * 2, cardY + 15);
      doc.setFontSize(8);
      doc.setTextColor(16, 185, 129);
      doc.text(
        person.revenuePerCall > 0
          ? `Rs. ${Math.round(person.revenuePerCall).toLocaleString("en-IN")}`
          : "Rs. 0",
        22 + colStep * 2,
        cardY + 20.5
      );
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(
        person.callsPerDeal > 0 ? `${person.callsPerDeal.toFixed(1)} calls/deal` : "0 calls/deal",
        22 + colStep * 2,
        cardY + 25.5
      );

      // Col 4: Comm / Call
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 113, 122);
      doc.text("COMM. / CALL", 22 + colStep * 3, cardY + 15);
      doc.setFontSize(8);
      doc.setTextColor(139, 92, 246);
      doc.text(
        person.commissionPerCall > 0
          ? `Rs. ${Math.round(person.commissionPerCall).toLocaleString("en-IN")}`
          : "Rs. 0",
        22 + colStep * 3,
        cardY + 20.5
      );
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(113, 113, 122);
      doc.text(
        person.averageDealSize > 0
          ? `Avg Deal: Rs. ${Math.round(person.averageDealSize).toLocaleString("en-IN")}`
          : "No deals",
        22 + colStep * 3,
        cardY + 25.5
      );

      cardY += cardHeight + 4;
    });

  } else {
    // -----------------------------------------------------------------------
    // INDIVIDUAL SALES EXECUTIVE REPORT
    // -----------------------------------------------------------------------

    // Page 1: Overview, Champions Standing & Breakdown Table
    renderHeaderBanner(
      `MnP Sales Performance Report - ${summary.salesperson}`,
      "Individual Performance Metrics, Revenue Yield & Movement Distribution",
      28
    );

    // Scope Box (y: 31..47)
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(14, 31, pageWidth - 28, 15, 2, 2, "F");

    doc.setTextColor(39, 39, 42);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("SALES EXECUTIVE:", 18, 37.5);
    doc.setFont("helvetica", "normal");
    doc.text(summary.salesperson, 55, 37.5);

    doc.setFont("helvetica", "bold");
    doc.text("DATE RANGE:", 18, 43);
    doc.setFont("helvetica", "normal");
    doc.text(dateRangeText, 55, 43);

    doc.setFont("helvetica", "bold");
    doc.text("TOTAL CALLS:", 126, 37.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${summary.numberOfCalls} calls entered`, 154, 37.5);

    doc.setFont("helvetica", "bold");
    doc.text("CLOSED DEALS:", 126, 43);
    doc.setFont("helvetica", "normal");
    doc.text(`${summary.dealsClosed} closed deals`, 154, 43);

    // ⭐ TOP PERFORMERS / EXECUTIVE STANDING SHOWCASE AT THE TOP ⭐ (y: 49..75)
    renderTopPerformersShowcase(49, true);

    // KPI Cards (y: 78..118)
    renderKpiCards(78);

    // Performance Breakdown Table
    const summaryTableY = 122;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text("Executive Performance Breakdown", 14, summaryTableY);

    const isTopRev = summary.salesperson === topPerformers.revenue.executiveName;
    const isTopComm = summary.salesperson === topPerformers.commission.executiveName;
    const isTopCalls = summary.salesperson === topPerformers.calls.executiveName;
    const isTopConv = summary.salesperson === topPerformers.conversion.executiveName;

    const summaryRows = [
      ["Sales Executive", summary.salesperson + (isTopRev || isTopComm || isTopCalls || isTopConv ? " (Category Leader)" : "")],
      ["Reporting Period", dateRangeText],
      ["Calls Logged / Entered", `${summary.numberOfCalls} calls` + (isTopCalls ? " (#1 Most Calls)" : "")],
      ["Total Deals Closed", `${summary.dealsClosed} deals`],
      ["Total Deal Revenue", `Rs. ${summary.dealAmount.toLocaleString("en-IN")}` + (isTopRev ? " (#1 Highest Revenue)" : "")],
      ["Total AA Commission Earned", `Rs. ${summary.aaCommission.toLocaleString("en-IN")}` + (isTopComm ? " (#1 Highest Commission)" : "")],
      ["Average AA Commission Rate", `${summary.commissionPercentage.toFixed(2)}%`],
      [
        "Revenue Generated per Call",
        summary.revenuePerCall > 0
          ? `Rs. ${Math.round(summary.revenuePerCall).toLocaleString("en-IN")}`
          : "Rs. 0",
      ],
      [
        "AA Commission per Call",
        summary.aaCommissionPerCall > 0
          ? `Rs. ${Math.round(summary.aaCommissionPerCall).toLocaleString("en-IN")}`
          : "Rs. 0",
      ],
      [
        "Deal Conversion Rate",
        (summary.conversionRate > 0 ? `${summary.conversionRate.toFixed(2)}%` : "0.0%") + (isTopConv ? " (#1 Highest Conversion)" : ""),
      ],
      [
        "Average Deal Size",
        summary.averageDealAmount > 0
          ? `Rs. ${Math.round(summary.averageDealAmount).toLocaleString("en-IN")}`
          : "Rs. 0",
      ],
    ];

    autoTable(doc, {
      startY: summaryTableY + 3,
      head: [["Performance Metric", "Value"]],
      body: summaryRows,
      theme: "striped",
      headStyles: {
        fillColor: [24, 24, 27],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [39, 39, 42],
        cellPadding: 1.8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 85 },
        1: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    const endTableY = (doc as any).lastAutoTable?.finalY || 205;

    // Movement Breakdown Table
    const moveY = endTableY + 5;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 24, 27);
    doc.text("Movement Type Distribution", 14, moveY);

    const mDist = summary.movementDistribution;
    const moveRows = [
      ["Intracity Deals (Local Movement)", `${mDist.intracityDeals} deals`, `${mDist.intracityPercentage.toFixed(1)}%`],
      ["Intercity Deals (Long Distance)", `${mDist.intercityDeals} deals`, `${mDist.intercityPercentage.toFixed(1)}%`],
    ];

    autoTable(doc, {
      startY: moveY + 3,
      head: [["Movement Type", "Deals", "Share"]],
      body: moveRows,
      theme: "striped",
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [39, 39, 42],
        cellPadding: 1.8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 70 },
        1: { halign: "center", cellWidth: 35 },
        2: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    // -----------------------------------------------------------------------
    // INDIVIDUAL: PAGE 2 (Monthly Trajectory Line Graphs: Sales, AA Comm & Deals)
    // -----------------------------------------------------------------------
    doc.addPage();
    renderHeaderBanner(
      `${summary.salesperson} - Monthly Performance & Trajectory Trends`,
      "Day 1 to 31 Cumulative Sales Revenue, AA Commission & Deal Velocity",
      26
    );

    // 1. Executive Sales Revenue Trajectory Line Graph (y: 29..103)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 29,
      width: pageWidth - 28,
      height: 74,
      title: `${summary.salesperson} - Monthly Sales Revenue Trajectory (Rs.)`,
      subtitle: "Day 1 to 31 cumulative revenue progression vs prior month benchmark & month-end forecast",
      metricType: "sales",
      records,
      salesperson: summary.salesperson,
    });

    // 2. Executive AA Commission Trajectory Line Graph (y: 107..181)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 107,
      width: pageWidth - 28,
      height: 74,
      title: `${summary.salesperson} - Monthly AA Commission Trajectory (Rs.)`,
      subtitle: "Day 1 to 31 cumulative AA Commission earnings trajectory vs prior month benchmark",
      metricType: "commission",
      records,
      salesperson: summary.salesperson,
    });

    // 3. Executive Closed Deals Trajectory Line Graph (y: 185..259)
    drawMonthlyTrajectoryChart({
      doc,
      x: 14,
      y: 185,
      width: pageWidth - 28,
      height: 74,
      title: `${summary.salesperson} - Monthly Closed Deals Trajectory (Count)`,
      subtitle: "Day 1 to 31 cumulative deal volume pace & month-end projection",
      metricType: "deals",
      records,
      salesperson: summary.salesperson,
    });
  }

  // =========================================================================
  // FOOTER & PAGE NUMBERING (ALL PAGES)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      "Confidential | Generated by MnP Sales Performance Analytics Dashboard",
      14,
      pageHeight - 8
    );
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: "right" }
    );
  }

  // Generate filename and trigger download
  const safeName = summary.salesperson.replace(/\s+/g, "_");
  const fileName = `MnP_Sales_Report_${safeName}_${nowStr.replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}
