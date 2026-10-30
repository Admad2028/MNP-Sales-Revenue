import { SheetRecord, CalculationSummary, SalespersonMetric, MovementDistribution } from "../types";
import { DEFAULT_SALESPEOPLE, getSalespeopleForDateRange } from "./sheetParser";

export interface FilterOptions {
  salesperson: string;
  startDate: string;
  endDate: string;
  numberOfCalls: number;
  teamCalls?: Record<string, number>;
}

/**
 * Parses movement type string to count Intracity and Intercity deals.
 * Rules:
 * - "local 1" -> 1 intracity deal
 * - "local 2" -> 2 intracity deals
 * - "local 3" -> 3 intracity deals
 * - "intercity 1" -> 1 intercity deal
 * - "intercity 2" -> 2 intercity deals
 * - "intercity 3" -> 3 intercity deals
 * - Compound strings: e.g. "local 2, intercity 1" -> 2 intracity deals and 1 intercity deal
 */
export function parseMovementType(movementStr: string): { intracity: number; intercity: number } {
  let intracity = 0;
  let intercity = 0;
  if (!movementStr) return { intracity, intercity };

  const clean = movementStr.replace(/["\\]/g, " ").toLowerCase();

  // Match local / intracity patterns
  const localRegex = /\b(?:local|intracity)\s*(\d+)?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = localRegex.exec(clean)) !== null) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    intracity += isNaN(count) || count <= 0 ? 1 : count;
  }

  // Match intercity patterns
  const interRegex = /\bintercity\s*(\d+)?\b/gi;
  while ((match = interRegex.exec(clean)) !== null) {
    const count = match[1] ? parseInt(match[1], 10) : 1;
    intercity += isNaN(count) || count <= 0 ? 1 : count;
  }

  return { intracity, intercity };
}

/**
 * Filter sheet records based on date range and salesperson
 */
