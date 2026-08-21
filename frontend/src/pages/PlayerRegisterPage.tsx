import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { User, CheckCircle, Upload, ArrowRight, ShieldAlert } from 'lucide-react';

export const PlayerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    employee_id: '',
    age: 25,
    mobile: '',
    jersey_name: '',
    jersey_number: '10',
    tshirt_size: 'M',
    category: 'Batsman',
    batting_style: 'Right Hand',
    bowling_style: 'Regular Bowler',
    experience_level: 'Intermediate',
    emergency_contact: '',
    bio: '',
    availability: true,
    fitness_declaration: true,
    achievements: '',
    preferred_batting_order: 'Middle Order'
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/players/me');
      if (res.data) {
        setFormData({
          ...res.data,
          jersey_number: res.data.jersey_number ? String(res.data.jersey_number) : '10'
        });
        if (res.data.image_path) setImagePreview(res.data.image_path);
      }
    } catch (err) {
      // Profile not registered yet, proceed with defaults
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setError(`📸 Image file size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 25MB limit.`);
        return;
      }
      setImageFile(file);
      try {
        setImagePreview(URL.createObjectURL(file));
      } catch (err) {
        // Fallback for camera raw / unsupported object URL formats
      }
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // MANDATORY PHOTO CHECK FOR PLAYER REGISTRATION
    if (!imageFile && !imagePreview) {
      setError('📸 PLAYER PHOTO IS MANDATORY! Please upload your profile photo before submitting.');
      return;
    }

    // MANDATORY 10-DIGIT MOBILE NUMBER CHECK
    const cleanMobile = (formData.mobile || '').replace(/[^0-9]/g, '');
    if (cleanMobile.length !== 10) {
      setError('📱 Mobile number must be exactly 10 numeric digits (e.g. 9876543210).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (imageFile) {
        const fileData = new FormData();
        fileData.append('file', imageFile);
        await api.post('/players/upload-photo', fileData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await api.post('/players/register-profile', formData);

      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save player profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="glass-card rounded-3xl p-8 border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Player Profile Registration</h1>
        <p className="text-xs text-slate-400 mt-1">Complete your corporate cricket profile to enter the official NPL Auction Pool</p>

        {success && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5" /> Profile saved successfully! Redirecting...
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          
          {/* Photo Upload Section - MANDATORY */}
          <div className="flex items-center gap-6 p-4 rounded-2xl bg-slate-900/80 border border-amber-500/40 shadow-md">
            <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative flex-shrink-0">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-white mb-1">
                Player Photo <span className="text-rose-400 font-extrabold text-xs ml-1">* (Mandatory)</span>
              </label>
              <input
                type="file"
                accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.jfif,.avif,.bmp,.gif,.svg,.tiff"
                onChange={handleImageChange}
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
              />
              <span className="text-[10px] text-amber-400/90 font-medium block mt-1">
                ⚠️ Uploading your clear profile picture is required to register for the NPL auction. (Max size: 25 MB)
              </span>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Employee ID</label>
              <input
                type="text"
                required
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                placeholder="EMP-1024"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Age (Max 2 Digits)</label>
              <input
                type="text"
                maxLength={2}
                required
                value={formData.age === 0 ? '' : String(formData.age || '')}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                  setFormData({ ...formData, age: cleaned === '' ? 0 : parseInt(cleaned, 10) });
                }}
                placeholder="25"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Mobile Number <span className="text-amber-400 font-normal">(10 Digits)</span>
              </label>
              <input
                type="tel"
                maxLength={10}
                required
                value={formData.mobile}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                  setFormData({ ...formData, mobile: digitsOnly });
                }}
                placeholder="9876543210"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Name</label>
              <input
                type="text"
                required
                value={formData.jersey_name}
                onChange={(e) => setFormData({ ...formData, jersey_name: e.target.value })}
                placeholder="VIRAT"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Jersey Number (Max 2 Digits)</label>
              <input
                type="text"
                maxLength={2}
                required
                value={formData.jersey_number}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                  setFormData({ ...formData, jersey_number: val });
                }}
                placeholder="07 or 18"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">T-Shirt Size</label>
              <select
                value={formData.tshirt_size}
                onChange={(e) => setFormData({ ...formData, tshirt_size: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All Rounder">All Rounder</option>
                <option value="Wicket Keeper">Wicket Keeper</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Batting Style</label>
              <select
                value={formData.batting_style}
                onChange={(e) => setFormData({ ...formData, batting_style: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Right Hand">Right Hand</option>
                <option value="Left Hand">Left Hand</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Bowling Style</label>
              <select
                value={formData.bowling_style}
                onChange={(e) => setFormData({ ...formData, bowling_style: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Regular Bowler">Regular Fast/Medium Bowler</option>
                <option value="Spin Regular">Spin Regular</option>
                <option value="Spin Throw">Spin Throw</option>
                <option value="Throw">Throw</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Experience Level</label>
              <select
                value={formData.experience_level}
                onChange={(e) => setFormData({ ...formData, experience_level: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Bio / Achievements</label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Brief summary of your cricketing experience and past achievements..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.checked })}
                className="rounded border-slate-800 text-brand-600 focus:ring-0"
              />
              Available for full tournament duration
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.fitness_declaration}
                onChange={(e) => setFormData({ ...formData, fitness_declaration: e.target.checked })}
                className="rounded border-slate-800 text-brand-600 focus:ring-0"
              />
              Fitness declaration verified
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Save & Register Profile <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

        </form>
      </div>

    </div>
  );
};
