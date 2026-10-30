import { SheetRecord } from "../types";
import { KNOWN_INDIAN_CITIES, projectCoordinates, CityCoordinate } from "../data/indiaMapData";

export type MonthFilter = "september" | "october" | "both";

export interface CityOrderRef {
  recordId: string;
  date: string;
  rawDate: string;
  executive: string;
  dealAmount: number;
  aaCommission: number;
  dealsClosed: number;
  movementType: string;
  rawOrigin: string;
}

export interface CityAggregatedMetric {
  name: string;
  canonicalName: string;
  state: string;
  lat: number;
  lng: number;
  svgX: number;
  svgY: number;
  orderCount: number;
  totalDealRevenue: number;
  totalCommission: number;
  isRepeat: boolean;
  heatLevel: "repeat" | "single" | "none";
  executives: string[];
  orders: CityOrderRef[];
}

export interface StateAggregatedMetric {
  name: string;
  orderCount: number;
  totalRevenue: number;
  cities: string[];
  isRepeat: boolean;
}

export interface OriginAnalyticsSummary {
  monthFilter: MonthFilter;
  salespersonFilter: string;
  totalDealsClosed: number;
  totalAttributedOrders: number;
  unattributedDeals: number;
  totalRevenue: number;
  uniqueCitiesCount: number;
  repeatCitiesCount: number;
  singleCitiesCount: number;
  topCity: CityAggregatedMetric | null;
  cities: CityAggregatedMetric[];
  stateMetrics: Record<string, StateAggregatedMetric>;
}

/**
 * Normalizes an origin city string into a known city coordinate.
 */
export function normalizeCityName(raw: string): CityCoordinate | null {
  if (!raw) return null;
  let clean = raw.trim().replace(/,\s*Rajasthan/i, "");
  const lower = clean.toLowerCase();
  
  // Exclude placeholder and invalid values
  if (
    !clean ||
    lower === "0" ||
    lower === "-" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "null" ||
    lower === "nil" ||
    lower === "undefined"
  ) {
    return null;
  }

  // Exact dictionary match
  if (KNOWN_INDIAN_CITIES[lower]) {
    return KNOWN_INDIAN_CITIES[lower];
  }

  // Common aliases and substrings
  if (lower.includes("baran")) return KNOWN_INDIAN_CITIES["baran"];
  if (lower.includes("bangal") || lower.includes("bangl") || lower.includes("benglur")) {
    return KNOWN_INDIAN_CITIES["bengaluru"];
  }
  if (lower.includes("lackn") || lower.includes("luckn")) {
    return KNOWN_INDIAN_CITIES["lucknow"];
  }
  if (lower.includes("pitump") || lower.includes("pithamp")) {
    return KNOWN_INDIAN_CITIES["pithampur"];
  }
  if (lower.includes("greater noida")) {
    return KNOWN_INDIAN_CITIES["greater noida"];
  }
  if (lower.includes("burhan")) return KNOWN_INDIAN_CITIES["burhanpur"];
  if (lower.includes("bikan")) return KNOWN_INDIAN_CITIES["bikaner"];
  if (lower.includes("gwal")) return KNOWN_INDIAN_CITIES["gwalior"];
  if (lower.includes("indo")) return KNOWN_INDIAN_CITIES["indore"];
  if (lower.includes("pune")) return KNOWN_INDIAN_CITIES["pune"];
  if (lower.includes("mumb") || lower.includes("bomb")) return KNOWN_INDIAN_CITIES["mumbai"];
  if (lower.includes("delh")) return KNOWN_INDIAN_CITIES["delhi"];
  if (lower.includes("chenn") || lower.includes("madr")) return KNOWN_INDIAN_CITIES["chennai"];
  if (lower.includes("kolk") || lower.includes("calc")) return KNOWN_INDIAN_CITIES["kolkata"];
  if (lower.includes("hyde")) return KNOWN_INDIAN_CITIES["hyderabad"];

  // Search through all known keys
  for (const key of Object.keys(KNOWN_INDIAN_CITIES)) {
    if (lower.includes(key) || key.includes(lower)) {
      return KNOWN_INDIAN_CITIES[key];
    }
  }

  // Capitalized fallback with projected centroid
  const formattedName = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    name: formattedName,
    canonicalName: formattedName,
    state: "India",
    lat: 21.0,
    lng: 78.0,
  };
}

