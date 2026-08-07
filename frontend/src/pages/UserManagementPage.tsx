import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { User, UserRole, DEPARTMENTS } from '../types';
import { Search, UserCheck, Shield, Trash2, CheckCircle, XCircle, AlertTriangle, X, Building, ArrowUpDown } from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'dept_asc' | 'role' | 'id_desc'>('name_asc');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Confirmation Modals State
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [confirmActionType, setConfirmActionType] = useState<'toggle' | 'delete' | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, search]);

  const fetchUsers = async () => {
    try {
      const params: any = {};
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const res = await api.get<User[]>('/users', { params });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedUsers = users
    .filter(u => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (departmentFilter && u.department !== departmentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department && u.department.toLowerCase().includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'dept_asc') return (a.department || '').localeCompare(b.department || '');
      if (sortBy === 'role') return a.role.localeCompare(b.role);
      if (sortBy === 'id_desc') return b.id - a.id;
      return a.name.localeCompare(b.name);
    });

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to update user role');
    }
  };

  const requestToggleActive = (userItem: User) => {
    if (userItem.id === currentUser?.id) {
      setErrorMsg('You cannot deactivate your own active admin account.');
      return;
    }
    setTargetUser(userItem);
    setConfirmActionType('toggle');
  };

  const requestDelete = (userItem: User) => {
    if (userItem.id === currentUser?.id) {
      setErrorMsg('You cannot delete your own admin account.');
      return;
    }
    setTargetUser(userItem);
    setConfirmActionType('delete');
  };

  const executeConfirmedAction = async () => {
    if (!targetUser || !confirmActionType) return;
    setErrorMsg(null);

    try {
      if (confirmActionType === 'toggle') {
        await api.put(`/users/${targetUser.id}/toggle-active`);
      } else if (confirmActionType === 'delete') {
        await api.delete(`/users/${targetUser.id}`);
      }
      setTargetUser(null);
      setConfirmActionType(null);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">User Management</h1>
          <p className="text-xs text-slate-400">Promote captain roles, activate/deactivate accounts, and manage platform permissions</p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            placeholder="Search name or email..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Role Filter Tabs & Sorting Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {['', 'admin', 'captain', 'player'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                roleFilter === role
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'glass-card text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {role === '' ? 'All Roles' : role}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-slate-900">{dept}</option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="name_asc" className="bg-slate-900">Sort: Name (A-Z)</option>
              <option value="name_desc" className="bg-slate-900">Sort: Name (Z-A)</option>
              <option value="dept_asc" className="bg-slate-900">Sort: Department (A-Z)</option>
              <option value="role" className="bg-slate-900">Sort: Role</option>
              <option value="id_desc" className="bg-slate-900">Sort: Newest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800 overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading user accounts...</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAndSortedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white flex items-center gap-2">
                      {u.name}
                      {u.id === currentUser?.id && (
                        <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 text-[9px] font-bold">YOU</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{u.department || 'N/A'}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-400 focus:outline-none focus:border-brand-500"
                    >
                      <option value="player">Player</option>
                      <option value="captain">Captain</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => requestToggleActive(u)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1 transition-all ${
                        u.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                      }`}
                    >
                      {u.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => requestDelete(u)}
                        title="Delete User"
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmActionType && targetUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-sm border border-slate-800 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white">
              {confirmActionType === 'toggle' 
                ? (targetUser.is_active ? 'Deactivate Account?' : 'Reactivate Account?')
                : 'Delete User Account?'
              }
            </h3>

            <p className="text-xs text-slate-400">
              Are you sure you want to {confirmActionType === 'toggle' ? (targetUser.is_active ? 'deactivate' : 'reactivate') : 'delete'} <strong className="text-white">{targetUser.name} ({targetUser.email})</strong>?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => { setConfirmActionType(null); setTargetUser(null); }}
                className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
