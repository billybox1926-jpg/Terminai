import { useEffect, useState } from "react";
import {
  Award,
  Clock,
  Monitor,
  Sliders,
  Smartphone,
  Sparkles,
  Terminal as TerminalIcon,
  User,
} from "lucide-react";
import { TerminalConsole } from "./components/TerminalConsole";
import { AIShellOptimizer } from "./components/AIShellOptimizer";
import { SystemMonitor } from "./components/SystemMonitor";
import { FileBrowser } from "./components/FileBrowser";
import { CodeEditor } from "./components/CodeEditor";
import { PackageLibrary } from "./components/PackageLibrary";
import { TermuxSettingsConsole } from "./components/TermuxSettingsConsole";
import { QuickScriptsLauncher } from "./components/QuickScriptsLauncher";
import { DeviceBuildStatus } from "./components/DeviceBuildStatus";
import { SystemStats, TerminalLine, TerminalSession, TermuxProperties } from "./types";

type WorkspaceTab = "terminal" | "device-build" | "ai-copilot" | "scripts" | "settings";

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function now(): string {
  return new Date().toLocaleTimeString();
}

function createLine(type: TerminalLine["type"], text: string, cwd?: string): TerminalLine {
  return {
    id: makeId(),
    type,
    text,
    cwd,
    timestamp: now(),
  };
}