/**
 * Parses raw Column K origin string, handling multi-city comma/slash separated entries.
 * Returns individual CityCoordinate items (e.g. 'Pune, Lucknow' -> [Pune, Lucknow]).
 */
export function parseOriginCities(rawOrigin?: string): CityCoordinate[] {
  if (!rawOrigin) return [];
  // Strip state suffix if present like 'Baran, Rajasthan'
  const cleaned = rawOrigin.replace(/,\s*Rajasthan/i, "");
  // Split on commas, slashes, ampersands
  const parts = cleaned.split(/[,/&+]/);
  const cities: CityCoordinate[] = [];

  for (const part of parts) {
    const matched = normalizeCityName(part);
    if (matched) {
      cities.push(matched);
    }
  }

  return cities;
}

/**
 * Aggregates client origin data across records according to the selected month and salesperson.
 */
/**
 * Allocates deals from Column I ("Deals Closed") to origin cities listed in Column K ("Origin City").
 * Business Rules:
 * - If only 1 city is mentioned: all deals belong to that city (e.g. 2 deals closed, "Pune" -> 2 Pune).
 * - If 2 deals closed and 2 cities mentioned: 1 deal per city (e.g. [Pune, Lucknow] -> 1 Pune, 1 Lucknow).
 * - If 3 deals closed:
 *   - 3 cities: 1 deal each.
 *   - 2 cities: 2 deals to the first city, 1 deal to the second city (e.g. [Mumbai, Pune] -> 2 Mumbai, 1 Pune).
 *   - 1 city: all 3 deals to that city.
 * - Generalization: Base deals = Math.floor(N / K), Remainder = N % K.
 *   First remainder cities get (base + 1) deals, remaining get base deals.
 */
export interface CityDealAllocation {
  city: CityCoordinate;
  deals: number;
  dealRevenue: number;
  commission: number;
}

export function allocateDealsToCities(
  dealsClosed: number,
  cities: CityCoordinate[],
  totalDealAmount: number = 0,
  totalCommission: number = 0
): CityDealAllocation[] {
  const K = cities.length;
  if (K === 0) return [];

  // Effective number of deals from Column I
  const N = dealsClosed > 0 ? dealsClosed : K;

  let assignedCounts: number[] = [];

  if (K === 1) {
    // If only 1 city is mentioned, all N deals belong to that single city
    assignedCounts = [N];
  } else if (K >= N) {
    // If cities mentioned >= deals closed, each city gets equal share (N / K)
    const perCity = N / K;
    assignedCounts = new Array(K).fill(perCity);
  } else {
    // K < N: distribute base + 1 to the first (N % K) cities, base to the rest
    // e.g. N = 3, cities = [Mumbai, Pune]: base = 1, extra = 1 -> Mumbai gets 2, Pune gets 1
    const base = Math.floor(N / K);
    const extra = N % K;
    assignedCounts = cities.map((_, idx) => base + (idx < extra ? 1 : 0));
  }

  return cities.map((city, idx) => {
    const deals = assignedCounts[idx];
    const fraction = N > 0 ? deals / N : 1 / K;
    return {
      city,
      deals,
      dealRevenue: totalDealAmount * fraction,
      commission: totalCommission * fraction,
    };
  });
}

