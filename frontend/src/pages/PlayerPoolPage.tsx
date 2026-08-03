import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api, getImageUrl } from '../api/client';
import { PlayerProfile, Team } from '../types';
import { PlayerDetailModal } from '../components/players/PlayerDetailModal';
import { Search, Filter, Heart, Plus, UserPlus, Shield, Award, CheckCircle, Check, X, Download } from 'lucide-react';

export const PlayerPoolPage: React.FC = () => {
  const { user } = useAuthStore();
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Filters State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [soldStatus, setSoldStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalPlayer, setModalPlayer] = useState<PlayerProfile | null>(null);

  // Direct Allocation Modal State
  const [allocatePlayer, setAllocatePlayer] = useState<PlayerProfile | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [purchasePrice, setPurchasePrice] = useState<string>('500000');

  // Requirement 5: Shopfloor Employee state toggle & Photo Upload
  const [isShopfloor, setIsShopfloor] = useState(false);
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newAge, setNewAge] = useState('25');
  const [newMobile, setNewMobile] = useState('');
  const [newJerseyName, setNewJerseyName] = useState('');
  const [newJerseyNumber, setNewJerseyNumber] = useState('10');
  const [newTshirtSize, setNewTshirtSize] = useState('M');
  const [newCategory, setNewCategory] = useState('Batsman');
  const [newBatting, setNewBatting] = useState('Right Hand');
  const [newBowling, setNewBowling] = useState('Regular Bowler');
  const [newExp, setNewExp] = useState('Intermediate');
  const [newEmergencyContact, setNewEmergencyContact] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newAchievements, setNewAchievements] = useState('');

  useEffect(() => {
    fetchPlayers();
    fetchWishlist();
    if (user?.role === 'admin') fetchTeams();
  }, [category, search, soldStatus]);

  const fetchPlayers = async () => {
    try {
      let url = `/players?search=${search}`;
      if (category) url += `&category=${category}`;
      if (soldStatus !== 'all') url += `&is_sold=${soldStatus === 'sold'}`;

      const res = await api.get<PlayerProfile[]>(url);
      setPlayers(res.data);
    } catch (err) {
      console.error('Failed to fetch player pool:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWishlist = async () => {
    if (user?.role !== 'captain') return;
    try {
      const res = await api.get('/wishlist');
      setWishlistIds(res.data.map((w: any) => w.player_id));
    } catch (err) {}
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (err) {}
  };

  const toggleWishlist = async (playerId: number) => {
    try {
      if (wishlistIds.includes(playerId)) {
        await api.delete(`/wishlist/${playerId}`);
        setWishlistIds(wishlistIds.filter(id => id !== playerId));
      } else {
        await api.post(`/wishlist/${playerId}`);
        setWishlistIds([...wishlistIds, playerId]);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Wishlist action failed');
    }
  };

  const handleExportJerseySpecs = async () => {
    try {
      const response = await api.get('/analytics/export-jersey-specs-csv', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'npl_jersey_specifications.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert('Failed to download Jersey Specs CSV');
    }
  };

  const handleAdminCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/players/admin-create', {
        name: newName,
        email: isShopfloor ? undefined : newEmail,
        password: isShopfloor ? undefined : newPassword,
        is_shopfloor: isShopfloor,
        department: isShopfloor ? 'Shopfloor' : newDept,
        employee_id: newEmpId,
        age: parseInt(newAge) || 25,
        mobile: newMobile,
        jersey_name: newJerseyName,
        jersey_number: newJerseyNumber,
        tshirt_size: newTshirtSize,
        category: newCategory,
        batting_style: newBatting,
        bowling_style: newBowling,
        experience_level: newExp,
        emergency_contact: newEmergencyContact,
        bio: newBio,
        achievements: newAchievements
      });

      if (newPhotoFile && res.data?.id) {
        const formData = new FormData();
        formData.append('file', newPhotoFile);
        await api.post(`/players/upload-photo?player_id=${res.data.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowCreateModal(false);
      resetAdminForm();
      fetchPlayers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to create player profile');
    }
  };

  const resetAdminForm = () => {
    setIsShopfloor(false);
    setNewPhotoFile(null);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewDept('');
    setNewEmpId('');
    setNewAge('25');
    setNewMobile('');
    setNewJerseyName('');
    setNewJerseyNumber('10');
    setNewTshirtSize('M');
    setNewCategory('Batsman');
    setNewBatting('Right Hand');
    setNewBowling('Regular Bowler');
    setNewExp('Intermediate');
    setNewEmergencyContact('');
    setNewBio('');
    setNewAchievements('');
  };

  const handleExecuteAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatePlayer || !selectedTeamId) return;

    try {
      await api.post(`/teams/allocate/${allocatePlayer.id}`, {
        team_id: parseInt(selectedTeamId),
        purchase_price: parseFloat(purchasePrice) || 500000.0
      });

      setAllocatePlayer(null);
      fetchPlayers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Direct allocation failed');
    }
  };

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Registered Player Pool</h1>
          <p className="text-xs text-slate-400">Browse corporate players, filter categories, bookmark to wishlist, and view player cards</p>
        </div>

        {user?.role === 'admin' && (
          <div className="flex items-center gap-3">
            {/* Requirement 6: Export Jersey Specs CSV Download */}
            <button
              onClick={handleExportJerseySpecs}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-brand-400 font-bold text-xs flex items-center gap-2 border border-slate-800 transition-colors"
            >
              <Download className="w-4 h-4" /> Export Jersey Specs CSV
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-brand-500/25"
            >
              <UserPlus className="w-4 h-4" /> Add Player to Pool
            </button>
          </div>
        )}
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchPlayers()}
            placeholder="Search name, department, category..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Category Pills & Sold Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {['', 'Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                category === cat
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat === '' ? 'All Categories' : cat}
            </button>
          ))}

          <select
            value={soldStatus}
            onChange={(e) => setSoldStatus(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-semibold"
          >
            <option value="all">All Status</option>
            <option value="unsold">Available Pool</option>
            <option value="sold">Sold Roster</option>
          </select>
        </div>

      </div>

      {/* Player Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading player pool...</div>
      ) : players.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center text-xs text-slate-500 border border-slate-800">
          No players found matching current search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {players.map((p) => (
            <div key={p.id} className="glass-card rounded-3xl p-5 border border-slate-800 space-y-4 relative group hover:border-slate-700 transition-all flex flex-col justify-between">
              
              <div>
                {/* Photo Header & Wishlist Button */}
                <div className="flex items-start justify-between gap-3">
                  <div 
                    onClick={() => setModalPlayer(p)}
                    className="w-16 h-20 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform"
                  >
                    {p.image_path ? (
                      <img src={getImageUrl(p.image_path)} alt={p.user_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-brand-400">{p.user_name?.charAt(0)}</span>
                    )}
                  </div>

                  {user?.role === 'captain' && !p.is_sold && (
                    <button
                      onClick={() => toggleWishlist(p.id)}
                      className={`p-2 rounded-xl border transition-colors ${
                        wishlistIds.includes(p.id)
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                          : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-rose-400'
                      }`}
                      title="Add to Captain Wishlist"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  )}
                </div>

                {/* Player Metadata */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 
                      onClick={() => setModalPlayer(p)}
                      className="text-base font-bold text-white tracking-tight cursor-pointer hover:text-brand-400 transition-colors"
                    >
                      {p.user_name}
                    </h3>
                    {p.is_shopfloor && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold border border-amber-500/30">
                        Shopfloor
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{p.department || 'General'} • Emp ID: {p.employee_id || 'N/A'}</p>

                  <div className="flex items-center gap-2 pt-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-extrabold uppercase border border-brand-500/30">
                      {p.category}
                    </span>
                    {p.is_sold ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30">
                        {p.team_name || 'Sold'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 text-[10px] font-extrabold border border-slate-800">
                        Available
                      </span>
                    )}
                  </div>
                </div>

                {/* Style Specs */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 mt-3">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">Batting</span>
                    <strong>{p.batting_style || 'Right Hand'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">Bowling</span>
                    <strong>{p.bowling_style || 'Regular'}</strong>
                  </div>
                </div>
              </div>

              {/* Bottom Base Price & Admin Actions */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Base Price</span>
                  <span className="text-sm font-extrabold text-gold-400">{formatPrice(p.base_price)}</span>
                </div>

                {/* Admin Direct Allocation Button */}
                {user?.role === 'admin' && !p.is_sold && (
                  <button
                    onClick={() => { setAllocatePlayer(p); setSelectedTeamId(''); setPurchasePrice(p.base_price.toString()); }}
                    className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-brand-400 font-bold text-xs flex items-center justify-center gap-1 border border-slate-800"
                  >
                    <Shield className="w-3.5 h-3.5" /> Direct Allocate to Team
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Admin Direct Allocation Modal */}
      {allocatePlayer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-400" /> Allocate Player to Team
              </h3>
              <button onClick={() => setAllocatePlayer(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Assigning <strong className="text-white">{allocatePlayer.user_name}</strong> directly to a corporate franchise.
            </p>

            <form onSubmit={handleExecuteAllocation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Franchise Team</label>
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                >
                  <option value="">Select Team</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Purchase / Acquisition Price (₹)</label>
                <input
                  type="number"
                  required
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25"
              >
                Confirm Allocation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Full Player Registration Modal (With Shopfloor Checkbox! Item 5) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 w-full max-w-lg border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-400" /> Create Complete Player Profile
              </h3>
              
              <div className="flex items-center gap-2">
                {/* Requirement 5: Shopfloor Checkbox at Top-Right Corner */}
                <label className="flex items-center gap-1.5 text-xs font-bold text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-xl border border-brand-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isShopfloor}
                    onChange={(e) => setIsShopfloor(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
                  />
                  Shopfloor Employee
                </label>

                {/* Issue 2: Modal Close (X) Button */}
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetAdminForm(); }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-800"
                  title="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              {isShopfloor 
                ? 'Creating profile for Shopfloor Employee. Email ID and Password are not required.'
                : 'Create a new player account with login credentials and full profile registration.'}
            </p>

            <form onSubmit={handleAdminCreatePlayer} className="space-y-4">
              
              {/* Account Credentials */}
              <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  {isShopfloor ? 'Player Identity' : 'Login Account Credentials'}
                </span>

                <div className={isShopfloor ? 'w-full' : 'grid grid-cols-2 gap-3'}>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Virat Kohli"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  {!isShopfloor && (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="player@npl.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>

                {!isShopfloor && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Player Login Password *</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password123!"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                    />
                    <span className="text-[10px] text-slate-500">Player will use this password to log in to the portal.</span>
                  </div>
                )}
              </div>

              {/* Profile Metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={isShopfloor ? 'Shopfloor' : newDept}
                    disabled={isShopfloor}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="Engineering"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={newEmpId}
                    onChange={(e) => setNewEmpId(e.target.value)}
                    placeholder="EMP-018"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={newMobile}
                    onChange={(e) => setNewMobile(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Name</label>
                  <input
                    type="text"
                    value={newJerseyName}
                    onChange={(e) => setNewJerseyName(e.target.value)}
                    placeholder="VIRAT"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Number (Max 2 Digits)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newJerseyNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                      setNewJerseyNumber(val);
                    }}
                    placeholder="07 or 18"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All Rounder">All Rounder</option>
                    <option value="Wicket Keeper">Wicket Keeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Batting Style</label>
                  <select
                    value={newBatting}
                    onChange={(e) => setNewBatting(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Right Hand">Right Hand</option>
                    <option value="Left Hand">Left Hand</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Bowling Style</label>
                  <select
                    value={newBowling}
                    onChange={(e) => setNewBowling(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Regular Bowler">Regular Fast/Medium</option>
                    <option value="Spin Regular">Spin Regular</option>
                    <option value="Spin Throw">Spin Throw</option>
                    <option value="Throw">Throw</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Experience Level</label>
                  <select
                    value={newExp}
                    onChange={(e) => setNewExp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Bio / Achievements</label>
                <textarea
                  rows={2}
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Cricketing bio and notable achievements..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Issue 2: Employee Picture Upload for Admin */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Upload Employee Picture / Avatar</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files && setNewPhotoFile(e.target.files[0])}
                  className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
              >
                Create Player Profile
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rich Player Detail Modal */}
      <PlayerDetailModal
        player={modalPlayer}
        onClose={() => setModalPlayer(null)}
      />

    </div>
  );
};