export default function App() {
  const [properties, setProperties] = useState<TermuxProperties>({
    bell: "beep",
    cursorStyle: "block",
    fontSize: 12,
    terminalTheme: "elegant-dark",
  });

  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [currentCwd, setCurrentCwd] = useState(".");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("terminal");
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [refreshExplorer, setRefreshExplorer] = useState(0);
  const [utcTime, setUtcTime] = useState("");

  const appendLines = (sessionId: string, lines: TerminalLine[]) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? { ...session, lines: [...session.lines, ...lines] }
          : session,
      ),
    );
  };

  const fetchTelemetry = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch("/api/system/stats");
      if (!response.ok) return;

      const data: SystemStats = await response.json();
      setStats(data);
      setCurrentCwd((prev) => (prev === "." && data.cwd ? data.cwd : prev));
    } catch (error) {
      console.error("TerminAI telemetry query failed:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const firstSessionId = makeId();
    setSessions([
      {
        id: firstSessionId,
        name: "Terminal (sh 1)",
        isActive: true,
        cwd: ".",
        lines: [
          createLine("success", "=== TerminAI Local Workspace [ONLINE] ==="),
          createLine(
            "info",
            "AI-assisted shell, package status, device/build telemetry, workspace files, scripts, and editor tools are mounted.",
          ),
        ],
      },
    ]);
    setActiveSessionId(firstSessionId);

    fetchTelemetry();
    const statsInterval = window.setInterval(fetchTelemetry, 6000);
    const clockInterval = window.setInterval(() => {
      setUtcTime(new Date().toUTCString().replace("GMT", "UTC"));
    }, 1000);

    return () => {
      window.clearInterval(statsInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  const handleCreateSession = () => {
    const nextNum = sessions.length + 1;
    const newSessionId = makeId();
    const newSession: TerminalSession = {
      id: newSessionId,
      name: `Terminal (sh ${nextNum})`,
      isActive: true,
      cwd: currentCwd,
      lines: [
        createLine("success", `=== TerminAI session ${nextNum} spawned ===`),
        createLine("info", `Workspace directory: ${currentCwd}`),
      ],
    };

    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSessionId);
  };

  const handleCloseSession = (id: string) => {
    if (sessions.length <= 1) return;

    const closedIndex = sessions.findIndex((session) => session.id === id);
    const filtered = sessions.filter((session) => session.id !== id);
    setSessions(filtered);

    if (activeSessionId === id) {
      const fallbackIndex = Math.max(0, closedIndex - 1);
      setActiveSessionId(filtered[fallbackIndex].id);
    }
  };

  const executeCommand = async (commandText: string) => {
    const command = commandText.trim();
    if (!command || !activeSessionId) return;

    if (command === "clear") {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId ? { ...session, lines: [] } : session,
        ),
      );
      return;
    }

    appendLines(activeSessionId, [createLine("command", command, currentCwd)]);

    if (command === "help") {
      appendLines(activeSessionId, [
        createLine(
          "stdout",
          `TerminAI Core Commands
- cd <path>       Change working folder target
- ls              List files in active folder
- ls -la          Detailed files visualization
- env             List process environment variables
- npm run lint    Type-check codebase integrity
- npm run build   Build production assets
- clear           Reset terminal logs`,
        ),
      ]);
      return;
    }

    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, cwd: currentCwd }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Terminal process failed.");
      }

      const data = await response.json();
      const lines: TerminalLine[] = [];

      if (data.stdout?.trim()) lines.push(createLine("stdout", data.stdout));
      if (data.stderr?.trim()) lines.push(createLine("stderr", data.stderr));
      if (data.code !== 0) lines.push(createLine("error", `[Shell returned status code: ${data.code}]`));
      if (data.timedOut) lines.push(createLine("error", "[Command timed out and was stopped]"));

      appendLines(activeSessionId, lines);

      if (data.newCwd && data.newCwd !== currentCwd) {
        setCurrentCwd(data.newCwd);
      }
      setRefreshExplorer((prev) => prev + 1);
    } catch (error: any) {
      appendLines(activeSessionId, [
        createLine("error", `[TerminAI execution error: ${error.message}]`),
      ]);
    }
  };

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeLines = activeSession?.lines ?? [];

  return (
    <div id="terminai-workspace-root" className="min-h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans select-none antialiased">
      <header className="bg-[#121214] border-b border-white/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-1.5 rounded-lg text-black shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse">
            <TerminalIcon className="w-5 h-5 font-bold" />
          </div>
          <div>
            <span className="font-display font-black text-sm tracking-tight text-white uppercase flex items-center gap-1.5">
              TerminAI <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 border border-emerald-900 rounded lowercase font-mono">single_runtime</span>
            </span>
            <p className="text-[10px] text-white/40 font-mono">A terminal that thinks with you</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 select-none">
          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5 font-mono text-[10px] text-white/60">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{utcTime || "Synchronizing Clock..."}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5 text-[10px] font-mono">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
            <span className="text-emerald-400 font-bold uppercase tracking-wider text-[9px]">LOCAL_ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-[#050505] px-2.5 py-1 rounded border border-white/5">
            <User className="w-3.5 h-3.5 text-emerald-400/80" />
            <span className="text-[10px] text-white/60 font-mono truncate max-w-[130px]">workspace</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-7xl mx-auto w-full overflow-y-auto">
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-[#121214] border border-white/5 p-1.5 rounded-lg flex flex-wrap gap-1 shrink-0 select-none">
            <button onClick={() => setActiveWorkspaceTab("terminal")} className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${activeWorkspaceTab === "terminal" ? "bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "text-white/45 hover:text-white/70"}`}>
              <Monitor className="w-3.5 h-3.5" /> Direct Term
            </button>
            <button onClick={() => setActiveWorkspaceTab("device-build")} className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${activeWorkspaceTab === "device-build" ? "bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "text-white/45 hover:text-white/70"}`}>
              <Smartphone className="w-3.5 h-3.5" /> Device & Build
            </button>
            <button onClick={() => setActiveWorkspaceTab("ai-copilot")} className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${activeWorkspaceTab === "ai-copilot" ? "bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "text-white/45 hover:text-white/70"}`}>
              <Sparkles className="w-3.5 h-3.5" /> AI Optimizer
            </button>
            <button onClick={() => setActiveWorkspaceTab("scripts")} className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${activeWorkspaceTab === "scripts" ? "bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "text-white/45 hover:text-white/70"}`}>
              <Award className="w-3.5 h-3.5" /> Automations
            </button>
            <button onClick={() => setActiveWorkspaceTab("settings")} className={`flex-1 min-w-[95px] py-2 px-3 rounded-md text-xs font-bold font-mono tracking-wide flex items-center justify-center gap-1 transition cursor-pointer ${activeWorkspaceTab === "settings" ? "bg-[#1A1A1E] text-emerald-400 border border-white/10 font-black shadow-[0_0_8px_rgba(16,185,129,0.15)]" : "text-white/45 hover:text-white/70"}`}>
              <Sliders className="w-3.5 h-3.5" /> Core Config
            </button>
          </div>

          {activeWorkspaceTab === "terminal" && (
            <TerminalConsole
              lines={activeLines}
              onSendCommand={executeCommand}
              currentCwd={currentCwd}
              onClearHistory={() => setSessions((prev) => prev.map((session) => session.id === activeSessionId ? { ...session, lines: [] } : session))}
              properties={properties}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onCreateSession={handleCreateSession}
              onSelectSession={setActiveSessionId}
              onRenameSession={(id, name) => setSessions((prev) => prev.map((session) => session.id === id ? { ...session, name } : session))}
              onCloseSession={handleCloseSession}
            />
          )}

          {activeWorkspaceTab === "device-build" && (
            <DeviceBuildStatus onSendCommand={(cmd) => { executeCommand(cmd); setActiveWorkspaceTab("terminal"); }} />
          )}

          {activeWorkspaceTab === "ai-copilot" && (
            <AIShellOptimizer currentCwd={currentCwd} onExecuteCommand={(cmd) => { executeCommand(cmd); setActiveWorkspaceTab("terminal"); }} />
          )}

          {activeWorkspaceTab === "scripts" && (
            <QuickScriptsLauncher onRunScript={(script) => { executeCommand(script); setActiveWorkspaceTab("terminal"); }} onSendCommand={executeCommand} />
          )}

          {activeWorkspaceTab === "settings" && (
            <TermuxSettingsConsole properties={properties} onUpdateProperties={setProperties} onSendCommand={executeCommand} />
          )}

          <PackageLibrary onRunInstallCommand={(cmd) => { executeCommand(cmd); setActiveWorkspaceTab("terminal"); }} />
        </section>

        <section className="lg:col-span-5 flex flex-col gap-4">
          <SystemMonitor stats={stats} onRefresh={fetchTelemetry} loading={statsLoading} />
          <div className="flex-1">
            <FileBrowser
              activeFolder={currentCwd}
              onSelectFile={setSelectedFile}
              onActiveFolderChange={(newFolder) => setCurrentCwd(newFolder)}
              refreshTrigger={refreshExplorer}
            />
          </div>
        </section>
      </main>

      {selectedFile && (
        <CodeEditor
          filePath={selectedFile}
          onClose={() => setSelectedFile(null)}
          onExecuteCommand={(cmd) => { executeCommand(cmd); setSelectedFile(null); setActiveWorkspaceTab("terminal"); }}
          onSaveSuccess={() => setRefreshExplorer((prev) => prev + 1)}
        />
      )}

      <footer className="bg-[#121214] border-t border-white/5 p-3 text-center text-xs font-mono text-white/40 shrink-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1 max-w-7xl mx-auto w-full px-2">
          <span>TerminAI workspace: <span className="text-emerald-400 font-bold">{currentCwd}</span></span>
          <span className="text-[10px] text-white/30">Local-first single-runtime shell environment</span>
        </div>
      </footer>
    </div>
  );
}
