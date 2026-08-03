import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AnalyticsDashboard } from '../types';
import { 
  Trophy, Users, Shield, DollarSign, Download, PieChart, 
  BarChart3, Award, TrendingUp, CheckCircle, Clock 
} from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get<AnalyticsDashboard>('/analytics/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  const downloadAuctionSummaryCSV = () => {
    if (!data || !data.team_spend_breakdown) return;
    let csv = 'Team Name,Captain,Players Acquired,Total Budget,Used Budget,Spendable Balance\n';
    data.team_spend_breakdown.forEach(t => {
      csv += `"${t.team_name}","${t.captain_name}",${t.player_count},${t.budget_total},${t.budget_used},${t.spendable_budget}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NPL_Auction_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadFranchiseSquadsCSV = async () => {
    try {
      const res = await api.get('/teams');
      const teams = res.data;
      let csv = 'Franchise,Captain,Player Name,Department,Category,Batting Style,Bowling Style,Purchase Price (₹)\n';

      teams.forEach((t: any) => {
        if (t.players && t.players.length > 0) {
          t.players.forEach((p: any) => {
            csv += `"${t.name}","${t.captain_name || ''}","${p.player.user_name}","${p.player.department || ''}","${p.player.category}","${p.player.batting_style || ''}","${p.player.bowling_style || ''}",${p.purchase_price}\n`;
          });
        }
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `NPL_Franchise_Squads_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to download franchise squads CSV');
    }
  };

  const downloadJerseySpecsCSV = async () => {
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
    } catch (err) {
      alert('Failed to download Jersey Specs CSV');
    }
  };

  if (loading) return <div className="py-12 text-center text-xs text-slate-500">Loading analytics dashboard...</div>;
  if (!data || !data.kpis) return <div className="py-12 text-center text-xs text-slate-500">No analytics data available</div>;

  const categoryEntries = Object.entries(data.category_distribution || {});
  const deptEntries = Object.entries(data.department_distribution || {});

  return (
    <div className="space-y-6">
      
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Auction Analytics & Reports</h1>
          <p className="text-xs text-slate-400">Comprehensive category distribution, franchise spending breakdowns, and downloadable tournament reports</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Requirement 6: Export Jersey Specs CSV Download */}
          <button
            onClick={downloadJerseySpecsCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-brand-400 font-bold text-xs flex items-center gap-1.5 border border-slate-800 shadow-md"
          >
            <Download className="w-4 h-4" /> Export Jersey Specs CSV
          </button>
          
          <button
            onClick={downloadAuctionSummaryCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-800 shadow-md"
          >
            <Download className="w-4 h-4" /> Export Summary CSV
          </button>
          <button
            onClick={downloadFranchiseSquadsCSV}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/25"
          >
            <Download className="w-4 h-4" /> Export Squad Rosters CSV
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Total Pool</span>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-3">{data.kpis.total_players}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Registered Players</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Completion</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-3">{data.kpis.completion_percentage}%</p>
          <span className="text-[11px] text-slate-500 mt-1 block">{data.kpis.sold_players} Sold • {data.kpis.unsold_players} Unsold</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Highest Purchase</span>
            <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gold-400 mt-3">{formatPrice(data.kpis.highest_price)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block truncate">{data.highest_sold_player?.name || 'N/A'}</span>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Average Bid Price</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-indigo-300 mt-3">{formatPrice(data.kpis.avg_price)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Per Sold Player</span>
        </div>
      </div>

      {/* Category Breakdown & Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Breakdown */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-brand-400" /> Player Category Breakdown
          </h3>
          <div className="space-y-3">
            {categoryEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No categories registered</p>
            ) : (
              categoryEntries.map(([catName, count]) => (
                <div key={catName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{catName}</span>
                    <span className="text-brand-400 font-bold">{count} Players</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full"
                      style={{ width: `${data.kpis.total_players > 0 ? (count / data.kpis.total_players) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Corporate Department Distribution
          </h3>
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {deptEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No departments specified</p>
            ) : (
              deptEntries.map(([deptName, count]) => (
                <div key={deptName} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{deptName || 'General'}</span>
                  <span className="px-2.5 py-1 rounded-full bg-brand-500/20 text-brand-400 font-extrabold">
                    {count} Registered Players
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Franchise Budget & Spending Master Table */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4 overflow-x-auto">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-gold-400" /> Master Franchise Expenditure Report
        </h3>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase">
              <th className="py-3 px-4">Franchise Team</th>
              <th className="py-3 px-4">Captain</th>
              <th className="py-3 px-4">Roster Size</th>
              <th className="py-3 px-4">Total Budget</th>
              <th className="py-3 px-4">Budget Spent</th>
              <th className="py-3 px-4">Spendable Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.team_spend_breakdown && data.team_spend_breakdown.map(t => (
              <tr key={t.team_id} className="hover:bg-slate-900/50">
                <td className="py-3 px-4 font-bold text-white">{t.team_name}</td>
                <td className="py-3 px-4 text-slate-300">{t.captain_name}</td>
                <td className="py-3 px-4 font-semibold text-brand-400">{t.player_count} / 11 Players</td>
                <td className="py-3 px-4 text-slate-300 font-mono">{formatPrice(t.budget_total)}</td>
                <td className="py-3 px-4 text-rose-400 font-bold font-mono">{formatPrice(t.budget_used)}</td>
                <td className="py-3 px-4 text-emerald-400 font-bold font-mono">{formatPrice(t.spendable_budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