export function aggregateCityOrigins(
  records: SheetRecord[],
  monthFilter: MonthFilter = "both",
  salespersonFilter: string = "All"
): OriginAnalyticsSummary {
  const cityMap = new Map<string, CityAggregatedMetric>();
  const stateMap: Record<string, StateAggregatedMetric> = {};
  let totalAttributedOrders = 0;
  let totalDealsClosed = 0;
  let unattributedDeals = 0;
  let totalRevenue = 0;

  for (const record of records) {
    // 1. Month Filter check
    const isSep = record.date.startsWith("2026-09") || record.rawDate.includes("/09/2026") || record.rawDate.includes("-09-2026");
    const isOct = record.date.startsWith("2026-10") || record.rawDate.includes("/10/2026") || record.rawDate.includes("-10-2026");

    if (monthFilter === "september" && !isSep) continue;
    if (monthFilter === "october" && !isOct) continue;
    if (monthFilter === "both" && !isSep && !isOct) continue;

    // 2. Salesperson Filter check
    if (salespersonFilter !== "All" && record.executive.toLowerCase() !== salespersonFilter.toLowerCase()) {
      continue;
    }

    const rowDealsClosed = record.dealsClosed || 0;
    totalDealsClosed += rowDealsClosed;

    // 3. Parse origin cities in Column K
    const citiesInRow = parseOriginCities(record.originCity);
    if (citiesInRow.length === 0) {
      if (rowDealsClosed > 0) {
        unattributedDeals += rowDealsClosed;
      }
      continue;
    }

    // Allocate deals from Column I according to business rules
    const allocations = allocateDealsToCities(
      rowDealsClosed,
      citiesInRow,
      record.dealAmount || 0,
      record.aaCommission || 0
    );

    for (const alloc of allocations) {
      const cityCoord = alloc.city;
      totalAttributedOrders += alloc.deals;
      totalRevenue += alloc.dealRevenue;

      let cityMetric = cityMap.get(cityCoord.canonicalName);
      if (!cityMetric) {
        const proj = projectCoordinates(cityCoord.lng, cityCoord.lat);
        cityMetric = {
          name: cityCoord.name,
          canonicalName: cityCoord.canonicalName,
          state: cityCoord.state,
          lat: cityCoord.lat,
          lng: cityCoord.lng,
          svgX: proj.x,
          svgY: proj.y,
          orderCount: 0,
          totalDealRevenue: 0,
          totalCommission: 0,
          isRepeat: false,
          heatLevel: "none",
          executives: [],
          orders: [],
        };
        cityMap.set(cityCoord.canonicalName, cityMetric);
      }

      cityMetric.orderCount += alloc.deals;
      cityMetric.totalDealRevenue += alloc.dealRevenue;
      cityMetric.totalCommission += alloc.commission;

      if (!cityMetric.executives.includes(record.executive)) {
        cityMetric.executives.push(record.executive);
      }

      cityMetric.orders.push({
        recordId: record.id,
        date: record.date,
        rawDate: record.rawDate,
        executive: record.executive,
        dealAmount: alloc.dealRevenue,
        aaCommission: alloc.commission,
        dealsClosed: alloc.deals,
        movementType: record.movementType,
        rawOrigin: record.originCity || "",
      });

      // Update state-level metric
      const stateName = cityCoord.state;
      if (stateName && stateName !== "India") {
        if (!stateMap[stateName]) {
          stateMap[stateName] = {
            name: stateName,
            orderCount: 0,
            totalRevenue: 0,
            cities: [],
            isRepeat: false,
          };
        }
        stateMap[stateName].orderCount += alloc.deals;
        stateMap[stateName].totalRevenue += alloc.dealRevenue;
        if (!stateMap[stateName].cities.includes(cityCoord.canonicalName)) {
          stateMap[stateName].cities.push(cityCoord.canonicalName);
        }
        stateMap[stateName].isRepeat = stateMap[stateName].orderCount > 1;
      }
    }
  }

  // Finalize repeat flags and heat levels
  const cityList = Array.from(cityMap.values());
  let repeatCitiesCount = 0;
  let singleCitiesCount = 0;

  for (const c of cityList) {
    if (c.orderCount > 1) {
      c.isRepeat = true;
      c.heatLevel = "repeat";
      repeatCitiesCount += 1;
    } else if (c.orderCount === 1) {
      c.isRepeat = false;
      c.heatLevel = "single";
      singleCitiesCount += 1;
    } else {
      c.heatLevel = "none";
    }
  }

  // Sort cities descending by orderCount, then by revenue
  cityList.sort((a, b) => {
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }
    return b.totalDealRevenue - a.totalDealRevenue;
  });

  const topCity = cityList.length > 0 ? cityList[0] : null;

  return {
    monthFilter,
    salespersonFilter,
    totalDealsClosed,
    totalAttributedOrders,
    unattributedDeals,
    totalRevenue,
    uniqueCitiesCount: cityList.length,
    repeatCitiesCount,
    singleCitiesCount,
    topCity,
    cities: cityList,
    stateMetrics: stateMap,
  };
}
