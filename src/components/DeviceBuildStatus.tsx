import React, { useEffect, useState } from "react";
import {
  Battery,
  BatteryCharging,
  Clipboard,
  ShieldCheck,
  Smartphone,
  Download,
  Save,
  Play,
  CheckCircle2,
  RefreshCw,
  FileJson,
  Wrench,
  Check,
  Power,
  Network,
} from "lucide-react";
import { DeviceBuildData, TelemetryArtifactSpec, DeviceInfo } from "../types";

interface DeviceBuildStatusProps {
  onSendCommand?: (cmd: string) => void;
}

function safeArtifactSegment(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

export const DeviceBuildStatus: React.FC<DeviceBuildStatusProps> = ({ onSendCommand }) => {
  const [data, setData] = useState<DeviceBuildData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [compiling, setCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [compileSuccess, setCompileSuccess] = useState<boolean>(false);

  const [appName, setAppName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState(1);
  const [buildProfile, setBuildProfile] = useState("Debug");
  const [minSdkVersion, setMinSdkVersion] = useState(26);
  const [targetSdkVersion, setTargetSdkVersion] = useState(34);
  const [selectedAbis, setSelectedAbis] = useState<string[]>([]);
  const [clipboardVal, setClipboardVal] = useState("");

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/device/build-status");
      if (!res.ok) throw new Error("Failed to load device status API");
      const json: DeviceBuildData = await res.json();
      setData(json);
      setAppName(json.telemetry.appName);
      setPackageName(json.telemetry.packageName);
      setVersionName(json.telemetry.versionName);
      setVersionCode(json.telemetry.versionCode);
      setBuildProfile(json.telemetry.buildProfile);
      setMinSdkVersion(json.telemetry.minSdkVersion);
      setTargetSdkVersion(json.telemetry.targetSdkVersion);
      setSelectedAbis(json.telemetry.targetAbis);
      setClipboardVal(json.device.clipboard);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveTelemetry = async () => {
    if (!data) return;
    setSaving(true);
    setSaveSuccess(false);

    const outputName = `${safeArtifactSegment(appName, "terminai")}-${safeArtifactSegment(buildProfile, "debug")}-v${safeArtifactSegment(versionName, "0.1.0")}.apk`;
    const updatedTelemetry: TelemetryArtifactSpec = {
      ...data.telemetry,
      appName,
      packageName,
      versionName,
      versionCode: Number(versionCode),
      buildProfile,
      minSdkVersion: Number(minSdkVersion),
      targetSdkVersion: Number(targetSdkVersion),
      targetAbis: selectedAbis,
      artifactOutputName: outputName,
      lastCompileTimestamp: new Date().toISOString(),
    };

    const updatedDevice: Partial<DeviceInfo> = {
      clipboard: clipboardVal,
      batteryLevel: data.device.batteryLevel,
      isCharging: data.device.isCharging,
      permissions: data.device.permissions,
    };

    try {
      const response = await fetch("/api/device/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry: updatedTelemetry, device: updatedDevice }),
      });
      if (response.ok) {
        setSaveSuccess(true);
        setData((prev) => (prev ? { ...prev, telemetry: updatedTelemetry, device: { ...prev.device, clipboard: clipboardVal } } : null));
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAbi = (abi: string) => {
    if (selectedAbis.includes(abi)) {
      setSelectedAbis(selectedAbis.filter((item) => item !== abi));
    } else {
      setSelectedAbis([...selectedAbis, abi]);
    }
  };

  const handleTogglePermission = async (permKey: keyof DeviceInfo["permissions"]) => {
    if (!data) return;
    const current = data.device.permissions[permKey];
    const nextVal = current === "granted" ? "denied" : current === "denied" ? "prompt" : "granted";
    const updatedPermissions = { ...data.device.permissions, [permKey]: nextVal };
    const updatedData = { ...data, device: { ...data.device, permissions: updatedPermissions } };

    setData(updatedData);

    try {
      await fetch("/api/device/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: { permissions: updatedPermissions } }),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleTriggerBuildCompiler = () => {
    if (compiling) return;
    setCompiling(true);
    setCompileProgress(0);
    setCompileSuccess(false);
    setCompileLogs([]);

    const safeApkName = `${safeArtifactSegment(appName, "terminai")}-${safeArtifactSegment(buildProfile, "debug")}-v${safeArtifactSegment(versionName, "0.1.0")}.apk`;
    const logStatements = [
      "[TerminAI CI Compiler] Initializing Android/APK build workflow...",
      "[TerminAI CI Compiler] Validating telemetry configuration blueprint...",
      `[TerminAI CI Compiler] Resolved Bundle ID: ${packageName || "io.terminai.app"}`,
      `[TerminAI CI Compiler] Target SDK Profile: ${targetSdkVersion}, Min SDK Profile: ${minSdkVersion}`,
      `[TerminAI CI Compiler] Target ABI Architectures: [${selectedAbis.join(", ")}]`,
      "[TerminAI CI Compiler] Loading Android SDK Build Tools...",
      "[TerminAI CI Compiler] Running linter on embedded resources and layouts...",
      "[TerminAI CI Compiler] Compiling classes.dex files...",
      "[TerminAI CI Compiler] Assembling resources using aapt2...",
      "[TerminAI CI Compiler] Packaging assets inside simulated APK artifact...",
      "[TerminAI CI Compiler] Build completed gracefully. Simulated APK artifact generated.",
    ];

    let currentStep = 0;
    const interval = window.setInterval(() => {
      if (currentStep < logStatements.length) {
        setCompileLogs((prev) => [...prev, logStatements[currentStep]]);
        setCompileProgress(Math.floor(((currentStep + 1) / logStatements.length) * 100));
        currentStep++;
      } else {
        window.clearInterval(interval);
        setCompiling(false);
        setCompileSuccess(true);
        if (onSendCommand) {
          onSendCommand(`echo "=== Simulated Android compilation for ${packageName || "io.terminai.app"} finished ===" && touch "${safeApkName}" && ls -la "${safeApkName}"`);
        }
      }
    }, 450);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-white/50 font-mono text-xs">
        <RefreshCw className="w-5 h-5 mr-2 animate-spin text-emerald-400" />
        Synchronizing first-class TerminAI Device & API systems...
      </div>
    );
  }

  return (
    <div id="device-build-status-wrapper" className="space-y-4 animate-fadeIn">
      <div className="bg-[#101012] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-white/90 text-sm font-semibold uppercase tracking-wider font-display flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Device, Build & Telemetry Control
          </h1>
          <p className="text-[11px] text-white/40 mt-1 leading-normal font-sans">
            Absorbs API capabilities, permission registers, and Android build telemetry under one unified runtime.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-1 px-3 bg-[#1A1A1E] text-white/60 hover:text-emerald-500 rounded border border-white/5 font-sans font-bold text-[10px] flex items-center gap-1 cursor-pointer transition"
        >
          <RefreshCw className="w-3 h-3" /> Quick Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center gap-1.5">
              <Power className="w-4 h-4 text-emerald-500" /> API Platform Capabilities
            </h3>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg flex items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 uppercase block font-bold">Battery Status</span>
                  <span className="text-xs text-white font-bold">{data?.device.batteryLevel}% {data?.device.isCharging ? "(Charging)" : "(Discharging)"}</span>
                  <span className="text-[9px] text-white/30 block">Temp: {data?.device.batteryTemperature}</span>
                </div>
                {data?.device.isCharging ? <BatteryCharging className="w-7 h-7 text-emerald-400 animate-pulse shrink-0" /> : <Battery className="w-7 h-7 text-emerald-400 shrink-0" />}
              </div>

              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg flex items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 uppercase block font-bold">Network SSID</span>
                  <span className="text-xs text-white font-bold truncate max-w-[110px] block">{data?.device.networkSsid}</span>
                  <span className="text-[9px] text-[#10b981] block">Local Bridge Link</span>
                </div>
                <Network className="w-6 h-6 text-emerald-400 shrink-0" />
              </div>

              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg">
                <span className="text-[9px] text-white/40 uppercase block font-bold">Android SDK Platform</span>
                <span className="text-xs text-white font-bold">API Level {data?.device.systemSdk}</span>
                <span className="text-[9px] text-white/30 block mt-0.5">Native runtime target</span>
              </div>

              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg">
                <span className="text-[9px] text-white/40 uppercase block font-bold">Core CPU Architecture</span>
                <span className="text-xs text-white font-bold uppercase">{data?.device.cpuArch}</span>
                <span className="text-[9px] text-white/30 block mt-0.5">{data?.device.manufacturer} {data?.device.brand}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1 p-0.5">
                <Clipboard className="w-3.5 h-3.5" /> Simulated Clipboard Reader/Writer
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={clipboardVal}
                  onChange={(e) => setClipboardVal(e.target.value)}
                  placeholder="Set simulated device clipboard state..."
                  className="flex-1 bg-[#0E0E10] border border-white/5 rounded-md px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={handleSaveTelemetry}
                  disabled={saving}
                  className="bg-[#1A1A1E] hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-800 text-emerald-400 text-[10px] font-bold px-3 py-1 cursor-pointer rounded-md transition"
                >
                  Set CB
                </button>
              </div>
              <span className="text-[9px] text-white/30 leading-snug block">
                Simulates programmatic clipboard hooks while the native Android API bridge is being designed.
              </span>
            </div>
          </div>

          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> API Permission Registers</span>
              <span className="text-[9px] text-white/30 uppercase font-normal">Click status tag to toggle</span>
            </h3>
            <div className="space-y-2">
              {[
                { key: "camera", name: "Camera Hardware access", desc: "For barcode scanner and video captures" },
                { key: "gps", name: "High-accuracy GPS Location", desc: "Provides geographical coordinates" },
                { key: "microphone", name: "Audio Recorder & Mic Input", desc: "For voice optimized commands" },
                { key: "storage", name: "External Storage directories", desc: "Access to shared folders" },
              ].map((permission) => {
                const statusValue = data?.device.permissions[permission.key as keyof DeviceInfo["permissions"]];
                return (
                  <div key={permission.key} className="flex items-center justify-between p-2.5 bg-[#101012] border border-white/5 rounded-lg hover:border-white/10 transition">
                    <div>
                      <h4 className="text-[11px] text-white font-semibold">{permission.name}</h4>
                      <p className="text-[9px] text-white/35 font-normal mt-0.5">{permission.desc}</p>
                    </div>
                    <button
                      onClick={() => handleTogglePermission(permission.key as keyof DeviceInfo["permissions"])}
                      className={`text-[9px] font-bold uppercase rounded px-2.5 py-1 border transition cursor-pointer select-none ${
                        statusValue === "granted" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" : statusValue === "denied" ? "bg-rose-950/40 text-rose-400 border-rose-900/60" : "bg-amber-950/40 text-amber-400 border-amber-900/60"
                      }`}
                    >
                      {statusValue || "prompt"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><FileJson className="w-4 h-4 text-emerald-500" /> Artifact Telemetry Spec</span>
              <span className="text-[9px] text-white/30">terminai_telemetry.json</span>
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">App Display Name
                  <input type="text" value={appName} onChange={(e) => setAppName(e.target.value)} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">App Package Bundle ID
                  <input type="text" value={packageName} onChange={(e) => setPackageName(e.target.value)} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">Version Name
                  <input type="text" value={versionName} onChange={(e) => setVersionName(e.target.value)} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">Version Code
                  <input type="number" value={versionCode} onChange={(e) => setVersionCode(Number(e.target.value))} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">Min Android SDK
                  <input type="number" value={minSdkVersion} onChange={(e) => setMinSdkVersion(Number(e.target.value))} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">Target Android SDK
                  <input type="number" value={targetSdkVersion} onChange={(e) => setTargetSdkVersion(Number(e.target.value))} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50" />
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] text-white/40 block font-bold">Compile Target ABIs</label>
                <div className="flex gap-1 bg-[#101012] border border-white/5 p-1 rounded-lg">
                  {["arm64-v8a", "armeabi-v7a", "x86_64", "x86"].map((abi) => {
                    const active = selectedAbis.includes(abi);
                    return (
                      <button key={abi} type="button" onClick={() => handleToggleAbi(abi)} className={`flex-1 py-1 text-center rounded-md text-[9px] uppercase font-bold transition cursor-pointer select-none ${active ? "bg-emerald-500 text-black shadow-sm" : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}>
                        {abi}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-[9px] text-white/40 block font-bold">Build Mode Profile
                  <select value={buildProfile} onChange={(e) => setBuildProfile(e.target.value)} className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="Debug">Debug Mode</option>
                    <option value="Release">Release Mode</option>
                  </select>
                </label>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Output APK Name</label>
                  <div className="bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white/40 font-semibold truncate leading-tight select-all">
                    {safeArtifactSegment(appName, "terminai")}-{safeArtifactSegment(buildProfile, "debug")}-v{safeArtifactSegment(versionName, "0.1.0")}.apk
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[9px] text-white/30 italic">Changes save directly in workspace disk.</span>
                <button type="button" onClick={handleSaveTelemetry} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] py-1.5 px-3.5 rounded-md transition flex items-center gap-1 cursor-pointer select-none">
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : saveSuccess ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {saving ? "Registering..." : saveSuccess ? "Export Success" : "Export Telemetry Spec"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3.5">
              <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-500" /> Embedded Compiler Sandbox
              </h3>
              <button onClick={handleTriggerBuildCompiler} disabled={compiling} className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-800/60 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition flex items-center gap-1 disabled:opacity-50">
                {compiling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {compiling ? "Compiling" : "Simulate Build"}
              </button>
            </div>
            <div className="h-2 bg-[#101012] rounded-full overflow-hidden border border-white/5 mb-3">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${compileProgress}%` }} />
            </div>
            <div className="bg-[#050505] border border-white/5 rounded-lg p-3 h-44 overflow-y-auto font-mono text-[10px] text-white/50 space-y-1">
              {compileLogs.length === 0 ? <div className="text-white/25">Build simulation output will appear here.</div> : compileLogs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>)}
              {compileSuccess && <div className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Simulated artifact registered.</div>}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[9px] text-white/30">
              <Download className="w-3 h-3" /> This is a prototype status panel. Real Android/APK compilation should move behind an explicit native build worker.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
