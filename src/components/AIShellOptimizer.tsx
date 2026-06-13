import React, { useState } from "react";
import { Sparkles, Terminal, Copy, Check, Info, ShieldAlert, ArrowRight, CornerDownRight } from "lucide-react";
import { OptimizedCommandResult } from "../types";

interface AIShellOptimizerProps {
  onExecuteCommand: (command: string) => void;
  currentCwd: string;
}

export const AIShellOptimizer: React.FC<AIShellOptimizerProps> = ({ onExecuteCommand, currentCwd }) => {
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<OptimizedCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/gemini/optimize-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          currentContext: currentCwd
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to contact Gemini optimizer.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const executeInTerminal = (command: string) => {
    onExecuteCommand(command);
  };

  // Safe light-render formatter for returning text/markdown nicely
  const renderFormattedExplanation = (text: string) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Bold items
      let content: React.ReactNode = line;
      
      // Basic markdown headers
      if (line.trim().startsWith("###")) {
        return <h4 key={idx} className="text-xs font-bold text-cyan-300 mt-2 mb-1 uppercase tracking-tight">{line.replace("###", "").trim()}</h4>;
      }
      if (line.trim().startsWith("##")) {
        return <h3 key={idx} className="text-sm font-bold text-cyan-400 mt-3 mb-1">{line.replace("##", "").trim()}</h3>;
      }
      if (line.trim().startsWith("#")) {
        return <h2 key={idx} className="text-sm font-extrabold text-neutral-100 mt-4 mb-2">{line.replace("#", "").trim()}</h2>;
      }

      // Basic list items
      if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
        content = (
          <span className="flex items-start gap-1 text-[11px] text-neutral-300 pl-2">
            <CornerDownRight className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />
            <span>{line.substring(2)}</span>
          </span>
        );
        return <div key={idx} className="my-1">{content}</div>;
      }

      // Format code tags in explanation lines
      if (line.includes("`")) {
        const parts = line.split("`");
        content = parts.map((part, pIdx) => {
          if (pIdx % 2 === 1) {
            return <code key={pIdx} className="bg-neutral-950 px-1 py-0.5 text-cyan-400 border border-neutral-800 rounded font-mono text-[10px]">{part}</code>;
          }
          return part;
        });
      }

      return <p key={idx} className="text-[11px] text-neutral-300 leading-relaxed my-1 min-h-[14px]">{content}</p>;
    });
  };

  return (
    <div id="ai-shell-optimizer-panel" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl">
      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2.5">
        <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
        <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">AI Shell Script Optimizer & co-pilot</h2>
      </div>

      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        Describe your objective (e.g. <em>"batch replace text 'api-key' with 'config.key' recursively in safe backups"</em>) and optimize it for high efficiency:
      </p>

      <form onSubmit={handleOptimize} className="space-y-2">
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            required
            placeholder="Translate intent to fastest terminal command..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            className="flex-1 bg-[#0E0E10] border border-white/5 placeholder-white/20 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 focus:ring-0 font-mono"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/5 text-black font-bold text-xs py-2 px-4 rounded-md transition flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)]"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-t border-black border-r border-black mr-1" />
                Optimizing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Optimize Task
              </>
            )}
          </button>
        </div>
      </form>

      {/* ERROR */}
      {error && (
        <div className="mt-3 bg-rose-950/20 border border-rose-900/40 rounded p-2 text-rose-450 text-[11px] flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* RESULTS DISPLAY */}
      {result && (
        <div className="mt-4 space-y-3.5 border-t border-white/5 pt-3.5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/45 uppercase tracking-widest flex items-center gap-1">
              <Terminal className="w-3 h-3 text-emerald-400" /> Executive Executable Command:
            </span>
          </div>

          {/* Actionable Terminal Block */}
          <div className="bg-[#050505] border border-white/10 rounded-lg p-3 relative flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <code className="text-xs text-emerald-400 font-bold break-all select-all flex-1 font-mono leading-relaxed">
              {result.optimizedCommand}
            </code>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => copyToClipboard(result.optimizedCommand)}
                className="p-1.5 text-white/40 hover:text-emerald-400 hover:bg-[#1A1A1E] rounded-md transition cursor-pointer"
                title="Copy command statement"
              >
                {copiedCmd ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => executeInTerminal(result.optimizedCommand)}
                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-black text-emerald-400 font-bold text-[10px] px-2.5 py-1 rounded-md border border-emerald-800 transition flex items-center gap-1 cursor-pointer"
                title="Run instantly inside Terminai Console"
              >
                Let's Run <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Explanation Area */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/45 uppercase tracking-widest flex items-center gap-1">
              <Info className="w-3 h-3 text-emerald-400" /> Explanation / Optimization breakdown:
            </span>
            <div className="bg-[#050505] p-3.5 border border-white/5 rounded-lg max-h-[160px] overflow-y-auto text-white/70 leading-relaxed font-mono">
              {renderFormattedExplanation(result.explanation)}
            </div>
          </div>

          {/* Localized Alternatives */}
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-3.5 text-[11px] text-amber-400/90">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-1">
              <div className="font-bold text-xs uppercase tracking-wider text-amber-400 font-sans">Dry-run or Safety variant:</div>
              <code className="text-[10px] bg-[#050505] px-2 py-1 border border-white/5 rounded text-white/80 block truncate select-all">{result.alternative}</code>
              <p className="text-[10px] text-white/30 leading-tight">Always double-check source parameters before running recursive scripting actions.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
