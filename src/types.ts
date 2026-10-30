export interface SheetRecord {
  id: string;
  date: string; // ISO format YYYY-MM-DD
  rawDate: string; // Original format e.g. "01/08/2026" or "01/09/2026"
  executive: string;
  dialledCalls?: number; // Col C in Sept+: "No of Dialled Calls" (or Leads Allocated in earlier sheets)
  connectedCalls?: number; // Col D in Sept+: "No of Connected Calls"
  leadsAllocated: number; // Retained for backwards compatibility
  spamEtc: number;
  genuineCalls: number;
  pendingLeads: number;
  prospects: number;
  dealsClosed: number;
  movementType: string;
  originCity?: string; // Col K in Sept+
  dealAmount: number;
  aaCommission: number;
  aaCommissionPercentage: string;
  remarks: string;
}

export interface SalespersonMetric {
  name: string;
  avatarColor: string;
  totalDeals: number;
  totalDealAmount: number;
  totalAaCommission: number;
  totalDialledCalls: number;
  totalLeadsAllocated: number;
  totalGenuineCalls: number;
  totalSpamEtc: number;
  totalProspects: number;
  activeDaysCount: number;
  averageDealSize: number;
  averageCommissionRate: number;
  enteredCalls: number;
  revenuePerCall: number;
  commissionPerCall: number;
  conversionRate: number;
  callsPerDeal: number;
}

export interface MovementDistribution {
  intracityDeals: number;
  intercityDeals: number;
  totalMovementDeals: number;
  intracityPercentage: number;
  intercityPercentage: number;
}

export interface CalculationSummary {
  salesperson: string;
  startDate: string;
  endDate: string;
  numberOfCalls: number;
  dealsClosed: number;
  dealAmount: number;
  aaCommission: number;
  averageDealAmount: number;
  commissionPercentage: number;
  revenuePerCall: number;
  aaCommissionPerCall: number;
  conversionRate: number; // deals / calls * 100
  callsPerDeal: number; // calls / deals
  sheetDialledCalls: number;
  sheetLeadsAllocated: number;
  sheetGenuineCalls: number;
  matchingRecordsCount: number;
  movementBreakdown?: { [type: string]: { deals: number; amount: number; commission: number } };
  movementDistribution: MovementDistribution;
  teamCalls?: Record<string, number>;
  individualMetrics?: SalespersonMetric[];
}

export interface SheetSyncStatus {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  totalRows: number;
  sourceUrl: string;
  dateRangeInData: { start: string; end: string };
}

export interface AnomalyRecord {
  id: string;
  serialNo: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string; // ISO format YYYY-MM-DD
  rawStartDate: string;
  rawEndDate: string;
  anomaly: string;
  remarks: string;
  affected: string;
}

