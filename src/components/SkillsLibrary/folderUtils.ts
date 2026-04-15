/** A file with its relative path preserved (for folder uploads). */
export interface FileWithPath {
  file: File;
  /** e.g. "sub/helper.py" or just "SKILL.md" */
  relativePath: string;
}

/** Collected upload result: files + the original folder name (if any). */
export interface CollectedFiles {
  items: FileWithPath[];
  folderName: string;
}

// ---------------------------------------------------------------------------
// File System Access API helpers
// ---------------------------------------------------------------------------

function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function traverseEntry(
  entry: FileSystemEntry,
  basePath: string,
): Promise<FileWithPath[]> {
  if (entry.isFile) {
    const file = await readEntryAsFile(entry as FileSystemFileEntry);
    return [{ file, relativePath: basePath ? `${basePath}/${entry.name}` : entry.name }];
  }
  if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const results: FileWithPath[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await readDirectoryEntries(dirReader);
      for (const child of batch) {
        const childPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        results.push(...(await traverseEntry(child, childPath)));
      }
    } while (batch.length > 0);
    return results;
  }
  return [];
}

/** Strip shared top-level folder prefix, e.g. "mySkill/SKILL.md" → "SKILL.md" */
function stripTopLevelDir(items: FileWithPath[]): FileWithPath[] {
  if (items.length === 0) return items;
  const topDirs = new Set(
    items.map((f) => f.relativePath.split("/")[0]).filter(Boolean),
  );
  if (topDirs.size === 1) {
    const prefix = [...topDirs][0] + "/";
    return items.map((f) => ({
      ...f,
      relativePath: f.relativePath.startsWith(prefix)
        ? f.relativePath.slice(prefix.length)
        : f.relativePath,
    }));
  }
  return items;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Recursively collect all files from a DataTransfer (drag-and-drop). */
export async function getFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<FileWithPath[]> {
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < dataTransfer.items.length; i++) {
    const entry = dataTransfer.items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  const all: FileWithPath[] = [];
  for (const entry of entries) {
    all.push(...(await traverseEntry(entry, "")));
  }
  return stripTopLevelDir(all);
}

/** Check whether a list of files contains a SKILL.md at any level. */
export function hasSkillMd(items: FileWithPath[]): boolean {
  return items.some(
    (f) =>
      f.relativePath.toUpperCase() === "SKILL.MD" ||
      f.relativePath.toUpperCase().endsWith("/SKILL.MD"),
  );
}
