import type { WorkspaceFileItemContract } from "@/lib/workspace/contracts";

export type FileItem = WorkspaceFileItemContract;

export interface FileTreeProps {
  apiBaseUrl?: string;
  onFileSelect?: (path: string | null) => void;
  selectedPath?: string | null;
  className?: string;
  threadId?: string | null;
  /** When false the component pauses polling to save resources. */
  visible?: boolean;
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  // Animation states
  isNew?: boolean;      // Just added - fade in
  isRemoving?: boolean; // Being removed - fade out
}

export interface UploadStatus {
  fileName: string;
  status: "pending" | "uploading" | "success" | "error";
  targetPath: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
}
