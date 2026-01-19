import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Equal } from "lucide-react";

interface PromptDiffViewerProps {
  originalPrompt: string | null;
  currentPrompt: string | null;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

export function PromptDiffViewer({ originalPrompt, currentPrompt }: PromptDiffViewerProps) {
  const diffLines = useMemo(() => {
    if (!originalPrompt && !currentPrompt) return [];
    
    const originalLines = (originalPrompt || "").split("\n");
    const currentLines = (currentPrompt || "").split("\n");
    
    const result: DiffLine[] = [];
    const maxLength = Math.max(originalLines.length, currentLines.length);
    
    // Simple line-by-line diff
    let originalIndex = 0;
    let currentIndex = 0;
    let lineNumber = 1;
    
    while (originalIndex < originalLines.length || currentIndex < currentLines.length) {
      const originalLine = originalLines[originalIndex] ?? "";
      const currentLine = currentLines[currentIndex] ?? "";
      
      if (originalIndex >= originalLines.length) {
        // Line only in current (added)
        result.push({ type: "added", content: currentLine, lineNumber: lineNumber++ });
        currentIndex++;
      } else if (currentIndex >= currentLines.length) {
        // Line only in original (removed)
        result.push({ type: "removed", content: originalLine, lineNumber: lineNumber++ });
        originalIndex++;
      } else if (originalLine === currentLine) {
        // Lines match (unchanged)
        result.push({ type: "unchanged", content: currentLine, lineNumber: lineNumber++ });
        originalIndex++;
        currentIndex++;
      } else {
        // Lines differ - show removed then added
        result.push({ type: "removed", content: originalLine, lineNumber: lineNumber++ });
        result.push({ type: "added", content: currentLine, lineNumber: lineNumber++ });
        originalIndex++;
        currentIndex++;
      }
    }
    
    return result;
  }, [originalPrompt, currentPrompt]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === "added").length;
    const removed = diffLines.filter(l => l.type === "removed").length;
    const unchanged = diffLines.filter(l => l.type === "unchanged").length;
    return { added, removed, unchanged };
  }, [diffLines]);

  if (!originalPrompt && !currentPrompt) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No prompt data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-chart-2 border-chart-2">
          <Plus className="h-3 w-3 mr-1" />
          {stats.added} added
        </Badge>
        <Badge variant="outline" className="text-destructive border-destructive">
          <Minus className="h-3 w-3 mr-1" />
          {stats.removed} removed
        </Badge>
        <Badge variant="outline" className="text-muted-foreground">
          <Equal className="h-3 w-3 mr-1" />
          {stats.unchanged} unchanged
        </Badge>
      </div>

      {/* Diff View */}
      <ScrollArea className="h-[400px] border-2 border-border">
        <div className="font-mono text-xs">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={`flex items-start ${
                line.type === "added"
                  ? "bg-chart-2/20 border-l-4 border-chart-2"
                  : line.type === "removed"
                  ? "bg-destructive/20 border-l-4 border-destructive line-through"
                  : "bg-transparent border-l-4 border-transparent"
              }`}
            >
              <div className="w-8 text-center py-1 text-muted-foreground select-none shrink-0">
                {line.type === "added" && <Plus className="h-3 w-3 inline text-chart-2" />}
                {line.type === "removed" && <Minus className="h-3 w-3 inline text-destructive" />}
                {line.type === "unchanged" && <span className="text-muted-foreground/50">{line.lineNumber}</span>}
              </div>
              <pre className="flex-1 py-1 px-2 whitespace-pre-wrap break-words">
                {line.content || " "}
              </pre>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
