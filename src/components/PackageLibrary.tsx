import React, { useEffect, useState } from "react";
import { Package, CheckCircle2, AlertTriangle, Search, Info, Terminal, Download, Plus, ShieldCheck, ShieldAlert, RefreshCw, Wrench } from "lucide-react";
import { CLITool, RuntimeBootstrapStatus } from "../types";

interface PackageLibraryProps {
  onRunInstallCommand: (cmd: string) => void;
}

export const PackageLibrary: React.FC<PackageLibraryProps> = ({ onRunInstallCommand }) => {
  const [tools, setTools] = useState<CLITool[]>([]);
  const [readiness, setReadiness] = useState<{ total: number; installed: number; missing: number; ready: boolean } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customPackage, setCustomPackage] = useState<string>("");

  // Runtime bootstrap state
  const [bootstrapStatus, setBootstrapStatus] = useState<RuntimeBootstrapStatus | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(false);
  const [repairing, setRepairing] = useState<boolean>(false);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/package-manager/list");
      const data = await response.json();
      if (data && data.tools) {
        setTools(data.tools);
        if (data.readiness) {
          setReadiness(data.readiness);
        }
      }
    } catch (err) {
      console.error("Error loading tools collection", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBootstrapStatus = async () => {
    try {
      const response = await fetch("/api/runtime/bootstrap/status");
      const data: RuntimeBootstrapStatus = await response.json();
      setBootstrapStatus(data);
    } catch (err) {
      console.error("Error loading bootstrap status", err);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchBootstrapStatus();
  }, []);

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tool.id && tool.id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const absentTools = tools.filter(tool => !tool.installed);

  const sanitizePackageName = (name: string): boolean => {
    return /^[a-z0-9][a-z0.+-]*$/.test(name.trim().toLowerCase());
  };

  const handleBootstrapRuntime = async () => {
    setBootstrapping(true);
    try {
      const response = await fetch("/api/runtime/bootstrap/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.command) {
        onRunInstallCommand(data.command);
      }
      // Refresh status
      await fetchPackages();
      await fetchBootstrapStatus();
    } catch (err) {
      console.error("Bootstrap failed:", err);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleRepairRuntime = async () => {
    setRepairing(true);
    try {
      const response = await fetch("/api/runtime/bootstrap/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (data.command) {
        onRunInstallCommand(data.command);
      }
      // Refresh status
      await fetchPackages();
      await fetchBootstrapStatus();
    } catch (err) {
      console.error("Repair failed:", err);
    } finally {
      setRepairing(false);
    }
  };

  const handleInstallAllMissing = () => {
    const missing = tools.filter(t => !t.installed && t.aptPackages);
    if (missing.length === 0) return;
    const aptNames = missing.map(t => t.aptPackages).join(" ");
    const cleanParts = aptNames.split(/\s+/).filter(sanitizePackageName);
    if (cleanParts.length === 0) return;
    const cmd = `echo "Installing ${cleanParts.length} missing packages..." && apt-get update && apt-get install -y ${cleanParts.join(" ")} || sudo apt-get update && sudo apt-get install -y ${cleanParts.join(" ")}`;
    onRunInstallCommand(cmd);
  };

  const handleInstallSingle = (tool: CLITool) => {
    if (!tool.aptPackages) return;
    const cleanParts = tool.aptPackages.split(/\s+/).filter(sanitizePackageName);
    if (cleanParts.length === 0) return;
    const cmd = `echo "Installing ${tool.name}..." && apt-get update && apt-get install -y ${cleanParts.join(" ")} || sudo apt-get update && sudo apt-get install -y ${cleanParts.join(" ")}`;
    onRunInstallCommand(cmd);
  };

  const handleCustomInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPackage.trim()) return;
    const sanitized = customPackage.trim().toLowerCase();
    if (!sanitizePackageName(sanitized)) {
      alert("Invalid package name. Only lowercase letters, numbers, dots, plus, and hyphen are allowed.");
      return;
    }
    const cmd = `echo "Installing ${sanitized}..." && apt-get update && apt-get install -y ${sanitized} || sudo apt-get update && sudo apt-get install -y ${sanitized}`;
    onRunInstallCommand(cmd);
    setCustomPackage("");
  };

  const isReady = bootstrapStatus?.runtimeReady ?? readiness?.ready ?? false;
  const pkgManager = bootstrapStatus?.packageManager ?? "unknown";
  const totalMissing = bootstrapStatus?.missing ?? readiness?.missing ?? 0;
  const requiredMissing = bootstrapStatus?.requiredMissing ?? 0;
  const totalInstalled = bootstrapStatus?.installed ?? readiness?.installed ?? 0;
  const totalPackages = bootstrapStatus?.total ?? readiness?.total ?? 0;

  return (
    <div id="pkg-library-box" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">Graphical Tools & Package Monitor</h2>
        </div>
        <button
          onClick={() => { fetchPackages(); fetchBootstrapStatus(); }}
          className="text-[10px] text-emerald-400 hover:text-emerald-300 decoration-emerald-550 hover:underline cursor-pointer font-bold font-sans"
        >
          Check status
        </button>
      </div>

      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        Terminai operates directly on a fully functional server container. Below are pre-configured developer CLI packages and interpreters from the runtime baseline.
      </p>

      {/* Runtime Readiness Summary */}
      {!loading && (readiness || bootstrapStatus) && (
        <div className={`rounded-lg p-3 mb-3 border ${
          isReady
            ? "bg-emerald-950/20 border-emerald-900/40"
            : "bg-amber-950/20 border-amber-900/40"
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-sans font-semibold flex items-center gap-1.5 ${
              isReady ? "text-emerald-300" : "text-amber-300"
            }`}>
              {isReady
                ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                : <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              }
              {isReady ? "Runtime Ready" : "Runtime Incomplete"}
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
              isReady
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-800/40"
                : "bg-amber-500/10 text-amber-400 border-amber-800/40"
            }`}>
              {pkgManager === "pkg" ? "Termux/pkg" : pkgManager === "apt" ? "Debian/apt" : pkgManager}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-white/40">
            <span>{totalInstalled} / {totalPackages} installed</span>
            {totalMissing > 0 && (
              <span className="text-amber-400">{totalMissing} missing ({requiredMissing} required)</span>
            )}
          </div>
        </div>
      )}

      {/* Bootstrap / Repair buttons */}
      {!loading && totalMissing > 0 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={handleBootstrapRuntime}
            disabled={bootstrapping}
            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 px-3 rounded-lg font-bold transition border cursor-pointer bg-emerald-500/10 text-emerald-400 border-emerald-800/40 hover:bg-emerald-500 hover:text-black disabled:opacity-40"
          >
            {bootstrapping ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {bootstrapping ? "Bootstrapping..." : "Bootstrap Missing"}
          </button>
          <button
            onClick={handleRepairRuntime}
            disabled={repairing}
            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] py-2 px-3 rounded-lg font-bold transition border cursor-pointer bg-amber-500/10 text-amber-400 border-amber-800/40 hover:bg-amber-500 hover:text-black disabled:opacity-40"
          >
            {repairing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
            {repairing ? "Repairing..." : "Repair Runtime"}
          </button>
        </div>
      )}

      {/* Search and filter bar */}
      <div className="relative mb-3.5">
        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-white/30">
          <Search className="w-3.5 h-3.5" />
        </span>
        <input
          type="text"
          placeholder="Filter package names..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0E0E10] border border-white/5 rounded-md py-1.5 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-0 font-mono"
        />
      </div>

      {/* Package listings */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-white/40">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-t border-emerald-400 border-r border-emerald-400 mr-2" />
          Reading container binaries...
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
          {filteredTools.length === 0 ? (
            <div className="text-center py-6 text-xs text-white/30">
              No packages match your search filter keys.
            </div>
          ) : (
            filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="bg-[#050505] border border-white/5 p-3 rounded-lg hover:border-emerald-500/30 transition group animate-fadeIn"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white/95 group-hover:text-emerald-400 transition font-sans">
                      {tool.displayName || tool.name}
                    </span>
                    <span className="text-[9px] text-white/30 px-1 bg-[#1A1A1E] border border-white/5 rounded">
                      {tool.category}
                    </span>
                    {tool.required && (
                      <span className="text-[8px] text-emerald-500/60 px-1 bg-emerald-950/30 border border-emerald-900/30 rounded">
                        REQUIRED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {tool.installed ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/40">
                        <CheckCircle2 className="w-3 h-3" /> v{tool.version || "Active"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40">
                        <AlertTriangle className="w-3 h-3" /> Absent
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1 text-[10px] text-white/50 line-clamp-2 leading-tight">
                  {tool.description}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5 opacity-80 group-hover:opacity-100 transition">
                  <span className="text-[9px] text-white/30 flex items-center gap-0.5">
                    <Info className="w-2.5 h-2.5" /> CLI: {tool.queryCommand || tool.id}
                  </span>

                  {tool.installed ? (
                    <button
                      onClick={() => onRunInstallCommand(`${tool.queryCommand || tool.id} --help`)}
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 border border-emerald-950 bg-emerald-950/20 hover:bg-emerald-950/50 rounded-md py-1 px-2.5 transition cursor-pointer"
                    >
                      <Terminal className="w-2.5 h-2.5" /> Run --help
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstallSingle(tool)}
                      className="text-[9px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 border border-amber-950 bg-amber-950/20 hover:bg-amber-950/50 rounded-md py-1 px-2.5 transition cursor-pointer"
                    >
                      <Download className="w-2.5 h-2.5" /> Auto-Install
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Custom APT Package form */}
      <form onSubmit={handleCustomInstall} className="flex gap-1.5 mt-3 pt-3 border-t border-white/5">
        <input
          type="text"
          placeholder="Install apt packages (e.g., htop, neofetch)..."
          value={customPackage}
          onChange={(e) => setCustomPackage(e.target.value)}
          className="flex-1 bg-[#0E0E10] border border-white/5 rounded-md px-2.5 py-1 text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 font-mono"
        />
        <button
          type="submit"
          className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-800/60 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded select-none cursor-pointer font-sans transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
