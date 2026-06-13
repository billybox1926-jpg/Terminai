import React, { useEffect, useState } from "react";
import { Package, CheckCircle2, AlertTriangle, Search, Info, Terminal, Download, Plus } from "lucide-react";
import { CLITool } from "../types";

interface PackageLibraryProps {
  onRunInstallCommand: (cmd: string) => void;
}

export const PackageLibrary: React.FC<PackageLibraryProps> = ({ onRunInstallCommand }) => {
  const [tools, setTools] = useState<CLITool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customPackage, setCustomPackage] = useState<string>("");

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/package-manager/list");
      const data = await response.json();
      if (data && data.tools) {
        setTools(data.tools);
      }
    } catch (err) {
      console.error("Error loading tools collection", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const absentTools = tools.filter(tool => !tool.installed);

  const handleInstallAllAbsent = () => {
    const listToInstall = absentTools.map(t => t.aptPackages || t.name).join(" ");
    if (!listToInstall) return;
    const cmd = `echo "Installing all missing packages..." && apt-get update && apt-get install -y ${listToInstall} || sudo apt-get update && sudo apt-get install -y ${listToInstall}`;
    onRunInstallCommand(cmd);
  };

  const handleInstallSingle = (toolName: string) => {
    const matched = tools.find(t => t.name === toolName);
    const aptName = matched?.aptPackages || toolName;
    const cmd = `echo "Installing ${toolName}..." && apt-get update && apt-get install -y ${aptName} || sudo apt-get update && sudo apt-get install -y ${aptName}`;
    onRunInstallCommand(cmd);
  };

  const handleCustomInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPackage.trim()) return;
    const cleanPkg = customPackage.trim().toLowerCase();

    // Command sanitization validation: Package names may only contain lowercase letters, numbers, dots, plus, and hyphen.
    const sanitizedAndValidated = cleanPkg
      .split(/\s+/)
      .filter(pkg => /^[a-z0-9.+-]+$/.test(pkg))
      .join(" ");

    if (!sanitizedAndValidated) {
      alert("Sanitization Alert: Package names may only contain lowercase letters, numbers, dots, plus, and hyphen.");
      return;
    }

    const cmd = `echo "Running custom installation command..." && apt-get update && apt-get install -y ${sanitizedAndValidated} || sudo apt-get update && sudo apt-get install -y ${sanitizedAndValidated}`;
    onRunInstallCommand(cmd);
    setCustomPackage("");
  };

  return (
    <div id="pkg-library-box" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">Graphical Tools & Package Monitor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPackages}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 decoration-emerald-550 hover:underline cursor-pointer font-bold font-sans"
          >
            Check status
          </button>
        </div>
      </div>

      <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
        Terminai operates directly on a fully functional server container. Below are pre-configured developer CLI packages and interpreters:
      </p>

      {/* Runtime Readiness Summary */}
      {!loading && (
        <div id="runtime-readiness-summary" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 bg-[#0d0d0f] border border-white/5 rounded-lg text-xs leading-none">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-white/30 uppercase font-bold tracking-wider font-sans">Total Baseline</span>
            <span className="text-xs font-extrabold text-white font-mono">{tools.length} packages</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-emerald-500/60 uppercase font-bold tracking-wider font-sans">Installed</span>
            <span className="text-xs font-extrabold text-emerald-400 font-mono">{tools.filter(t => t.installed).length} OK</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-amber-500/60 uppercase font-bold tracking-wider font-sans">Missing</span>
            <span className="text-xs font-extrabold text-amber-400 font-mono">{tools.filter(t => !t.installed).length} absent</span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[9px] text-white/30 uppercase font-bold tracking-wider font-sans mb-1">State</span>
            {tools.filter(t => !t.installed).length === 0 ? (
              <span className="inline-flex items-center gap-1 text-[8.5px] text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/40 max-w-fit shadow-[0_0_8px_rgba(16,185,129,0.2)] font-mono">
                ● READY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[8.5px] text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/40 max-w-fit animate-pulse font-mono">
                ▲ SETUP REQ
              </span>
            )}
          </div>
        </div>
      )}

      {/* Auto preinstall missing helper banner */}
      {!loading && absentTools.length > 0 && (
        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 mb-3 flex flex-col gap-2 animate-fadeIn">
          <div className="flex items-center justify-between gap-1.5 row-auto">
            <span className="text-[10px] font-sans text-emerald-300 font-semibold flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              {absentTools.length} system utilities can be pre-installed!
            </span>
            <button
              onClick={handleInstallAllAbsent}
              className="bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] font-bold px-2.5 py-1 rounded select-none cursor-pointer font-sans transition-all active:scale-95 duration-70"
            >
              Install Missing
            </button>
          </div>
          <span className="text-[9px] text-white/40 leading-snug">
            Run automated installation in the main terminal interface. Makes full CLI environments immediately active.
          </span>
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
                key={tool.name}
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
                    <Info className="w-2.5 h-2.5" /> CLI query: {tool.queryCommand || tool.name}
                  </span>
                  
                  {tool.installed ? (
                    <button
                      onClick={() => onRunInstallCommand(`${tool.queryCommand || tool.name} --help`)}
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 border border-emerald-950 bg-emerald-950/20 hover:bg-emerald-950/50 rounded-md py-1 px-2.5 transition cursor-pointer"
                    >
                      <Terminal className="w-2.5 h-2.5" /> Run --help
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstallSingle(tool.name)}
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
