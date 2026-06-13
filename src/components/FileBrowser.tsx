import React, { useState, useEffect } from "react";
import { Folder, File, ArrowLeft, Plus, FolderPlus, Trash2, RefreshCw, FileText, Upload, ChevronRight, CornerDownRight } from "lucide-react";
import { FileItem } from "../types";

interface FileBrowserProps {
  activeFolder: string; // The active shell CWD relative or absolute.
  onSelectFile: (filePath: string) => void;
  onActiveFolderChange: (folderPath: string) => void;
  refreshTrigger: number; // Increment to force refresh
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  activeFolder,
  onSelectFile,
  onActiveFolderChange,
  refreshTrigger
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentRelativeDir, setCurrentRelativeDir] = useState<string>(".");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / Inline forms
  const [showNewFolderForm, setShowNewFolderForm] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [showNewFileForm, setShowNewFileForm] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("");
  const [newFileContent, setNewFileContent] = useState<string>("");

  const loadFiles = async (targetDirectory: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/file-manager/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: targetDirectory })
      });

      if (!response.ok) {
        throw new Error("Could not listing target directory contents.");
      }

      const data = await response.json();
      setFiles(data.files);
      setCurrentRelativeDir(data.currentFolder || ".");
      onActiveFolderChange(data.currentFolder || ".");
    } catch (err: any) {
      setError(err.message || "Failed to load files.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(activeFolder);
  }, [activeFolder, refreshTrigger]);

  const handleFolderClick = (folderPath: string) => {
    loadFiles(folderPath);
  };

  const handleGoBack = () => {
    if (currentRelativeDir === "." || currentRelativeDir === "") return;
    const parts = currentRelativeDir.split("/");
    parts.pop();
    const parentDir = parts.join("/") || ".";
    loadFiles(parentDir);
  };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch("/api/file-manager/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dirPath: currentRelativeDir,
          name: newFolderName.trim()
        })
      });

      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || "Failed to create folder.");
      }

      setNewFolderName("");
      setShowNewFolderForm(false);
      loadFiles(currentRelativeDir);
    } catch (err: any) {
      alert(err.message || "Error creating directory.");
    }
  };

  const createNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const fullPath = currentRelativeDir === "." ? newFileName.trim() : `${currentRelativeDir}/${newFileName.trim()}`;

    try {
      const response = await fetch("/api/file-manager/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: fullPath,
          content: newFileContent
        })
      });

      if (!response.ok) {
        throw new Error("Failed to write new file");
      }

      setNewFileName("");
      setNewFileContent("");
      setShowNewFileForm(false);
      loadFiles(currentRelativeDir);
    } catch (err: any) {
      alert(err.message || "Error writing file.");
    }
  };

  const deletePath = async (targetPath: string, name: string) => {
    const confirmDelete = window.confirm(`Are you absolutely sure you want to delete "${name}"? This is irreversible.`);
    if (!confirmDelete) return;

    try {
      const response = await fetch("/api/file-manager/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath })
      });

      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.error || "Failed to delete item.");
      }

      loadFiles(currentRelativeDir);
    } catch (err: any) {
      alert(err.message || "Error deleting index path.");
    }
  };

  const isEditableFile = (filename: string) => {
    return /\.(ts|tsx|js|jsx|json|html|css|txt|md|example|env|yml|yaml|sh)$/i.test(filename);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div id="file-browser-container" className="bg-[#141417] border border-white/5 rounded-xl p-5 font-mono select-none flex flex-col h-full min-h-[400px] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Folder className="w-4 h-4 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
          <h2 className="text-xs font-semibold text-white/90 uppercase tracking-wider font-display">File Explorer Shelf</h2>
        </div>
        <button
          onClick={() => loadFiles(currentRelativeDir)}
          disabled={loading}
          className="p-1 hover:bg-white/5 text-white/40 hover:text-emerald-500 rounded transition cursor-pointer"
          title="Sync file structures"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Navigation Line */}
      <div className="flex items-center gap-2 mb-3 bg-[#0E0E10] p-2 border border-white/5 rounded-lg select-text shrink-0 text-xs">
        <button
          onClick={handleGoBack}
          disabled={currentRelativeDir === "." || currentRelativeDir === ""}
          className="p-1 disabled:opacity-40 hover:bg-[#1A1A1E] hover:text-emerald-400 text-white/70 rounded transition shrink-0 cursor-pointer"
          title="Go up folder"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="text-[10px] text-white/50 truncate flex items-center">
          <span className="text-emerald-500/70 font-bold mr-1">workspace/</span>
          {currentRelativeDir === "." || currentRelativeDir === "" ? (
            <span className="text-white/30 italic">root</span>
          ) : (
            <span className="text-emerald-400 font-bold">{currentRelativeDir}</span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-1 mb-3 shrink-0">
        <button
          onClick={() => {
            setShowNewFileForm(!showNewFileForm);
            setShowNewFolderForm(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 px-2 rounded-md font-bold transition border cursor-pointer ${
            showNewFileForm 
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-extrabold' 
              : 'bg-[#0E0E10] text-[#E0E0E0]/80 border-white/5 hover:bg-[#1A1A1E] hover:text-emerald-400'
          }`}
        >
          <Plus className="w-3 h-3" /> New File
        </button>

        <button
          onClick={() => {
            setShowNewFolderForm(!showNewFolderForm);
            setShowNewFileForm(false);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] py-1.5 px-2 rounded-md font-bold transition border cursor-pointer ${
            showNewFolderForm 
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-extrabold' 
              : 'bg-[#0E0E10] text-[#E0E0E0]/80 border-white/5 hover:bg-[#1A1A1E] hover:text-emerald-400'
          }`}
        >
          <FolderPlus className="w-3 h-3" /> New Dir
        </button>
      </div>

      {/* Inline Creation Forms */}
      {showNewFolderForm && (
        <form onSubmit={createFolder} className="bg-[#050505] border border-white/5 p-3 rounded-lg mb-3 space-y-2 shrink-0 animate-fadeIn">
          <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold">New Directory Name</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              required
              placeholder="e.g. assets, components"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 bg-[#0E0E10] border border-white/5 rounded-md px-2.5 py-1 text-xs text-white/90 focus:outline-none focus:border-emerald-500/50"
            />
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1 rounded-md text-[10px] cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)]">Create</button>
          </div>
        </form>
      )}

      {showNewFileForm && (
        <form onSubmit={createNewFile} className="bg-[#050505] border border-white/5 p-3 rounded-lg mb-3 space-y-2 shrink-0 animate-fadeIn">
          <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-bold font-sans">New File Creation</div>
          <input
            type="text"
            required
            placeholder="e.g. script.sh, notes.txt"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="w-full bg-[#0E0E10] border border-white/5 rounded-md px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-emerald-500/50"
          />
          <textarea
            placeholder="File code body..."
            value={newFileContent}
            onChange={(e) => setNewFileContent(e.target.value)}
            className="w-full h-16 bg-[#0E0E10] border border-white/5 rounded-md px-2.5 py-1.5 text-xs text-white/90 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
          <div className="flex justify-end gap-1.5 pt-1">
            <button 
              type="button" 
              onClick={() => setShowNewFileForm(false)} 
              className="text-white/40 hover:bg-white/5 px-3 py-1 rounded text-[10px]"
            >
              Cancel
            </button>
            <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1 rounded-md text-[10px] cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)]">Write File</button>
          </div>
        </form>
      )}

      {/* Files Display Shelf */}
      <div className="flex-1 overflow-y-auto bg-[#050505]/40 border border-white/5 rounded-lg p-2 mb-2 max-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-xs text-white/40">
            <div className="animate-spin rounded-full h-4 w-4 border-t border-emerald-400 border-r border-emerald-400 mr-2" />
            Crawling system files...
          </div>
        ) : error ? (
          <div className="p-3 text-center text-xs text-rose-400 leading-normal">
            {error}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-white/30 text-[11px] text-center p-4 leading-normal">
            <Plus className="w-5 h-5 text-white/10 mb-2" />
            Workspace folder is empty.<br />Add a file to initiate text modules.
          </div>
        ) : (
          <div className="space-y-0.5">
            {files
              .sort((a, b) => {
                // Directories first
                if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map((item) => {
                const isDir = item.type === "directory";
                const editable = isEditableFile(item.name);
                
                return (
                  <div
                    key={item.path}
                    className="flex items-center justify-between p-1.5 rounded-md hover:bg-white/5 transition group text-xs text-[#E0E0E0] font-mono animate-fadeIn"
                  >
                    <div 
                      onClick={() => isDir ? handleFolderClick(item.path) : onSelectFile(item.path)}
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer overflow-hidden "
                    >
                      {isDir ? (
                        <Folder className="w-4 h-4 text-emerald-500/80 shrink-0" />
                      ) : (
                        <FileText className={`w-4 h-4 shrink-0 ${editable ? 'text-emerald-400/90' : 'text-white/30'}`} />
                      )}
                      
                      <div className="truncate flex-1">
                        <span className={`transition ${isDir ? 'font-bold text-white/90 font-sans' : 'text-white/70'}`}>
                          {item.name}
                        </span>
                        {!isDir && (
                          <span className="text-[9px] text-white/30 ml-2">
                             ({formatSize(item.size)})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                      {isDir ? (
                        <button
                          onClick={() => handleFolderClick(item.path)}
                          className="p-1 hover:text-emerald-400 transition cursor-pointer text-white/55"
                          title="Open directory"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        editable && (
                          <button
                            onClick={() => onSelectFile(item.path)}
                            className="bg-emerald-950/60 px-1.5 py-0.5 rounded text-[9px] text-emerald-400 border border-emerald-900/60 font-semibold transition cursor-pointer hover:bg-emerald-500 hover:text-black"
                          >
                            Edit
                          </button>
                        )
                      )}
                      
                      <button
                        onClick={() => deletePath(item.path, item.name)}
                        className="p-1 hover:text-rose-400 text-white/20 rounded transition cursor-pointer"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="text-[9px] text-white/30 shrink-0 leading-tight">
        * Select any highlighted editable files (.ts, .tsx, .json, .html, .css, .md, .env) to load them directly into our responsive system GUI code editor.
      </div>
    </div>
  );
};
