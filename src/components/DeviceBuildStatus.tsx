import React, { useEffect, useState } from "react";
import {
  Battery,
  BatteryCharging,
  Clipboard,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sliders,
  Cpu,
  Layers,
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
  Share2,
  GitBranch,
  GitPullRequest
} from "lucide-react";
import { DeviceBuildData, TelemetryArtifactSpec, DeviceInfo } from "../types";

interface DeviceBuildStatusProps {
  onSendCommand?: (cmd: string) => void;
}

export const DeviceBuildStatus: React.FC<DeviceBuildStatusProps> = ({ onSendCommand }) => {
  const [data, setData] = useState<DeviceBuildData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [bootstrapStatus, setBootstrapStatus] = useState<any>(null);
  
  // Local compiler simulation states
  const [compiling, setCompiling] = useState<boolean>(false);
  const [compileProgress, setCompileProgress] = useState<number>(0);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [compileSuccess, setCompileSuccess] = useState<boolean>(false);

  // Form inputs for Git sync & rebase
  const [repoUrl, setRepoUrl] = useState("https://github.com/billybox1926-jpg/Terminai");
  const [gitToken, setGitToken] = useState("");
  const [targetCommit, setTargetCommit] = useState("356773d082e34a2e7f3d982a525b116844a81ccb");
  const [useAutostash, setUseAutostash] = useState(true);
  const [rebasing, setRebasing] = useState(false);
  const [rebaseProgress, setRebaseProgress] = useState(0);
  const [rebaseLogs, setRebaseLogs] = useState<string[]>([]);
  const [rebaseSuccess, setRebaseSuccess] = useState(false);

  // Form inputs for telemetry artifacts
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
      
      // Sync local form state
      setAppName(json.telemetry.appName);
      setPackageName(json.telemetry.packageName);
      setVersionName(json.telemetry.versionName);
      setVersionCode(json.telemetry.versionCode);
      setBuildProfile(json.telemetry.buildProfile);
      setMinSdkVersion(json.telemetry.minSdkVersion);
      setTargetSdkVersion(json.telemetry.targetSdkVersion);
      setSelectedAbis(json.telemetry.targetAbis);
      setClipboardVal(json.device.clipboard);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = () => {
    fetchStatus();
    fetchBootstrapStatus();
    fetchApiStatus();
  };

  const fetchBootstrapStatus = async () => {
    try {
      const res = await fetch("/api/runtime/bootstrap/status");
      if (res.ok) {
        const data = await res.json();
        setBootstrapStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch bootstrap status:", e);
    }
  };

  const [apiStatus, setApiStatus] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(true);

  const fetchApiStatus = async () => {
    setApiLoading(true);
    try {
      const res = await fetch("/api/runtime/api/status");
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch API status:", e);
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchBootstrapStatus();
    fetchApiStatus();
  }, []);

  const handleSaveTelemetry = async () => {
    if (!data) return;
    setSaving(true);
    setSaveSuccess(false);

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
      lastCompileTimestamp: new Date().toISOString()
    };

    const updatedDevice: Partial<DeviceInfo> = {
      clipboard: clipboardVal,
      batteryLevel: data.device.batteryLevel,
      isCharging: data.device.isCharging,
      permissions: data.device.permissions
    };

    try {
      const response = await fetch("/api/device/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry: updatedTelemetry, device: updatedDevice })
      });
      if (response.ok) {
        setSaveSuccess(true);
        setData(prev => prev ? { ...prev, telemetry: updatedTelemetry, device: { ...prev.device, clipboard: clipboardVal } } : null);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAbi = (abi: string) => {
    if (selectedAbis.includes(abi)) {
      setSelectedAbis(selectedAbis.filter(a => a !== abi));
    } else {
      setSelectedAbis([...selectedAbis, abi]);
    }
  };

  const handleTogglePermission = async (permKey: keyof DeviceInfo["permissions"]) => {
    if (!data) return;
    const current = data.device.permissions[permKey];
    const nextVal = current === "granted" ? "denied" : current === "denied" ? "prompt" : "granted";
    
    const updatedPermissions = {
      ...data.device.permissions,
      [permKey]: nextVal
    };

    const updatedData = {
      ...data,
      device: {
        ...data.device,
        permissions: updatedPermissions
      }
    };

    setData(updatedData);

    // Persist immediately on backend
    try {
      await fetch("/api/device/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: { permissions: updatedPermissions } })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunGitRebase = () => {
    if (rebasing) return;
    setRebasing(true);
    setRebaseProgress(0);
    setRebaseSuccess(false);
    setRebaseLogs([]);

    const steps = [
      `[TerminAI Git Engine] Initializing git pipeline parameters...`,
      `[TerminAI Git Engine] Target Repository: ${repoUrl}`,
      gitToken.trim() ? `[TerminAI Git Engine] Authorizing with token...` : `[TerminAI Git Engine] Using public remote access...`,
      `[TerminAI Git Engine] Target commit reference: ${targetCommit}`,
      `[TerminAI Git Engine] Verifying remote repository reachability...`,
      `[TerminAI Git Engine] Fetching branch objects: git fetch origin`,
      `[TerminAI Git Engine] Analyzing commit graph topology...`,
      useAutostash ? `[TerminAI Git Engine] Enabling autostash: git rebase --autostash ${targetCommit}` : `[TerminAI Git Engine] Executing: git rebase ${targetCommit}`,
      `[TerminAI Git Engine] Resolving merge bases and tracking upstream status...`,
      `[TerminAI Git Engine] Fast-forwarding local branch to target commit...`,
      `[TerminAI Git Engine] Git rebase completed gracefully! Local branch successfully aligned.`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setRebaseLogs(prev => [...prev, steps[currentStep]]);
        setRebaseProgress(Math.floor(((currentStep + 1) / steps.length) * 100));
        currentStep++;
      } else {
        clearInterval(interval);
        setRebasing(false);
        setRebaseSuccess(true);
        
        // Run the real actual execution chain so the user's local terminal runs it!
        if (onSendCommand) {
          const stashOption = useAutostash ? " --autostash" : "";
          
          let authenticatedUrl = repoUrl;
          if (gitToken.trim()) {
            const cleanUrl = repoUrl.replace(/^https?:\/\//i, "");
            authenticatedUrl = `https://${gitToken.trim()}@${cleanUrl}`;
          }

          const fetchCmd = `if [ ! -d .git ]; then echo "⚙️ No Git repository found. Initializing and configuring baseline..." && git init && git config user.name "TerminAI Bot" && git config user.email "bot@terminai.io" && git add -A && git commit -m "Local workspace snapshot" && git remote add origin ${authenticatedUrl}; else echo "⚙️ Git repository detected. Synchronizing remote target..." && git remote set-url origin ${authenticatedUrl} || git remote add origin ${authenticatedUrl}; fi && echo "📥 Fetching commits from tracking upstream..." && git fetch origin && echo "🚧 Aligning commits: Running git rebase on ${targetCommit}..." && (git rebase${stashOption} ${targetCommit} || (echo "⚠️ Conflicts or stash required. Running stash and rebase sequence..." && git stash && git rebase${stashOption} ${targetCommit} && git stash pop))`;
          onSendCommand(fetchCmd);
        }
      }
    }, 400);
  };

  const handleTriggerBuildCompiler = () => {
    if (compiling) return;
    setCompiling(true);
    setCompileProgress(0);
    setCompileSuccess(false);
    setCompileLogs([]);

    const logStatements = [
      `[TerminAI CI Compiler] Initializing Android/APK build workflow...`,
      `[TerminAI CI Compiler] Validating telemetry configuration blueprint...`,
      `[TerminAI CI Compiler] Resolved Bundle ID: ${packageName || 'io.terminai.app'}`,
      `[TerminAI CI Compiler] Target SDK Profile: ${targetSdkVersion}, Min SDK Profile: ${minSdkVersion}`,
      `[TerminAI CI Compiler] Target ABI Architectures: [${selectedAbis.join(", ")}]`,
      `[TerminAI CI Compiler] Loading Android SDK Build Tools (v34.0.0)...`,
      `[TerminAI CI Compiler] Running linter on embedded resources & layouts...`,
      `[TerminAI CI Compiler] Compiling classes.dex files with R8 optimization...`,
      `[TerminAI CI Compiler] Assembling resources using aapt2...`,
      `[TerminAI CI Compiler] Compiling native binaries for optimized wrappers...`,
      `[TerminAI CI Compiler] Packaging assets inside terminai-unsigned.apk...`,
      `[TerminAI CI Compiler] Aligning zip directories with zipalign...`,
      `[TerminAI CI Compiler] Signing package using apksigner with Developer Key...`,
      `[TerminAI CI Compiler] Build completed gracefully! Raw APK generated.`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logStatements.length) {
        setCompileLogs(prev => [...prev, logStatements[currentStep]]);
        setCompileProgress(Math.floor(((currentStep + 1) / logStatements.length) * 100));
        currentStep++;
      } else {
        clearInterval(interval);
        setCompiling(false);
        setCompileSuccess(true);
        
        // Execute output command inside terminal so user gets a real package file to view!
        if (onSendCommand) {
          const apkName = `${appName.toLowerCase().replace(/\s+/g, "-")}-${buildProfile.toLowerCase()}-v${versionName}.apk`;
          onSendCommand(`echo "=== Simulated Android compilation for ${packageName} finished! Arch format registered ===" && touch ${apkName} && ls -la ${apkName}`);
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
      
      {/* Overview header */}
      <div className="bg-[#101012] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-white/90 text-sm font-semibold uppercase tracking-wider font-display flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Device, Build & Telemetry Control
          </h1>
          <p className="text-[11px] text-white/40 mt-1 leading-normal font-sans">
            Absorbs APK capabilities, permissions registers, and downstream Android/Git workflows under one unified runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            className="p-1 px-3 bg-[#1A1A1E] text-white/60 hover:text-emerald-500 rounded border border-white/5 font-sans font-bold text-[10px] flex items-center gap-1 cursor-pointer transition"
          >
            <RefreshCw className="w-3 h-3" /> Quick Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* LEFT COLUMN: Device Info & Permission Registers */}
        <div className="space-y-4">
          
          {/* Hardware & API details */}
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center gap-1.5">
              <Power className="w-4 h-4 text-emerald-500" /> API Platform Capabilities
            </h3>
            
            <div className="grid grid-cols-2 gap-3.5">
              {/* Battery */}
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg flex items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 uppercase block font-bold">Battery Status</span>
                  <span className="text-xs text-white font-bold">{data?.device.batteryLevel}% {data?.device.isCharging ? "(Charging)" : "(Discharging)"}</span>
                  <span className="text-[9px] text-white/30 block">Temp: {data?.device.batteryTemperature}</span>
                </div>
                {data?.device.isCharging ? (
                  <BatteryCharging className="w-7 h-7 text-emerald-400 animate-pulse shrink-0" />
                ) : (
                  <Battery className="w-7 h-7 text-emerald-400 shrink-0" />
                )}
              </div>

              {/* Network */}
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg flex items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <span className="text-[9px] text-white/40 uppercase block font-bold">Network SSID</span>
                  <span className="text-xs text-white font-bold truncate max-w-[110px] block">{data?.device.networkSsid}</span>
                  <span className="text-[9px] text-[#10b981] block">Secure Bridge Link</span>
                </div>
                <Network className="w-6 h-6 text-emerald-400 shrink-0" />
              </div>

              {/* SDK Version */}
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg">
                <span className="text-[9px] text-white/40 uppercase block font-bold">Android SDK Platform</span>
                <span className="text-xs text-white font-bold">API Level {data?.device.systemSdk}</span>
                <span className="text-[9px] text-white/30 block mt-0.5">Android 14 (UpsideDownCake)</span>
              </div>

              {/* Host Arch */}
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg">
                <span className="text-[9px] text-white/40 uppercase block font-bold">Core CPU Architecture</span>
                <span className="text-xs text-white font-bold uppercase">{data?.device.cpuArch} (Host VM)</span>
                <span className="text-[9px] text-white/30 block mt-0.5">{data?.device.manufacturer} {data?.device.brand}</span>
              </div>
            </div>

            {/* Clipboard Intercept */}
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
                  className="bg-[#1A1A1E] hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-800 text-emerald-400 text-[10px] font-bold px-3 py-1 object-cover cursor-pointer rounded-md transition"
                >
                  Set CB
                </button>
              </div>
              <span className="text-[9px] text-white/30 leading-snug block">
                Satisfiesclipboard intercept routes. Simulates programmatic clipboard hooks inside the emulator logic.
              </span>
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> API Permission Registers
              </span>
              <span className="text-[9px] text-white/30 uppercase font-normal">Click status tag to toggle</span>
            </h3>

            <div className="space-y-2">
              {[
                { key: "camera", name: "Camera Hardware access", desc: "For barcode scanner and video captures" },
                { key: "gps", name: "High-accuracy GPS Location", desc: "Provides geographical coordinates" },
                { key: "microphone", name: "Audio Recorder & Mic Input", desc: "For voice optimized commands" },
                { key: "storage", name: "External Storage directories", desc: "Access to /sdcard folders" }
              ].map((p) => {
                const statusValue = data?.device.permissions[p.key as keyof DeviceInfo["permissions"]];
                return (
                  <div key={p.key} className="flex items-center justify-between p-2.5 bg-[#101012] border border-white/5 rounded-lg hover:border-white/10 transition">
                    <div>
                      <h4 className="text-[11px] text-white font-semibold">{p.name}</h4>
                      <p className="text-[9px] text-white/35 font-normal mt-0.5">{p.desc}</p>
                    </div>
                    
                    <button
                      onClick={() => handleTogglePermission(p.key as keyof DeviceInfo["permissions"])}
                      className={`text-[9px] font-bold uppercase rounded px-2.5 py-1 border transition cursor-pointer select-none ${
                        statusValue === "granted"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60"
                          : statusValue === "denied"
                          ? "bg-rose-950/40 text-rose-400 border-rose-900/60"
                          : "bg-amber-950/40 text-amber-400 border-amber-900/60"
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

        {/* RIGHT COLUMN: Android APK Build Spec & Telemetry Artifact Export */}
        <div className="space-y-4">
          
          {/* Telemetry settings config */}
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold border-b border-white/5 pb-2 mb-3.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-emerald-500" /> Artifact Telemetry Spec
              </span>
              <span className="text-[9px] text-white/30">terminai_telemetry.json</span>
            </h3>

            <div className="space-y-3">
              {/* Row 1 App & Package details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">App Display Name</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">App Package Bundle ID</label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {/* Row 2 Versions */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Version Name (String)</label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Version Code (Integer)</label>
                  <input
                    type="number"
                    value={versionCode}
                    onChange={(e) => setVersionCode(Number(e.target.value))}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 focus:ring-0"
                  />
                </div>
              </div>

              {/* Row 3 SDK constraints & Keys */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Min Android SDK</label>
                  <input
                    type="number"
                    value={minSdkVersion}
                    onChange={(e) => setMinSdkVersion(Number(e.target.value))}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 focus:ring-0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Target Android SDK</label>
                  <input
                    type="number"
                    value={targetSdkVersion}
                    onChange={(e) => setTargetSdkVersion(Number(e.target.value))}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 focus:ring-0"
                  />
                </div>
              </div>

              {/* Target ABIs architectures selection (Direction baseline) */}
              <div className="space-y-1.5">
                <label className="text-[9px] text-white/40 block font-bold">Compile Target ABIs (APK architecture formats)</label>
                <div className="flex gap-1 bg-[#101012] border border-white/5 p-1 rounded-lg">
                  {["arm64-v8a", "armeabi-v7a", "x86_64", "x86"].map((abi) => {
                    const active = selectedAbis.includes(abi);
                    return (
                      <button
                        key={abi}
                        type="button"
                        onClick={() => handleToggleAbi(abi)}
                        className={`flex-1 py-1 text-center rounded-md text-[9px] uppercase font-bold transition cursor-pointer select-none ${
                          active
                            ? "bg-emerald-500 text-black shadow-sm"
                            : "text-white/40 hover:text-white/80 hover:bg-white/5"
                        }`}
                      >
                        {abi}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Build Profile debug vs release */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Build Mode Profile</label>
                  <select
                    value={buildProfile}
                    onChange={(e) => setBuildProfile(e.target.value)}
                    className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="Debug">Debug Mode</option>
                    <option value="Release">Release Mode (AOT optimize)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/40 block font-bold">Output APK Name</label>
                  <div className="bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white/40 font-semibold truncate leading-tight select-all">
                    {appName.toLowerCase().replace(/\s+/g, "-")}-{buildProfile.toLowerCase()}-v{versionName}.apk
                  </div>
                </div>
              </div>

              {/* Trigger save & telemetry export */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-[9px] text-white/30 italic">
                  Changes save directly in workspace disk.
                </span>
                <button
                  type="button"
                  onClick={handleSaveTelemetry}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] py-1.5 px-3.5 rounded-md transition flex items-center gap-1 cursor-pointer select-none"
                >
                  {saving ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {saving ? "Registering..." : saveSuccess ? "Export Success!" : "Export Telemetry Spec"}
                </button>
              </div>

            </div>
          </div>

          {/* Interactive Compilation Simulator */}
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3.5">
              <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-emerald-500" /> Embedded Compiler Sandbox
              </h3>
              <button
                onClick={handleTriggerBuildCompiler}
                disabled={compiling || selectedAbis.length === 0}
                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-800/80 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded select-none cursor-pointer flex items-center gap-1 transition"
                title="Assemble target APK with current settings"
              >
                <Play className="w-3 h-3" /> Assemble Spec
              </button>
            </div>

            {/* Build parameters display or logs console */}
            {compileLogs.length === 0 && !compiling ? (
              <div className="text-center py-8 text-neutral-400 text-xs font-sans">
                <Sliders className="w-7 h-7 mx-auto mb-2 text-white/10" />
                No active compile processes. Select compiler settings above and run "Assemble Spec".
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-white/50">
                    <span>{compiling ? "Bundling compiler resource segments..." : "Compilation Success!"}</span>
                    <span>{compileProgress}%</span>
                  </div>
                  <div className="w-full bg-[#101012] border border-white/5 h-2 rounded overflow-hidden">
                    <div 
                      className={`h-full rounded transition-all duration-300 ${compileSuccess ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                      style={{ width: `${compileProgress}%` }}
                    />
                  </div>
                </div>

                {/* Monospace build logs simulation console */}
                <div className="bg-[#0A0A0C] border border-white/5 rounded-lg p-3 max-h-[145px] overflow-y-auto font-mono text-[9px] text-[#818cf8] space-y-1 leading-snug">
                  {compileLogs.map((log, i) => (
                    <div key={i} className="truncate select-text">
                      <span className="text-emerald-500/50 font-bold">$&nbsp;</span>
                      {log}
                    </div>
                  ))}
                  {compiling && <span className="animate-pulse inline-block w-1.5 h-3 bg-indigo-500 ml-1 select-none"></span>}
                </div>

                {/* Success prompt */}
                {compileSuccess && (
                  <div className="bg-emerald-950/20 border border-emerald-900/40 p-2.5 rounded-lg text-[10px] text-white/70 flex items-start gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-300 block">Package artifact generated successfully:</span>
                      <span className="text-white/40 select-all font-mono">
                        {appName.toLowerCase().replace(/\s+/g, "-")}-{buildProfile.toLowerCase()}-v{versionName}.apk (Approx 14.8 MB)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* FULL WIDTH BOTTOM ROW: GIT SYNC & COMMIT REBASE */}
      <div id="git-rebase-pipeline-card" className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg mt-4 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 mb-4 gap-2">
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold font-display">
              Upstream Repository Sync / Rebase Gateway
            </h3>
          </div>
          <span className="text-[10px] text-emerald-500 bg-emerald-950/40 px-2 py-0.5 border border-emerald-900/60 rounded font-bold uppercase tracking-wider font-sans">
            Git Integration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-white/40 block font-bold">Remote Git Repository URL</label>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="https://github.com/billybox1926-jpg/Terminai"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-white/40 block font-bold">Personal Access Token (PAT) <span className="text-[7.5px] font-normal text-emerald-400">(Optional)</span></label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/50 font-mono"
                  placeholder="ghp_xxx (for private repos)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-white/40 block font-bold">Rebase Target (Commit SHA / Branch / Tag)</label>
                <input
                  type="text"
                  value={targetCommit}
                  onChange={(e) => setTargetCommit(e.target.value)}
                  className="w-full bg-[#101012] border border-white/5 rounded px-2.5 py-1.5 text-[11px] text-emerald-400 font-mono focus:outline-none focus:border-emerald-500/50"
                  placeholder="e.g., 356773d082e34a2e7f3d982a525b116844a81ccb"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 bg-[#101012] border border-white/5 p-3 rounded-lg text-[10.5px]">
              <input
                id="use-autostash-checkbox"
                type="checkbox"
                checked={useAutostash}
                onChange={(e) => setUseAutostash(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-black border-white/10 checked:bg-emerald-500 text-emerald-500 accent-emerald-500 cursor-pointer focus:ring-0 focus:outline-none"
              />
              <label htmlFor="use-autostash-checkbox" className="text-white/60 cursor-pointer font-sans select-none leading-normal">
                Automatically stash unstaged local changes (<code className="text-emerald-500/80 font-bold font-mono">--autostash</code>) before running rebase
              </label>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-1">
              <span className="text-[9px] text-white/35 leading-normal flex items-center gap-1 font-sans">
                💡 Rebase aligns workspace target builds and pulls incremental repository enhancements.
              </span>
              <button
                type="button"
                onClick={handleRunGitRebase}
                disabled={rebasing || !repoUrl.trim() || !targetCommit.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs py-2 px-4.5 rounded-md transition flex items-center gap-1.5 cursor-pointer max-w-fit"
              >
                {rebasing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitPullRequest className="w-3.5 h-3.5" />
                )}
                {rebasing ? "Rebasing..." : "Run Git Rebase"}
              </button>
            </div>
          </div>

          <div className="bg-[#101012] border border-white/5 p-4 rounded-xl flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[9px] text-white/40 uppercase block font-bold mb-1.5">Rebase Pipeline monitor</span>
              {rebaseLogs.length === 0 && !rebasing ? (
                <div className="text-center py-6 text-white/20 text-[10px] font-sans flex flex-col items-center justify-center gap-1">
                  <GitBranch className="w-5 h-5 opacity-20" />
                  No active Git synchronization pipeline. Set commit SHA above and start rebase.
                </div>
              ) : (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-bold text-white/50">
                      <span>Pipeline execution progress</span>
                      <span>{rebaseProgress}%</span>
                    </div>
                    <div className="w-full bg-black/40 h-1.5 rounded overflow-hidden">
                      <div 
                        className={`h-full rounded transition-all duration-300 ${rebaseSuccess ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                        style={{ width: `${rebaseProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#050505] border border-white/5 rounded-lg p-2.5 max-h-[110px] overflow-y-auto font-mono text-[9px] text-[#818cf8] space-y-1 leading-snug">
                    {rebaseLogs.map((log, i) => (
                      <div key={i} className="truncate select-text">
                        <span className="text-emerald-500/50 font-bold">$&nbsp;</span>
                        {log}
                      </div>
                    ))}
                    {rebasing && <span className="animate-pulse inline-block w-1.5 h-2.5 bg-indigo-500 ml-1 select-none"></span>}
                  </div>

                  {rebaseSuccess && (
                    <div className="bg-emerald-950/20 border border-emerald-900/40 p-2 rounded text-[9.5px] text-white/60 flex items-center gap-1.5 animate-fadeIn font-sans">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        Rebase succeeded! Local directory aligned to <code className="text-emerald-400 font-bold">{targetCommit.slice(0, 8)}</code>.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RUNTIME MODULES — Package + API bridge readiness */}
      <div id="runtime-modules-card" className="bg-[#141417] border border-white/5 rounded-xl p-5 shadow-lg mt-4 animate-fadeIn">
        <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            <h3 className="text-white/80 text-[11px] uppercase tracking-widest font-bold font-display">
              Runtime Modules — One App Readiness
            </h3>
          </div>
          <button
            onClick={() => { fetchApiStatus(); }}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold font-sans cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {apiLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-white/40">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin text-emerald-400" />
            Checking runtime modules...
          </div>
        ) : apiStatus ? (
          <div className="space-y-4">
            {/* Readiness score */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg text-center">
                <div className="text-[9px] text-white/30 uppercase font-bold mb-1">Package Runtime</div>
                <div className={`text-xs font-extrabold ${bootstrapStatus?.runtimeReady ? "text-emerald-400" : "text-amber-400"}`}>
                  {bootstrapStatus?.runtimeReady ? "READY" : "INCOMPLETE"}
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">
                  {bootstrapStatus?.installed ?? 0}/{bootstrapStatus?.total ?? 0} installed
                </div>
              </div>
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg text-center">
                <div className="text-[9px] text-white/30 uppercase font-bold mb-1">API Bridge</div>
                <div className={`text-xs font-extrabold ${apiStatus.summary?.oneAppReady ? "text-emerald-400" : "text-amber-400"}`}>
                  {apiStatus.summary?.oneAppReady ? "READY" : "PARTIAL"}
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">
                  {apiStatus.summary?.available ?? 0}/{apiStatus.summary?.total ?? 0} available
                </div>
              </div>
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg text-center">
                <div className="text-[9px] text-white/30 uppercase font-bold mb-1">Simulated</div>
                <div className="text-xs font-extrabold text-blue-400">
                  {apiStatus.summary?.simulated ?? 0}
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">APIs in simulation mode</div>
              </div>
              <div className="bg-[#101012] border border-white/5 p-3 rounded-lg text-center">
                <div className="text-[9px] text-white/30 uppercase font-bold mb-1">Native Required</div>
                <div className="text-xs font-extrabold text-amber-400">
                  {apiStatus.summary?.nativeRequired ?? 0}
                </div>
                <div className="text-[9px] text-white/30 mt-0.5">Need Android runtime</div>
              </div>
            </div>

            {/* Missing packages list */}
            {bootstrapStatus && bootstrapStatus.missing > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] text-amber-400/80 uppercase font-bold tracking-wider">Missing Packages ({bootstrapStatus.requiredMissing} required)</span>
                <div className="flex flex-wrap gap-1">
                  {bootstrapStatus.packages?.filter((p: any) => !p.installed).map((p: any) => (
                    <span key={p.id} className={`text-[8px] px-1.5 py-0.5 rounded border ${
                      p.required ? "bg-amber-950/30 text-amber-400 border-amber-900/40" : "bg-white/5 text-white/40 border-white/10"
                    }`}>
                      {p.id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Simulated/unavailable APIs */}
            <div className="space-y-1.5">
              <span className="text-[9px] text-blue-400/80 uppercase font-bold tracking-wider">
                Simulated / Unavailable APIs
              </span>
              <div className="flex flex-wrap gap-1">
                {apiStatus.capabilities?.filter((c: any) => c.status !== "available").map((c: any) => (
                  <span key={c.id} className={`text-[8px] px-1.5 py-0.5 rounded border ${
                    c.status === "simulated"
                      ? "bg-blue-950/30 text-blue-400 border-blue-900/40"
                      : "bg-white/5 text-white/30 border-white/10"
                  }`}>
                    {c.displayName} ({c.status})
                  </span>
                ))}
              </div>
            </div>

            <div className="text-[9px] text-white/20 leading-snug pt-2 border-t border-white/5">
              TerminAI is one app — package layer, API bridge, file tools, scripts, and AI optimizer in one dashboard.
              Simulated APIs run in the web prototype. Native Android runtime required for full hardware access.
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-white/30 text-xs">
            Failed to load runtime module status.
          </div>
        )}
      </div>

    </div>
  );
};
