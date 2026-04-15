export interface SessionContract {
  id: string;
  title: string;
  lastUpdateTime: number | null;
  createdAt?: number | null;
}

export interface SessionsListResponseContract {
  sessions?: SessionContract[];
  detail?: string;
}

export interface SessionCreateResponseContract {
  id?: string;
  title?: string;
  lastUpdateTime?: number | null;
  detail?: string;
}

export interface SessionDeleteResponseContract {
  success?: boolean;
  id?: string;
  detail?: string;
}

export interface SessionUpdateTitleResponseContract {
  success?: boolean;
  id?: string;
  title?: string;
  detail?: string;
}

export interface SessionAutonameRequestBody {
  message: string;
}

export interface SessionAutonameResponseContract {
  title?: string | null;
  detail?: string;
}

export interface SessionPoolStatsConfigContract {
  min_pool_size: number;
  auto_stop_minutes: number;
  auto_archive_minutes: number;
}

export interface SessionPoolStatsContract {
  creating: number;
  available: number;
  assigned: number;
  error: number;
  total: number;
  config: SessionPoolStatsConfigContract;
}

export interface SessionPoolStatsResponseContract {
  stats?: SessionPoolStatsContract;
  detail?: string;
}
