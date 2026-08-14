import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ApplicationSettings } from '../../types';
import { Settings, X, Save, Clock, DollarSign, Users, Shield, Lock, Upload, Calendar } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export const AuctionSettingsModal: React.FC<Props> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<ApplicationSettings>({
    team_budget: 50000000.0,
    base_price: 500000.0,
    timer_seconds: 30,
    min_players: 11,
    max_players: 11,
    timer_reset_on_bid: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Requirement 5: Company Logo Upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (isOpen) fetchSettings();
  }, [isOpen]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get<ApplicationSettings>('/auction/settings');
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to fetch auction settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await api.put('/auction/settings', {
        settings: {
          team_budget: 50000000.0,
          base_price: 500000.0,
          timer_seconds: settings.timer_seconds,
          intermission_seconds: settings.intermission_seconds || 15,
          min_players: settings.min_players,
          max_players: settings.max_players,
          min_squad_size: settings.min_squad_size || settings.min_players || 15,
          timer_reset_on_bid: settings.timer_reset_on_bid,
          registration_closed_date: settings.registration_closed_date || '',
          registration_closed: !!settings.registration_closed
        }
      });

      if (logoFile) {
        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('file', logoFile);
        await api.post('/auction/company-logo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setUploadingLogo(false);
      }

      setSuccess(true);
      if (onSave) onSave();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-400" /> Auction Rules & Configuration
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center">
            Settings & Logo saved successfully!
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Requirement 5: Company Logo Upload */}
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Company / Tournament Logo
              </span>
              <p className="text-[10px] text-slate-400">Replaces default trophy in header brand title</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={(e) => e.target.files && setLogoFile(e.target.files[0])}
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white cursor-pointer"
              />
            </div>

            {/* Static Budget & Base Price Badges */}
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-2.5">
              <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Static Fixed Tournament Rules
              </span>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Team Budget</span>
                  <strong className="text-white text-sm font-extrabold font-mono">₹5,00,00,000</strong>
                  <span className="text-[9px] text-slate-500 block">5 Crore (Fixed)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Base Price</span>
                  <strong className="text-gold-400 text-sm font-extrabold font-mono">₹5,00,000</strong>
                  <span className="text-[9px] text-slate-500 block">5 Lakh (Fixed)</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Hammer Timer Length</label>
                <select
                  value={settings.timer_seconds}
                  onChange={(e) => setSettings({ ...settings, timer_seconds: parseInt(e.target.value) || 30 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value={15}>15 Seconds</option>
                  <option value={20}>20 Seconds</option>
                  <option value={30}>30 Seconds (Default)</option>
                  <option value={45}>45 Seconds</option>
                  <option value={60}>60 Seconds</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sold Intermission Break</label>
                <select
                  value={settings.intermission_seconds || 15}
                  onChange={(e) => setSettings({ ...settings, intermission_seconds: parseInt(e.target.value) || 15 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value={10}>10 Seconds Break</option>
                  <option value={15}>15 Seconds Break (Default)</option>
                  <option value={20}>20 Seconds Break</option>
                  <option value={30}>30 Seconds Break</option>
                  <option value={45}>45 Seconds Break</option>
                  <option value={60}>60 Seconds Break</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Required Squad Target Size (Min Players per Team)</label>
              <select
                value={settings.min_squad_size || settings.min_players || 15}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 15;
                  setSettings({ ...settings, min_players: val, max_players: val + 3, min_squad_size: val });
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value={11}>11 Players (Minimum XI)</option>
                <option value={12}>12 Players</option>
                <option value={13}>13 Players</option>
                <option value={14}>14 Players</option>
                <option value={15}>15 Players (Standard Squad)</option>
                <option value={16}>16 Players</option>
                <option value={18}>18 Players</option>
                <option value={20}>20 Players</option>
              </select>
              <span className="text-[10px] text-slate-500 block mt-1">Reserves base price (₹5 Lakh) for remaining squad slots to ensure every team completes its squad.</span>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Reset Timer on New Bid</span>
                <span className="text-[10px] text-slate-400">Resets hammer countdown to full duration upon every valid bid</span>
              </div>
              <input
                type="checkbox"
                checked={settings.timer_reset_on_bid}
                onChange={(e) => setSettings({ ...settings, timer_reset_on_bid: e.target.checked })}
                className="w-4 h-4 rounded border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Requirement 6: Registration Closing Controls */}
            <div className="p-3 bg-slate-900/90 rounded-2xl border border-amber-500/30 space-y-3">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Player Registration Control & Deadline
              </span>
              
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Registration Closing Date & Time</label>
                <div className="space-y-2">
                  <input
                    type="datetime-local"
                    style={{ colorScheme: 'dark' }}
                    value={settings.registration_closed_date ? settings.registration_closed_date.slice(0, 16) : ''}
                    onChange={(e) => setSettings({ ...settings, registration_closed_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        const pad = (n: number) => String(n).padStart(2, '0');
                        const formatted = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59`;
                        setSettings({ ...settings, registration_closed_date: formatted });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 cursor-pointer"
                    >
                      Today 11:59 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, registration_closed_date: '' })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold border border-slate-700 cursor-pointer"
                    >
                      Clear Date
                    </button>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Registration form will automatically stop accepting responses after this date. Admin can still add players manually.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">Immediately Close Player Registration</span>
                  <span className="text-[10px] text-slate-400">Manually stop accepting new player registrations right now</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.registration_closed}
                  onChange={(e) => setSettings({ ...settings, registration_closed: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || uploadingLogo}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
            >
              {saving || uploadingLogo ? 'Saving...' : <> <Save className="w-4 h-4" /> Save Auction Rules </>}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};
