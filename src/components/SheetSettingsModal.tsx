import React, { useState, FormEvent } from "react";
import { X, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, RotateCcw } from "lucide-react";
import { DEFAULT_SHEET_URL } from "../utils/sheetParser";

interface SheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveUrl: (url: string) => void;
  isSyncing: boolean;
  error: string | null;
  totalRows: number;
}

export function SheetSettingsModal({
  isOpen,
  onClose,
  currentUrl,
  onSaveUrl,
  isSyncing,
  error,
  totalRows,
}: SheetSettingsModalProps) {
  const [urlInput, setUrlInput] = useState(currentUrl);

  if (!isOpen) return null;

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    onSaveUrl(urlInput.trim() || DEFAULT_SHEET_URL);
    onClose();
  };

  const handleResetDefault = () => {
    setUrlInput(DEFAULT_SHEET_URL);
    onSaveUrl(DEFAULT_SHEET_URL);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-zinc-200 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Google Sheet Connection</h3>
              <p className="text-xs text-zinc-500">Live data synchronization settings</p>
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

        {/* Current status */}
        <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-700">Sync Status:</span>
            {isSyncing ? (
              <span className="text-zinc-900 font-medium flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-zinc-700" /> Synchronizing...
              </span>
            ) : error ? (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Using Cached Data ({totalRows} rows)
              </span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Live & Connected ({totalRows} rows)
              </span>
            )}
          </div>
          {error && <p className="text-amber-700 text-[11px]">{error}</p>}
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Google Spreadsheet URL (Public or Anyone with Link):
            </label>
            <textarea
              rows={3}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full p-3.5 text-xs font-mono text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 focus:bg-white resize-none outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <a
              href={urlInput}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-900 hover:text-zinc-700 flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Sheet in Google Docs
            </a>

            <button
              type="button"
              onClick={handleResetDefault}
              className="text-zinc-600 hover:text-zinc-900 flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Default
            </button>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs transition-colors"
            >
              Save & Sync Sheet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
