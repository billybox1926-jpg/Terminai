import React, { useState, useRef, useEffect } from "react";
import { 
  Terminal, 
  Trash2, 
  ArrowRightCircle, 
  HelpCircle, 
  Plus, 
  X, 
  Edit3, 
  Check, 
  Maximize2, 
  Volume2, 
  Monitor, 
  TerminalSquare 
} from "lucide-react";
import { TerminalLine, TerminalSession, TermuxProperties } from "../types";

interface TerminalConsoleProps {
  lines: TerminalLine[];
  onSendCommand: (cmd: string) => void;
  currentCwd: string;
  onClearHistory: () => void;
  
  // Custom cannibalized Termux properties and sessions
  properties: TermuxProperties;
  sessions: TerminalSession[];
  activeSessionId: string;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onCloseSession: (id: string) => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({
  lines,
  onSendCommand,
  currentCwd,
  onClearHistory,
  properties,
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
  onRenameSession,
  onCloseSession
}) => {
  const [input, setInput] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  
  // Renaming state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when lines append
  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, activeSessionId]);

  // Handle bell sound context on outcomes
  useEffect(() => {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine.type === "error" || lastLine.type === "stderr") {
        triggerBellSound(true);
      } else if (lastLine.type === "success") {
        triggerBellSound(false);
      }
    }
  }, [lines]);

  // Audio Context Bell Synthesizer (No assets needed!)
  const triggerBellSound = (isError = false) => {
    if (properties.bell === "silent") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = isError ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(isError ? 140 : 880, ctx.currentTime); // buzzer or high chime
      
      // Vibrate simulation: pulse audio freq
      if (properties.bell === "vibrate") {
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      }

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (err) {
      console.warn("Bell audio blocked/unsupported:", err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const commandText = input.trim();
    if (!commandText) return;

    onSendCommand(commandText);
    
    if (history[history.length - 1] !== commandText) {
      setHistory(prev => [...prev, commandText]);
    }
    setHistoryIndex(-1);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex === history.length - 1) {
        setHistoryIndex(-1);
        setInput("");
      } else {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === "Tab") {
      // Auto-completions on general filesystem or terminal words
      e.preventDefault();
      handleTabCompletion();
    }
  };

  // Autocomplete suggestions mapping
  const handleTabCompletion = () => {
    const currentInput = input.trim();
    if (!currentInput) return;

    const commonCommands = ["git status", "git log", "npm run lint", "npm run dev", "npm run build", "curl -I ", "cat /etc/hosts", "clear", "help"];
    const match = commonCommands.find(c => c.startsWith(currentInput) && c !== currentInput);
    if (match) {
      setInput(match);
      triggerBellSound(false);
    } else {
      // Small audio chime indicating no match
      triggerBellSound(true);
    }
  };

  // Handle clickable Virtual Extra Keys Row (Termux-signature utility row)
  const handleExtraKeyClick = (keySymbol: string) => {
    switch (keySymbol) {
      case "ESC":
        setInput("");
        break;
      case "CTRL+C":
        onSendCommand("^C (Interrupted)");
        setInput("");
        triggerBellSound(true);
        break;
      case "TAB":
        handleTabCompletion();
        break;
      case "UP":
        if (history.length > 0) {
          const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIdx);
          setInput(history[newIdx]);
        }
        break;
      case "DN":
        if (historyIndex !== -1) {
          if (historyIndex === history.length - 1) {
            setHistoryIndex(-1);
            setInput("");
          } else {
            const newIdx = historyIndex + 1;
            setHistoryIndex(newIdx);
            setInput(history[newIdx]);
          }
        }
        break;
      case "CLEAR":
        onClearHistory();
        triggerBellSound(false);
        break;
      case "LS":
        onSendCommand("ls");
        break;
      default:
        // Regular typing input appendage
        setInput(prev => prev + keySymbol);
        break;
    }
    inputRef.current?.focus();
  };

  const startRename = (sess: TerminalSession) => {
    setEditingSessionId(sess.id);
    setRenameValue(sess.name);
  };

  const saveRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameSession(id, renameValue.trim());
    }
    setEditingSessionId(null);
  };

  // Get stylized path helper for current command console prompt
  const getPromptPath = () => {
    if (currentCwd === "." || currentCwd === "" || currentCwd === "/") return "~";
    const cleanPath = currentCwd.replace(/\/$/, "");
    const parts = cleanPath.split("/");
    const last = parts[parts.length - 1] || "";
    return `~/${last}`;
  };

  // Custom UI colors based on termux properties theme
  const getThemeStyles = () => {
    switch (properties.terminalTheme) {
      case "gruvbox":
        return {
          bg: "bg-[#282828] text-[#EBDBB2]",
          border: "border-[#FABD2F]/20",
          innerBg: "bg-[#1D2021]",
          promptColor: "text-[#B8BB26]",
          commandColor: "text-[#FABD2F] font-bold",
          stdoutColor: "text-[#EBDBB2]/80 font-mono",
          stderrColor: "text-[#FB4934]",
          cursorStyle: "bg-[#FABD2F]",
          caretColor: "#FABD2F",
          fontClass: "font-mono"
        };
      case "solarized":
        return {
          bg: "bg-[#002B36] text-[#93A1A1]",
          border: "border-[#2AA198]/20",
          innerBg: "bg-[#073642]",
          promptColor: "text-[#859900]",
          commandColor: "text-[#2AA198] font-bold",
          stdoutColor: "text-[#93A1A1]/85 font-mono",
          stderrColor: "text-[#DC322F]",
          cursorStyle: "bg-[#2AA198]",
          caretColor: "#2AA198",
          fontClass: "font-mono"
        };
      case "cyberpunk":
        return {
          bg: "bg-[#0C081A] text-[#DDFBFF]",
          border: "border-[#FF0055]/30",
          innerBg: "bg-[#180E2E]",
          promptColor: "text-[#00F3FF]",
          commandColor: "text-[#FF0055] font-bold",
          stdoutColor: "text-[#DDFBFF]/80 font-mono",
          stderrColor: "text-[#FF0055] font-medium",
          cursorStyle: "bg-[#00F3FF]",
          caretColor: "#00F3FF",
          fontClass: "font-mono"
        };
      case "monokai":
        return {
          bg: "bg-[#272822] text-[#F8F8F2]",
          border: "border-[#AE81FF]/20",
          innerBg: "bg-[#1E1F1C]",
          promptColor: "text-[#A6E22E]",
          commandColor: "text-[#F92672] font-semibold",
          stdoutColor: "text-[#F8F8F2]/80 font-mono",
          stderrColor: "text-[#F92672]",
          cursorStyle: "bg-[#E6DB74]",
          caretColor: "#E6DB74",
          fontClass: "font-mono"
        };
      case "matrix":
        return {
          bg: "bg-[#000000] text-[#00FF33]",
          border: "border-[#00FF33]/30",
          innerBg: "bg-black",
          promptColor: "text-[#00FF33]",
          commandColor: "text-[#D6FFD8] font-black",
          stdoutColor: "text-[#00FF33]/85 font-mono",
          stderrColor: "text-[#FF1111]",
          cursorStyle: "bg-[#00FF33]",
          caretColor: "#00FF33",
          fontClass: "font-mono"
        };
      case "elegant-dark":
      default:
        return {
          bg: "bg-[#050505] text-[#E0E0E0]",
          border: "border-white/10",
          innerBg: "bg-[#0A0A0C]",
          promptColor: "text-emerald-500",
          commandColor: "text-white font-semibold",
          stdoutColor: "text-white/60 font-mono",
          stderrColor: "text-rose-400/95",
          cursorStyle: "bg-emerald-500",
          caretColor: "#10B981",
          fontClass: "font-mono"
        };
    }
  };

  const theme = getThemeStyles();

  // Redundant scrollbar properties styles applied locally on components bases
  return (
    <div 
      id="terminal-console-widget" 
      className={`${theme.bg} ${theme.border} border rounded-xl p-5 flex flex-col flex-1 h-[450px] shadow-2xl relative transition-all duration-300`}
    >
      {/* Sessions management bar (Cannibalized Termux multi-terminal tab controls) */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-2.5 shrink-0 select-none">
        
        {/* Left Side: Termux session switcher tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pr-2 scrollbar-none max-w-[80%]">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer shrink-0 ${
                activeSessionId === sess.id
                  ? "bg-white/5 text-emerald-400 border-emerald-500/30"
                  : "bg-transparent text-white/40 border-transparent hover:text-white/70"
              }`}
            >
              {editingSessionId === sess.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(sess.id)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(sess.id)}
                    className="bg-[#121214] border border-white/10 text-xs px-1 text-white outline-none w-16"
                    autoFocus
                  />
                  <Check className="w-3 h-3 text-emerald-400 cursor-pointer" onClick={() => saveRename(sess.id)} />
                </div>
              ) : (
                <span onClick={() => onSelectSession(sess.id)} className="font-sans">
                  {sess.name}
                </span>
              )}

              {/* Edit button */}
              {editingSessionId !== sess.id && activeSessionId === sess.id && (
                <Edit3 
                  className="w-3 h-3 text-white/30 hover:text-white/60 cursor-pointer" 
                  onClick={() => startRename(sess)}
                />
              )}

              {/* Close session button, protected from closing singular active core session */}
              {sessions.length > 1 && (
                <X
                  className="w-3 h-3 text-white/30 hover:text-rose-400 cursor-pointer hover:bg-white/5 p-0.5 rounded"
                  onClick={() => onCloseSession(sess.id)}
                />
              )}
            </div>
          ))}

          {/* Spawn multiple tab sessions (+ symbol) */}
          <button
            onClick={onCreateSession}
            className="p-1 px-2 bg-[#121214] hover:bg-emerald-500 hover:text-black border border-white/5 text-white/40 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer font-sans"
            title="Open concurrent multi-shell session"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Side: Clear logs action */}
        <div className="flex items-center gap-2">
          {properties.bell !== "silent" && (
            <Volume2 className="w-3.5 h-3.5 text-white/30" title={`Bell sound: ${properties.bell}`} />
          )}
          <button
            onClick={onClearHistory}
            className="p-1.5 hover:bg-white/5 text-white/40 hover:text-rose-400 rounded-lg transition cursor-pointer"
            title="Flush visual term buffer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport Lines Area */}
      <div 
        onClick={() => inputRef.current?.focus()}
        className={`flex-1 overflow-y-auto mb-3.5 space-y-1.5 p-3.5 ${theme.innerBg} rounded-xl max-h-[300px] leading-relaxed select-text shadow-inner`}
        style={{ fontSize: `${properties.fontSize}px` }}
      >
        {lines.length === 0 ? (
          <div className="text-[11px] text-white/30 py-6 leading-normal flex flex-col items-center justify-center text-center font-sans">
            <HelpCircle className="w-6 h-6 text-white/10 mb-2" />
            <span>WebTermux Multi-Session console active.<br />Spawn shell sessions above, adjust configurations or ask the AI Co-pilot below.</span>
          </div>
        ) : (
          lines.map((line) => {
            let color = theme.stdoutColor;
            if (line.type === "command") color = theme.commandColor;
            if (line.type === "stderr") color = theme.stderrColor;
            if (line.type === "info") color = "text-blue-400 font-bold";
            if (line.type === "success") color = "text-emerald-400 font-bold";
            if (line.type === "error") color = "text-rose-500 font-bold font-mono";

            return (
              <div key={line.id} className={`${theme.fontClass} text-xs break-all leading-normal`}>
                {line.type === "command" && (
                  <span className={`${theme.promptColor} mr-1.5 select-none font-bold`}>
                    billybox@{getPromptPath()}$
                  </span>
                )}
                <span className={color}>{line.text}</span>
              </div>
            );
          })
        )}
        <div ref={consoleBottomRef} />
      </div>

      {/* ICONIC TERMUX EXTRA KEYS ROW (Virtual help overlay on screen) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2 shrink-0 select-none scrollbar-thin border-b border-white/5 pr-1.5">
        <span className="text-[8px] text-white/20 uppercase tracking-wider font-extrabold font-sans shrink-0 mr-1">KEYS:</span>
        {[
          "ESC", "CTRL+C", "TAB", "LS", "UP", "DN",
          "-", "/", "|", "&", "<", ">", ";", "~"
        ].map((keySymbol) => (
          <button
            key={keySymbol}
            type="button"
            onClick={() => handleExtraKeyClick(keySymbol)}
            className="text-[9.5px] py-1 px-3.5 bg-[#121214] hover:bg-[#1C1C20] border border-white/5 rounded-lg font-bold text-white/70 hover:text-emerald-400 cursor-pointer shrink-0 transition"
          >
            {keySymbol}
          </button>
        ))}
      </div>

      {/* Active bash prompt input bar */}
      <form 
        onSubmit={handleSubmit} 
        className="flex gap-2.5 items-center bg-[#0C0C0E] border border-white/5 rounded-xl px-4 py-2.5 shrink-0 select-none focus-within:border-emerald-500/40 transition duration-150"
      >
        <label htmlFor="cli-input-field" className={`${theme.promptColor} font-bold text-xs select-none shrink-0 whitespace-nowrap`}>
          billybox@{getPromptPath()}$
        </label>
        
        <div className="flex-1 flex items-center relative">
          <input
            id="cli-input-field"
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder="Run script, binaries, command (TAB completion)..."
            style={{ caretColor: theme.caretColor }}
            className="w-full bg-transparent border-none text-xs text-white/90 outline-none p-0 font-mono focus:ring-0 placeholder-white/20"
          />
        </div>

        <button
          type="submit"
          className="text-white/40 hover:text-emerald-500 transition cursor-pointer"
          title="Dispatch container statement"
        >
          <ArrowRightCircle className="w-5.5 h-5.5" />
        </button>
      </form>
    </div>
  );
};
