import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api, formatApiError } from '../api/client';
import { Mail, Lock, User as UserIcon, Building, ArrowRight, Sparkles, KeyRound, CheckCircle, ShieldCheck } from 'lucide-react';
import { DEPARTMENTS } from '../types';

export const AuthPages: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'new_password'>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [demoOtpNotice, setDemoOtpNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user, isAuthenticated, login } = useAuthStore();
  const navigate = useNavigate();

  // Automatically redirect logged-in users away from auth pages
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@nikkisoceig.com')) {
      setError('Corporate email must end with @nikkisoceig.com');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-reset-otp', { email: cleanEmail });
      setSuccessMsg(res.data.message || `Verification OTP code generated for ${cleanEmail}.`);
      if (res.data.otp_code) {
        setDemoOtpNotice(`OTP Verification Code: ${res.data.otp_code}`);
        setOtpCode(res.data.otp_code);
      } else {
        setOtpCode('');
      }
      setForgotStep('otp');
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to send OTP code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-reset-otp', {
        email: cleanEmail,
        otp: otpCode.trim()
      });
      setSuccessMsg(res.data.message || 'OTP verified successfully!');
      setDemoOtpNotice(null);
      setForgotStep('new_password');
    } catch (err: any) {
      setError(formatApiError(err, 'Invalid OTP code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        email: cleanEmail,
        otp: otpCode.trim(),
        new_password: newPassword
      });
      setSuccessMsg(res.data.message || 'Password updated successfully! Please sign in.');
      setAuthMode('login');
      setPassword('');
      setOtpCode('');
      setNewPassword('');
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (authMode === 'register' && !cleanEmail.endsWith('@nikkisoceig.com')) {
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
      }
    } catch (err: any) {
      setError(formatApiError(err, 'Authentication failed. Please check your credentials and network.'));
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
              {authMode === 'forgot' && 'Reset your password via corporate email OTP'}
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

          {/* FORGOT PASSWORD MULTI-STEP FLOW */}
          {authMode === 'forgot' ? (
            <div className="space-y-4">
              
              {/* Step Indicators */}
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pb-2 border-b border-slate-800">
                <span className={forgotStep === 'email' ? 'text-brand-400 font-extrabold' : ''}>1. Email</span>
                <span>→</span>
                <span className={forgotStep === 'otp' ? 'text-brand-400 font-extrabold' : ''}>2. Verify OTP</span>
                <span>→</span>
                <span className={forgotStep === 'new_password' ? 'text-brand-400 font-extrabold' : ''}>3. New Password</span>
              </div>

              {/* STEP 1: ENTER EMAIL */}
              {forgotStep === 'email' && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Enter Corporate Email</label>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <> Send OTP Verification Code <ArrowRight className="w-4 h-4" /> </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: ENTER OTP */}
              {forgotStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">6-Digit OTP Code</label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="123456"
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <> Verify OTP Code <ArrowRight className="w-4 h-4" /> </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 3: NEW PASSWORD */}
              {forgotStep === 'new_password' && (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
                  >
                    {loading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <> Update Password & Sign In <CheckCircle className="w-4 h-4" /> </>
                    )}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => { setAuthMode('login'); setError(null); setSuccessMsg(null); }}
                className="w-full text-center text-xs text-slate-400 hover:text-white font-semibold pt-2 block"
              >
                Back to Sign In
              </button>

            </div>
          ) : (

            /* STANDARD SIGN IN / REGISTER FORM */
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              
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
                      <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-3 z-10 pointer-events-none" />
                      <select
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
                      >
                        <option value="">Select Corporate Department...</option>
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
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
                    {authMode === 'login' && 'Sign In to Platform'}
                    {authMode === 'register' && 'Create Player Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Requirement 1: Forgot Password Button Below Sign In Option */}
              {authMode === 'login' && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setForgotStep('email'); setError(null); setSuccessMsg(null); }}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

            </form>
          )}

        </div>
      </div>
    </div>
  );
};
