import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Mail, Lock, User as UserIcon, Building, ArrowRight, Sparkles, KeyRound, CheckCircle } from 'lucide-react';

export const AuthPages: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (authMode !== 'login' && !cleanEmail.endsWith('@nikkisoceig.com')) {
      setError('Corporate email must end with @nikkisoceig.com');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'login') {
        const res = await api.post('/auth/login', { email: cleanEmail, password });
        login(res.data.access_token, res.data.user);
        navigate('/dashboard');
      } else if (authMode === 'register') {
        const res = await api.post('/auth/register', {
          name,
          email: cleanEmail,
          password,
          department
        });
        login(res.data.access_token, res.data.user);
        navigate('/register-profile');
      } else if (authMode === 'forgot') {
        const res = await api.post('/auth/reset-password', {
          email: cleanEmail,
          new_password: newPassword
        });
        setSuccessMsg(res.data.message || 'Password reset successfully! Please sign in.');
        setAuthMode('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication operation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Centered Dual-Card Wrapper */}
      <div className="w-full max-w-5xl glass-card rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative z-10 grid grid-cols-1 lg:grid-cols-12">
        
        {/* Left Side: Clean Tournament Poster Card */}
        <div className="lg:col-span-6 p-6 sm:p-8 bg-slate-900/60 flex flex-col justify-center items-center relative border-b lg:border-b-0 lg:border-r border-slate-800/80">
          {/* Tournament Poster Frame */}
          <div className="relative group w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 transform hover:scale-[1.01] transition-transform duration-300">
            <img 
              src="/npl-poster.png" 
              alt="NPL Poster Artwork" 
              className="w-full h-auto object-cover"
            />
          </div>

          <p className="text-xs font-semibold text-slate-300 text-center mt-5 tracking-wide">
            Welcome to the official Nikkiso Corporate Cricket Bidding Portal
          </p>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              NPL Auction Portal <Sparkles className="w-4 h-4 text-gold-400" />
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {authMode === 'login' && 'Sign in with your corporate @nikkisoceig.com credentials'}
              {authMode === 'register' && 'Register your corporate player profile'}
              {authMode === 'forgot' && 'Reset your corporate account password'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-900/80 rounded-xl p-1 mb-6 border border-slate-800">
            <button
              onClick={() => { setAuthMode('login'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'login' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('register'); setError(null); setSuccessMsg(null); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                authMode === 'register' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {successMsg}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium text-center">
              {error}
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Virat Kohli"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Department</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Engineering / Operations"
                      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Corporate Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@nikkisoceig.com"
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {authMode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setError(null); setSuccessMsg(null); }}
                      className="text-[11px] text-brand-400 hover:text-brand-300 font-bold transition-colors"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {authMode === 'forgot' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-6"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {authMode === 'login' && 'Sign In to Platform'}
                  {authMode === 'register' && 'Create Player Account'}
                  {authMode === 'forgot' && 'Reset Password'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {authMode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(null); }}
                className="w-full text-center text-xs text-slate-400 hover:text-white font-semibold pt-2 block"
              >
                Back to Sign In
              </button>
            )}

          </form>

        </div>
      </div>
    </div>
  );
};
