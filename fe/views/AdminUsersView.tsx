import React, { useState, useEffect, useMemo, memo } from 'react';
import { Users, Trash2, AlertTriangle } from 'lucide-react';
import { Button, EmptyState, Modal } from '../components/UIComponents';
import { User } from '../types';
import { userAPI } from '../services/api';

interface AdminUsersViewProps {
  t: any;
  notify: (msg: string, type?: 'success' | 'error') => void;
  language?: string;
}

const AdminUsersViewComponent: React.FC<AdminUsersViewProps> = ({ t, notify, language = 'vi' }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Helper function để translate error messages
  const translateError = (errorMessage: string): string => {
    const errorLower = errorMessage.toLowerCase();
    
    // Map các error messages phổ biến từ server
    if (errorLower.includes('phiên đăng nhập đã hết hạn') || errorLower.includes('session expired')) {
      return t.sessionExpired;
    }
    if (errorLower.includes('không có quyền') || errorLower.includes('permission') || errorLower.includes('forbidden')) {
      return t.noPermission;
    }
    if (errorLower.includes('lỗi khi lấy') || errorLower.includes('error loading')) {
      const statusMatch = errorMessage.match(/\d+/);
      if (statusMatch) {
        return t.errorLoadingUsers.replace('{status}', statusMatch[0]);
      }
      return t.cannotGetUsers;
    }
    if (errorLower.includes('không thể xóa tài khoản admin') || errorLower.includes('cannot delete admin')) {
      return t.cannotDeleteAdmin;
    }
    
    // Nếu không match, trả về message gốc hoặc default message
    return errorMessage || t.cannotLoadUsers;
  };

  // Load users từ API
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      console.log('[AdminUsersView] Loading users...');
      const loadedUsers = await userAPI.getAllUsers();
      console.log('[AdminUsersView] Loaded users:', loadedUsers);
      setUsers(loadedUsers);
    } catch (error: any) {
      console.error('[AdminUsersView] Error loading users:', error);
      console.error('[AdminUsersView] Error details:', {
        message: error.message,
        stack: error.stack
      });
      const translatedError = translateError(error.message || '');
      notify(translatedError, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Xóa user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await userAPI.deleteUser(userToDelete);
      // Optimistic update: Xóa khỏi UI ngay lập tức
      setUsers((prev) => prev.filter((u) => u.email !== userToDelete));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      notify(t.userDeletedSuccess, 'success');
    } catch (error: any) {
      console.error('[AdminUsersView] Error deleting user:', error);
      const translatedError = translateError(error.message || '');
      notify(translatedError || t.cannotDeleteUserError, 'error');
    }
  };

  // Memoize filtered users
  const regularUsers = useMemo(() => {
    return users.filter((u) => !u.role || u.role !== 'admin');
  }, [users]);

  const adminUsers = useMemo(() => {
    return users.filter((u) => u.role === 'admin');
  }, [users]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-500" />
                {t.userManagement}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {t.totalUsers.replace('{count}', users.length.toString()).replace('{regular}', regularUsers.length.toString()).replace('{admin}', adminUsers.length.toString())}
              </p>
            </div>
            <Button onClick={loadUsers} variant="secondary" disabled={isLoading}>
              {isLoading ? t.loading : t.refresh}
            </Button>
          </div>
        </div>

        {isLoading && users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-slate-500 mt-4">{t.loadingUsers}</p>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="w-16 h-16 text-slate-300" />}
            message={t.noUsers}
          />
        ) : (
          <div className="p-6">
            {/* Danh sách Users thường */}
            {regularUsers.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
                  {t.regularUsers} ({regularUsers.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.email}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.name}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.createdAt}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.actions}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {regularUsers.map((user) => (
                        <tr
                          key={user.email}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium">{user.email}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {user.name || '-'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setUserToDelete(user.email);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title={t.deleteUser}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Danh sách Admin */}
            {adminUsers.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
                  {t.adminUsers} ({adminUsers.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.email}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.name}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.createdAt}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {t.role}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((user) => (
                        <tr
                          key={user.email}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium">{user.email}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {user.name || '-'}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                              {t.admin}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal xác nhận xóa */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title={t.confirmDeleteUser.replace('{email}', userToDelete || '')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
              }}
            >
              {t.cancel}
            </Button>
            <Button variant="danger" onClick={handleDeleteUser}>
              {t.delete}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-slate-700 dark:text-slate-300">
                {t.confirmDeleteUser.replace('{email}', userToDelete || '')}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                {t.deleteUserWarning}
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Memoize component để tránh re-render không cần thiết
export const AdminUsersView = memo(AdminUsersViewComponent);

