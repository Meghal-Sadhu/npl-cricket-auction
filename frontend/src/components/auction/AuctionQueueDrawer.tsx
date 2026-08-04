import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { QueueItem } from '../../types';
import { api } from '../../api/client';
import { ListFilter, RotateCcw, CheckCircle, Clock, Search, Shield, Gavel } from 'lucide-react';

interface Props {
  queue: QueueItem[];
  isAdmin: boolean;
  onRefresh: () => void;
  onSelectPlayer?: (playerId: number) => void;
}

export const AuctionQueueDrawer: React.FC<Props> = ({ queue, isAdmin, onRefresh, onSelectPlayer }) => {
  const [activeTab, setActiveTab] = useState<'queued' | 'unsold' | 'sold'>('queued');
  const [search, setSearch] = useState('');

  const filteredQueue = queue.filter(item => {
    const isQueued = item.status === 'queued' && !item.is_sold;
    const isSold = item.status === 'sold' || item.is_sold;
    const isUnsold = item.status === 'unsold' && !item.is_sold;

    const matchesTab = activeTab === 'queued' ? isQueued : (activeTab === 'sold' ? isSold : isUnsold);
    const matchesSearch = item.player_name.toLowerCase().includes(search.toLowerCase()) ||
                          item.category.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleReAuction = async (playerId: number) => {
    try {
      await api.post(`/auction/re-auction-player/${playerId}`);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to re-auction player');
    }
  };

  const handlePutOnHammer = async (playerId: number) => {
    try {
      await api.post(`/auction/select-player/${playerId}`);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to put player on auction hammer');
    }
  };

  const [revokeConfirmItem, setRevokeConfirmItem] = useState<{ id: number; name: string } | null>(null);

  const executeRevokePlayer = async () => {
    if (!revokeConfirmItem) return;
    try {
      await api.post(`/auction/revoke-player/${revokeConfirmItem.id}`);
      setRevokeConfirmItem(null);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to revoke player');
    }
  };

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-brand-400" /> Auction Queue Manager (Admin Only)
        </h4>

        {/* Tab switcher */}
        <div className="flex bg-slate-900/90 rounded-xl p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('queued')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'queued' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Queued ({queue.filter(q => q.status === 'queued' && !q.is_sold).length})
          </button>
          <button
            onClick={() => setActiveTab('unsold')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'unsold' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Unsold ({queue.filter(q => q.status === 'unsold' && !q.is_sold).length})
          </button>
          <button
            onClick={() => setActiveTab('sold')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'sold' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sold ({queue.filter(q => q.status === 'sold' || q.is_sold).length})
          </button>
        </div>
      </div>

      {/* Search Input for Admin Queue */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search queued players by name or category..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Queue items list */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {filteredQueue.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No players in this queue category</p>
        ) : (
          filteredQueue.map(item => (
            <div key={item.id} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-lg bg-slate-950 text-slate-400 text-[10px] font-bold flex items-center justify-center border border-slate-800">
                  #{item.order_index + 1}
                </span>
                <div>
                  <h5 className="font-bold text-white cursor-pointer hover:text-brand-400 transition-colors" onClick={() => onSelectPlayer && onSelectPlayer(item.player_id)}>
                    {item.player_name}
                  </h5>
                  <span className="text-[10px] text-slate-400">{item.category} • Base {formatPrice(item.base_price)}</span>
                </div>
              </div>

              {/* Action buttons for Admin */}
              <div className="flex items-center gap-2">
                {activeTab === 'queued' && isAdmin && (
                  <button
                    onClick={() => handlePutOnHammer(item.player_id)}
                    className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-md shadow-brand-500/20"
                    title="Put player on auction hammer immediately"
                  >
                    <Gavel className="w-3 h-3" /> Put on Hammer
                  </button>
                )}

                {activeTab === 'unsold' && isAdmin && (
                  <button
                    onClick={() => handleReAuction(item.player_id)}
                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-md shadow-brand-500/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Re-Auction
                  </button>
                )}

                {activeTab === 'sold' && isAdmin && (
                  <button
                    onClick={() => setRevokeConfirmItem({ id: item.player_id, name: item.player_name })}
                    className="px-2.5 py-1 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 text-[10px] font-bold flex items-center gap-1 border border-amber-500/30 transition-colors"
                    title="Revoke team assignment and send back to auction pool"
                  >
                    <RotateCcw className="w-3 h-3" /> Revoke & Re-Auction
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Screen-Centered Glassmorphic Revoke Confirmation Modal */}
      {revokeConfirmItem && createPortal(
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
                Are you sure you want to revoke <span className="text-amber-400 font-extrabold underline decoration-amber-500/50 underline-offset-4">{revokeConfirmItem.name}</span> from their assigned team? This will refund the team budget and return the player to the unsold pool for re-auction.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setRevokeConfirmItem(null)}
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

    </div>
  );
};
