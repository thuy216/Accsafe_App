import React from "react";
import {
  Shield,
  User as UserIcon,
  Server,
  Bot,
  HelpCircle,
  Settings,
  UserCog,
  LogOut,
  Users,
} from "lucide-react";
import { User, View } from "../types";
import { APP_NAME } from "../constants";

interface SidebarProps {
  currentUser: User | null;
  currentView: View;
  setCurrentView: (view: View) => void;
  handleLogout: () => void;
  t: any;
}

const NavItem = ({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
    }`}
  >
    <div
      className={`w-5 h-5 ${
        active ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
      }`}
    >
      {icon}
    </div>
    {label}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  currentView,
  setCurrentView,
  handleLogout,
  t,
}) => {
  return (
    <aside className="w-64 bg-white dark:bg-slate-850 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
      <div className="p-6 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white">
          <img src="logo.png" alt="Logo" className="w-10 h-10" />
        </div>

        <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-2">
          {t.dashboard}
        </div>
        <NavItem
          icon={<UserIcon />}
          label={t.profiles}
          active={currentView === "profiles"}
          onClick={() => setCurrentView("profiles")}
        />
        <NavItem
          icon={<Server />}
          label={t.proxies}
          active={currentView === "proxies"}
          onClick={() => setCurrentView("proxies")}
        />
        <NavItem
          icon={<Bot />}
          label={t.automation}
          active={currentView === "automation"}
          onClick={() => setCurrentView("automation")}
        />

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 mt-6">
          {t.settings}
        </div>
        <NavItem
          icon={<HelpCircle />}
          label={t.support}
          active={currentView === "support"}
          onClick={() => setCurrentView("support")}
        />
        <NavItem
          icon={<Settings />}
          label={t.settings}
          active={currentView === "settings"}
          onClick={() => setCurrentView("settings")}
        />

        {currentUser?.isAdmin && (
          <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
              Admin
            </div>
            <NavItem
              icon={<UserCog />}
              label={t.adminPanel}
              active={currentView === "admin_chat"}
              onClick={() => {
                setCurrentView("admin_chat");
              }}
            />
            <NavItem
              icon={<Users />}
              label={t.userManagement}
              active={currentView === "admin_users"}
              onClick={() => {
                setCurrentView("admin_users");
              }}
            />
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
            {currentUser?.username?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {currentUser?.username}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {currentUser?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full px-3 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          {t.logout}
        </button>
      </div>
    </aside>
  );
};
