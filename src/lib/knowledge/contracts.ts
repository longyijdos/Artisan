export interface KnowledgeSourceContract {
  id: number;
  name: string;
  source_type: string;
  chunk_count: number;
  created_at: string;
}

export interface KnowledgeListResponseContract {
  sources?: KnowledgeSourceContract[];
  detail?: string;
}

export interface KnowledgeIndexRequestBody {
  path: string;
  is_dir: boolean;
  thread_id: string;
  force?: boolean;
}

export interface KnowledgeIndexResultItem {
  source_id: number;
  name: string;
  source_type: string;
  chunk_count: number;
}

export interface KnowledgeIndexResponseContract {
  success?: boolean;
  message?: string;
  results?: KnowledgeIndexResultItem[];
  detail?: string;
}

export interface KnowledgeDeleteResponseContract {
  success?: boolean;
  message?: string;
  detail?: string;
}

export interface KnowledgeCheckResponseContract {
  exists?: boolean;
  source_ids?: number[];
  name?: string;
  detail?: string;
}
