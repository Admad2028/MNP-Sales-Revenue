import { useState, useMemo, useRef } from "react";
import { SheetRecord } from "../types";
import {
  aggregateCityOrigins,
  MonthFilter,
  CityAggregatedMetric,
} from "../utils/originCityParser";
import { INDIA_STATES, MAP_DIMENSIONS } from "../data/indiaMapData";
import { formatINR } from "../utils/sheetParser";
import {
  getCityColorInfo,
  getStateColorInfo,
  getCityCircleRadius,
  getCityHaloRadius,
  LEGEND_SHADES,
} from "../utils/heatColorScale";
import {
  MapPin,
  Flame,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Users,
  Compass,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Info,
  Calendar,
  Sparkles,
  CircleDot,
  Download,
  FileDown,
  Loader2,
} from "lucide-react";
import { downloadHeatMapPdf } from "../utils/heatMapPdfGenerator";

interface IndiaOriginHeatMapProps {
  records: SheetRecord[];
  activeRepFilter?: string;
}

export function IndiaOriginHeatMap({
  records,
  activeRepFilter = "All",
}: IndiaOriginHeatMapProps) {
  // Expand/collapse state
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Filter state: September, October, or Both (Consensus)
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("both");

  // Optional local salesperson filter (defaults to parent active rep or All)
  const [selectedRep, setSelectedRep] = useState<string>("All");

  // Interactive inspection state
  const [hoveredCity, setHoveredCity] = useState<CityAggregatedMetric | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityAggregatedMetric | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // PDF download handler for active timeframe & rep
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadHeatMapPdf({
        monthFilter,
        selectedRep,
        analytics,
        svgElement: svgRef.current,
      });
    } catch (err) {
      console.error("Error downloading heat map PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Compute aggregated data for active filter
  const analytics = useMemo(() => {
    return aggregateCityOrigins(records, monthFilter, selectedRep);
  }, [records, monthFilter, selectedRep]);

  // Compute dynamic counts for month filter buttons
  const sepQuickSummary = useMemo(
    () => aggregateCityOrigins(records, "september", selectedRep),
    [records, selectedRep]
  );
  const octQuickSummary = useMemo(
    () => aggregateCityOrigins(records, "october", selectedRep),
    [records, selectedRep]
  );
  const bothQuickSummary = useMemo(
    () => aggregateCityOrigins(records, "both", selectedRep),
    [records, selectedRep]
  );

  // City lookup map for fast SVG marker matching
  const cityByName = useMemo(() => {
    const map = new Map<string, CityAggregatedMetric>();
    for (const c of analytics.cities) {
      map.set(c.canonicalName.toLowerCase(), c);
    }
    return map;
  }, [analytics.cities]);

  // Filtered city list for ledger
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return analytics.cities;
    const q = searchQuery.toLowerCase().trim();
    return analytics.cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.executives.some((e) => e.toLowerCase().includes(q))
    );
  }, [analytics.cities, searchQuery]);

  // Max order count among cities for relative scaling
  const maxOrderCount = useMemo(() => {
    return Math.max(...analytics.cities.map((c) => c.orderCount), 1);
  }, [analytics.cities]);

  // Max order count among states for regional scale
  const maxStateOrderCount = useMemo(() => {
    const counts = Object.values(analytics.stateMetrics).map((s) => s.orderCount);
    return Math.max(...counts, 1);
  }, [analytics.stateMetrics]);

  // Sorted cities for layer rendering so higher-volume cities and active city draw on top
  const sortedCitiesForRendering = useMemo(() => {
    return [...analytics.cities].sort((a, b) => {
      if (selectedCity?.name === a.name) return 1;
      if (selectedCity?.name === b.name) return -1;
      if (hoveredCity?.name === a.name) return 1;
      if (hoveredCity?.name === b.name) return -1;
      return a.orderCount - b.orderCount;
    });
  }, [analytics.cities, selectedCity, hoveredCity]);

  // Active highlighted city (either hovered or selected)
  const activeCity = hoveredCity || selectedCity;

  // Active highlighted city color info
  const activeCityColor = useMemo(() => {
    if (!activeCity) return null;
    return getCityColorInfo(activeCity.orderCount, maxOrderCount);
  }, [activeCity, maxOrderCount]);

  // Handle SVG city hover
  const handleCityMouseEnter = (
    city: CityAggregatedMetric,
    event: React.MouseEvent
  ) => {
    setHoveredCity(city);
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleCityMouseMove = (event: React.MouseEvent) => {
    if (mapContainerRef.current) {
      const rect = mapContainerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  };

  const handleCityMouseLeave = () => {
    setHoveredCity(null);
    setTooltipPos(null);
  };

  // State fill color helper: 0 orders = White (#FFFFFF); >0 scales from subtle light orange to rich red
  const getStateFill = (stateName: string) => {
    const stateMetric = analytics.stateMetrics[stateName];
    const count = stateMetric ? stateMetric.orderCount : 0;
    return getStateColorInfo(count, maxStateOrderCount).fill;
  };

  const getStateStroke = (stateName: string) => {
    const stateMetric = analytics.stateMetrics[stateName];
    const count = stateMetric ? stateMetric.orderCount : 0;
    return getStateColorInfo(count, maxStateOrderCount).stroke;
  };

  // Available reps from records for secondary filter
  const repOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      if (r.executive && r.executive.trim()) {
        set.add(r.executive.trim());
      }
    }
    return ["All", ...Array.from(set).sort()];
  }, [records]);

  return (
    <div className="bg-white border border-zinc-200 rounded-3xl p-5 sm:p-7 shadow-sm transition-all duration-200">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-md shadow-red-500/20 shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
                Client Origin Heat Map (India)
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60">
                <Flame className="w-3 h-3 text-red-600 fill-red-600" />
                Column I Deals &amp; Column K Origin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
              Geographic consensus mapping each closed deal (Col I) to origin cities (Col K). Single-city rows with multiple deals allocate all deals to that city; multi-city rows distribute deals per mentioned cities.
            </p>
          </div>
        </div>

        {/* Action Buttons: Download PDF & Expand/Collapse */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 disabled:opacity-60 rounded-xl shadow-xs shadow-red-600/30 transition-all border border-red-500/30 cursor-pointer active:scale-95"
            title={`Download complete Heat Map report, ranked origin hubs, and regional state aggregation for ${
              monthFilter === "september"
                ? "September 2026"
                : monthFilter === "october"
                ? "October 2026"
                : "Sep + Oct Consensus"
            } as PDF`}
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileDown className="w-4 h-4 text-white" />
            )}
            <span>{isGeneratingPdf ? "Generating PDF..." : "Download Heat Map PDF"}</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 bg-red-950/40 text-rose-100 rounded font-mono font-medium">
              {monthFilter === "september"
                ? "Sep 2026"
                : monthFilter === "october"
                ? "Oct 2026"
                : "Sep + Oct"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl border border-zinc-200/80 transition-colors"
          >
            <span>{isExpanded ? "Collapse Map" : "Expand Heat Map"}</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-6 space-y-6">
          {/* 2. Month Filters & Secondary Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-white via-red-50/30 to-amber-50/20 p-4 sm:p-5 rounded-2xl border-2 border-red-200/90 shadow-sm">
            {/* Primary Month Filter Segmented Control */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200 shadow-2xs">
                <Calendar className="w-4 h-4 text-red-600" />
                Filter Month:
              </span>

              <button
                type="button"
                onClick={() => setMonthFilter("september")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  monthFilter === "september"
                    ? "bg-zinc-900 text-white shadow-md ring-2 ring-zinc-900/20"
                    : "bg-white text-zinc-700 hover:bg-zinc-50 border-2 border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span>September 2026</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-mono font-bold ${
                    monthFilter === "september"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                  }`}
                >
                  {sepQuickSummary.totalAttributedOrders} orders
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMonthFilter("october")}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  monthFilter === "october"
                    ? "bg-zinc-900 text-white shadow-md ring-2 ring-zinc-900/20"
                    : "bg-white text-zinc-700 hover:bg-zinc-50 border-2 border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <span>October 2026</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-mono font-bold ${
                    monthFilter === "october"
                      ? "bg-red-600 text-white"
                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                  }`}
                >
                  {octQuickSummary.totalAttributedOrders} orders
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMonthFilter("both")}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  monthFilter === "both"
                    ? "bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-red-600/30 ring-2 ring-red-500/30"
                    : "bg-white text-zinc-700 hover:bg-zinc-50 border-2 border-zinc-200 hover:border-zinc-300 shadow-2xs"
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Sep + Oct (Consensus)</span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-mono font-bold ${
                    monthFilter === "both"
                      ? "bg-red-900 text-amber-200"
                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                  }`}
                >
                  {bothQuickSummary.totalAttributedOrders} orders
                </span>
              </button>
            </div>

            {/* Rep Filter & Quick Reset */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border-2 border-zinc-200 shadow-2xs">
                <Users className="w-4 h-4 text-zinc-700" />
                <span className="font-bold text-xs sm:text-sm text-zinc-800">Sales Rep:</span>
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 text-zinc-900 text-xs sm:text-sm rounded-lg px-2.5 py-1 font-bold focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  {repOptions.map((rep) => (
                    <option key={rep} value={rep}>
                      {rep === "All" ? "Whole Team (All Reps)" : rep}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCity && (
                <button
                  type="button"
                  onClick={() => setSelectedCity(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors shadow-2xs"
                  title="Clear selected city focus"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Pin</span>
                </button>
              )}

              {/* Quick PDF Export button in controls bar */}
              <button
                type="button"
                disabled={isGeneratingPdf}
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-red-700 bg-white hover:bg-red-50 border-2 border-red-200/90 hover:border-red-400 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
                title={`Export PDF for ${
                  monthFilter === "september"
                    ? "September 2026"
                    : monthFilter === "october"
                    ? "October 2026"
                    : "Sep + Oct Consensus"
                }`}
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-red-600" />
                )}
                <span>Export PDF</span>
              </button>
            </div>
          </div>


          {/* 4. Main Geographic Visual Section: Map + Ranked Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: India SVG Map */}
            <div className="lg:col-span-7 bg-zinc-50/50 border border-zinc-200 rounded-3xl p-4 sm:p-6 relative flex flex-col items-center">
              {/* Zoom & View Controls */}
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white border border-zinc-200 shadow-sm rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 1.8))}
                  className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.8))}
                  className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomLevel(1);
                    setSelectedCity(null);
                  }}
                  className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Map Title / Status Badge */}
              <div className="w-full flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>
                    Interactive India Client Density (
                    {monthFilter === "september"
                      ? "September 2026"
                      : monthFilter === "october"
                      ? "October 2026"
                      : "Consensus: Sep & Oct"}
                    )
                  </span>
                </div>
                {activeCity && (
                  <span className="text-xs font-bold text-red-800 bg-red-100/80 px-2.5 py-0.5 rounded-full border border-red-200">
                    Inspecting: {activeCity.name} ({activeCity.orderCount} order
                    {activeCity.orderCount > 1 ? "s" : ""})
                  </span>
                )}
              </div>

              {/* SVG Canvas Container */}
              <div
                ref={mapContainerRef}
                onMouseMove={handleCityMouseMove}
                className="w-full max-w-[560px] aspect-[600/680] relative overflow-hidden flex items-center justify-center select-none"
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${MAP_DIMENSIONS.width} ${MAP_DIMENSIONS.height}`}
                  className="w-full h-full transition-transform duration-300 origin-center drop-shadow-sm"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  {/* Heat Density Gradients & Filters */}
                  <defs>
                    {/* Dynamic radial gradients for each origin city matching its exact shade */}
                    {analytics.cities.map((city) => {
                      const colorInfo = getCityColorInfo(city.orderCount, maxOrderCount);
                      return (
                        <radialGradient
                          key={`halo-grad-${city.canonicalName}`}
                          id={`heatHalo-${city.canonicalName}`}
                          cx="50%"
                          cy="50%"
                          r="50%"
                          fx="50%"
                          fy="50%"
                        >
                          <stop
                            offset="0%"
                            stopColor={colorInfo.haloColor}
                            stopOpacity={colorInfo.isMax ? "0.85" : "0.62"}
                          />
                          <stop
                            offset="40%"
                            stopColor={colorInfo.haloColor}
                            stopOpacity={colorInfo.isMax ? "0.45" : "0.30"}
                          />
                          <stop
                            offset="75%"
                            stopColor={colorInfo.haloColor}
                            stopOpacity="0.10"
                          />
                          <stop
                            offset="100%"
                            stopColor={colorInfo.haloColor}
                            stopOpacity="0"
                          />
                        </radialGradient>
                      );
                    })}

                    {/* Drop shadow filter for active markers */}
                    <filter
                      id="markerShadow"
                      x="-20%"
                      y="-20%"
                      width="140%"
                      height="140%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="2"
                        stdDeviation="2.5"
                        floodColor="#450A0A"
                        floodOpacity="0.35"
                      />
                    </filter>
                  </defs>

                  {/* 1. Base Layer: Indian States (0 orders = White; >0 scales from subtle light orange to rich red) */}
                  <g id="india-states-layer">
                    {INDIA_STATES.map((state) => {
                      const fill = getStateFill(state.name);
                      const stroke = getStateStroke(state.name);
                      const stateData = analytics.stateMetrics[state.name];

                      return (
                        <path
                          key={state.id}
                          d={state.path}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="0.85"
                          strokeLinejoin="round"
                          className="transition-colors duration-200 hover:opacity-90 cursor-pointer"
                        >
                          <title>
                            {state.name}
                            {stateData
                              ? ` - ${stateData.orderCount} client order(s) in ${stateData.cities.join(", ")}`
                              : " - 0 orders (White area)"}
                          </title>
                        </path>
                      );
                    })}
                  </g>

                  {/* 2. Heat Density Halos Layer */}
                  <g id="heat-halos-layer">
                    {analytics.cities.map((city) => {
                      const isSelected = selectedCity?.name === city.name;
                      const isHovered = hoveredCity?.name === city.name;

                      // Radial spread radius strictly proportional to order volume
                      const baseHaloRadius = getCityHaloRadius(city.orderCount, maxOrderCount);
                      const haloRadius =
                        isSelected || isHovered
                          ? baseHaloRadius * 1.25
                          : baseHaloRadius;

                      return (
                        <circle
                          key={`halo-${city.canonicalName}`}
                          cx={city.svgX}
                          cy={city.svgY}
                          r={haloRadius}
                          fill={`url(#heatHalo-${city.canonicalName})`}
                          className="pointer-events-none transition-all duration-300"
                        />
                      );
                    })}
                  </g>

                  {/* 3. City Markers and Badges Layer */}
                  <g id="city-markers-layer">
                    {sortedCitiesForRendering.map((city) => {
                      const isSelected = selectedCity?.name === city.name;
                      const isHovered = hoveredCity?.name === city.name;
                      const colorInfo = getCityColorInfo(city.orderCount, maxOrderCount);
                      const isMax = colorInfo.isMax;
                      const isRepeat = city.orderCount > 1;

                      // Bubble radius strictly scales with volume (e.g. 28 orders = 17px, 10 orders = 11.2px, 1 order = 5.5px)
                      const baseRadius = getCityCircleRadius(city.orderCount, maxOrderCount);
                      const radius =
                        isSelected || isHovered ? baseRadius + 2.5 : baseRadius;

                      const markerFill = colorInfo.fill;
                      const markerStroke = "#FFFFFF";

                      // Position West coast cities (like Mumbai) towards the sea to avoid inland label overlap
                      const isWestCoast = city.canonicalName.toLowerCase() === "mumbai";

                      return (
                        <g
                          key={`marker-${city.canonicalName}`}
                          className="cursor-pointer group"
                          onClick={() =>
                            setSelectedCity(
                              selectedCity?.name === city.name ? null : city
                            )
                          }
                          onMouseEnter={(e) => handleCityMouseEnter(city, e)}
                          onMouseLeave={handleCityMouseLeave}
                        >
                          {/* Pulsing ring for hotspots */}
                          {isRepeat && (
                            <circle
                              cx={city.svgX}
                              cy={city.svgY}
                              r={radius + (isMax ? 6 : 4)}
                              fill="none"
                              stroke={colorInfo.fill}
                              strokeWidth={isMax ? "2" : "1.5"}
                              strokeOpacity={isMax ? "0.85" : "0.6"}
                              className="animate-ping origin-center"
                              style={{
                                transformOrigin: `${city.svgX}px ${city.svgY}px`,
                                animationDuration: isMax ? "2.2s" : "3.2s",
                              }}
                            />
                          )}

                          {/* Outer halo highlight when active */}
                          {(isSelected || isHovered) && (
                            <circle
                              cx={city.svgX}
                              cy={city.svgY}
                              r={radius + 5}
                              fill="none"
                              stroke={isMax ? "#450A0A" : colorInfo.fill}
                              strokeWidth="2"
                              strokeDasharray="3 3"
                            />
                          )}

                          {/* Main city bubble with shade color */}
                          <circle
                            cx={city.svgX}
                            cy={city.svgY}
                            r={radius}
                            fill={markerFill}
                            stroke={markerStroke}
                            strokeWidth={isMax ? 2.5 : isRepeat ? 2 : 1.5}
                            filter="url(#markerShadow)"
                            className="transition-all duration-200"
                          />

                          {/* Order count label inside bubble if count > 1 */}
                          {city.orderCount > 1 && (
                            <text
                              x={city.svgX}
                              y={city.svgY + (radius >= 13 ? 4 : radius >= 9.5 ? 3.5 : 3)}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={radius >= 13 ? "10" : radius >= 9 ? "8.5" : "7.5"}
                              fontWeight="bold"
                              fontFamily="sans-serif"
                              className="pointer-events-none select-none font-mono drop-shadow-sm"
                            >
                              {city.orderCount}
                            </text>
                          )}

                          {/* City Name Label with white halo outline */}
                          <text
                            x={isWestCoast ? city.svgX - radius - 5 : city.svgX + radius + 4}
                            y={city.svgY + 3}
                            textAnchor={isWestCoast ? "end" : "start"}
                            fill={isMax ? "#7F1D1D" : isRepeat ? "#9A3412" : "#374151"}
                            fontSize={isMax ? "11.5" : isRepeat ? "10" : "9.5"}
                            fontWeight={isMax ? "800" : isRepeat ? "bold" : "600"}
                            fontFamily="sans-serif"
                            stroke="#FFFFFF"
                            strokeWidth="2.5"
                            paintOrder="stroke"
                            strokeLinejoin="round"
                            className="pointer-events-none select-none drop-shadow-sm"
                          >
                            {isWestCoast && isMax && "★ "}
                            {city.name}
                            {!isWestCoast && isMax && " ★"}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Interactive Tooltip Card Floating over Map */}
                {activeCity && tooltipPos && activeCityColor && (
                  <div
                    className="absolute z-30 pointer-events-none bg-zinc-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-zinc-700/80 text-xs w-68 transform -translate-x-1/2 -translate-y-full mb-3"
                    style={{
                      left: Math.max(130, Math.min(tooltipPos.x, 430)),
                      top: Math.max(70, tooltipPos.y - 12),
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-800">
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-400" />
                          <span>{activeCity.name}</span>
                          {activeCityColor.isMax && (
                            <span className="text-[10px] bg-red-600 text-white font-extrabold px-1.5 py-0.2 rounded">
                              MAX
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {activeCity.state}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs border"
                        style={{
                          backgroundColor: activeCityColor.fill,
                          borderColor: activeCityColor.stroke,
                          color:
                            activeCityColor.tier === "light-orange"
                              ? "#7C2D12"
                              : "#FFFFFF",
                        }}
                      >
                        {activeCityColor.label}
                      </span>
                    </div>

                    <div className="pt-2 space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Attributed Orders:</span>
                        <span className="font-mono font-bold text-white flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: activeCityColor.fill }}
                          />
                          {activeCity.orderCount} order
                          {activeCity.orderCount > 1 ? "s" : ""}{" "}
                          <span className="text-zinc-400 font-normal">
                            ({((activeCity.orderCount / (analytics.totalAttributedOrders || 1)) * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Deal Revenue:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatINR(activeCity.totalDealRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-zinc-400">Active Reps:</span>
                        <span className="text-zinc-300 truncate max-w-[130px]">
                          {activeCity.executives.join(", ") || "None"}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-zinc-800 text-[10px] text-zinc-400">
                        <span>Latest Orders: </span>
                        <span className="text-zinc-200">
                          {activeCity.orders
                            .map((o) => o.rawDate || o.date)
                            .slice(0, 3)
                            .join(", ")}
                          {activeCity.orders.length > 3 ? "..." : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Map Legend: Multi-Shade Sequential Scale */}
              <div className="w-full mt-4 pt-3.5 border-t border-zinc-200/80 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-800">
                    <Flame className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                    <span>Heat Intensity Scale (White → Light Orange → Dark Orange → Darkest Red)</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    Darkest red is strictly the maximum ({maxOrderCount} orders)
                  </span>
                </div>

                {/* Continuous gradient strip */}
                <div className="space-y-1">
                  <div
                    className="h-3 w-full rounded-full border border-zinc-300 shadow-2xs"
                    style={{
                      background:
                        "linear-gradient(to right, #FFFFFF 0%, #FFFFFF 10%, #FDBA74 25%, #FB923C 45%, #EA580C 65%, #DC2626 82%, #7F1D1D 100%)",
                    }}
                  />
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-600 px-0.5">
                    <span>0 (White Area)</span>
                    <span>1 (Light Orange)</span>
                    <span>Mid (Dark Orange)</span>
                    <span>High (Crimson)</span>
                    <span className="font-bold text-red-900">Max: {maxOrderCount} (Darkest Red)</span>
                  </div>
                </div>

                {/* Swatch chips */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap pt-0.5 text-xs text-zinc-700">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-white border border-zinc-300 shadow-2xs"></span>
                    <span className="text-zinc-600 font-medium">0 Orders (White Area)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#FDBA74] border border-white shadow-2xs"></span>
                    <span className="font-medium text-orange-950">1 Order (Light Orange)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#EA580C] border border-white shadow-2xs"></span>
                    <span className="font-medium text-orange-950">Mid (Dark Orange)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] border border-white shadow-2xs"></span>
                    <span className="font-medium text-red-950">High (Crimson Red)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#7F1D1D] border-2 border-white shadow-xs"></span>
                    <span className="font-bold text-red-950">
                      Max ({maxOrderCount}) (Darkest Red)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto text-[11px] text-zinc-400">
                    <span className="w-3 h-3 rounded-full bg-red-600/30 border border-red-500/40"></span>
                    <span>Density Halo</span>
                  </div>
                </div>

                {/* Circle Dimension Scale */}
                <div className="flex items-center gap-3 sm:gap-5 flex-wrap pt-2 border-t border-zinc-200/60 text-xs text-zinc-600">
                  <div className="flex items-center gap-1.5 font-semibold text-zinc-800">
                    <CircleDot className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Circle Dimension Scale:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 border border-white shadow-2xs inline-block"></span>
                    <span className="text-[11px] text-zinc-600">1 Order (Base • 5.5px)</span>
                  </div>
                  {maxOrderCount > 2 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-orange-600 border border-white shadow-2xs inline-block"></span>
                      <span className="text-[11px] text-zinc-600">
                        Mid Volume ({Math.round(maxOrderCount / 2)} orders)
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-red-900 border-2 border-white shadow-xs inline-block"></span>
                    <span className="text-[11px] font-bold text-red-950">
                      Max Peak ({maxOrderCount} orders • Largest Circle)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Ranked City Ledger & Geographic Breakdown */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-zinc-50/70 border border-zinc-200 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-600" />
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Ranked Client Origin Hubs
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500 font-medium">
                      {filteredCities.length} {filteredCities.length === 1 ? "hub" : "hubs"} · {analytics.totalAttributedOrders} orders
                    </span>
                    <button
                      type="button"
                      disabled={isGeneratingPdf}
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-red-700 bg-white hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
                      title="Download Ranked Hubs & Heat Map as PDF"
                    >
                      <Download className="w-3 h-3 text-red-600" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>

                {/* City Search Filter */}
                <div className="mt-2.5 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search city, state, or rep..."
                    className="w-full bg-white border border-zinc-200 text-xs rounded-xl pl-8 pr-3 py-1.5 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Ranked Cities Grid matching Regional State Aggregation format */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs max-h-[380px] overflow-y-auto pr-1">
                  {filteredCities.length === 0 ? (
                    <div className="col-span-2 py-6 text-center text-xs text-zinc-400">
                      No origin hubs found matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    filteredCities.map((city, idx) => {
                      const isSelected = selectedCity?.name === city.name;
                      const isHovered = hoveredCity?.name === city.name;
                      const isTopHub = city.orderCount >= maxOrderCount;
                      const hubColor = getStateColorInfo(
                        city.orderCount,
                        maxOrderCount
                      );
                      const totalOrders = analytics.totalAttributedOrders || 1;
                      const pctRaw = (city.orderCount / totalOrders) * 100;
                      const pctDisplay =
                        pctRaw % 1 === 0 ? `${pctRaw}%` : `${pctRaw.toFixed(1)}%`;

                      return (
                        <div
                          key={city.canonicalName}
                          onClick={() =>
                            setSelectedCity(
                              selectedCity?.name === city.name ? null : city
                            )
                          }
                          onMouseEnter={() => setHoveredCity(city)}
                          onMouseLeave={() => setHoveredCity(null)}
                          className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                            isSelected
                              ? "ring-2 ring-red-600 shadow-sm"
                              : isHovered
                              ? "brightness-95 shadow-xs"
                              : "hover:brightness-98"
                          }`}
                          style={{
                            backgroundColor: hubColor.fill,
                            borderColor: isSelected ? "#DC2626" : hubColor.stroke,
                          }}
                          title={`${city.name}, ${city.state} · ${city.orderCount} of ${totalOrders} orders (${pctDisplay}) · Revenue: ${formatINR(city.totalDealRevenue)} · Reps: ${city.executives.join(", ")}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="text-[10px] font-mono font-bold text-zinc-500 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="truncate">
                              <span className="font-medium truncate max-w-[80px] sm:max-w-[100px] text-zinc-900 block">
                                {city.name}
                              </span>
                              <span className="text-[9px] text-zinc-500 truncate block">
                                {city.state}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="flex items-center justify-end gap-1">
                              <span
                                className="font-mono font-bold text-xs"
                                style={{
                                  color: isTopHub
                                    ? "#7F1D1D"
                                    : city.orderCount > 1
                                    ? "#9A3412"
                                    : "#C2410C",
                                }}
                              >
                                {city.orderCount} {city.orderCount === 1 ? "order" : "orders"}
                                {isTopHub && " ★"}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded ${
                                  isTopHub
                                    ? "bg-red-800 text-white"
                                    : city.orderCount > 1
                                    ? "bg-orange-200/90 text-orange-950 border border-orange-300"
                                    : "bg-zinc-200/80 text-zinc-700 border border-zinc-300/60"
                                }`}
                              >
                                {pctDisplay}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-zinc-500 mt-0.5">
                              <span>{formatINR(city.totalDealRevenue)}</span>
                              <span>·</span>
                              <span>{city.orderCount}/{totalOrders}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* State Consensus Overview Card */}
              <div className="bg-zinc-50/70 border border-zinc-200 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-zinc-600" />
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Regional State Aggregation
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {Object.keys(analytics.stateMetrics).length} active states
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {Object.values(analytics.stateMetrics)
                    .sort((a, b) => b.orderCount - a.orderCount)
                    .slice(0, 6)
                    .map((sm) => {
                      const stateColor = getStateColorInfo(
                        sm.orderCount,
                        maxStateOrderCount
                      );
                      const isTopState = sm.orderCount >= maxStateOrderCount;
                      const totalOrders = analytics.totalAttributedOrders || 1;
                      const statePctRaw = (sm.orderCount / totalOrders) * 100;
                      const statePctDisplay =
                        statePctRaw % 1 === 0 ? `${statePctRaw}%` : `${statePctRaw.toFixed(1)}%`;

                      return (
                        <div
                          key={sm.name}
                          className="p-2 rounded-xl border flex items-center justify-between transition-colors shadow-2xs"
                          style={{
                            backgroundColor: stateColor.fill,
                            borderColor: stateColor.stroke,
                          }}
                        >
                          <span className="font-medium truncate max-w-[80px] sm:max-w-[95px] text-zinc-900">
                            {sm.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              className="font-mono font-bold text-xs"
                              style={{
                                color: isTopState
                                  ? "#7F1D1D"
                                  : sm.orderCount > 1
                                  ? "#9A3412"
                                  : "#C2410C",
                              }}
                            >
                              {sm.orderCount} {sm.orderCount === 1 ? "order" : "orders"}
                              {isTopState && " ★"}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded ${
                                isTopState
                                  ? "bg-red-800 text-white"
                                  : sm.orderCount > 1
                                  ? "bg-orange-200/90 text-orange-950 border border-orange-300"
                                  : "bg-zinc-200/80 text-zinc-700 border border-zinc-300/60"
                              }`}
                            >
                              {statePctDisplay}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
