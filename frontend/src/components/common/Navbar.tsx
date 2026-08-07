import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useAuctionStore } from '../../store/auctionStore';
import { api, getImageUrl } from '../../api/client';
import { AuctionSettingsModal } from '../auction/AuctionSettingsModal';
import { DEPARTMENTS } from '../../types';
import { 
  Trophy, Shield, Users, Radio, PieChart, Heart, 
  UserCheck, LogOut, Bell, ChevronDown, User, Edit3, X, Sparkles, CheckCircle, AlertTriangle, Info, Settings, Menu, Lock, Camera 
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, fetchCurrentUser } = useAuthStore();
  const { isConnected, notifications, activeToast, clearToast, fetchNotifications } = useAuctionStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Requirement 4: Submitted Profile Locking state
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Full Profile Form State
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editEmpId, setEditEmpId] = useState('');
  const [editAge, setEditAge] = useState(25);
  const [editMobile, setEditMobile] = useState('');
  const [editJerseyName, setEditJerseyName] = useState('');
  const [editJerseyNumber, setEditJerseyNumber] = useState('10');
  const [editTshirtSize, setEditTshirtSize] = useState('M');
  const [editCategory, setEditCategory] = useState('Batsman');
  const [editBatting, setEditBatting] = useState('Right Hand');
  const [editBowling, setEditBowling] = useState('Regular Bowler');
  const [editExp, setEditExp] = useState('Intermediate');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAchievements, setEditAchievements] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Mandatory Photo & Department Update Enforcement for Existing Registered Users
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [enforcePhotoFile, setEnforcePhotoFile] = useState<File | null>(null);
  const [enforcePhotoPreview, setEnforcePhotoPreview] = useState<string | null>(null);
  const [enforceDept, setEnforceDept] = useState('');
  const [enforceError, setEnforceError] = useState<string | null>(null);
  const [savingEnforce, setSavingEnforce] = useState(false);

  // Requirement 5: Company Logo state
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'captain')) {
      fetchNotifications();
    }
    loadUserProfile();
    fetchCompanyLogo();
  }, [user?.id]);

  const fetchCompanyLogo = async () => {
    try {
      const res = await api.get('/auction/company-logo');
      if (res.data?.logo_path) setCompanyLogoUrl(res.data.logo_path);
    } catch (err) {}
  };

  useEffect(() => {
    if (activeToast && user && (user.role === 'admin' || user.role === 'captain')) {
      const timer = setTimeout(() => {
        clearToast();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const loadUserProfile = async () => {
    if (!user) return;
    try {
      const res = await api.get('/players/me');
      if (res.data) {
        const photo = res.data.image_path;
        if (photo) setUserPhotoUrl(photo);
        setIsSubmitted(!!res.data.is_submitted);

        // Check if photo is missing OR department is not in official DEPARTMENTS list
        const validDept = !!user.department && DEPARTMENTS.includes(user.department);
        if ((!photo || !validDept) && user.role !== 'admin') {
          setIsProfileIncomplete(true);
          setEnforceDept(validDept ? user.department : '');
          if (photo) setEnforcePhotoPreview(getImageUrl(photo));
        } else {
          setIsProfileIncomplete(false);
        }
      } else if (user.role !== 'admin') {
        const validDept = !!user.department && DEPARTMENTS.includes(user.department);
        if (!validDept) {
          setIsProfileIncomplete(true);
          setEnforceDept('');
        }
      }
    } catch (err) {}
  };

  const handleEnforcePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setEnforceError('Image file size exceeds 5MB limit');
        return;
      }
      setEnforcePhotoFile(file);
      setEnforcePhotoPreview(URL.createObjectURL(file));
      setEnforceError(null);
    }
  };

  const handleEnforceProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enforcePhotoFile && !enforcePhotoPreview) {
      setEnforceError('📸 Player photo is mandatory! Please upload your profile photo.');
      return;
    }
    if (!enforceDept || !DEPARTMENTS.includes(enforceDept)) {
      setEnforceError('🏢 Please select a valid official corporate department.');
      return;
    }

    setSavingEnforce(true);
    setEnforceError(null);

    try {
      if (enforcePhotoFile) {
        const formData = new FormData();
        formData.append('file', enforcePhotoFile);
        await api.post('/players/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await api.put('/players/profile/me', {
        department: enforceDept
      });

      await fetchCurrentUser();
      await loadUserProfile();
      setIsProfileIncomplete(false);
    } catch (err: any) {
      setEnforceError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSavingEnforce(false);
    }
  };

  const openProfileEdit = async () => {
    if (user) {
      setEditName(user.name);
      setEditDept(user.department || '');
      try {
        const res = await api.get('/players/me');
        if (res.data) {
          setIsSubmitted(!!res.data.is_submitted);
          setEditEmpId(res.data.employee_id || '');
          setEditAge(res.data.age || 25);
          setEditMobile(res.data.mobile || '');
          setEditJerseyName(res.data.jersey_name || '');
          setEditJerseyNumber(res.data.jersey_number ? String(res.data.jersey_number) : '10');
          setEditTshirtSize(res.data.tshirt_size || 'M');
          setEditCategory(res.data.category || 'Batsman');
          setEditBatting(res.data.batting_style || 'Right Hand');
          setEditBowling(res.data.bowling_style || 'Regular Bowler');
          setEditExp(res.data.experience_level || 'Intermediate');
          setEditEmergencyContact(res.data.emergency_contact || '');
          setEditBio(res.data.bio || '');
          setEditAchievements(res.data.achievements || '');
          if (res.data.image_path) setUserPhotoUrl(res.data.image_path);
        }
      } catch (err) {}
    }
    setShowUserMenu(false);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPhotoUrl && !editPhotoFile) {
      alert('📸 PLAYER PHOTO IS MANDATORY! Please upload your profile photo.');
      return;
    }
    setSavingProfile(true);
    try {
      await api.put('/players/profile/me', {
        name: editName,
        department: editDept,
        employee_id: editEmpId,
        age: editAge,
        mobile: editMobile,
        jersey_name: editJerseyName,
        jersey_number: editJerseyNumber,
        tshirt_size: editTshirtSize,
        category: editCategory,
        batting_style: editBatting,
        bowling_style: editBowling,
        experience_level: editExp,
        emergency_contact: editEmergencyContact,
        bio: editBio,
        achievements: editAchievements
      });

      if (editPhotoFile) {
        const formData = new FormData();
        formData.append('file', editPhotoFile);
        const uploadRes = await api.post('/players/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (uploadRes.data?.image_path) setUserPhotoUrl(`${uploadRes.data.image_path}?t=${Date.now()}`);
      }

      await fetchCurrentUser();
      await loadUserProfile();
      setShowProfileModal(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: Trophy, roles: ['admin', 'captain', 'player'] },
    { label: 'Auction Room', path: '/auction', icon: Radio, roles: ['admin', 'captain'] },
    { label: 'Player Pool', path: '/players', icon: Users, roles: ['admin', 'captain', 'player'] },
    { label: 'Teams', path: '/teams', icon: Shield, roles: ['admin', 'captain', 'player'] },
    { label: 'My Team', path: '/my-team', icon: Heart, roles: ['captain'] },
    { label: 'User Mgmt', path: '/users', icon: UserCheck, roles: ['admin'] },
    { label: 'Analytics', path: '/analytics', icon: PieChart, roles: ['admin'] },
  ];

  const filteredLinks = navLinks.filter(
    (link) => user && link.roles.includes(user.role)
  );

  const isFieldsLocked = false;

  return (
    <>
      {/* Toast Banner */}
      {activeToast && (
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shadow-lg sticky top-0 z-50 animate-slide-down">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <Sparkles className="w-4 h-4 text-gold-300 animate-pulse flex-shrink-0" />
            <span>{activeToast.message}</span>
          </div>
          <button onClick={clearToast} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <nav className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left Brand Identity */}
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <div className="h-11 px-4 rounded-2xl bg-white border-2 border-blue-500/40 shadow-xl shadow-blue-500/20 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                <img 
                  src="/nikkiso-logo.png" 
                  alt="Nikkiso Logo" 
                  className="h-8 sm:h-9 w-auto object-contain" 
                />
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  NPL AUCTION <Sparkles className="w-3.5 h-3.5 text-gold-400" />
                </span>
                <span className="text-[10px] font-bold text-slate-400 block tracking-widest uppercase">
                  Corporate Premier League 2026
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80">
              {filteredLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                      isActive
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                    {link.path === '/auction' && isConnected && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute -top-0.5 -right-0.5" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right User Actions Menu & Notifications */}
            <div className="flex items-center gap-3">
              
              {/* WS Live Badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                {isConnected ? 'LIVE SYNC' : 'OFFLINE'}
              </div>

              {/* Requirement 6: Notification Dropdown (Admins and Captains ONLY - Hidden from regular players) */}
              {user && (user.role === 'admin' || user.role === 'captain') && (
                <div className="relative">
                  <button
                    onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false); }}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors relative"
                  >
                    <Bell className="w-4 h-4" />
                    {notifications.some(n => !n.is_read) && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5 border-2 border-slate-950" />
                    )}
                  </button>

                  {showNotifs && (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 space-y-3 z-50">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Tournament Feed</span>
                        <span className="text-[10px] text-slate-500">{notifications.length} Unread</span>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">No recent notifications</p>
                        ) : (
                          notifications.slice(0, 10).map((n) => (
                            <div key={n.id} className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1">
                              <p className="leading-snug">{n.message}</p>
                              <span className="text-[9px] text-slate-500 block">{new Date(n.created_at).toLocaleTimeString()}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Profile Dropdown Button */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
                    className="flex items-center gap-2.5 p-1.5 pl-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 border border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {userPhotoUrl ? (
                        <img src={getImageUrl(userPhotoUrl)} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-white">{user.name.charAt(0)}</span>
                      )}
                    </div>

                    <div className="hidden md:block overflow-hidden max-w-[120px]">
                      <span className="text-xs font-bold text-white block truncate">{user.name}</span>
                      <span className="text-[10px] font-extrabold uppercase text-brand-400 block truncate">
                        {user.role}
                      </span>
                    </div>

                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pr-0.5" />
                  </button>

                  {/* Profile Menu Dropdown */}
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 space-y-1 z-50">
                      
                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {userPhotoUrl ? (
                            <img src={getImageUrl(userPhotoUrl)} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-black text-brand-400">{user.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-white truncate">{user.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                          <span className="text-[9px] text-brand-400 font-black uppercase mt-0.5 block">
                            {user.role} Account
                          </span>
                        </div>
                      </div>

                      {user.role === 'admin' && (
                        <button
                          onClick={() => { setShowSettingsModal(true); setShowUserMenu(false); }}
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-brand-400 hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors border border-transparent hover:border-slate-800"
                        >
                          <Settings className="w-4 h-4" />
                          Auction Rules & Settings
                        </button>
                      )}

                      <button
                        onClick={openProfileEdit}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors border border-transparent hover:border-slate-800"
                      >
                        <Edit3 className="w-4 h-4 text-brand-400" />
                        Edit Complete Profile
                      </button>

                      <button
                        onClick={handleLogout}
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white bg-slate-900 border border-slate-800"
              >
                <Menu className="w-5 h-5" />
              </button>

            </div>

          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-slate-800/80 grid grid-cols-2 gap-2">
              {filteredLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </nav>

      {/* Requirement 4: Profile Registration Form Modal with Submitted Fields Locking */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-card rounded-3xl p-6 sm:p-8 w-full max-w-2xl border border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-brand-400" /> Complete Profile Details
              </h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>


            <p className="text-xs text-slate-400">
              Update your corporate player profile information across all tournament records.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              
              {/* Personal & Corporate Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    disabled={isFieldsLocked}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
                  <select
                    disabled={isFieldsLocked}
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80 cursor-pointer"
                  >
                    <option value="">Select Corporate Department...</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Employee ID</label>
                  <input
                    type="text"
                    disabled={isFieldsLocked}
                    value={editEmpId}
                    onChange={(e) => setEditEmpId(e.target.value)}
                    placeholder="EMP-1024"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Age</label>
                  <input
                    type="number"
                    disabled={isFieldsLocked}
                    value={editAge}
                    onChange={(e) => setEditAge(parseInt(e.target.value) || 25)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    disabled={isFieldsLocked}
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    disabled={isFieldsLocked}
                    value={editEmergencyContact}
                    onChange={(e) => setEditEmergencyContact(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  />
                </div>
              </div>

              {/* Requirement 4: Jersey & Cricketing Specs - ALWAYS ACTIVE & EDITABLE */}
              <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block">
                  Jersey Specifications (Editable)
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Name</label>
                    <input
                      type="text"
                      value={editJerseyName}
                      onChange={(e) => setEditJerseyName(e.target.value)}
                      placeholder="VIRAT"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white uppercase focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Number (Max 2 Digits)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editJerseyNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setEditJerseyNumber(val);
                      }}
                      placeholder="07 or 18"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">T-Shirt Size</label>
                    <select
                      value={editTshirtSize}
                      onChange={(e) => setEditTshirtSize(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Category & Styles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                  <select
                    disabled={isFieldsLocked}
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
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
                    disabled={isFieldsLocked}
                    value={editBatting}
                    onChange={(e) => setEditBatting(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                  >
                    <option value="Right Hand">Right Hand</option>
                    <option value="Left Hand">Left Hand</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Bowling Style</label>
                  <select
                    disabled={isFieldsLocked}
                    value={editBowling}
                    onChange={(e) => setEditBowling(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
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
                    disabled={isFieldsLocked}
                    value={editExp}
                    onChange={(e) => setEditExp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
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
                  disabled={isFieldsLocked}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Cricketing bio and notable achievements..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-950/80"
                />
              </div>

              {!isFieldsLocked && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Avatar / Player Photo Upload</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => e.target.files && setEditPhotoFile(e.target.files[0])}
                    className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white cursor-pointer"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Rules & Settings Modal */}
      <AuctionSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* MANDATORY PROFILE COMPLETION / PHOTO & DEPARTMENT ENFORCEMENT MODAL */}
      {isProfileIncomplete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-4 z-[999999] animate-fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl shadow-amber-500/20 space-y-6 relative overflow-hidden text-left">
            {/* Glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Badge */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-inner flex-shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white tracking-wide">Action Required: Profile Photo & Department</h3>
                <p className="text-xs text-amber-400/90 font-medium">Mandatory profile updates for NPL Auction entry</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
              📢 <strong>Official NPL Requirement:</strong> All registered players must upload a clear profile picture and select their official corporate department from the updated dropdown list to participate in the upcoming cricket auction.
            </p>

            <form onSubmit={handleEnforceProfileSubmit} className="space-y-4">
              {/* Photo Upload Section */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                <label className="block text-xs font-bold text-white">
                  1. Profile Picture <span className="text-rose-400">* (Mandatory)</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {enforcePhotoPreview ? (
                      <img src={enforcePhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleEnforcePhotoChange}
                      className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">Upload a clear front-facing headshot (Max 5MB)</span>
                  </div>
                </div>
              </div>

              {/* Department Select Dropdown */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                <label className="block text-xs font-bold text-white">
                  2. Corporate Department <span className="text-rose-400">* (Mandatory)</span>
                </label>
                <select
                  required
                  value={enforceDept}
                  onChange={(e) => setEnforceDept(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Select Official Department...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {enforceError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  {enforceError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingEnforce}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs shadow-lg shadow-amber-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {savingEnforce ? 'Updating Profile...' : 'Save & Continue to NPL Portal'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
