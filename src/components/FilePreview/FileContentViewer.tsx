import { memo } from "react";
import { SlideViewer, CodeViewer, MarkdownViewer, WebViewer } from "@/components/Artifact";
import { FileType, getLanguageFromPath } from "./utils";

export const FileContentViewer = memo(function FileContentViewer({
  content,
  filePath,
  fileType,
  filename,
  isDark,
  viewMode,
}: {
  content: string;
  filePath: string;
  fileType: FileType;
  filename: string;
  isDark: boolean;
  viewMode: "preview" | "code";
}) {
  const language = getLanguageFromPath(filePath);

  switch (fileType) {
    case "html":
      return <WebViewer html={content} className="h-full" viewMode={viewMode} isDark={isDark} />;
    case "markdown":
      return <MarkdownViewer content={content} className="h-full" isDark={isDark} viewMode={viewMode} />;
    case "slide":
      return <SlideViewer content={content} />;
    case "code":
    default:
      return <CodeViewer code={content} language={language} filename={filename} className="h-full" isDark={isDark} />;
  }
});
