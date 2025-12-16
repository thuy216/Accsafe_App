import React, { useEffect } from 'react';
import { RefreshCw, X, CheckCircle, Shield } from 'lucide-react';

// --- Button Component ---
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost', isLoading?: boolean }> = 
  ({ children, variant = 'primary', className = '', isLoading, ...props }) => {
  const baseClass = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm",
    secondary: "bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-slate-500",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
  };

  return (
    <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2" /> : children}
    </button>
  );
};

// --- Input Component ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string, icon?: React.ReactNode, error?: string, rightElement?: React.ReactNode }> = 
  ({ label, icon, className = '', error, rightElement, ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
    <div className="relative">
      {icon && <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{icon}</div>}
      <input 
        className={`w-full bg-white dark:bg-slate-800 border ${error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'} text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent block p-2.5 ${icon ? 'pl-10' : ''} ${rightElement ? 'pr-10' : ''} ${className} placeholder-slate-400`}
        {...props} 
      />
      {rightElement && <div className="absolute inset-y-0 right-0 pr-3 flex items-center">{rightElement}</div>}
    </div>
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

// --- Select Component ---
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = 
  ({ label, children, className = '', ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
    <select 
      className={`w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent block p-2.5 ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

// --- Toast Component ---
export const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-in slide-in-from-right ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80"><X className="w-4 h-4" /></button>
    </div>
  );
};

// --- Modal Component ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode, size?: 'md' | 'lg' }> = 
  ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-slate-850 rounded-xl shadow-2xl w-full ${size === 'lg' ? 'max-w-4xl' : 'max-w-2xl'} max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-blue-600">
             <Shield className="w-5 h-5" />
             <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
            <span className="text-2xl">&times;</span>
          </button>
        </div>
        <div className="p-0 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-900">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Empty State Component ---
export const EmptyState = ({ icon, message }: { icon: React.ReactNode, message: string }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
    {icon}
    <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">{message}</p>
  </div>
);
