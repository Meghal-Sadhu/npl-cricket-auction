import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../api/client';
import { Trophy, Mail, Lock, User as UserIcon, Building, ArrowRight, Sparkles } from 'lucide-react';

export const AuthPages: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && !email.trim().toLowerCase().endsWith('@nikkisoceig.com')) {
      setError('Registration is strictly restricted to @nikkisoceig.com email addresses.');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        login(res.data.access_token, res.data.user);
        navigate('/dashboard');
      } else {
        const res = await api.post('/auth/register', {
          name,
          email,
          password,
          department
        });
        login(res.data.access_token, res.data.user);
        navigate('/register-profile');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check credentials.');
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
        
        {/* Left Side: Tournament Poster Showcase Card */}
        <div className="lg:col-span-6 p-6 sm:p-8 bg-slate-900/60 flex flex-col justify-between items-center relative border-b lg:border-b-0 lg:border-r border-slate-800/80">
          
          {/* Header Nikkiso Branding */}
          <div className="w-full flex items-center justify-between mb-4">
            <div className="bg-white/95 px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-md">
              <img src="/nikkiso-logo.png" alt="Nikkiso Logo" className="h-5 w-auto object-contain" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/30">
              Official League 2027
            </span>
          </div>

          {/* Tournament Poster Frame */}
          <div className="relative group my-2 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 transform hover:scale-[1.02] transition-transform duration-300">
            <img 
              src="/npl-poster.png" 
              alt="Nikkiso Premier League 2027 Poster" 
              className="w-full h-auto object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <p className="text-xs font-bold text-white tracking-wide">ONE LEAGUE. ONE SPIRIT. ONE NIKKISO.</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-4 font-medium tracking-wide">
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
              {isLogin ? 'Sign in with your corporate @nikkisoceig.com credentials' : 'Register your corporate player profile'}
            </p>
          </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900/80 rounded-xl p-1 mb-6 border border-slate-800">
          <button
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              isLogin ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              !isLogin ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Register Player
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLogin && (
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-6"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In to Platform' : 'Create Player Account'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

        </form>

        </div>
      </div>
    </div>
  );
};
