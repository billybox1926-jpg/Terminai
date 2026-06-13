import React, { useState } from "react";
import { Sliders, HelpCircle, Save, Check, RefreshCw, Volume2, Type } from "lucide-react";
import { TermuxProperties } from "../types";

interface TermuxSettingsProps {
  properties: TermuxProperties;
  onUpdateProperties: (props: TermuxProperties) => void;
  onSendCommand: (cmd: string) => void;
}

export const TermuxSettingsConsole: React.FC<TermuxSettingsProps> = ({
  properties,
  onUpdateProperties,
  onSendCommand,
}) => {
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Themes database matching standard Termux styling overlays
  const themesList = [
    { id: "elegant-dark", name: "Elegant Emerald", desc: "Dark charcoal with emerald phosphor" },
    { id: "gruvbox", name: "Gruvbox Retro", desc: "Cozy ochre with warm cream and yellow" },
    { id: "solarized", name: "Solarized Ocean", desc: "Deep wash water-teal with cyan" },
    { id: "cyberpunk", name: "Cyberpunk Hacker", desc: "Synthetic indigo with hot neon pink" },
    { id: "monokai", name: "Monokai Pro", desc: "Volcanic ash with bright magenta" },
    { id: "matrix", name: "Matrix Phosphor", desc: "Pitch black with active green lines" },
  ];

  const handleThemeChange = (themeId: any) => {
    onUpdateProperties({
      ...properties,
      terminalTheme: themeId,
    });
  };

  const handleCursorChange = (cursor: any) => {
    onUpdateProperties({
      ...properties,
      cursorStyle: cursor,
    });
  };

  const handleFontSizeChange = (size: number) => {
    onUpdateProperties({
      ...properties,
      fontSize: size,
    });
  };

  const handleBellChange = (bellValue: any) => {
    onUpdateProperties({
      ...properties,
      bell: bellValue,
    });
  };

  const saveToSystemProperties = async () => {
    setSavingConfig(true);
    setSaveSuccess(false);
    try {
      // Replicate the real ~/.termux/termux.properties config writer
      const configLines = [
        `# Termux properties fully cannibalized & exported`,
        `bell-character=${properties.bell}`,
        `cursor-style=${properties.cursorStyle}`,
        `font-size=${properties.fontSize}`,
        `theme=${properties.terminalTheme}`,
        `terminal-bell-sound-enabled=${properties.bell !== "silent"}`,
        `back-key-behaviour=back`,
        `shortcut-keys=ctrl,alt,tab,esc`,
      ].join("\\n");

      // We run commands directly through terminal transmission
      const shellCommand = `mkdir -p .termux && printf "${configLines}" > .termux/termux.properties && echo "Termux configurations updated inside .termux/termux.properties file"`;
      onSendCommand(shellCommand);
      
      setTimeout(() => {
        setSavingConfig(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }, 1000);
    } catch (err) {
      console.error(err);
      setSavingConfig(false);
    }
  };

  return (
    <div id="termux-properties-panel" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none shadow-xl">
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">Termux Config Properties</h2>
        </div>
        <div className="text-[10px] text-white/30 hidden sm:block">~/.termux/termux.properties</div>
      </div>

      <div className="space-y-4">
        {/* Termux Theme Presets */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Color Schemes Preset
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
            {themesList.map((t) => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`text-[10px] py-2 px-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between h-14 ${
                  properties.terminalTheme === t.id
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/45 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-bold"
                    : "bg-[#0A0A0C] text-white/50 border-white/5 hover:text-white/80 hover:bg-[#121215]"
                }`}
              >
                <span>{t.name}</span>
                <span className="text-[8px] text-white/20 whitespace-normal line-clamp-1 truncate font-normal leading-tight">
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Font size selectors and Cursor styling options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Cursor Options */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1">
              <Type className="w-3.5 h-3.5" /> Cursor Style
            </label>
            <div className="flex gap-1 bg-[#0A0A0C] border border-white/5 p-1 rounded-lg">
              {(["block", "underline", "bar"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => handleCursorChange(type)}
                  className={`flex-1 py-1.5 text-center rounded-md text-[10px] uppercase font-bold transition cursor-pointer ${
                    properties.cursorStyle === type
                      ? "bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Font size and Bell Sound selectors */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 font-bold" /> Notification Bell sound
            </label>
            <div className="flex gap-1 bg-[#0A0A0C] border border-white/5 p-1 rounded-lg">
              {(["beep", "vibrate", "silent"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => handleBellChange(b)}
                  className={`flex-1 py-1.5 text-center rounded-md text-[10px] uppercase font-bold transition cursor-pointer ${
                    properties.bell === b
                      ? "bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Font scale buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0A0A0C] border border-white/5 p-3 rounded-lg pt-2 mt-1">
          <div>
            <div className="text-[10px] font-bold text-white/80">Terminal Font Scale</div>
            <div className="text-[9px] text-white/30">Currently running at {properties.fontSize}px</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleFontSizeChange(Math.max(10, properties.fontSize - 1))}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded border border-white/5 font-bold transition cursor-pointer"
            >
              -
            </button>
            <button
              onClick={() => handleFontSizeChange(12)}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded border border-white/5 text-[9px] tracking-wider transition cursor-pointer font-sans"
            >
              Reset
            </button>
            <button
              onClick={() => handleFontSizeChange(Math.min(22, properties.fontSize + 1))}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/80 rounded border border-white/10 font-bold transition cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* System configurations save action */}
        <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-[9px] text-white/30 flex items-center gap-1 max-w-[280px]">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Updates local .properties file and synchronizes active environment variables.</span>
          </div>

          <button
            onClick={saveToSystemProperties}
            disabled={savingConfig}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-xs py-2 px-4 rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.35)]"
          >
            {savingConfig ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {savingConfig ? "Synchronizing..." : saveSuccess ? "Saved to OS Disk!" : "Save termux.properties"}
          </button>
        </div>
      </div>
    </div>
  );
};
