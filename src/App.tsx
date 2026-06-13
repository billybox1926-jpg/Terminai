import { useEffect, useState } from "react";
import { 
  Terminal as TermIcon, 
  Sparkles, 
  Globe, 
  Cpu, 
  BookOpen, 
  User, 
  Clock, 
  HelpCircle, 
  ShieldCheck, 
  ChevronRight, 
  CheckCircle2, 
  ChevronDown,
  Monitor,
  Sliders,
  Award,
  Settings
} from "lucide-react";
import { TerminalConsole } from "./components/TerminalConsole";
import { AIShellOptimizer } from "./components/AIShellOptimizer";
import { SystemMonitor } from "./components/SystemMonitor";
import { FileBrowser } from "./components/FileBrowser";
import { CodeEditor } from "./components/CodeEditor";
import { PackageLibrary } from "./components/PackageLibrary";
import { TermuxSettingsConsole } from "./components/TermuxSettingsConsole";
import { QuickScriptsLauncher } from "./components/QuickScriptsLauncher";
import { SystemStats, TerminalLine, TerminalSession, TermuxProperties } from "./types";

export default function App() {
  // Termux-cannibalized Properties Customizer State
  const [properties, setProperties] = useState<TermuxProperties>({
    bell: "beep",
    cursorStyle: "block",
    fontSize: 12,
    terminalTheme: "elegant-dark"
  });

  // Multiple Terminal Sessions State
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");

  // Terminal Sync Working Directory
  const [currentCwd, setCurrentCwd] = useState<string>(".");
  
  // Tab toggler: "terminal" | "ai-copilot" | "scripts" | "settings"
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"terminal" | "ai-copilot" | "scripts" | "settings">("terminal");

  // Telemetry statistics
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // File selection for GUI text editor
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Increment trigger to refresh visual child directories
  const [refreshExplorer, setRefreshExplorer] = useState<number>(0);

  // UTC clock state
  const [utcTime, setUtcTime] = useState<string>("");

  // Fetch telemetry from local server container
  const fetchTelemetry = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch("/api/system/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        // Safely capture initial process workspace folder if not set
        if (currentCwd === "." && data.cwd) {
          setCurrentCwd(data.cwd);
        }
      }
    } catch (err) {
      console.error("Telemetry query failed:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Synchronous timers & Initial State construction
  useEffect(() => {
    fetchTelemetry();
    
    // WebTermux polling intervals
    const statsInterval = setInterval(fetchTelemetry, 6000);
    
    // Simple clocks
    const clockInterval = setInterval(() => {
      const d = new Date();
      setUtcTime(d.toUTCString().replace("GMT", "UTC"));
    }, 1000);

    // Initial Termux Session
    const firstSessId = Math.random().toString();
    const welcomeId = Math.random().toString();
    
    setSessions([
      {
        id: firstSessId,
        name: "Terminal (sh 1)",
        isActive: true,
        cwd: ".",
        lines: [
          {
            id: welcomeId,
            type: "success",
            text: "=== WebTermux Desktop Terminal Emulator [ONLINE] ===",
            timestamp: new Date().toLocaleTimeString()
          },
          {
            id: Math.random().toString(),
            type: "info",
            text: "⚡ Optimized shell support active. AI co-pilot, filesystem sync, and graphic tools mounted. Type commands directly, trigger quick scripts, or adjust properties.",
            timestamp: new Date().toLocaleTimeString()
          }
        ]
      }
    ]);
    setActiveSessionId(firstSessId);

    return () => {
      clearInterval(statsInterval);
      clearInterval(clockInterval);
    };
  }, []);

  // Session Creators and Swappers
  const handleCreateSession = () => {
    const nextNum = sessions.length + 1;
    const newSessId = Math.random().toString();
    const newSession: TerminalSession = {
      id: newSessId,
      name: `Terminal (sh ${nextNum})`,
      isActive: true,
      cwd: currentCwd,
      lines: [
        {
          id: Math.random().toString(),
          type: "success",
          text: `=== WebTermux Session ${nextNum} spawned ===`,
          timestamp: new Date().toLocaleTimeString()
        },
        {
          id: Math.random().toString(),
          type: "info",
          text: `Active process working index starts on background directory: ${currentCwd}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    };
    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(newSessId);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleRenameSession = (id: string, name: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  };

  const handleCloseSession = (id: string) => {
    if (sessions.length <= 1) return;
    const closedIndex = sessions.findIndex(s => s.id === id);
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    
    // Fallback focus to other available sessions if closed active index
    if (activeSessionId === id) {
      const fallbackIndex = Math.max(0, closedIndex - 1);
      setActiveSessionId(filtered[fallbackIndex].id);
    }
  };

  // Root Shell Execution Handler targeting ACTIVE session
  const executeCommand = async (commandText: string) => {
    const cmdClean = commandText.trim();
    if (!cmdClean) return;

    const timestamp = new Date().toLocaleTimeString();

    // 1. Log native statement to screen
    const commandId = Math.random().toString();
    const commandLine: TerminalLine = {
      id: commandId,
      type: "command",
      text: cmdClean,
      cwd: currentCwd,
      timestamp: timestamp
    };
    
    // Append to current session
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        if (cmdClean === "clear") {
          return { ...s, lines: [] };
        }
        return {
          ...s,
          lines: [...s.lines, commandLine]
        };
      }
      return s;
    }));

    // Handle clear CLI action locally
    if (cmdClean === "clear") {
      return;
    }

    if (cmdClean === "help") {
      const helpLine = {
        id: Math.random().toString(),
        type: "stdout" as const,
        text: `WebTermux Graphic Shell - Core Commands
- cd <path>       Change working folder target
- ls              List files in active folder
- ls -la          Detailed files visualization
- env             List process environment variables
- npm run lint    Verify codebase integrity
- clear           Reset terminal logs`,
        timestamp: timestamp
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, lines: [...s.lines, helpLine] };
        }
        return s;
      }));
      return;
    }

    // 2. Transmit command API request
    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmdClean,
          cwd: currentCwd
        })
      });

      if (!response.ok) {
        throw new Error("Terminal process failed. No server transmission.");
      }

      const data = await response.json();
      const payloadLines: TerminalLine[] = [];

      // Append standard answers
      if (data.stdout && data.stdout.trim()) {
        payloadLines.push({
          id: Math.random().toString(),
          type: "stdout",
          text: data.stdout,
          timestamp: timestamp
        });
      }

      // Append errors
      if (data.stderr && data.stderr.trim()) {
        payloadLines.push({
          id: Math.random().toString(),
          type: "stderr",
          text: data.stderr,
          timestamp: timestamp
        });
      }

      // Append exit status descriptors
      if (data.code !== 0) {
        payloadLines.push({
          id: Math.random().toString(),
          type: "error",
          text: `[Shell returned status code: ${data.code}]`,
          timestamp: timestamp
        });
      }

      // Apply result lines to target session
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            lines: [...s.lines, ...payloadLines]
          };
        }
        return s;
      }));

      // 3. Synchronize ending working directories!
      if (data.newCwd && data.newCwd !== currentCwd) {
        setCurrentCwd(data.newCwd);
        // Force refresh explorer files since directory changed
        setRefreshExplorer(prev => prev + 1);
      } else {
        // Run refresh anyways because files or sizes might have changed (e.g., touch file, rm file)
        setRefreshExplorer(prev => prev + 1);
      }

    } catch (err: any) {
      const errLine = {
        id: Math.random().toString(),
        type: "error" as const,
        text: `[Internal API Execution Error: ${err.message}]`,
        timestamp: timestamp
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            lines: [...s.lines, errLine]
          };
        }
        return s;
      }));
    }
  };

  const handleClearTerminal = () => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, lines: [] } : s));
  };

  // Find lines of the current active session
  const activeSessionObj = sessions.find(s => s.id === activeSessionId);
  const activeLines = activeSessionObj ? activeSessionObj.lines : [];

  return (
    <div id="web-termux-desktop-root" className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans select-none antialiased">
      {/* Top OS Menu Controller */}
      <header className="bg-[#121214] border-b border-white/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        {/* App Logo branding */}
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-1.5 rounded-lg text-black shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse">
            <TermIcon className="w-5 h-5 font-bold" />
          </div>
          <div>
            <span className="font-display font-black text-sm tracking-tight text-white uppercase flex items-center gap-1.5">
              WebTermux Desktop <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-920 rounded lowercase font-mono">native_gui</span>
            </span>
            <p className="text-[10px] text-white/40 font-mono">Optimized Container Shell v4.0.0</p>
          </div>
        </div>

        {/* Global telemetry tickers */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 select-none">
          {/* Active UTC Sync Clock */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5 font-mono text-[10px] text-white/60">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{utcTime || "Synchronizing Clock..."}</span>
          </div>

          {/* Connection status indicators */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5 text-[10px] font-mono">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
            <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px]">SYS_ONLINE</span>
          </div>

          {/* User badge */}
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5">
            <User className="w-3.5 h-3.5 text-emerald-400/80" />
            <span className="text-[10px] text-white/60 font-mono truncate max-w-[130px]">billybox1926</span>
          </div>
        </div>
      </header>

      {/* Main OS desktop dashboard workbench layout (Grid responsive splitting) */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* Left column: Desktop Terminal & AI optimization shell tab groups [lg:span-7] */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Tab Suite headers */}
          <div className="bg-[#121214] border border-white/5 p-1.5 rounded-lg flex flex-wrap gap-1 shrink-0 select-none">
            <button
              onClick={() => setActiveWorkspaceTab("terminal")}
              className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${
                activeWorkspaceTab === "terminal"
                  ? 'bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Direct Term
            </button>
            <button
              onClick={() => setActiveWorkspaceTab("ai-copilot")}
              className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${
                activeWorkspaceTab === "ai-copilot"
                  ? 'bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI Optimizer
            </button>
            <button
              onClick={() => setActiveWorkspaceTab("scripts")}
              className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${
                activeWorkspaceTab === "scripts"
                  ? 'bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> Automations
            </button>
            <button
              onClick={() => setActiveWorkspaceTab("settings")}
              className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${
                activeWorkspaceTab === "settings"
                  ? 'bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Core Config
            </button>
          </div>

          {/* Tab viewport panel renderers */}
          {activeWorkspaceTab === "terminal" && (
            <TerminalConsole 
              lines={activeLines}
              onSendCommand={executeCommand}
              currentCwd={currentCwd}
              onClearHistory={handleClearTerminal}
              properties={properties}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onCreateSession={handleCreateSession}
              onSelectSession={handleSelectSession}
              onRenameSession={handleRenameSession}
              onCloseSession={handleCloseSession}
            />
          )}

          {activeWorkspaceTab === "ai-copilot" && (
            <AIShellOptimizer 
              onExecuteCommand={(cmd) => {
                // Execute optimized command, and hot-focus user back to the primary prompt
                executeCommand(cmd);
                setActiveWorkspaceTab("terminal");
              }}
              currentCwd={currentCwd}
            />
          )}

          {activeWorkspaceTab === "scripts" && (
            <QuickScriptsLauncher 
              onRunScript={(scriptCode) => {
                executeCommand(scriptCode);
                setActiveWorkspaceTab("terminal");
              }}
              onSendCommand={(cmd) => {
                executeCommand(cmd);
              }}
            />
          )}

          {activeWorkspaceTab === "settings" && (
            <TermuxSettingsConsole 
              properties={properties}
              onUpdateProperties={(updated) => setProperties(updated)}
              onSendCommand={(cmd) => {
                executeCommand(cmd);
              }}
            />
          )}

          {/* Preinstalled tool category libraries */}
          <PackageLibrary 
            onRunInstallCommand={(cmd) => {
              executeCommand(cmd);
              setActiveWorkspaceTab("terminal");
            }}
          />
        </section>

        {/* Right column: Local system telemetry stats & visual directory browsers [lg:span-5] */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Telemetry Gauge component */}
          <SystemMonitor 
            stats={stats}
            onRefresh={fetchTelemetry}
            loading={statsLoading}
          />

          {/* Visual file system explorer */}
          <div className="flex-1">
            <FileBrowser 
              activeFolder={currentCwd}
              onSelectFile={(filePath) => setSelectedFile(filePath)}
              onActiveFolderChange={(newFolder) => {
                // Clean and align shell directories
                if (currentCwd !== newFolder) {
                  setCurrentCwd(newFolder);
                }
              }}
              refreshTrigger={refreshExplorer}
            />
          </div>
        </section>
      </main>

      {/* Floating full-screen Code/Script graphic IDE Editor modal */}
      {selectedFile && (
        <CodeEditor 
          filePath={selectedFile}
          onClose={() => setSelectedFile(null)}
          onExecuteCommand={(cmd) => {
            // Trigger command execution, close editor viewport, and transfer user to terminal tab
            executeCommand(cmd);
            setSelectedFile(null);
            setActiveWorkspaceTab("terminal");
          }}
          onSaveSuccess={() => {
            // Trigger file listing updates
            setRefreshExplorer(prev => prev + 1);
          }}
        />
      )}

      {/* Humble OS status info footer */}
      <footer className="bg-[#121214] border-t border-white/5 p-3 text-center text-xs font-mono text-white/40 shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 max-w-7xl mx-auto w-full px-2">
          <span>WebTermux Host workspace: <span className="text-emerald-400 font-bold">{currentCwd}</span></span>
          <span className="text-[10px] text-white/30">Secure Sandboxed Container Shell Environment</span>
        </div>
      </footer>
    </div>
  );
}
