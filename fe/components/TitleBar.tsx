import React from "react";
import { Minus, Square, X, Shield } from "lucide-react";
import { APP_NAME } from "../constants";

export const TitleBar: React.FC = () => {
  // Kết nối với Electron IPC
  const handleAction = (action: string) => {
    // Ép kiểu window thành any để tránh lỗi TypeScript báo đỏ
    const w = window as any;
    if (w.require) {
      const { ipcRenderer } = w.require("electron");
      ipcRenderer.send(action);
    } else {
      console.warn("Electron IPC not available (Running in Browser?)");
    }
  };

  return (
    <div className="h-8 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center select-none title-bar-drag-region z-50">
      {/* App Logo & Name */}
      <div className="flex items-center gap-2 px-3 h-full">
        <Shield className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide">
          {APP_NAME}
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex h-full title-bar-no-drag">
        <button
          onClick={() => handleAction("minimize-window")}
          className="w-12 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors focus:outline-none"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAction("maximize-window")}
          className="w-12 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors focus:outline-none"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => handleAction("close-window")}
          className="w-12 flex items-center justify-center hover:bg-red-500 hover:text-white text-slate-500 dark:text-slate-400 transition-colors focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
