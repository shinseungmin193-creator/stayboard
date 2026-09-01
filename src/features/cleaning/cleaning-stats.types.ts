export const CLEANING_STATS_UNSPECIFIED_VALUE = "__UNSPECIFIED__";

export interface CleaningStatsFilters {
  from: string | null;
  to: string | null;
  companyId: string | null;
  propertyId: string | null;
  cleanerName: string | null;
  detailCleanerName: string | null;
  detailDate: string | null;
  page: number;
}

export interface CleaningStatsGroup {
  cleanerName: string | null;
  count: number;
}

export interface CleaningStatsDailyGroup extends CleaningStatsGroup {
  date: string;
}

export interface CleaningStatsDetailItem {
  id: string;
  completedAt: string;
  companyName: string;
  propertyName: string;
  roomName: string;
  cleanerName: string | null;
  completedByName: string | null;
  photoCount: number;
  note: string | null;
}

export interface CleaningStatsPageData {
  range: { from: string; to: string };
  timeZone: string;
  totalCount: number;
  dailyGroups: CleaningStatsDailyGroup[];
  workerTotals: CleaningStatsGroup[];
  workerOptions: Array<{ value: string; name: string | null }>;
  details: CleaningStatsDetailItem[];
  detailTotalCount: number;
  detailTotalPages: number;
  detailPage: number;
  companies: Array<{ id: string; name: string }>;
  properties: Array<{ id: string; name: string; companyId: string }>;
}
