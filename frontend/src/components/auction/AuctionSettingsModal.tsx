import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { ApplicationSettings } from '../../types';
import { Settings, X, Save, Clock, DollarSign, Users, Shield, Lock, Upload } from 'lucide-react';

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
          min_players: settings.min_players,
          max_players: settings.max_players,
          timer_reset_on_bid: settings.timer_reset_on_bid
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
                <label className="block text-xs font-bold text-slate-300 mb-1">Required Squad Size</label>
                <input
                  type="number"
                  required
                  value={settings.min_players}
                  onChange={(e) => setSettings({ ...settings, min_players: parseInt(e.target.value) || 11, max_players: parseInt(e.target.value) || 11 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
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
