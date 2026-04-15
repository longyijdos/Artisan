import type { TreeNode, FileItem } from "./types";

// Deep compare for tree nodes to avoid unnecessary re-renders
export function areTreesEqual(a: TreeNode[], b: TreeNode[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].size !== b[i].size) return false;
  }
  return true;
}

// Convert FileItem array to TreeNode array
export function toTreeNodes(files: FileItem[], parentPath: string): TreeNode[] {
  return files
    .filter((f) => f.name !== "." && f.name !== "..")
    .map((file) => ({
      name: file.name,
      path: parentPath ? `${parentPath}/${file.name}` : file.name,
      isDir: file.is_dir,
      size: file.size,
      children: file.is_dir ? [] : undefined,
      isExpanded: false,
      isLoading: false,
    }))
    .sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
}

// Collect all expanded folder paths from current tree
export function getExpandedPaths(nodes: TreeNode[]): Set<string> {
  const paths = new Set<string>();
  const traverse = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.isDir && node.isExpanded) {
        paths.add(node.path);
        if (node.children) {
          traverse(node.children);
        }
      }
    }
  };
  traverse(nodes);
  return paths;
}

// Format file size for display
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Find a node by path in the tree
export function findNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

// Expand folder by path in tree
export function expandFolderByPath(nodes: TreeNode[], targetPath: string): TreeNode[] {
  return nodes.map(node => {
    if (node.path === targetPath && node.isDir) {
      return { ...node, isExpanded: true };
    } else if (targetPath.startsWith(node.path + "/") && node.isDir) {
      return {
        ...node,
        isExpanded: true,
        children: node.children ? expandFolderByPath(node.children, targetPath) : node.children
      };
    }
    return node;
  });
}
