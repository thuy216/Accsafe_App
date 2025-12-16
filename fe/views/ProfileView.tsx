import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Globe, Play, Plus, User as UserIcon, Smartphone, Laptop, Square, Trash2, RefreshCw } from 'lucide-react';
import { Button, EmptyState, Input, Modal, Select } from '../components/UIComponents';
import { ProfileItem, ProxyItem, User } from '../types';
import { CPU_OPTIONS, MOCK_GPUS, MOCK_USER_AGENTS, RAM_OPTIONS, RESOLUTION_OPTIONS } from '../constants';
import { profileAPI } from '../services/api';

interface ProfileViewProps {
  t: any;
  profiles: ProfileItem[];
  proxies: ProxyItem[];
  setProfiles: React.Dispatch<React.SetStateAction<ProfileItem[]>>;
  notify: (msg: string, type?: 'success' | 'error') => void;
  currentUser?: User | null; // User hiện tại để lấy userId
}

const ProfileViewComponent: React.FC<ProfileViewProps> = ({ t, profiles, proxies, setProfiles, notify, currentUser }) => {
  const [urlToOpen, setUrlToOpen] = useState('https://whoer.net');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Listen for profile status updates from Electron
  useEffect(() => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      
      // Listen for profile status updates
      const handleProfileStatus = (event: any, data: { profileId?: string; action?: string; status: string; message?: string; messageKey?: string }) => {
        if (data.action === 'reset-all') {
          // Reset all profiles to stopped (khi app tắt hoặc mở lại)
          setProfiles((prevProfiles: ProfileItem[]) => {
            const updated = prevProfiles.map((p: ProfileItem) => ({ ...p, status: 'stopped' as const }));
            // Update status trong database/API cho tất cả profiles
            updated.forEach((profile: ProfileItem) => {
              profileAPI.updateProfile(profile.id, { status: 'stopped' }).catch(err => {
                console.error(`[ProfileView] Error updating profile ${profile.id} status:`, err);
              });
            });
            return updated;
          });
          return;
        }
        
        // Nếu không có profileId, bỏ qua
        if (!data.profileId) return;

        // Dùng functional update để đảm bảo có state mới nhất
        setProfiles((prevProfiles: ProfileItem[]) => {
          const profile = prevProfiles.find((p: ProfileItem) => p.id === data.profileId);
          if (profile) {
            const updatedProfile = { ...profile, status: data.status as 'running' | 'stopped' };
            const newProfiles = prevProfiles.map((p: ProfileItem) => p.id === data.profileId ? updatedProfile : p);
            
            // Notify sau khi update state - translate message nếu có messageKey
            // Bỏ qua notify nếu messageKey là "profileNotRunning" (chỉ update status thầm lặng)
            const messageKey = data.messageKey;
            if (messageKey && messageKey !== 'profileNotRunning' && messageKey in t) {
              setTimeout(() => {
                notify((t as any)[messageKey] || data.message || '', data.status === 'error' ? 'error' : 'success');
              }, 0);
            } else if (data.message && messageKey !== 'profileNotRunning') {
              setTimeout(() => {
                notify(data.message!, data.status === 'error' ? 'error' : 'success');
              }, 0);
            }
            
            return newProfiles;
          } else {
            // Nếu không tìm thấy profile, log để debug nhưng không hiển thị lỗi
            console.warn(`[ProfileView] Profile ${data.profileId} not found in list, but status update received`);
            return prevProfiles;
          }
        });
      };

      // Listen for profile logs
      const handleProfileLog = (event: any, data: { profileId: string; log: string; isError?: boolean }) => {
        // Có thể hiển thị logs trong UI nếu cần
        console.log(`[Profile ${data.profileId}]`, data.log);
      };

      ipcRenderer.on('profile-status', handleProfileStatus);
      ipcRenderer.on('profile-log', handleProfileLog);

      return () => {
        ipcRenderer.removeListener('profile-status', handleProfileStatus);
        ipcRenderer.removeListener('profile-log', handleProfileLog);
      };
    }
  }, [profiles, setProfiles, notify]);
  
  const [profileForm, setProfileForm] = useState<Partial<ProfileItem>>({
    name: '', deviceType: undefined, os: undefined, browser: undefined, timezone: 'auto', userAgent: '',
    hardware: {
        cpuCores: 0, ram: 0, gpu: '', screenResolution: '',
        audioContextNoise: true, canvasNoise: true, webGLNoise: true, webRTCPolicy: 'disable'
    }
  });

  const getHardwareState = () => {
    return profileForm.hardware || {
        cpuCores: 0, ram: 0, gpu: '', screenResolution: '',
        audioContextNoise: true, canvasNoise: true, webGLNoise: true, webRTCPolicy: 'disable'
    };
  };

  // Function để random cấu hình ngẫu nhiên
  const randomizeProfile = () => {
    const randomOS = 'windows' as 'windows';
    const randomBrowser = 'chrome' as 'chrome';
    const randomDeviceType = ['desktop', 'mobile'][Math.floor(Math.random() * 2)] as 'desktop' | 'mobile';
    const randomUserAgent = MOCK_USER_AGENTS[Math.floor(Math.random() * MOCK_USER_AGENTS.length)];
    const randomCPU = CPU_OPTIONS[Math.floor(Math.random() * CPU_OPTIONS.length)];
    const randomRAM = RAM_OPTIONS[Math.floor(Math.random() * RAM_OPTIONS.length)];
    const randomGPU = MOCK_GPUS[Math.floor(Math.random() * MOCK_GPUS.length)];
    const randomResolution = RESOLUTION_OPTIONS[Math.floor(Math.random() * RESOLUTION_OPTIONS.length)];
    
    setProfileForm({
      ...profileForm,
      os: randomOS,
      browser: randomBrowser,
      deviceType: randomDeviceType,
      userAgent: randomUserAgent,
      hardware: {
        ...getHardwareState(),
        cpuCores: randomCPU,
        ram: randomRAM,
        gpu: randomGPU,
        screenResolution: randomResolution,
        audioContextNoise: true,
        canvasNoise: true,
        webGLNoise: true,
        webRTCPolicy: 'disable'
      }
    });
  };

  const updateHardware = (key: keyof ProfileItem['hardware'], value: any) => {
      const currentHw = getHardwareState();
      setProfileForm({
          ...profileForm,
          hardware: { ...currentHw, [key]: value }
      });
  };

  const handleCreateProfile = async () => {
    if (!currentUser || !currentUser.email) {
      notify(t.pleaseLoginToCreateProfile, 'error');
      return;
    }

    const hw = getHardwareState();

    // Validate required fields
    if (!profileForm.name || !profileForm.name.trim()) {
      notify('Vui lòng nhập tên profile', 'error');
      return;
    }
    if (!profileForm.os) {
      notify('Vui lòng chọn hệ điều hành', 'error');
      return;
    }
    if (!profileForm.browser) {
      notify('Vui lòng chọn trình duyệt', 'error');
      return;
    }
    if (!hw.cpuCores || hw.cpuCores === 0) {
      notify('Vui lòng chọn số nhân CPU', 'error');
      return;
    }
    if (!hw.ram || hw.ram === 0) {
      notify('Vui lòng chọn RAM', 'error');
      return;
    }
    if (!hw.gpu || !hw.gpu.trim()) {
      notify('Vui lòng chọn GPU', 'error');
      return;
    }
    if (!hw.screenResolution || !hw.screenResolution.trim()) {
      notify('Vui lòng chọn độ phân giải màn hình', 'error');
      return;
    }
    const tempId = `temp-${Date.now()}`; // Temporary ID để hiển thị ngay
    const newProfileData = {
      userId: currentUser.email,
      name: profileForm.name.trim(),
      deviceType: profileForm.deviceType || 'desktop',
      os: profileForm.os,
      browser: profileForm.browser,
      userAgent: profileForm.userAgent || MOCK_USER_AGENTS[Math.floor(Math.random() * MOCK_USER_AGENTS.length)],
      timezone: profileForm.timezone || 'auto',
      hardware: {
        ...hw,
        cpuCores: hw.cpuCores!,
        ram: hw.ram!,
        gpu: hw.gpu!,
        screenResolution: hw.screenResolution!
      },
      status: 'stopped' as const,
      proxyId: profileForm.proxyId
    };

    // Optimistic update: Thêm vào UI ngay lập tức với temp ID
    const optimisticProfile: ProfileItem = {
      ...newProfileData,
      id: tempId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setProfiles((prevProfiles: ProfileItem[]) => [...prevProfiles, optimisticProfile]);
    setIsProfileModalOpen(false);
    
    // Reset form ngay lập tức
    setProfileForm({ 
        name: '', deviceType: undefined, os: undefined, browser: undefined, timezone: 'auto', userAgent: '',
        hardware: {
            cpuCores: 0, ram: 0, gpu: '', screenResolution: '',
            audioContextNoise: true, canvasNoise: true, webGLNoise: true, webRTCPolicy: 'disable'
        }
    });
    notify(t.savedSuccessfully);

    // Gọi API trong background và cập nhật với ID thật
    try {
      const createdProfile = await profileAPI.createProfile(newProfileData);
      // Thay thế profile tạm bằng profile thật từ server
      setProfiles((prevProfiles: ProfileItem[]) => 
        prevProfiles.map((p: ProfileItem) => p.id === tempId ? createdProfile : p)
      );
    } catch (error: any) {
      // Rollback nếu API fail
      setProfiles((prevProfiles: ProfileItem[]) => prevProfiles.filter((p: ProfileItem) => p.id !== tempId));
      notify(error.message || t.cannotCreateProfile, 'error');
      // Mở lại modal để user có thể thử lại
      setIsProfileModalOpen(true);
      setProfileForm(newProfileData);
    }
  };

  const toggleProfileStatus = async (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) {
      // Không hiển thị lỗi nếu không tìm thấy, có thể profile đang được load
      console.warn('[ProfileView] Profile not found:', id);
      return;
    }

    try {
      // Kiểm tra Electron có sẵn không
      if (typeof window === 'undefined' || !(window as any).require) {
        notify(t.electronNotAvailable, 'error');
        return;
      }

      const { ipcRenderer } = (window as any).require('electron');
      
      if (profile.status === 'running') {
        // Stop profile
        console.log('[ProfileView] Stopping profile:', id);
        ipcRenderer.send('stop-profile', id);
        
        // Cập nhật UI ngay lập tức, không cần đợi API
        setProfiles((prevProfiles: ProfileItem[]) => prevProfiles.map((p: ProfileItem) => p.id === id ? { ...p, status: 'stopped' as const } : p));
        // Chỉ notify nếu thực sự có process đang chạy (sẽ được xử lý bởi IPC handler)
        // Nếu không có process, chỉ update status thầm lặng
        notify(t.profileStopped);
        
        // Update API trong background
        profileAPI.updateProfile(id, { status: 'stopped' }).catch(err => {
          console.error('[ProfileView] Error updating profile status:', err);
        });
      } else {
        // Start profile
        console.log('[ProfileView] Starting profile:', id, profile);
        
        // Cập nhật UI ngay lập tức trước khi gửi IPC
        setProfiles((prevProfiles: ProfileItem[]) => prevProfiles.map((p: ProfileItem) => p.id === id ? { ...p, status: 'running' as const } : p));
        notify(t.profileStarting);
        
        // Lấy proxy string nếu có
        let proxyString = null;
        if (profile.proxyId) {
          const proxy = proxies.find(p => p.id === profile.proxyId);
          if (proxy) {
            // Format: ip:port:username:password hoặc ip:port
            if (proxy.username && proxy.password) {
              proxyString = `${proxy.ip}:${proxy.port}:${proxy.username}:${proxy.password}`;
            } else {
              proxyString = `${proxy.ip}:${proxy.port}`;
            }
          }
        }

        // Gửi IPC event để start profile
        ipcRenderer.send('start-profile', {
          ...profile,
          proxyString,
          url: urlToOpen || 'https://www.google.com'
        });

        // Update API trong background
        profileAPI.updateProfile(id, { status: 'running' }).catch(err => {
          console.error('[ProfileView] Error updating profile status:', err);
        });
      }
    } catch (error: any) {
      console.error('[ProfileView] Error in toggleProfileStatus:', error);
      // Chỉ hiển thị lỗi nếu thực sự có lỗi, không phải "không tìm thấy profile"
      if (!error.message || !error.message.includes('Không tìm thấy profile')) {
        notify(error.message || t.cannotUpdateProfileStatus, 'error');
      }
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;

    // Optimistic update: Xóa khỏi UI ngay lập tức
    const originalProfiles = [...profiles]; // Lưu bản sao để rollback
    setProfiles((prevProfiles: ProfileItem[]) => prevProfiles.filter((p: ProfileItem) => p.id !== id));
    
    // Gọi API để xóa
    try {
      await profileAPI.deleteProfile(id);
      notify(t.deletedSuccessfully);
    } catch (error: any) {
      // Rollback nếu API fail
      setProfiles(originalProfiles);
      notify(error.message || t.cannotDeleteProfile, 'error');
    }
  };

  const renderProfileModalContent = () => {
    const hw = getHardwareState();
    return (
        <div className="flex flex-col h-full">
            <div className="p-6 space-y-6">
                {/* Header với button Random */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t.createProfile}</h3>
                    <Button 
                        variant="secondary" 
                        onClick={randomizeProfile}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Random Config
                    </Button>
                </div>

                {/* Tổng quan và Phần cứng gộp lại */}
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Tổng quan */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                            {t.overview}
                        </h4>
                        <Input 
                            label={t.profileName} 
                            value={profileForm.name || ''} 
                            onChange={e => setProfileForm({...profileForm, name: e.target.value})} 
                            placeholder="Profile 1"
                            className="bg-slate-800 text-white border-none focus:ring-2 focus:ring-blue-500" 
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Select 
                                label={t.os} 
                                value={profileForm.os || ''}
                                onChange={e => setProfileForm({...profileForm, os: e.target.value as any})}
                                className="bg-slate-800 text-white border-none"
                            >
                                <option value="">-- Chọn OS --</option>
                                <option value="windows">Windows</option>
                            </Select>
                            <Select 
                                label={t.browser} 
                                value={profileForm.browser || ''}
                                onChange={e => setProfileForm({...profileForm, browser: e.target.value as any})}
                                className="bg-slate-800 text-white border-none"
                            >
                                <option value="">-- Chọn Browser --</option>
                                <option value="chrome">Chrome</option>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Proxy Connection</label>
                            <select 
                                className="w-full bg-slate-800 border-none text-white rounded-lg focus:ring-2 focus:ring-blue-500 block p-2.5"
                                value={profileForm.proxyId || ""}
                                onChange={(e) => setProfileForm({...profileForm, proxyId: e.target.value})}
                            >
                                <option value="">No Proxy (Direct Connection)</option>
                                {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t.userAgent}</label>
                                <button 
                                    className="text-blue-500 text-xs flex items-center hover:underline"
                                    onClick={() => setProfileForm({...profileForm, userAgent: MOCK_USER_AGENTS[Math.floor(Math.random() * MOCK_USER_AGENTS.length)]})}
                                >
                                    <RefreshCw className="w-3 h-3 mr-1" /> {t.generate}
                                </button>
                            </div>
                            <textarea 
                                className="w-full bg-slate-800 border-none text-slate-300 text-xs font-mono rounded-lg p-3 h-24 focus:ring-2 focus:ring-blue-500"
                                value={profileForm.userAgent || ''}
                                onChange={(e) => setProfileForm({...profileForm, userAgent: e.target.value})}
                                placeholder="User Agent sẽ được tạo tự động khi random..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Select label="Timezone" value={profileForm.timezone || 'auto'} onChange={e => setProfileForm({...profileForm, timezone: e.target.value})} className="bg-slate-800 text-white border-none">
                                <option value="auto">Auto (Based on IP)</option>
                                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh</option>
                                <option value="America/New_York">America/New_York</option>
                                <option value="Europe/London">Europe/London</option>
                            </Select>
                        </div>
                    </div>

                    {/* Phần cứng */}
                    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
                            {t.hardware}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Select 
                                label={t.cpuCores} 
                                value={hw.cpuCores || 0} 
                                onChange={(e) => updateHardware('cpuCores', e.target.value ? Number(e.target.value) : 0)} 
                                className="bg-slate-800 text-white border-none"
                            >
                                <option value="0">-- Chọn CPU Cores --</option>
                                {CPU_OPTIONS.map(opt => <option key={opt} value={opt}>{opt} Cores</option>)}
                            </Select>
                            <Select 
                                label={t.memory} 
                                value={hw.ram || 0} 
                                onChange={(e) => updateHardware('ram', e.target.value ? Number(e.target.value) : 0)} 
                                className="bg-slate-800 text-white border-none"
                            >
                                <option value="0">-- Chọn RAM --</option>
                                {RAM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt} GB</option>)}
                            </Select>
                        </div>
                        <Select 
                            label={t.screenRes} 
                            value={hw.screenResolution || ''} 
                            onChange={(e) => updateHardware('screenResolution', e.target.value)} 
                            className="bg-slate-800 text-white border-none"
                        >
                            <option value="">-- Chọn Độ phân giải --</option>
                            {RESOLUTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </Select>
                        <Select 
                            label={t.gpu} 
                            value={hw.gpu || ''} 
                            onChange={(e) => updateHardware('gpu', e.target.value)} 
                            className="bg-slate-800 text-white border-none"
                        >
                            <option value="">-- Chọn GPU --</option>
                            {MOCK_GPUS.map(gpu => <option key={gpu} value={gpu}>{gpu}</option>)}
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // Chạy tất cả profiles hiện có (start nếu đang stopped)
  const handleTestAllProfiles = () => {
    if (!profiles || profiles.length === 0) {
      notify(t.noProfiles, 'error');
      return;
    }

    const stoppeds = profiles.filter((p) => p.status !== 'running');
    if (stoppeds.length === 0) {
      notify(t.profileAlreadyRunning);
      return;
    }

    notify(`Launching ${stoppeds.length} profiles to ${urlToOpen || 'https://www.google.com'}`);

    stoppeds.forEach((p, idx) => {
      setTimeout(() => {
        toggleProfileStatus(p.id);
      }, idx * 400); // giãn cách nhẹ cho an toàn
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-850 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6 flex flex-col md:flex-row gap-3">
         <div className="flex-1 relative">
            <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              value={urlToOpen}
              onChange={(e) => setUrlToOpen(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
         </div>
         <div className="flex gap-2">
            <Button variant="secondary" onClick={handleTestAllProfiles}>
                <Play className="w-4 h-4 mr-2" /> Test All
            </Button>
            <Button onClick={() => setIsProfileModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> {t.createProfile}
            </Button>
         </div>
      </div>

      {profiles.length === 0 ? (
        <EmptyState icon={<UserIcon className="w-16 h-16 text-slate-300" />} message={t.noProfiles} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {profiles.map(profile => (
            <div key={profile.id} className="group bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${profile.status === 'running' ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {profile.deviceType === 'mobile' ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
                     </div>
                     <div>
                       <h3 className="font-semibold text-lg leading-tight">{profile.name}</h3>
                       <p className="text-xs text-slate-500 mt-0.5 font-mono">{profile.id.substring(0,8)}</p>
                     </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${profile.status === 'running' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900' : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                    {profile.status === 'running' ? t.running : t.stopped}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                   <div className="flex justify-between"><span>OS:</span> <span className="text-slate-900 dark:text-slate-200 capitalize">{profile.os}</span></div>
                   <div className="flex justify-between"><span>Browser:</span> <span className="text-slate-900 dark:text-slate-200 capitalize">{profile.browser}</span></div>
                   <div className="flex justify-between"><span>CPU:</span> <span className="text-slate-900 dark:text-slate-200">{profile.hardware?.cpuCores || 8} cores</span></div>
                   <div className="flex justify-between"><span>RAM:</span> <span className="text-slate-900 dark:text-slate-200">{profile.hardware?.ram || 16} GB</span></div>
                   <div className="flex justify-between"><span>Screen:</span> <span className="text-slate-900 dark:text-slate-200">{profile.hardware?.screenResolution || '1920x1080'}</span></div>
                   <div className="flex justify-between"><span>GPU:</span> <span className="text-slate-900 dark:text-slate-200 truncate max-w-[150px]" title={profile.hardware?.gpu}>{profile.hardware?.gpu || 'NVIDIA GeForce RTX 3060'}</span></div>
                   <div className="flex justify-between"><span>Proxy:</span> <span className="text-slate-900 dark:text-slate-200 truncate max-w-[150px]">{profile.proxyId ? proxies.find(p => p.id === profile.proxyId)?.name : 'Direct'}</span></div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button className="flex-1 py-1.5 text-sm" variant={profile.status === 'running' ? 'danger' : 'primary'} onClick={() => toggleProfileStatus(profile.id)}>
                     {profile.status === 'running' ? <><Square className="w-3 h-3 mr-1.5 fill-current" /> {t.stop}</> : <><Play className="w-3 h-3 mr-1.5 fill-current" /> {t.open}</>}
                  </Button>
                  <Button className="px-3" variant="secondary" onClick={() => deleteProfile(profile.id)}>
                     <Trash2 className="w-4 h-4 text-slate-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        title={t.createProfile}
        size="lg"
        footer={<><Button variant="secondary" onClick={() => setIsProfileModalOpen(false)}>{t.cancel}</Button><Button onClick={handleCreateProfile}>{t.save}</Button></>}
      >
        {renderProfileModalContent()}
      </Modal>
    </div>
  );
};

// Memoize component để tránh re-render không cần thiết
export const ProfileView = React.memo(ProfileViewComponent);