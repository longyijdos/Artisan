import { createPortal } from "react-dom";
import type { ContextMenuState, TreeNode } from "./types";
import { NewFolderIcon, DownloadIcon, EditIcon, TrashIcon, RefreshIcon } from "./icons";

// Database icon for knowledge indexing
function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  onStartNewFolder: (parentPath: string) => void;
  onDownload: (node: TreeNode) => void;
  onStartRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onRefresh: () => void;
  onClose: () => void;
  onIndexKnowledge?: (node: TreeNode | null) => void;
}

export function ContextMenu({
  contextMenu,
  onStartNewFolder,
  onDownload,
  onStartRename,
  onDelete,
  onRefresh,
  onClose,
  onIndexKnowledge,
}: ContextMenuProps) {
  if (!contextMenu.visible) return null;

  const menu = (
    <div
      className="fixed bg-white/95 backdrop-blur-sm rounded-xl shadow-[0_10px_30px_-12px_rgba(79,70,229,0.3)] border border-indigo-100/60 py-1.5 z-[9999] min-w-[140px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* New folder - for root (node is null) or folders */}
      {(!contextMenu.node || contextMenu.node.isDir) && (
        <button
          className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-indigo-50/60 hover:text-indigo-600 flex items-center gap-2 transition-colors"
          onClick={() => onStartNewFolder(contextMenu.node?.path || "")}
        >
          <NewFolderIcon className="w-4 h-4 text-slate-400" />
          新建文件夹
        </button>
      )}

      {/* Following items only for actual nodes */}
      {contextMenu.node && (
        <>
          {/* Download - only for files */}
          {!contextMenu.node.isDir && (
            <button
              className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-indigo-50/60 hover:text-indigo-600 flex items-center gap-2 transition-colors"
              onClick={() => onDownload(contextMenu.node!)}
            >
              <DownloadIcon className="w-4 h-4 text-slate-400" />
              下载
            </button>
          )}
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-indigo-50/60 hover:text-indigo-600 flex items-center gap-2 transition-colors"
            onClick={() => onStartRename(contextMenu.node!)}
          >
            <EditIcon className="w-4 h-4 text-slate-400" />
            重命名
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50/60 flex items-center gap-2 transition-colors"
            onClick={() => onDelete(contextMenu.node!)}
          >
            <TrashIcon className="w-4 h-4" />
            删除
          </button>

          {/* Divider before knowledge indexing */}
          {onIndexKnowledge && (
            <>
              <div className="border-t border-indigo-100/40 my-1" />
              <button
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-amber-50/60 hover:text-amber-600 flex items-center gap-2 transition-colors"
                onClick={() => onIndexKnowledge(contextMenu.node)}
              >
                <DatabaseIcon className="w-4 h-4 text-slate-400" />
                生成知识库
              </button>
            </>
          )}
        </>
      )}

      {/* Divider before refresh */}
      <div className="border-t border-indigo-100/40 my-1" />

      {/* Refresh - always available */}
      <button
        className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-indigo-50/60 hover:text-indigo-600 flex items-center gap-2 transition-colors"
        onClick={() => {
          onClose();
          onRefresh();
        }}
      >
        <RefreshIcon className="w-4 h-4 text-slate-400" />
        刷新
      </button>
    </div>
  );

  return createPortal(menu, document.body);
}
