import { useState } from "react";
import {
  PhoneCall,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { SheetSyncStatus } from "../types";
import { DEFAULT_SHEET_URL } from "../utils/sheetParser";

interface HeaderProps {
  syncStatus: SheetSyncStatus;
  onRefresh: () => void;
  onDownloadReport: () => void;
}

export function Header({
  syncStatus,
  onRefresh,
  onDownloadReport,
}: HeaderProps) {
  const [isRotating, setIsRotating] = useState(false);

  const handleRefreshClick = () => {
    setIsRotating(true);
    onRefresh();
    setTimeout(() => setIsRotating(false), 1000);
  };

  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-sm">
              <PhoneCall className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight">
                  MnP Sales Performance Analysis
                </h1>
              </div>
              <p className="text-xs text-zinc-500 hidden sm:block">
                Revenue and AA Commission Analytics
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Live Sheet Status */}
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate max-w-[150px]">
                {syncStatus.isSyncing ? "Syncing Live..." : "Auto-Sync Active"}
              </span>
              {syncStatus.isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
              ) : syncStatus.error ? (
                <span title={syncStatus.error} className="text-amber-700 flex items-center gap-1 font-normal">
                  <AlertCircle className="w-3 h-3" /> ({syncStatus.totalRows} cached)
                </span>
              ) : (
                <span className="font-bold text-emerald-800">
                  {syncStatus.totalRows} rows
                </span>
              )}
              <a
                href={syncStatus.sourceUrl || DEFAULT_SHEET_URL}
                target="_blank"
                rel="noreferrer"
                title="Open Google Sheet in new tab"
                className="text-emerald-600 hover:text-emerald-900 p-0.5"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Sync Button */}
            <button
              id="btn-sync-sheet"
              type="button"
              onClick={handleRefreshClick}
              disabled={syncStatus.isSyncing}
              title="Sync latest records from Google Sheet"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100 transition-colors shadow-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRotating || syncStatus.isSyncing ? "animate-spin text-zinc-900" : "text-zinc-500"
                }`}
              />
              <span className="hidden sm:inline">Sync Sheet</span>
            </button>

            {/* Download PDF Report Button */}
            <button
              id="btn-download-pdf-report"
              type="button"
              onClick={onDownloadReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-xl text-white bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Download Report</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
