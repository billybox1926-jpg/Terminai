import React, { useState, useEffect } from "react";
import { FileCode, Save, X, Terminal, CheckCircle2, ShieldAlert, RefreshCw } from "lucide-react";

interface CodeEditorProps {
  filePath: string | null;
  onClose: () => void;
  onExecuteCommand: (cmd: string) => void;
  onSaveSuccess: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  filePath,
  onClose,
  onExecuteCommand,
  onSaveSuccess
}) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [status, setStatus] = useState<"clean" | "modified" | "saved" | "error">("clean");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;

    const loadFileContent = async () => {
      setLoading(true);
      setError(null);
      setStatus("clean");
      try {
        const response = await fetch("/api/file-manager/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filePath })
        });

        if (!response.ok) {
          throw new Error("Could not parse file from container filesystem.");
        }

        const data = await response.json();
        setContent(data.content || "");
      } catch (err: any) {
        setError(err.message || "Failed to load file contents.");
        setStatus("error");
      } finally {
        setLoading(false);
      }
    };

    loadFileContent();
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/file-manager/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          content
        })
      });

      if (!response.ok) {
        throw new Error("Could not write file content back to disk.");
      }

      setStatus("saved");
      onSaveSuccess();
      setTimeout(() => setStatus("clean"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to write file configurations.");
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setStatus("modified");
  };

  const handleRunInShell = () => {
    if (!filePath) return;
    
    // Choose appropriate runtime CLI depending on file format extension
    let execCmd = "";
    if (filePath.endsWith(".ts")) {
      execCmd = `npx tsx ${filePath}`;
    } else if (filePath.endsWith(".js") || filePath.endsWith(".json")) {
      execCmd = `node ${filePath}`;
    } else if (filePath.endsWith(".sh")) {
      execCmd = `bash ${filePath}`;
    } else if (filePath.endsWith(".html")) {
      execCmd = `cat ${filePath} | head -n 25`;
    } else {
      execCmd = `cat ${filePath}`;
    }

    onExecuteCommand(execCmd);
  };

  if (!filePath) return null;

  // Generate list numbers for editor gutter
  const lineCount = content.split("\n").length;
  const lineGutter = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1).join("\n");

  return (
    <div id="gui-code-editor-modal" className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono select-none animate-fadeIn">
      <div className="bg-[#141417] border border-white/10 rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Editor Titlebar */}
        <div className="bg-[#0B0B0C] border-b border-white/5 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <div className="text-xs">
              <div className="text-white/40 text-[10px] uppercase font-bold font-sans tracking-widest">Graphic System Editor</div>
              <div className="text-white font-bold max-w-[280px] md:max-w-md truncate">{filePath}</div>
            </div>
            {status === "modified" && (
              <span className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-ping" title="Unsaved changes" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "saved" && (
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-900/40">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved to disk
              </span>
            )}
            
            <button
              onClick={handleRunInShell}
              className="bg-[#1E1E22] hover:bg-[#28282D] text-white/80 hover:text-emerald-400 text-xs py-1 px-3 rounded-md border border-white/5 transition flex items-center gap-1 cursor-pointer"
              title="Run and execute file directly on active terminal console"
            >
              <Terminal className="w-3.5 h-3.5" /> Execute
            </button>

            <button
              onClick={handleSave}
              disabled={saving || loading || status === "clean"}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs py-1 px-3.5 rounded-md transition flex items-center gap-1 cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)]"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>

            <button
              onClick={onClose}
              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace panel content */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-[#0C0C0E]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-xs text-white/40">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mb-2" />
              Reading file from server container memory...
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-rose-400 text-xs">
              <ShieldAlert className="w-10 h-10 mb-2 text-rose-500" />
              <div>{error}</div>
            </div>
          ) : (
            <>
              {/* Line number gutter */}
              <div className="bg-[#08080A] select-none text-right px-3 py-3.5 text-white/20 font-mono text-xs border-r border-white/5 whitespace-pre leading-relaxed overflow-hidden min-w-[32px] md:min-w-[40px]">
                {lineGutter}
              </div>

              {/* Textarea container */}
              <textarea
                value={content}
                onChange={handleContentChange}
                className="flex-1 bg-transparent p-3.5 text-xs text-white/85 outline-none resize-none font-mono leading-relaxed select-text overflow-y-auto whitespace-pre h-full focus:outline-none focus:ring-0"
                placeholder="// Start writing some CLI script code here..."
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0B0B0C] border-t border-white/5 p-2.5 text-[10px] text-white/40 flex justify-between items-center shrink-0">
          <div>
            Lines: <span className="text-white font-bold">{lineCount}</span>
          </div>
          <div>
            Status: <span className={`font-bold uppercase ${status === 'modified' ? 'text-amber-400' : 'text-emerald-400'}`}>{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
