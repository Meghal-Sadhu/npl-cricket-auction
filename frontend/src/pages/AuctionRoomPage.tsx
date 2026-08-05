import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAuctionStore } from '../store/auctionStore';
import { api, getImageUrl } from '../api/client';
import { PlayerProfile } from '../types';
import { AuctionSettingsModal } from '../components/auction/AuctionSettingsModal';
import { AuctionQueueDrawer } from '../components/auction/AuctionQueueDrawer';
import { PlayerDetailModal } from '../components/players/PlayerDetailModal';
import { 
  Radio, Play, Pause, Square, SkipForward, RotateCcw, Shuffle, 
  DollarSign, Shield, Users, AlertCircle, Clock, Volume2, Sparkles, Gavel, Settings, Search 
} from 'lucide-react';

export const AuctionRoomPage: React.FC = () => {
  const { user } = useAuthStore();
  const { auctionState, isConnected, bidError, placeBid, clearBidError, fetchNotifications, fetchState } = useAuctionStore();

  const [bidErrorLocal, setBidErrorLocal] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalPlayer, setModalPlayer] = useState<PlayerProfile | null>(null);

  // Intermission break countdown & Sold overlay state
  const [intermissionTime, setIntermissionTime] = useState<number | null>(null);
  const [soldOverlay, setSoldOverlay] = useState<{
    player_name: string;
    team_name: string;
    amount: number;
    image_path?: string;
    is_unsold?: boolean;
  } | null>(null);

  // Requirement 3: Direct sale state for Admin
  const [directSellTeamId, setDirectSellTeamId] = useState<string>('');
  const [directSellPriceLakhs, setDirectSellPriceLakhs] = useState<string>('5');

  // Dynamic max timer tracking for ring calculation
  const [maxTimerDuration, setMaxTimerDuration] = useState<number>(30);

  useEffect(() => {
    fetchSettingsMaxTimer();
    if (bidError) {
      setBidErrorLocal(bidError);
      const timer = setTimeout(() => {
        clearBidError();
        setBidErrorLocal(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [bidError]);

  const fetchSettingsMaxTimer = async () => {
    try {
      const res = await api.get('/auction/settings');
      if (res.data && res.data.timer_seconds) {
        setMaxTimerDuration(res.data.timer_seconds);
      }
    } catch (err) {}
  };

  const isLive = auctionState?.status === 'live';
  const currentPlayer = auctionState?.current_player;
  const currentPrice = auctionState?.highest_bid || (currentPlayer?.base_price || 500000);

  const getBidIncrementsForPrice = (price: number): number[] => {
    if (price <= 2000000) {
      return [25000, 50000, 100000, 500000];
    } else if (price <= 5000000) {
      return [50000, 100000, 250000, 500000];
    } else if (price <= 10000000) {
      return [100000, 250000, 500000, 1000000];
    } else if (price <= 20000000) {
      return [250000, 500000, 1000000, 2500000];
    } else if (price <= 30000000) {
      return [500000, 1000000, 2500000, 5000000];
    } else if (price <= 40000000) {
      return [1000000, 2500000, 5000000];
    } else {
      return [2500000, 5000000];
    }
  };

  const incrementOptions = getBidIncrementsForPrice(currentPrice);

  const formatPrice = (val: number | null | undefined) => {
    if (val === null || val === undefined || val === 0.0) return 'Hidden';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  const handleAdminAction = async (actionPath: string) => {
    try {
      await api.post(`/auction/${actionPath}`);
      fetchNotifications();
    } catch (err: any) {
      setBidErrorLocal(err.response?.data?.detail || 'Admin action failed');
    }
  };

  const handlePlaceBid = (increment: number) => {
    const nextBid = currentPrice + increment;
    placeBid(nextBid);
  };

  // Requirement 3: Admin Direct Sale at specified price in Lakhs
  const handleDirectSell = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directSellTeamId) {
      setBidErrorLocal('Please select a franchise team to sell the player to.');
      return;
    }
    const lakhs = parseFloat(directSellPriceLakhs);
    if (isNaN(lakhs) || lakhs <= 0) {
      setBidErrorLocal('Please enter a valid sale price in Lakhs.');
      return;
    }

    try {
      await api.post('/auction/direct-sell', {
        team_id: parseInt(directSellTeamId),
        price_in_lakhs: lakhs
      });
      fetchNotifications();
      fetchState();
    } catch (err: any) {
      setBidErrorLocal(err.response?.data?.detail || 'Direct sell action failed');
    }
  };

  const openPlayerModalById = async (playerId: number) => {
    try {
      const res = await api.get<PlayerProfile>(`/players/${playerId}`);
      setModalPlayer(res.data);
    } catch (err) {
      console.error('Failed to load player details:', err);
    }
  };

  // User's Team & Highest Bidder Status - Strictly scoped to CURRENT active player on hammer
  const userTeam = auctionState?.teams.find(t => t.captain_id === user?.id);
  const isUserHighestBidder = Boolean(
    userTeam && 
    currentPlayer?.id && 
    auctionState?.highest_bidder_team?.id === userTeam.id &&
    auctionState?.bids &&
    auctionState.bids.length > 0 &&
    auctionState.bids[0].team_id === userTeam.id
  );

  // Intermission Break & Sold Overlay Calculations
  const timerSeconds = auctionState?.timer_seconds ?? maxTimerDuration;
  const isIntermission = auctionState?.status === 'intermission';
  const activeSoldInfo = soldOverlay || auctionState?.last_sold_info;
  const currentIntermissionSeconds = intermissionTime ?? auctionState?.intermission_seconds ?? timerSeconds;

  // Timer Calculation
  const currentMax = Math.max(maxTimerDuration, timerSeconds);
  const timerPercentage = Math.min(100, Math.max(0, (timerSeconds / currentMax) * 100));
  const strokeDashoffset = 377 - (377 * timerPercentage) / 100;

  return (
    <div className="space-y-6 pb-12 relative">
      
      {/* SOLD / UNSOLD PLAYER CELEBRATION MODAL OVERLAY */}
      {activeSoldInfo && isIntermission && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-card rounded-3xl p-8 sm:p-10 w-full max-w-lg border-2 border-gold-400/50 text-center space-y-6 relative overflow-hidden shadow-2xl shadow-gold-500/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-lg inline-flex items-center gap-1.5 ${
              activeSoldInfo.is_unsold
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-gold-500/20 text-gold-400 border-gold-500/30'
            }`}>
              <Sparkles className="w-4 h-4" /> {activeSoldInfo.is_unsold ? '⚠️ PLAYER UNSOLD' : '🎉 PLAYER SOLD!'}
            </span>

            <div className="w-40 h-40 mx-auto rounded-3xl bg-slate-900 border-4 border-gold-400/80 overflow-hidden shadow-2xl flex items-center justify-center">
              {activeSoldInfo.image_path ? (
                <img src={getImageUrl(activeSoldInfo.image_path)} alt={activeSoldInfo.player_name} className="w-full h-full object-cover object-top" />
              ) : (
                <span className="text-5xl font-black text-gold-400">{activeSoldInfo.player_name?.charAt(0)}</span>
              )}
            </div>

            <div>
              <h2 className="text-3xl font-black text-white tracking-tight">{activeSoldInfo.player_name}</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">
                {activeSoldInfo.is_unsold ? 'PASSED AT BASE PRICE' : `SOLD TO ${activeSoldInfo.team_name.toUpperCase()}`}
              </p>
              <div className="mt-3 inline-block px-6 py-2 rounded-2xl bg-gold-500/20 border border-gold-400/40 text-gold-400 font-black text-2xl font-mono shadow-xl">
                {formatPrice(activeSoldInfo.amount)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-gold-400/30 text-xs text-slate-300 font-bold flex items-center justify-center gap-2 shadow-inner">
              <Clock className="w-4.5 h-4.5 text-gold-400 animate-spin" />
              Next Player Starting In: <span className="text-gold-400 font-black font-mono text-base">{currentIntermissionSeconds}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Header Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">NPL Auction Console</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
              isLive 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : auctionState?.status === 'paused'
                ? 'bg-gold-500/20 text-gold-400 border-gold-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Radio className={`w-3.5 h-3.5 ${isLive ? 'animate-pulse text-emerald-400' : ''}`} />
              {auctionState?.status === 'live' ? 'LIVE AUCTION' : auctionState?.status === 'intermission' ? 'POST-SALE BREAK' : auctionState?.status === 'paused' ? 'AUCTION PAUSED' : 'AUCTION READY'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Official Nikkiso Corporate Cricket Premier League 2027 Auction Portal</p>
        </div>

        {user?.role === 'admin' && (
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Settings className="w-4 h-4 text-brand-400" /> Auction Rules & Rules Settings
          </button>
        )}
      </div>

      {/* 15-Second Post-Sale Intermission Break Countdown Banner */}
      {isIntermission && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-gold-500/20 via-amber-500/20 to-gold-500/20 border-2 border-gold-400/50 text-gold-300 text-sm font-black flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gold-400 animate-spin" />
            <span>⏸️ 15-SECOND POST-SALE INTERMISSION BREAK (AUTO-RESUMING NEXT PLAYER)</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 px-4 py-1.5 rounded-xl border border-gold-400/30">
            <span className="text-xs text-slate-400 font-bold uppercase">Next Player In:</span>
            <span className="text-xl font-extrabold font-mono text-gold-400">{currentIntermissionSeconds}s</span>
          </div>
        </div>
      )}

      {/* Error Alert Toast */}
      {bidErrorLocal && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {bidErrorLocal}
          </div>
          <button onClick={() => setBidErrorLocal(null)} className="text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left (Active Player & Controls) | Right (Highest Bid & Bidding Console & Teams) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Active Player Card & Admin Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Player Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-widest text-brand-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Active Player on Hammer
              </span>
              {currentPlayer && (
                <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-extrabold border border-brand-500/30">
                  {currentPlayer.category}
                </span>
              )}
            </div>

            {currentPlayer ? (
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                
                {/* Photo */}
                <div 
                  onClick={() => openPlayerModalById(currentPlayer.id)}
                  className="w-36 h-44 sm:w-44 sm:h-52 rounded-2xl bg-slate-900 border-2 border-slate-700 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-2xl group cursor-pointer relative"
                >
                  {currentPlayer.image_path ? (
                    <img src={getImageUrl(currentPlayer.image_path)} alt={currentPlayer.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform" />
                  ) : (
                    <span className="text-4xl font-black text-white">{currentPlayer.name.charAt(0)}</span>
                  )}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-wider">
                    Click for Profile
                  </div>
                </div>

                {/* Specs */}
                <div className="space-y-3 flex-1 text-center sm:text-left">
                  <div>
                    <h2 
                      onClick={() => openPlayerModalById(currentPlayer.id)}
                      className="text-2xl sm:text-3xl font-black text-white tracking-tight hover:text-brand-400 transition-colors cursor-pointer"
                    >
                      {currentPlayer.name}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">
                      {currentPlayer.department || 'General'} • Emp ID: {currentPlayer.employee_id || 'N/A'} • Exp: {currentPlayer.experience_level}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Batting</span>
                      <strong className="text-white">{currentPlayer.batting_style || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Bowling</span>
                      <strong className="text-white">{currentPlayer.bowling_style || 'N/A'}</strong>
                    </div>
                  </div>

                  {currentPlayer.bio && (
                    <p className="text-xs text-slate-300 italic line-clamp-2 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50">
                      "{currentPlayer.bio}"
                    </p>
                  )}

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold uppercase">Base Price</span>
                    <strong className="text-gold-400 text-base font-black">{formatPrice(currentPlayer.base_price)}</strong>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-16 text-center space-y-3">
                <Gavel className="w-12 h-12 text-slate-600 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-white">No Player Currently on Hammer</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {user?.role === 'admin' 
                    ? 'Use the Console Controls below to Start the auction or select a player from the Queue.'
                    : 'Waiting for Admin to put the next player on the auction block.'}
                </p>
              </div>
            )}
          </div>

          {/* Admin Controls Panel - Placed RIGHT BELOW Active Player on Hammer */}
          {user?.role === 'admin' && (
            <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand-400" /> Admin Live Console Controls
                </h4>
                <span className="text-[10px] text-slate-500 uppercase font-bold">
                  {auctionState?.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {auctionState?.status !== 'live' ? (
                  <button
                    onClick={() => handleAdminAction(auctionState?.status === 'paused' ? 'resume' : 'start')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> {auctionState?.status === 'paused' ? '▶️ Resume Auction' : '▶️ Start Auction'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdminAction('pause')}
                    className="px-4 py-2.5 rounded-xl bg-gold-600 hover:bg-gold-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-gold-500/20 cursor-pointer"
                  >
                    <Pause className="w-4 h-4" /> ⏸️ Pause Auction
                  </button>
                )}

                <button
                  disabled={!isLive || !currentPlayer}
                  onClick={() => handleAdminAction('award-player')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer"
                >
                  <Gavel className="w-4 h-4" /> 🔨 Award / Sell Player Now
                </button>

                <button
                  disabled={!isLive}
                  onClick={() => handleAdminAction('next-player')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" /> Next Player
                </button>

                <button
                  disabled={!isLive}
                  onClick={() => handleAdminAction('skip-player')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 font-bold text-xs flex items-center gap-2 border border-slate-700 cursor-pointer"
                >
                  Skip Current
                </button>

                <button
                  disabled={!isLive}
                  onClick={() => handleAdminAction('shuffle-queue')}
                  title="Shuffle Queue randomly reorders all upcoming queued players."
                  className="px-4 py-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-300 font-bold text-xs flex items-center gap-2 border border-indigo-500/30 cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" /> Shuffle Queue
                </button>
              </div>

              {/* Admin Direct Sale Form */}
              <form onSubmit={handleDirectSell} className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3 text-left">
                <label className="block text-[11px] font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5 text-gold-400" /> Direct Sale to Franchise (Specify Price in Lakhs)
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Target Team</label>
                    <select
                      required
                      value={directSellTeamId}
                      onChange={(e) => setDirectSellTeamId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="">Select Team</option>
                      {auctionState?.teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Sale Price (₹ in Lakhs)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="5"
                        required
                        value={directSellPriceLakhs}
                        onChange={(e) => setDirectSellPriceLakhs(e.target.value)}
                        placeholder="e.g. 25"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-12 py-1.5 text-xs text-white font-mono"
                      />
                      <span className="text-[10px] font-bold text-gold-400 absolute right-3 top-2">Lakh</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!directSellTeamId}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Gavel className="w-3.5 h-3.5" /> Sell at ₹{directSellPriceLakhs || '0'} Lakh Now
                </button>
              </form>
            </div>
          )}

          {/* CURRENT HIGHEST BIDDER & LEADERBOARD BANNER */}
          <div className="glass-card rounded-3xl p-5 border-2 border-gold-400/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-center space-y-3 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gavel className="w-4 h-4" /> Current Highest Bid on Hammer
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {auctionState?.bids?.length || 0} Bids Placed
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-2">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block text-left">Active Price</span>
                <p className="text-3xl font-black text-gold-400 tracking-tight font-mono">{formatPrice(currentPrice)}</p>
              </div>

              {auctionState?.highest_bidder_team ? (
                <div className="flex items-center gap-3 bg-brand-500/10 px-4 py-2 rounded-2xl border border-brand-500/30">
                  <Shield className="w-6 h-6 text-brand-400" />
                  <div className="text-right">
                    <span className="text-[9px] text-brand-400 font-bold uppercase block">Highest Bidder</span>
                    <strong className="text-white text-sm font-extrabold">{auctionState.highest_bidder_team.name}</strong>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-500 font-medium">Opening Bid at Base Price</span>
              )}
            </div>

            {/* Consecutive Bid Block Warning Badge */}
            {user?.role === 'captain' && isUserHighestBidder && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" /> You are currently the highest bidder! Wait for another team to place a bid.
              </div>
            )}
          </div>

          {/* Embedded Interactive Auction Queue Drawer - VISIBLE ONLY TO ADMIN */}
          {user?.role === 'admin' && (
            <AuctionQueueDrawer
              queue={auctionState?.queue || []}
              isAdmin={true}
              onRefresh={fetchState}
              onSelectPlayer={openPlayerModalById}
            />
          )}
        </div>

        {/* Right Column: Timer Ring, Bidding Buttons & Franchise Overview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Bidding & Timer Card */}
          <div className="glass-card rounded-3xl p-6 border border-slate-800 text-center space-y-6">
            
            {/* Circular Timer Ring */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-900"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="60"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={`transition-all duration-1000 ${
                    timerSeconds <= 5 ? 'text-rose-500' : timerSeconds <= 10 ? 'text-gold-400' : 'text-brand-500'
                  }`}
                  fill="transparent"
                  strokeDasharray="377"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${timerSeconds <= 5 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                  {timerSeconds}s
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Hammer Countdown</span>
              </div>
            </div>

            {/* Dynamic Tiered Bid Buttons for Captains */}
            {user?.role === 'captain' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>Place Bid Increment</span>
                  <span className="text-brand-400 font-mono">{formatPrice(currentPrice)} Tier</span>
                </div>

                <div className={`grid ${incrementOptions.length === 4 ? 'grid-cols-2' : 'grid-cols-2'} gap-2.5`}>
                  {incrementOptions.map((inc) => (
                    <button
                      key={inc}
                      disabled={!currentPlayer || !isLive || isUserHighestBidder}
                      onClick={() => handlePlaceBid(inc)}
                      className="py-3 px-2 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-brand-500/25 flex flex-col items-center justify-center transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>+{formatPrice(inc)}</span>
                      <span className="text-[9px] font-normal opacity-80">Bid {formatPrice(currentPrice + inc)}</span>
                    </button>
                  ))}
                </div>

                {isUserHighestBidder && (
                  <p className="text-[11px] text-amber-400 font-bold italic">
                    * Bidding disabled while your team is the highest bidder.
                  </p>
                )}
              </div>
            )}

          </div>

          {/* Live Bids History Feed Card with Highest Bid Info inside Header */}
          <div className="glass-card rounded-3xl p-4 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-gold-400">
                <Gavel className="w-3.5 h-3.5" /> Recent Bids History
              </span>
              
              {/* Requirement 4: Show Highest Bid Message Inside Recent Bids History Title */}
              {auctionState?.highest_bidder_team ? (
                <span className="px-2.5 py-1 rounded-xl bg-gold-500/20 text-gold-400 border border-gold-500/30 text-[10px] font-black truncate max-w-[200px]">
                  Top: {formatPrice(currentPrice)} ({auctionState.highest_bidder_team.name})
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">
                  Base: {formatPrice(currentPrice)}
                </span>
              )}
            </h4>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {!auctionState?.bids || auctionState.bids.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No bids placed yet on current player</p>
              ) : (
                auctionState.bids.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center font-bold text-brand-400 text-[10px]">
                        {b.team_name.charAt(0)}
                      </div>
                      <div>
                        <strong className="text-white block font-bold">{b.team_name}</strong>
                        <span className="text-[9px] text-slate-500">{new Date(b.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-gold-400 font-mono bg-gold-500/10 px-2.5 py-1 rounded-xl border border-gold-500/20">
                      {formatPrice(b.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Requirement 9: Franchises Overview Panel */}
          <div className="glass-card rounded-3xl p-4 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Franchises Overview</span>
              <span className="text-[10px] text-slate-500 font-normal">Live Budget & Roster</span>
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {auctionState?.teams.map((t) => (
                <div key={t.id} className="p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate pr-2">
                    <strong className="text-white block truncate font-bold">{t.name}</strong>
                    <span className="text-[10px] text-slate-400">{t.total_assigned_players ?? t.players_count ?? 0} Players Assigned</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 block font-mono">
                      {formatPrice(t.spendable_budget)}
                    </span>
                    <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Spendable</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Admin Rules & Settings Modal */}
      <AuctionSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={() => { fetchState(); fetchSettingsMaxTimer(); }}
      />

      {/* Rich Player Detail Modal */}
      <PlayerDetailModal
        player={modalPlayer}
        onClose={() => setModalPlayer(null)}
      />

    </div>
  );
};
