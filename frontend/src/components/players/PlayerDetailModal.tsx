import React from 'react';
import { PlayerProfile } from '../../types';
import { getImageUrl } from '../../api/client';
import { X, Award, CheckCircle, Shield, User, DollarSign, Shirt } from 'lucide-react';

interface Props {
  player: PlayerProfile | null;
  onClose: () => void;
}

export const PlayerDetailModal: React.FC<Props> = ({ player, onClose }) => {
  if (!player) return null;

  const formatPrice = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="glass-card rounded-3xl p-6 sm:p-8 w-full max-w-lg border border-slate-800 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <div className="flex items-center justify-between relative z-10">
          <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider border border-brand-500/30">
            Player Profile View
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Header info */}
        <div className="flex items-start gap-5 relative z-10">
          <div className="w-32 h-40 sm:w-36 sm:h-44 rounded-2xl bg-slate-900 border-2 border-slate-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-2xl">
            {player.image_path ? (
              <img src={getImageUrl(player.image_path)} alt={player.user_name} className="w-full h-full object-cover object-top" />
            ) : (
              <span className="text-4xl font-black text-brand-400">{player.user_name?.charAt(0)}</span>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-white tracking-tight">{player.user_name}</h3>
            <p className="text-xs text-slate-400">{player.department || 'General'} • Emp ID: {player.employee_id || 'N/A'}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 text-[10px] font-extrabold uppercase border border-brand-500/30">
                {player.category}
              </span>
              {player.is_sold ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {player.team_name || 'Sold'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-400 text-[10px] font-extrabold border border-slate-800">
                  AVAILABLE IN POOL
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-900/90 p-4 rounded-2xl border border-slate-800 relative z-10">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Batting Style</span>
            <strong className="text-slate-200">{player.batting_style || 'Right Hand'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Bowling Style</span>
            <strong className="text-slate-200">{player.bowling_style || 'Regular'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Experience</span>
            <strong className="text-slate-200">{player.experience_level || 'Intermediate'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Jersey Spec</span>
            <strong className="text-slate-200">{player.jersey_name || 'N/A'} #{player.jersey_number || ''} ({player.tshirt_size || 'M'})</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Age</span>
            <strong className="text-slate-200">{player.age || '25'} Yrs</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Base Price</span>
            <strong className="text-gold-400 font-extrabold">{formatPrice(player.base_price)}</strong>
          </div>
        </div>

        {/* Bio & Achievements */}
        <div className="space-y-2 relative z-10 text-xs">
          {player.bio && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cricketing Bio</span>
              <p className="text-slate-300 italic bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 mt-1">
                "{player.bio}"
              </p>
            </div>
          )}
          {player.achievements && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Past Achievements</span>
              <p className="text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80 mt-1">
                {player.achievements}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
