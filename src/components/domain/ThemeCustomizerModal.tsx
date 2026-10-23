'use client';

import React, { useState } from 'react';
import { useFest } from '@/context/FestContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Palette, CheckCircle2, Eye, ShieldCheck, Sparkles, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeCustomizerModal: React.FC<ThemeCustomizerModalProps> = ({
  isOpen,
  onClose
}) => {
  const { theme, updateTheme } = useFest();

  const [festivalName, setFestivalName] = useState(theme.festivalName);
  const [institutionName, setInstitutionName] = useState(theme.institutionName);
  const [tagline, setTagline] = useState(theme.tagline);
  const [logoUrl, setLogoUrl] = useState(theme.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(theme.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(theme.secondaryColor || '#111111');
  const [accentColor, setAccentColor] = useState(theme.accentColor);
  const [headingFont, setHeadingFont] = useState(theme.headingFont || 'Montserrat');
  const [bodyFont, setBodyFont] = useState(theme.bodyFont || 'Montserrat');
  const [backgroundStyle, setBackgroundStyle] = useState(theme.backgroundStyle);
  const [cardStyle, setCardStyle] = useState(theme.cardStyle || 'elevated');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateTheme({
        festivalName,
        institutionName,
        tagline,
        logoUrl: logoUrl.trim() || undefined,
        primaryColor,
        secondaryColor,
        accentColor,
        headingFont,
        bodyFont,
        fontFamily: headingFont,
        backgroundStyle,
        cardStyle
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to update theme.');
    } finally {
      setSaving(false);
    }
  };

  const presetColors = [
    { name: 'Classic Blue', hex: '#2563EB' },
    { name: 'Emerald Forest', hex: '#059669' },
    { name: 'Deep Purple', hex: '#7C3AED' },
    { name: 'Crimson Red', hex: '#DC2626' },
    { name: 'Amber Gold', hex: '#D97706' },
    { name: 'Obsidian Charcoal', hex: '#111111' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Public Result Theme & Visual Customizer"
      description="Authorized Admin tool: Customize festival brand colors, typography, background, and card layout for the public website. Internal portals strictly maintain the institutional standard."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Link
            href="/public"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-[#2563EB] hover:underline font-semibold"
          >
            <Eye className="w-4 h-4" /> Open Public Website Preview
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              leftIcon={<Palette className="w-4 h-4" />}
            >
              Save &amp; Publish Theme
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>
            <strong>Admin Authorization Active:</strong> Public visitors cannot edit or save theme changes. Changes saved here immediately update the live public website.
          </span>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Official festival theme published successfully to the public portal!
          </div>
        )}

        {/* Brand Information */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Festival Name"
            value={festivalName}
            onChange={(e) => setFestivalName(e.target.value)}
            required
          />
          <Input
            label="Institution Name"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            required
          />
          <Input
            label="Festival Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>

        {/* Logo URL */}
        <div>
          <Input
            label="Festival Logo URL (Optional)"
            placeholder="https://example.com/logo.png"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            leftIcon={<ImageIcon className="w-4 h-4 text-[#526070]" />}
          />
        </div>

        {/* Colors */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-[#111111] uppercase tracking-wider">
            Color Palette Configuration
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="block text-xs font-semibold text-[#526070] mb-1">Primary Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-9 h-9 rounded border border-[#E1E7EF] cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 border border-[#E1E7EF] rounded-md uppercase"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#526070] mb-1">Secondary Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-9 h-9 rounded border border-[#E1E7EF] cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 border border-[#E1E7EF] rounded-md uppercase"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#526070] mb-1">Accent Color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded border border-[#E1E7EF] cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 border border-[#E1E7EF] rounded-md uppercase"
                />
              </div>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-[11px] text-[#526070] block mb-1.5 font-medium">Quick Preset Palettes:</span>
            <div className="flex flex-wrap gap-2">
              {presetColors.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPrimaryColor(c.hex)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E1E7EF] hover:bg-[#F8FAFC] text-[11px] font-semibold text-[#111111]"
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.hex }} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Typography & Styling */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Select
            label="Heading Font"
            value={headingFont}
            onChange={(e) => setHeadingFont(e.target.value)}
            options={[
              { value: 'Montserrat', label: 'Montserrat (Corporate Modern)' },
              { value: 'Inter', label: 'Inter (Clean Technical)' },
              { value: 'Outfit', label: 'Outfit (Friendly Modern)' },
              { value: 'Playfair Display', label: 'Playfair Display (Classical Heritage)' }
            ]}
          />

          <Select
            label="Body Font"
            value={bodyFont}
            onChange={(e) => setBodyFont(e.target.value)}
            options={[
              { value: 'Montserrat', label: 'Montserrat' },
              { value: 'Inter', label: 'Inter' },
              { value: 'Outfit', label: 'Outfit' }
            ]}
          />

          <Select
            label="Background Style"
            value={backgroundStyle}
            onChange={(e) => setBackgroundStyle(e.target.value as any)}
            options={[
              { value: 'clean-white', label: 'Clean White Minimalist' },
              { value: 'subtle-pattern', label: 'Subtle Geometric Grid' },
              { value: 'festive-aurora', label: 'Festive Aurora Glow' },
              { value: 'gradient-mesh', label: 'Smooth Gradient Mesh' }
            ]}
          />

          <Select
            label="Result Card Styling"
            value={cardStyle}
            onChange={(e) => setCardStyle(e.target.value as any)}
            options={[
              { value: 'elevated', label: 'Elevated (Soft Shadow)' },
              { value: 'bordered', label: 'Bordered (Clean Lines)' },
              { value: 'glassmorphism', label: 'Glassmorphism (Frosted)' },
              { value: 'minimal', label: 'Minimalist Flat' }
            ]}
          />
        </div>

        {/* Live Preview Card */}
        <div className="border border-[#E1E7EF] rounded-xl p-5 bg-[#F8FAFC]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-[#526070] tracking-wider">
              Live Public Preview
            </span>
            <span className="text-[10px] font-mono text-[#526070]">{headingFont} + {bodyFont}</span>
          </div>

          <div
            className="p-6 rounded-xl text-white shadow-md transition-all relative overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg bg-white/10 p-1" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
                  {festivalName.charAt(0)}
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80 block">
                  OFFICIAL PUBLIC RESULTS
                </span>
                <h3 className="text-xl font-extrabold tracking-tight mt-0.5">{festivalName}</h3>
                <p className="text-xs text-white/80">{institutionName} · {tagline}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                Championship Leaderboard
              </span>
              <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium">
                Verified Winners Registry
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
