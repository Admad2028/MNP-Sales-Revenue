import { useState } from "react";
import { X, Copy, Check, Download, Share2, FileText, Printer } from "lucide-react";
import { CalculationSummary, SheetRecord } from "../types";
import { formatINR, formatDateDisplay } from "../utils/sheetParser";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: CalculationSummary;
  records: SheetRecord[];
}

export function ExportModal({
  isOpen,
  onClose,
  summary,
  records,
}: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const {
    salesperson,
    startDate,
    endDate,
    numberOfCalls,
    dealsClosed,
    dealAmount,
    aaCommission,
    revenuePerCall,
    aaCommissionPerCall,
    conversionRate,
    averageDealAmount,
    individualMetrics,
  } = summary;

  let topPerformersText = "";
  let individualBreakdownText = "";
  if (salesperson === "All" && individualMetrics && individualMetrics.length > 0) {
    const valid = individualMetrics.filter(
      (m) => m.name !== "Storage Team" && m.name !== "All"
    );

    let topRev = valid[0];
    let topComm = valid[0];
    let topCalls = valid[0];
    let topConv = valid[0];

    valid.forEach((m) => {
      if (m.totalDealAmount > (topRev?.totalDealAmount || 0)) topRev = m;
      if (m.totalAaCommission > (topComm?.totalAaCommission || 0)) topComm = m;
      if (m.enteredCalls > (topCalls?.enteredCalls || 0)) topCalls = m;
      if ((m.enteredCalls > 0 || m.totalDeals > 0) && m.conversionRate > (topConv?.conversionRate || 0)) topConv = m;
    });

    topPerformersText = `\n\n⭐ *TOP PERFORMING EXECUTIVES (CATEGORY CHAMPIONS):*\n` +
      `• *Top Revenue:* ${topRev?.name || "N/A"} (${formatINR(topRev?.totalDealAmount || 0)})\n` +
      `• *Top AA Commission:* ${topComm?.name || "N/A"} (${formatINR(topComm?.totalAaCommission || 0)})\n` +
      `• *Most Calls Done:* ${topCalls?.name || "N/A"} (${topCalls?.enteredCalls || 0} calls)\n` +
      `• *Highest Conversion:* ${topConv?.name || "N/A"} (${(topConv?.conversionRate || 0).toFixed(1)}%)`;

    individualBreakdownText = `\n\n👥 *INDIVIDUAL PERFORMANCE SYNOPSIS:*\n` +
      individualMetrics
        .filter((m) => m.name !== "Storage Team" || m.totalDealAmount > 0 || m.enteredCalls > 0)
        .map((m) => `• *${m.name}:* ${m.enteredCalls} calls | ${m.totalDeals} deals | ${formatINR(m.totalDealAmount)} sales | ${formatINR(m.revenuePerCall, 1)}/call | Conv: ${m.conversionRate.toFixed(1)}%`)
        .join("\n");
  }

  const summaryText = `📊 *Sales Call & Revenue Intelligence Report*
----------------------------------------
👤 *Salesperson:* ${salesperson === "All" ? "Whole Team" : salesperson}
📅 *Date Range:* ${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}
📞 *Calls Made:* ${numberOfCalls} calls

💰 *KEY METRICS:*
• *Revenue Per Call:* ${formatINR(revenuePerCall, 2)}
• *AA Commission Per Call:* ${formatINR(aaCommissionPerCall, 2)}
• *Total Sales / Deal Amount:* ${formatINR(dealAmount)}
• *Total AA Commission:* ${formatINR(aaCommission)}
• *Closed Deals:* ${dealsClosed} deals
• *Conversion Rate:* ${conversionRate.toFixed(2)}%
• *Avg Deal Value:* ${formatINR(averageDealAmount)}${topPerformersText}${individualBreakdownText}

Synced from Google Sheets live sales records.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-zinc-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Export & Share Report</h3>
              <p className="text-xs text-zinc-500">Formatted summary for Slack, WhatsApp & Email</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Text Preview Box */}
        <div className="relative">
          <pre className="p-4 bg-zinc-900 text-zinc-100 text-xs font-mono rounded-2xl overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 border border-zinc-800">
            {summaryText}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500" />
            Print Report
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-xs ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Summary Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
