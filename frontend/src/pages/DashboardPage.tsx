import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAuctionStore } from '../store/auctionStore';
import { api } from '../api/client';
import { 
  Users, Shield, Radio, Trophy, DollarSign, PieChart, 
  TrendingUp, Award, CheckCircle, Clock, ArrowUpRight, Sparkles 
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { auctionState, fetchState } = useAuctionStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchState();
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (user?.role === 'admin') {
        const res = await api.get('/analytics/dashboard');
        setAnalytics(res.data);
      } else if (user?.role === 'captain') {
        const res = await api.get('/teams/my-team');
        setMyTeam(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '••••••';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-8">
      
      {/* Welcome Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider border border-brand-500/30">
                {user?.role} Portal
              </span>
              <span className="text-xs text-slate-400 font-medium">{user?.department}</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              NPL Live Auction Session is currently <span className="text-emerald-400 font-bold uppercase">{auctionState?.status.replace('_', ' ') || 'READY'}</span>.
            </p>
          </div>

          {/* Enter Auction Room Button shown ONLY to Admins & Captains! (Issue 2) */}
          {(user?.role === 'admin' || user?.role === 'captain') && (
            <div className="flex items-center gap-3">
              <Link
                to="/auction"
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-brand-500/25 flex items-center gap-2 transition-all hover:scale-105"
              >
                <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                Enter Auction Room
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ADMIN DASHBOARD VIEW */}
      {user?.role === 'admin' && analytics && (
        <div className="space-y-6">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Players</span>
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-3">{analytics.kpis.total_players}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">Registered in pool</span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Sold Players</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-3">{analytics.kpis.sold_players}</p>
              <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                {analytics.kpis.completion_percentage}% Completed
              </span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Unsold Players</span>
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-white mt-3">{analytics.kpis.unsold_players}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">Available for re-auction</span>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Highest Sold</span>
                <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400">
                  <Trophy className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-gold-400 mt-3">{formatPrice(analytics.kpis.highest_price)}</p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {analytics.highest_sold_player?.name || 'No sales yet'}
              </span>
            </div>
          </div>

          {/* Teams Budget Breakdown */}
          <div className="glass-card rounded-3xl p-6 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-brand-400" />
              Franchises Budget & Squad Progress
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.team_spend_breakdown.map((t: any) => (
                <div key={t.team_id} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{t.team_name}</h4>
                      <p className="text-xs text-slate-400">Captain: {t.captain_name}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold">
                      {t.player_count} / 11 Players
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/60 p-2.5 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Budget</span>
                      <span className="font-bold text-slate-300">{formatPrice(t.budget_total)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Used Budget</span>
                      <span className="font-bold text-rose-400">{formatPrice(t.budget_used)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Spendable Balance</span>
                      <span className="font-bold text-emerald-400">{formatPrice(t.spendable_budget)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* CAPTAIN DASHBOARD VIEW */}
      {user?.role === 'captain' && myTeam && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Squad Fill Card */}
            <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Squad Completion</span>
                <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold">
                  {myTeam.players_count} / 11 Players
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-brand-600 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(myTeam.players_count / 11) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                * You need <strong className="text-white">{Math.max(0, 11 - myTeam.players_count)}</strong> more player(s) to complete your 11-player squad.
              </p>
            </div>

            {/* Spendable Balance Card */}
            <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase">My Available Spendable Budget</span>
              <p className="text-3xl font-extrabold text-emerald-400">{formatPrice(myTeam.spendable_budget)}</p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex justify-between">
                <span>Reserved Base Price:</span>
                <strong className="text-slate-200">{formatPrice(myTeam.reserved_budget)}</strong>
              </div>
            </div>

            {/* Quick Wishlist Link */}
            <div className="glass-card rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold-400" />
                  Captain Wishlist
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Bookmark key players to target during the live auction session.
                </p>
              </div>
              <Link
                to="/my-team"
                className="mt-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-brand-400 flex items-center justify-center gap-1.5 transition-colors border border-slate-800"
              >
                View My Squad & Wishlist <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* PLAYER DASHBOARD VIEW */}
      {user?.role === 'player' && (
        <div className="glass-card rounded-3xl p-8 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Player Profile Active</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You are registered as a player in the NPL Cricket Auction Pool. Keep your registration profile updated for team captains during bidding!
          </p>
          <Link
            to="/register-profile"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-colors"
          >
            Edit Player Profile
          </Link>
        </div>
      )}

    </div>
  );
};
