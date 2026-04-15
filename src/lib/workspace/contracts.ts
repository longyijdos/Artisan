export interface WorkspaceFileItemContract {
  name: string;
  is_dir: boolean;
  size: number;
}

export type WorkspaceFilesResponseContract = WorkspaceFileItemContract[];

export interface WorkspaceStatusResponseContract {
  path: string;
  initialized: boolean;
  file_count: number;
}

export interface WorkspaceReadResponseContract {
  content?: string;
  path?: string;
  detail?: string;
}

export interface WorkspaceUploadResponseContract {
  message?: string;
  filename?: string;
  path?: string;
  detail?: string;
}

export interface WorkspaceDeleteResponseContract {
  message?: string;
  path?: string;
  detail?: string;
}

export interface WorkspaceRenameResponseContract {
  message?: string;
  old_path?: string;
  new_path?: string;
  detail?: string;
}

export interface WorkspaceMkdirResponseContract {
  message?: string;
  path?: string;
  detail?: string;
}

export interface WorkspaceErrorResponseContract {
  detail?: string;
}