export function filterRecords(
  records: SheetRecord[],
  salesperson: string,
  startDate: string,
  endDate: string
): SheetRecord[] {
  return records.filter((record) => {
    // Check salesperson
    if (salesperson !== "All" && record.executive.toLowerCase() !== salesperson.toLowerCase()) {
      return false;
    }

    // Check date bounds
    if (startDate && record.date < startDate) {
      return false;
    }
    if (endDate && record.date > endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Compute the complete calculation summary for the selected salesperson, date range, and call count
 */
export function calculateMetrics(
  records: SheetRecord[],
  options: FilterOptions
): CalculationSummary {
  const matchingRecords = filterRecords(
    records,
    options.salesperson,
    options.startDate,
    options.endDate
  );

  let dealsClosed = 0;
  let dealAmount = 0;
  let aaCommission = 0;
  let sheetDialledCalls = 0;
  let sheetLeadsAllocated = 0;
  let sheetGenuineCalls = 0;
  let intracityDeals = 0;
  let intercityDeals = 0;

  const movementBreakdown: { [type: string]: { deals: number; amount: number; commission: number } } = {};

  matchingRecords.forEach((r) => {
    dealsClosed += r.dealsClosed;
    dealAmount += r.dealAmount;
    aaCommission += r.aaCommission;
    sheetDialledCalls += r.dialledCalls || 0;
    sheetLeadsAllocated += r.leadsAllocated;
    sheetGenuineCalls += r.genuineCalls;

    if (r.movementType) {
      const parsed = parseMovementType(r.movementType);
      intracityDeals += parsed.intracity;
      intercityDeals += parsed.intercity;

      const type = r.movementType.trim();
      if (!movementBreakdown[type]) {
        movementBreakdown[type] = { deals: 0, amount: 0, commission: 0 };
      }
      movementBreakdown[type].deals += r.dealsClosed;
      movementBreakdown[type].amount += r.dealAmount;
      movementBreakdown[type].commission += r.aaCommission;
    }
  });

  const totalMovementDeals = intracityDeals + intercityDeals;
  const intracityPercentage = totalMovementDeals > 0 ? (intracityDeals / totalMovementDeals) * 100 : 0;
  const intercityPercentage = totalMovementDeals > 0 ? (intercityDeals / totalMovementDeals) * 100 : 0;

  const movementDistribution: MovementDistribution = {
    intracityDeals,
    intercityDeals,
    totalMovementDeals,
    intracityPercentage,
    intercityPercentage,
  };

  const calls = Math.max(0, options.numberOfCalls);
  const revenuePerCall = calls > 0 ? dealAmount / calls : 0;
  const aaCommissionPerCall = calls > 0 ? aaCommission / calls : 0;
  const averageDealAmount = dealsClosed > 0 ? dealAmount / dealsClosed : 0;
  const commissionPercentage = dealAmount > 0 ? (aaCommission / dealAmount) * 100 : 0;
  const conversionRate = calls > 0 ? (dealsClosed / calls) * 100 : 0;
  const callsPerDeal = dealsClosed > 0 ? calls / dealsClosed : 0;

  const individualMetrics = calculateAllSalespeopleMetrics(
    records,
    options.startDate,
    options.endDate,
    options.teamCalls || {}
  );

  return {
    salesperson: options.salesperson,
    startDate: options.startDate,
    endDate: options.endDate,
    numberOfCalls: calls,
    dealsClosed,
    dealAmount,
    aaCommission,
    averageDealAmount,
    commissionPercentage,
    revenuePerCall,
    aaCommissionPerCall,
    conversionRate,
    callsPerDeal,
    sheetDialledCalls,
    sheetLeadsAllocated,
    sheetGenuineCalls,
    matchingRecordsCount: matchingRecords.length,
    movementBreakdown,
    movementDistribution,
    teamCalls: options.teamCalls,
    individualMetrics,
  };
}

/**
 * Calculates comparative metrics for all salespeople in the given date range
 */
export function calculateAllSalespeopleMetrics(
  records: SheetRecord[],
  startDate: string,
  endDate: string,
  callsMap: Record<string, number> = {}
): SalespersonMetric[] {
  const people = [...getSalespeopleForDateRange(startDate, endDate, records), "Storage Team"];

  return people.map((name) => {
    const personRecords = filterRecords(records, name, startDate, endDate);

    let totalDeals = 0;
    let totalDealAmount = 0;
    let totalAaCommission = 0;
    let totalDialledCalls = 0;
    let totalLeadsAllocated = 0;
    let totalGenuineCalls = 0;
    let totalSpamEtc = 0;
    let totalProspects = 0;

    personRecords.forEach((r) => {
      totalDeals += r.dealsClosed;
      totalDealAmount += r.dealAmount;
      totalAaCommission += r.aaCommission;
      totalDialledCalls += r.dialledCalls || 0;
      totalLeadsAllocated += r.leadsAllocated;
      totalGenuineCalls += r.genuineCalls;
      totalSpamEtc += r.spamEtc;
      totalProspects += r.prospects;
    });

    const enteredCalls =
      callsMap[name] !== undefined
        ? Math.max(0, callsMap[name])
        : totalDialledCalls > 0
        ? totalDialledCalls
        : 0;
    const revenuePerCall = enteredCalls > 0 ? totalDealAmount / enteredCalls : 0;
    const commissionPerCall = enteredCalls > 0 ? totalAaCommission / enteredCalls : 0;
    const averageDealSize = totalDeals > 0 ? totalDealAmount / totalDeals : 0;
    const averageCommissionRate = totalDealAmount > 0 ? (totalAaCommission / totalDealAmount) * 100 : 0;
    const conversionRate = enteredCalls > 0 ? (totalDeals / enteredCalls) * 100 : 0;
    const callsPerDeal = totalDeals > 0 ? enteredCalls / totalDeals : 0;

    return {
      name,
      avatarColor: name,
      totalDeals,
      totalDealAmount,
      totalAaCommission,
      totalDialledCalls,
      totalLeadsAllocated,
      totalGenuineCalls,
      totalSpamEtc,
      totalProspects,
      activeDaysCount: personRecords.length,
      averageDealSize,
      averageCommissionRate,
      enteredCalls,
      revenuePerCall,
      commissionPerCall,
      conversionRate,
      callsPerDeal,
    };
  });
}

/**
 * Calculates the exact dialled calls from the sheet for each active salesperson within a specific date range.
 * Returns a callsMap { [salesperson]: count }, whether any dialled calls exist, and the total dialled calls.
 */
export function calculateSheetCallsForDateRange(
  records: SheetRecord[],
  startDate: string,
  endDate: string
): { callsMap: Record<string, number>; hasDialledCalls: boolean; totalDialledCalls: number } {
  const activeTeam = [...getSalespeopleForDateRange(startDate, endDate, records), "Storage Team"];
  const callsMap: Record<string, number> = {};
  activeTeam.forEach((p) => {
    callsMap[p] = 0;
  });

  let hasDialledCalls = false;
  records.forEach((r) => {
    if (startDate && r.date < startDate) return;
    if (endDate && r.date > endDate) return;

    if (r.dialledCalls !== undefined && r.dialledCalls > 0) {
      if (callsMap[r.executive] !== undefined) {
        callsMap[r.executive] += r.dialledCalls;
      } else {
        callsMap[r.executive] = r.dialledCalls;
      }
      hasDialledCalls = true;
    }
  });

  const totalDialledCalls = Object.values(callsMap).reduce((sum, v) => sum + (v || 0), 0);
  return { callsMap, hasDialledCalls, totalDialledCalls };
}

/**
 * Get the min and max dates available across all records
 */
export function getDateBounds(records: SheetRecord[]): { minDate: string; maxDate: string } {
  if (!records.length) return { minDate: "2026-08-01", maxDate: "2026-08-19" };
  const dates = records.map((r) => r.date).filter(Boolean).sort();
  return {
    minDate: dates[0] || "2026-08-01",
    maxDate: dates[dates.length - 1] || "2026-08-19",
  };
}
