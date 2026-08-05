import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../store/authStore';
import { api, getImageUrl } from '../api/client';
import { Team, User, PlayerProfile } from '../types';
import { PlayerDetailModal } from '../components/players/PlayerDetailModal';
import { Shield, Plus, Users, DollarSign, UserCheck, X, Upload, Image as ImageIcon, Lock, Eye, Edit3, Trash2, RotateCcw } from 'lucide-react';

export const TeamsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [captains, setCaptains] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedCaptainId, setSelectedCaptainId] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Edit Team Modal State
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editCaptainId, setEditCaptainId] = useState<string>('');
  const [editBudgetTotal, setEditBudgetTotal] = useState<string>('50000000');
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);

  // Delete Team State (Request 2)
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<Team | null>(null);

  // Player Detail Modal State
  const [modalPlayer, setModalPlayer] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    fetchTeams();
    if (user?.role === 'admin') fetchCaptains();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await api.get<Team[]>('/teams');
      setTeams(res.data);
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaptains = async () => {
    try {
      const res = await api.get<User[]>('/users');
      setCaptains(res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const openPlayerModalById = async (playerId: number) => {
    try {
      const res = await api.get<PlayerProfile>(`/players/${playerId}`);
      setModalPlayer(res.data);
    } catch (err) {
      console.error('Failed to fetch player profile:', err);
    }
  };

  const [revokeConfirmPlayer, setRevokeConfirmPlayer] = useState<{ id: number; name: string } | null>(null);

  const executeRevokePlayer = async () => {
    if (!revokeConfirmPlayer) return;
    try {
      await api.post(`/auction/revoke-player/${revokeConfirmPlayer.id}`);
      setRevokeConfirmPlayer(null);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to revoke player');
    }
  };

  const openEditTeamModal = (t: Team) => {
    setEditTeam(t);
    setEditTeamName(t.name);
    setEditCaptainId(t.captain_id ? String(t.captain_id) : '');
    setEditBudgetTotal(String(t.budget_total));
    setEditLogoFile(null);
  };

  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingTeam) return;
    setIsCreatingTeam(true);

    try {
      const res = await api.post<Team>('/teams', {
        name: newTeamName,
        captain_id: selectedCaptainId ? parseInt(selectedCaptainId) : null,
        budget_total: 50000000.0
      });

      if (logoFile && res.data.id) {
        const formData = new FormData();
        formData.append('file', logoFile);
        await api.post(`/teams/${res.data.id}/logo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      alert('Franchise Team Created Successfully!');
      setShowModal(false);
      setNewTeamName('');
      setSelectedCaptainId('');
      setLogoFile(null);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create team');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeam) return;

    try {
      await api.put(`/teams/${editTeam.id}`, {
        name: editTeamName,
        captain_id: editCaptainId ? parseInt(editCaptainId) : null,
        budget_total: parseFloat(editBudgetTotal) || 50000000.0
      });

      if (editLogoFile) {
        const formData = new FormData();
        formData.append('file', editLogoFile);
        await api.post(`/teams/${editTeam.id}/logo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setEditTeam(null);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update team details');
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteConfirmTeam) return;
    try {
      await api.delete(`/teams/${deleteConfirmTeam.id}`);
      setDeleteConfirmTeam(null);
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete team');
    }
  };

  const handleLogoUploadDirect = async (teamId: number, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/teams/${teamId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTeams();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to upload logo');
    }
  };

  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined || val === 0.0) return null;
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Teams Overview</h1>
          <p className="text-xs text-slate-400">View corporate franchises, logos, captains, and purchased rosters</p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-brand-500/25"
          >
            <Plus className="w-4 h-4" /> Create New Team
          </button>
        )}
      </div>

      {/* Teams Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-xs text-slate-500 border border-slate-800">
          No teams registered yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {teams.map((t) => {
            const isMyTeam = user?.role === 'captain' && t.captain_id === user.id;
            const isPrivileged = user?.role === 'admin' || user?.role === 'captain';
            const spendableText = formatPrice(t.spendable_budget);

            return (
              <div key={t.id} className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4 relative flex flex-col justify-between">
                
                <div className="space-y-4">
                  {/* Top info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      
                      {/* Team Logo Avatar */}
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative group flex-shrink-0">
                        {t.logo_path ? (
                          <img src={getImageUrl(t.logo_path)} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl font-black text-brand-400">{t.name.charAt(0)}</span>
                        )}

                        {/* Admin Change Logo overlay */}
                        {user?.role === 'admin' && (
                          <label className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white cursor-pointer transition-opacity">
                            <Upload className="w-4 h-4" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files && e.target.files[0] && handleLogoUploadDirect(t.id, e.target.files[0])}
                            />
                          </label>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{t.name}</h3>
                          {isMyTeam && (
                            <span className="px-2 py-0.2 rounded bg-gold-500/20 text-gold-400 text-[9px] font-extrabold border border-gold-500/30">
                              YOUR TEAM
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">Captain: <strong className="text-slate-200">{t.captain_name || 'Unassigned'}</strong></p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {user?.role === 'admin' && (
                        <>
                          <button
                            onClick={() => openEditTeamModal(t)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-brand-400 border border-slate-800 transition-colors"
                            title="Edit Team Details"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setDeleteConfirmTeam(t)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-rose-400 border border-slate-800 transition-colors"
                            title="Delete Team"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold border border-brand-500/30">
                        {t.players_count} / 11
                      </span>
                    </div>
                  </div>

                  {/* Budget metrics bar */}
                  {isPrivileged && spendableText ? (
                    <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Budget</span>
                        <span className="font-bold text-slate-300">{formatPrice(t.budget_total)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Spent</span>
                        <span className="font-bold text-rose-400">{formatPrice(t.budget_used)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Spendable</span>
                        <span className="font-bold text-emerald-400">{spendableText}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500 italic">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      Franchise budget details hidden (Captain Privacy Active)
                    </div>
                  )}

                  {/* Purchased Roster */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Purchased Roster</h4>
                    {t.players && t.players.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {t.players.map(tp => {
                          const priceText = isPrivileged ? formatPrice(tp.purchase_price) : null;
                          return (
                            <div key={tp.id} className="flex items-center gap-1">
                              <button 
                                onClick={() => openPlayerModalById(tp.player_id)}
                                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-brand-400 flex items-center gap-1.5 transition-colors cursor-pointer group"
                                title="Click to view detailed player profile"
                              >
                                <span>{tp.player.user_name}</span>
                                {priceText && <span className="text-gold-400 font-bold font-mono">({priceText})</span>}
                                <Eye className="w-3 h-3 text-slate-500 group-hover:text-brand-400 ml-0.5" />
                              </button>
                              {user?.role === 'admin' && (
                                <button
                                  onClick={() => setRevokeConfirmPlayer({ id: tp.player_id, name: tp.player.user_name })}
                                  className="p-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                                  title="Revoke player & return to re-auction pool"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No players acquired yet</p>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Admin Create Team Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Create Corporate Team</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Franchise Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Royal Strikers"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Assign Captain</label>
                <select
                  value={selectedCaptainId}
                  onChange={(e) => setSelectedCaptainId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Select User for Captain</option>
                  {captains.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Team Logo Image (PNG, JPG, SVG)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && setLogoFile(e.target.files[0])}
                  className="text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingTeam}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-500/25 cursor-pointer"
              >
                {isCreatingTeam ? 'Creating Franchise Team...' : 'Create Franchise'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Edit Team Modal */}
      {editTeam && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-400" /> Edit Team Details
              </h3>
              <button onClick={() => setEditTeam(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Franchise Name</label>
                <input
                  type="text"
                  required
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Assign Captain User</label>
                <select
                  value={editCaptainId}
                  onChange={(e) => setEditCaptainId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">No Captain Assigned</option>
                  {captains.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Total Franchise Budget</label>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono flex items-center justify-between">
                  <span>₹5,00,00,000 (5 Crore)</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Fixed Tournament Rule</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Change Team Logo Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && setEditLogoFile(e.target.files[0])}
                  className="text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25"
              >
                Update Franchise Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Delete Team Confirmation Modal (Request 2) */}
      {deleteConfirmTeam && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" /> Delete Franchise Team
              </h3>
              <button onClick={() => setDeleteConfirmTeam(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-extrabold">{deleteConfirmTeam.name}</strong>? Any purchased players will be returned to the unsold player pool.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmTeam(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25"
              >
                Yes, Delete Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen-Centered Glassmorphic Revoke Confirmation Modal */}
      {revokeConfirmPlayer && createPortal(
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 z-[99999]">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-6 w-full max-w-md shadow-2xl shadow-amber-500/10 space-y-5 text-center relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Icon Badge */}
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto shadow-inner">
              <RotateCcw className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white tracking-wide">Revoke Player Assignment?</h3>
              <p className="text-xs text-slate-300 leading-relaxed px-2">
                Are you sure you want to revoke <span className="text-amber-400 font-extrabold underline decoration-amber-500/50 underline-offset-4">{revokeConfirmPlayer.name}</span> from their assigned team? This will refund the team budget and return the player to the unsold pool for re-auction.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setRevokeConfirmPlayer(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={executeRevokePlayer}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
              >
                Yes, Revoke Player
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Rich Player Detail Pop-up Modal */}
      <PlayerDetailModal
        player={modalPlayer}
        onClose={() => setModalPlayer(null)}
      />

    </div>
  );
};
