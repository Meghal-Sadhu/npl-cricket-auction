import React, { useEffect, useState } from 'react';
import { api, getImageUrl } from '../api/client';
import { Team, PlayerProfile } from '../types';
import { PlayerDetailModal } from '../components/players/PlayerDetailModal';
import { Shield, Heart, Trash2, Users, DollarSign, Award, Eye } from 'lucide-react';

export const MyTeamPage: React.FC = () => {
  const [team, setTeam] = useState<Team | null>(null);
  const [wishlist, setWishlist] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalPlayer, setModalPlayer] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    fetchMyTeamData();
  }, []);

  const fetchMyTeamData = async () => {
    setLoading(true);

    // 1. Fetch Captain Team Details
    try {
      const teamRes = await api.get<Team>('/teams/my-team');
      setTeam(teamRes.data);
    } catch (err: any) {
      console.error('Failed to load captain team data:', err);
    }

    // 2. Fetch Wishlist Details (Correct route /api/player-pool/wishlist)
    try {
      const wishRes = await api.get<PlayerProfile[]>('/player-pool/wishlist');
      setWishlist(wishRes.data || []);
    } catch (err: any) {
      console.error('Wishlist load info:', err);
      setWishlist([]);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (playerId: number) => {
    try {
      await api.delete(`/player-pool/wishlist/${playerId}`);
      setWishlist(wishlist.filter(p => p.id !== playerId));
    } catch (err) {
      alert('Failed to remove from wishlist');
    }
  };

  const formatPrice = (val: number | null | undefined) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  if (loading) return <div className="py-12 text-center text-xs text-slate-500">Loading your franchise...</div>;
  if (!team) return (
    <div className="glass-card rounded-3xl p-12 text-center text-slate-400 space-y-3 border border-slate-800">
      <Shield className="w-10 h-10 mx-auto text-slate-600" />
      <h3 className="text-base font-bold text-white">No Team Assigned Yet</h3>
      <p className="text-xs text-slate-400 max-w-md mx-auto">
        Your account is registered as a Captain, but no franchise team has been linked to your account yet by the Admin.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="glass-card rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
            {team.logo_path ? (
              <img src={getImageUrl(team.logo_path)} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-brand-400">{team.name.charAt(0)}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{team.name}</h1>
            <p className="text-xs text-slate-400">Captain: <strong className="text-white">{team.captain_name}</strong></p>
          </div>
        </div>

        {/* Budget metrics */}
        <div className="flex items-center gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Spendable Balance</span>
            <span className="text-lg font-black text-emerald-400">{formatPrice(team.spendable_budget)}</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Reserved</span>
            <span className="text-sm font-bold text-slate-300">{formatPrice(team.reserved_budget)}</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-[10px] text-slate-500 block uppercase font-bold">Squad Size</span>
            <span className="text-sm font-bold text-brand-400">{team.players_count} / 11 Players</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Purchased Roster & Wishlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Purchased Squad Roster (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-400" /> Acquired Squad Players ({team.players?.length || 0})
          </h3>

          {team.players && team.players.length > 0 ? (
            <div className="space-y-2">
              {team.players.map(tp => (
                <div 
                  key={tp.id} 
                  onClick={() => setModalPlayer(tp.player)}
                  className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs hover:bg-slate-800/80 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      {tp.player.image_path ? (
                        <img src={getImageUrl(tp.player.image_path)} alt={tp.player.user_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-brand-400">{tp.player.user_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-brand-400 transition-colors flex items-center gap-1">
                        {tp.player.user_name}
                        <Eye className="w-3 h-3 text-slate-500 group-hover:text-brand-400 ml-1" />
                      </h4>
                      <span className="text-[10px] text-slate-400">{tp.player.category} • {tp.player.department || 'General'}</span>
                    </div>
                  </div>

                  <span className="font-extrabold text-gold-400 font-mono">{formatPrice(tp.purchase_price)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No players acquired yet. Enter the Live Auction Room to bid on players!
            </div>
          )}
        </div>

        {/* Captain Wishlist (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400 fill-current" /> Target Wishlist ({wishlist.length})
          </h3>

          {wishlist.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {wishlist.map(p => (
                <div key={p.id} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div 
                    onClick={() => setModalPlayer(p)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-9 h-11 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      {p.image_path ? (
                        <img src={getImageUrl(p.image_path)} alt={p.user_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-brand-400">{p.user_name?.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-white group-hover:text-brand-400 transition-colors flex items-center gap-1">
                        {p.user_name}
                        <Eye className="w-3 h-3 text-slate-500 group-hover:text-brand-400 ml-1" />
                      </h4>
                      <span className="text-[10px] text-slate-400">{p.category} • Base {formatPrice(p.base_price)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeFromWishlist(p.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Your target wishlist is empty. Add players from the Player Pool!
            </div>
          )}
        </div>

      </div>

      {/* Rich Player Detail Pop-up Modal */}
      <PlayerDetailModal
        player={modalPlayer}
        onClose={() => setModalPlayer(null)}
      />

    </div>
  );
};
