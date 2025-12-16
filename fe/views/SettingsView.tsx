import React, { useState } from 'react';
import { Globe, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { Button, Input } from '../components/UIComponents';
import { AppConfig } from '../types';

interface SettingsViewProps {
  t: any;
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  notify: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ t, config, setConfig, notify }) => {
  const [passForm, setPassForm] = useState({ old: '', new: '', error: '' });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const handleChangePassword = () => {
      if (passForm.old !== '123456' && passForm.old !== '') { 
          setPassForm({ ...passForm, error: t.passwordMismatch });
          notify(t.passwordMismatch, 'error');
          return;
      }
      setPassForm({ old: '', new: '', error: '' });
      notify(t.passwordChanged);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
         <h3 className="text-lg font-semibold mb-4">{t.settings}</h3>
         
         <div className="space-y-4">
           {/* Language */}
           <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                 <Globe className="text-slate-400" />
                 <span>{t.language}</span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setConfig({...config, language: 'en'})}
                  className={`px-3 py-1 rounded text-sm ${config.language === 'en' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >English</button>
                <button 
                  onClick={() => setConfig({...config, language: 'vi'})}
                  className={`px-3 py-1 rounded text-sm ${config.language === 'vi' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >Tiếng Việt</button>
              </div>
           </div>

           {/* Theme */}
           <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                 {config.theme === 'dark' ? <Moon className="text-slate-400" /> : <Sun className="text-slate-400" />}
                 <span>{t.darkMode}</span>
              </div>
              <button 
                onClick={() => setConfig({...config, theme: config.theme === 'dark' ? 'light' : 'dark'})}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${config.theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                 <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${config.theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
           </div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
         <h3 className="text-lg font-semibold mb-4">{t.changePassword}</h3>
         <div className="space-y-4">
            <Input 
                type={showOldPass ? "text" : "password"} 
                placeholder={t.oldPassword} 
                value={passForm.old}
                onChange={e => setPassForm({...passForm, old: e.target.value, error: ''})}
                error={passForm.error}
                rightElement={
                    <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="text-slate-400 hover:text-slate-600">
                        {showOldPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                }
            />
            <Input 
                type={showNewPass ? "text" : "password"} 
                placeholder={t.newPassword} 
                value={passForm.new}
                onChange={e => setPassForm({...passForm, new: e.target.value})}
                rightElement={
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="text-slate-400 hover:text-slate-600">
                        {showNewPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                    </button>
                }
            />
            <div className="flex justify-end mt-2">
               <Button onClick={handleChangePassword}>{t.save}</Button>
            </div>
         </div>
      </div>

    </div>
  );
};