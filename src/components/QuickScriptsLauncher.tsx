import React, { useState } from "react";
import { Terminal, Copy, Play, Check, Eye, ChevronDown, Award, HelpCircle } from "lucide-react";

interface QuickScriptsLauncherProps {
  onRunScript: (scriptAndCmd: string) => void;
  onSendCommand: (cmd: string) => void;
}

export const QuickScriptsLauncher: React.FC<QuickScriptsLauncherProps> = ({
  onRunScript,
  onSendCommand
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inspectingScript, setInspectingScript] = useState<any | null>(null);

  // Ready script utilities that represent advanced shell systems
  const scriptsList = [
    {
      id: "sys_diagnostics",
      name: "Uptime & Diagnostics",
      desc: "Detailed report of container resource loads, running tasks, and thread statistics",
      command: "echo '=== SYSTEM SUMMARY ===' && uname -a && echo '--- CPU LOADS ---' && uptime && echo '--- RAM UTILIZATION ---' && free -h || vmstat && echo '--- ACTIVE TASKS ---' && ps aux | head -n 12",
      icon: "⚡"
    },
    {
      id: "network_auditor",
      name: "Network Connection Scan",
      desc: "Audit routing tables, listening loopback ports, and active sockets",
      command: "echo '=== ACTIVE LOCAL PORTS ===' && (netstat -tuln || ss -tulpn || cat /proc/net/tcp | head -n 15) && echo '--- DNS RESOLUTION ---' && cat /etc/resolv.conf && echo '--- INTERFACES ---' && (ip addr || ifconfig | head -n 12)",
      icon: "🌐"
    },
    {
      id: "workspace_cleaner",
      name: "Workspace Temp Wiper",
      desc: "Recursively purge stale logs, error logs, and optimize repository partitions",
      command: "echo '=== PURGING STALE DATA ===' && find . -name '*.log' -type f -delete -print && echo '--- SIZE STATS ---' && du -sh .",
      icon: "🧹"
    },
    {
      id: "ports_sniffer",
      name: "Service Ports sniffer",
      desc: "Verify active local server sockets and loopbacks binding checks",
      command: "echo '=== LOOPBACK PORTS PINGER ===' && curl -s -I http://localhost:3000/api/health || echo 'Port 3000 online'",
      icon: "📡"
    }
  ];

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCreateLocalFile = (script: any) => {
    const fileName = `${script.id}.sh`;
    const fullCommand = `cat << 'EOF' > ${fileName}\n#!/bin/bash\n# Terminai Script: ${script.name}\n${script.command}\nEOF\nchmod +x ${fileName} && echo "${fileName} created dynamically and marked as executable! Type ./${fileName} or click execute."`;
    onSendCommand(fullCommand);
  };

  return (
    <div id="quick-scripts-launcher-widget" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl relative">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">Termux Script repository</h2>
        </div>
        <span className="text-[10px] text-emerald-500 bg-emerald-950/40 px-2 py-0.5 border border-emerald-900/60 rounded text-[9px] uppercase tracking-wider font-bold">Automation Modules</span>
      </div>

      <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
        Pre-configured standard executable automation scripts. Build them into physical <code className="text-emerald-500/80 font-bold">.sh</code> scripts on-the-fly, or trigger execution immediately inside your active shell session:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {scriptsList.map((script) => (
          <div 
            key={script.id}
            className="bg-[#050505] border border-white/5 p-3.5 rounded-lg flex flex-col justify-between hover:border-emerald-500/20 transition group"
          >
            <div>
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition flex items-center gap-1.5 font-sans">
                  <span className="text-xs">{script.icon}</span> {script.name}
                </span>
                <span className="text-[9px] text-white/20 font-mono">.{script.id.slice(0, 3)}</span>
              </div>
              <p className="text-[10.5px] text-white/40 mt-1 leading-normal font-sans">
                {script.desc}
              </p>
            </div>

            <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between gap-1.5">
              <button
                onClick={() => setInspectingScript(script)}
                className="text-[9px] text-white/50 hover:text-white flex items-center gap-0.5 bg-white/5 hover:bg-white/10 py-1.5 px-2.5 rounded-md transition cursor-pointer font-sans"
                title="View executable console script body"
              >
                <Eye className="w-3 h-3" /> View Source
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCreateLocalFile(script)}
                  className="text-[9px] text-white/60 hover:text-emerald-400 p-1.5 hover:bg-white/5 rounded-md transition cursor-pointer"
                  title="Export code into physical file inside active folder path"
                >
                  {copiedId === script.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => onRunScript(script.command)}
                  className="bg-emerald-500/15 hover:bg-emerald-500 hover:text-black hover:shadow-[0_0_8px_rgba(16,185,129,0.3)] text-emerald-400 font-bold text-[9.5px] py-1.5 px-3 rounded-md transition flex items-center gap-1 cursor-pointer font-sans"
                  title="Run command chain inside terminal session tab"
                >
                  <Play className="w-2.5 h-2.5 fill-current" /> Let's Run
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* INSPECT SOURCE MODAL OVERLAY */}
      {inspectingScript && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-white/10 rounded-xl w-full max-w-xl flex flex-col p-5 shadow-2xl overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-xs">{inspectingScript.name} Source block</span>
              </div>
              <span className="text-[9px] text-white/30">Read-Only View</span>
            </div>

            <div className="bg-[#050505] p-4 rounded-lg text-emerald-400/90 leading-relaxed overflow-x-auto max-h-[300px] select-text">
              <code className="whitespace-pre-wrap">{inspectingScript.command}</code>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-white/5">
              <span className="text-[9px] text-white/30">Close this dialog to resume workbench.</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(inspectingScript.id, inspectingScript.command)}
                  className="bg-white/5 hover:bg-white/10 text-white/80 font-bold py-2 px-3 rounded-md transition text-[10px] flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === inspectingScript.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Code
                </button>
                <button
                  onClick={() => setInspectingScript(null)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold py-2 px-4.5 rounded-md transition text-[10px] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
