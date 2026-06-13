import React, { useEffect, useState } from "react";
import { Cpu, HardDrive, Shield, Activity, RefreshCw } from "lucide-react";
import { SystemStats } from "../types";

interface SystemMonitorProps {
  stats: SystemStats | null;
  onRefresh: () => void;
  loading: boolean;
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({ stats, onRefresh, loading }) => {
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  };

  if (!stats) {
    return (
      <div id="sys-monitor-loading" className="flex items-center justify-center p-8 text-neutral-400 font-mono text-xs">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin text-cyan-400" />
        Syncing system monitors...
      </div>
    );
  }

  const memPercent = stats.memory.percent;
  const cpuPercent = Math.min(Math.max(stats.cpu.load * 100, 1.2), 100); // Normalize load average to estimated percent

  return (
    <div id="system-monitor-widget" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">Telemetry & Real Stats</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 hover:bg-[#1A1A1E] text-white/40 hover:text-emerald-500 rounded transition cursor-pointer"
          title="Force telemetry refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CPU */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" /> CPU Load
            </span>
            <span className="text-white font-bold">{cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/5 h-2.5 rounded overflow-hidden">
            <div 
              className={`h-full rounded transition-all duration-1000 ${
                cpuPercent > 80 ? 'bg-rose-500' : cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${cpuPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-white/30 truncate" title={stats.cpu.model}>
            {stats.cpu.cores} Cores @ {stats.cpu.model}
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Memory (RAM)
            </span>
            <span className="text-white font-bold">{memPercent}%</span>
          </div>
          <div className="w-full bg-white/5 h-2.5 rounded overflow-hidden">
            <div 
              className={`h-full rounded transition-all duration-1000 ${
                memPercent > 85 ? 'bg-rose-500' : memPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${memPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>Free: {stats.memory.free}</span>
            <span>Total: {stats.memory.total}</span>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> Disk partitions
            </span>
            <span className="text-white font-bold">{stats.disk.percent}</span>
          </div>
          <div className="w-full bg-white/5 h-2.5 rounded overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded transition-all duration-1000"
              style={{ width: stats.disk.percent }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span>Used: {stats.disk.used} / {stats.disk.total}</span>
            <span>Avail: {stats.disk.free}</span>
          </div>
        </div>

        {/* Operating System */}
        <div className="space-y-1.5 bg-[#1A1A1E] p-3 border border-white/5 rounded-lg flex flex-col justify-between transition hover:border-white/10 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="text-xs text-white/50 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400/80" /> Container Env
            </div>
          </div>
          <div className="text-[10px] text-white font-bold tracking-wide flex justify-between gap-1 items-center mt-1">
            <span className="truncate max-w-[110px]">{stats.os.type} {stats.os.platform}</span>
            <span className="text-white/40 text-[9px] px-1 bg-[#050505] border border-white/5 rounded">{stats.os.release}</span>
          </div>
          <div className="text-[9px] text-white/30 mt-1 flex justify-between">
            <span>Uptime:</span>
            <span className="text-emerald-400 font-semibold">{formatUptime(stats.uptime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
