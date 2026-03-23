'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Monitor,
  ChevronDown,
  Lock,
  AlertTriangle,
  Check,
  Clock,
  X,
  Activity,
  LogIn,
  LogOut,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  XCircle,
  ArrowUpRight,
  Settings,
  ExternalLink,
  Copy,
  Plus,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { twoFactorApi, apiKeysApi, type TwoFactorSetupResponse, type ApiKeyDto, type ApiKeyPermissionsDto } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { useTranslation } from '@/lib/i18n/context';
import { LanguageSelector } from '@/components/ui/LanguageSelector';

/* ─── Types ────────────────────────────────────────── */

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
}

/* ─── KYC Badge ────────────────────────────────────── */

function KycBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    none: { bg: 'bg-nvx-text-muted/10', text: 'text-nvx-text-muted', label: 'Not Verified' },
    pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Pending' },
    verified: { bg: 'bg-nvx-buy/10', text: 'text-nvx-buy', label: 'Verified' },
    rejected: { bg: 'bg-nvx-sell/10', text: 'text-nvx-sell', label: 'Rejected' },
  };

  const s = styles[status] ?? styles.none!;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', s?.bg, s?.text)}>
      {status === 'verified' && <Check size={12} />}
      {status === 'pending' && <Clock size={12} />}
      {status === 'rejected' && <X size={12} />}
      {s?.label}
    </span>
  );
}

/* ─── Section Card ─────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  description,
  children,
  danger,
}: {
  icon: typeof User;
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-nvx-bg-secondary border rounded-xl overflow-hidden',
        danger ? 'border-nvx-sell/30' : 'border-nvx-border',
      )}
    >
      <div className={cn('px-5 py-4 border-b flex items-center gap-3', danger ? 'border-nvx-sell/30' : 'border-nvx-border')}>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', danger ? 'bg-nvx-sell/10' : 'bg-nvx-primary/10')}>
          <Icon size={16} className={danger ? 'text-nvx-sell' : 'text-nvx-primary'} />
        </div>
        <div>
          <h2 className={cn('text-sm font-semibold', danger ? 'text-nvx-sell' : 'text-nvx-text-primary')}>{title}</h2>
          {description && <p className="text-xs text-nvx-text-muted mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─── Toggle ───────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        checked ? 'bg-nvx-primary' : 'bg-nvx-bg-tertiary',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

/* ─── Time Ago Helper ─────────────────────────────── */

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ─── Theme Selector ──────────────────────────────── */

function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider mb-3">
        {t('settings_theme')}
      </h3>
      <div className="flex gap-2">
        <button
          onClick={() => setTheme('dark')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
            theme === 'dark'
              ? 'border-nvx-primary bg-nvx-primary/10 text-nvx-primary'
              : 'border-nvx-border text-nvx-text-secondary hover:text-nvx-text-primary hover:border-nvx-text-secondary',
          )}
        >
          Dark
        </button>
        <button
          onClick={() => setTheme('light')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
            theme === 'light'
              ? 'border-nvx-primary bg-nvx-primary/10 text-nvx-primary'
              : 'border-nvx-border text-nvx-text-secondary hover:text-nvx-text-primary hover:border-nvx-text-secondary',
          )}
        >
          Light
        </button>
      </div>
    </div>
  );
}

/* ─── Main Settings Page ───────────────────────────── */

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { t } = useTranslation();

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // 2FA state
  const [show2faModal, setShow2faModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<'setup' | 'verify' | 'disable'>('setup');
  const [twoFASetupData, setTwoFASetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Preferences state
  const [defaultPair, setDefaultPair] = useState('BTC_USDT');
  const [currency, setCurrency] = useState('USD');
  const [notifTradeFill, setNotifTradeFill] = useState(true);
  const [notifDeposit, setNotifDeposit] = useState(true);
  const [notifWithdrawal, setNotifWithdrawal] = useState(true);

  // Activity log
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyDto[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyLabel, setApiKeyLabel] = useState('');
  const [apiKeyPerms, setApiKeyPerms] = useState<ApiKeyPermissionsDto>({ trading: false, marketData: true, wallet: false });
  const [apiKeyExpiry, setApiKeyExpiry] = useState<number | undefined>(undefined);
  const [apiKeyGenerating, setApiKeyGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Danger zone
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  // Load profile
  useEffect(() => {
    async function load() {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('novex_access_token')
            : null;
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/me`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setProfileData(data);
          setFirstName(data.firstName ?? '');
          setLastName(data.lastName ?? '');
        }
      } catch {
        // silently fail — user info from store is fallback
      } finally {
        setProfileLoading(false);
      }
    }
    load();
  }, []);

  // Save profile
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      const token = localStorage.getItem('novex_access_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/me`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ firstName, lastName }),
        },
      );
      if (res.ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch {
      // Handle error silently
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordSuccess(false);
    try {
      const token = localStorage.getItem('novex_access_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      );
      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setPasswordError(data?.message ?? 'Failed to change password');
      }
    } catch {
      setPasswordError('Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Load 2FA status from profile data
  useEffect(() => {
    async function load2FAStatus() {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('novex_access_token')
            : null;
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/me`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setTwoFAEnabled(data.twoFactorEnabled ?? false);
        }
      } catch {
        // silently fail
      }
    }
    load2FAStatus();
  }, []);

  // Load recent activity
  useEffect(() => {
    async function loadActivity() {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('novex_access_token')
            : null;
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/account/activity?limit=10`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setRecentActivity(data.activities ?? []);
        }
      } catch {
        // silently fail
      } finally {
        setActivityLoading(false);
      }
    }
    loadActivity();
  }, []);

  // 2FA: Start setup
  const handleStart2FASetup = async () => {
    setTwoFAError('');
    setTwoFACode('');
    setTwoFALoading(true);
    setTwoFAStep('setup');
    setShow2faModal(true);
    try {
      const data = await twoFactorApi.setup();
      setTwoFASetupData(data);
      setTwoFAStep('verify');
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
    } finally {
      setTwoFALoading(false);
    }
  };

  // 2FA: Verify code and enable
  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code');
      return;
    }
    setTwoFAError('');
    setTwoFALoading(true);
    try {
      await twoFactorApi.verify(twoFACode);
      setTwoFAEnabled(true);
      setShow2faModal(false);
      setTwoFASetupData(null);
      setTwoFACode('');
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setTwoFALoading(false);
    }
  };

  // 2FA: Start disable flow
  const handleStartDisable2FA = () => {
    setTwoFAError('');
    setTwoFACode('');
    setTwoFAStep('disable');
    setShow2faModal(true);
  };

  // 2FA: Confirm disable
  const handleDisable2FA = async () => {
    if (twoFACode.length !== 6) {
      setTwoFAError('Please enter a 6-digit code');
      return;
    }
    setTwoFAError('');
    setTwoFALoading(true);
    try {
      await twoFactorApi.disable(twoFACode);
      setTwoFAEnabled(false);
      setShow2faModal(false);
      setTwoFACode('');
    } catch (err) {
      setTwoFAError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setTwoFALoading(false);
    }
  };

  const close2FAModal = () => {
    setShow2faModal(false);
    setTwoFAError('');
    setTwoFACode('');
    setTwoFASetupData(null);
  };

  // Load API keys
  useEffect(() => {
    async function loadApiKeys() {
      try {
        const keys = await apiKeysApi.list();
        setApiKeys(keys);
      } catch {
        // silently fail
      } finally {
        setApiKeysLoading(false);
      }
    }
    loadApiKeys();
  }, []);

  // Generate API key
  const handleGenerateApiKey = async () => {
    if (!apiKeyLabel.trim()) {
      setApiKeyError('Please enter a label for this key');
      return;
    }
    setApiKeyError('');
    setApiKeyGenerating(true);
    try {
      const result = await apiKeysApi.generate(apiKeyLabel.trim(), apiKeyPerms, apiKeyExpiry);
      setGeneratedKey(result.key);
      // Refresh list
      const keys = await apiKeysApi.list();
      setApiKeys(keys);
    } catch (err) {
      setApiKeyError(err instanceof Error ? err.message : 'Failed to generate API key');
    } finally {
      setApiKeyGenerating(false);
    }
  };

  // Revoke API key
  const handleRevokeApiKey = async (keyId: string) => {
    try {
      await apiKeysApi.revoke(keyId);
      setApiKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, isActive: false } : k)));
    } catch {
      // silently fail
    }
  };

  // Close API key modal
  const closeApiKeyModal = () => {
    setShowApiKeyModal(false);
    setApiKeyLabel('');
    setApiKeyPerms({ trading: false, marketData: true, wallet: false });
    setApiKeyExpiry(undefined);
    setGeneratedKey(null);
    setApiKeyError('');
    setKeyCopied(false);
  };

  // Copy key to clipboard
  const handleCopyKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  const kycStatus = profileData?.kycStatus ?? 'none';
  const createdAt = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '--';

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page header */}
        <div className="mb-2">
          <h1 className="text-xl font-bold text-nvx-text-primary">{t('settings_title')}</h1>
          <p className="text-sm text-nvx-text-muted mt-1">{t('settings_subtitle')}</p>
        </div>

        {/* ═══════ Profile ═══════ */}
        <Section icon={User} title={t('settings_profile')} description={t('settings_profile_desc')}>
          <div className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Email</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-muted font-mono">
                <Lock size={14} className="text-nvx-text-muted flex-shrink-0" />
                {user?.email ?? profileData?.email ?? '--'}
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>
            </div>

            {/* KYC + Created */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-nvx-text-muted">KYC Status:</span>
                <KycBadge status={kycStatus} />
              </div>
              <div className="sm:ml-auto text-xs text-nvx-text-muted">
                Account created: {createdAt}
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-4 py-2 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {profileSuccess && (
                <span className="text-xs text-nvx-buy flex items-center gap-1">
                  <Check size={14} /> Saved
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* ═══════ Security ═══════ */}
        <Section icon={Shield} title={t('settings_security')} description={t('settings_security_desc')}>
          <div className="space-y-6">
            {/* Change Password */}
            <div>
              <h3 className="text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider mb-3">
                {t('settings_change_password')}
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2.5 pr-10 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-nvx-text-muted hover:text-nvx-text-primary"
                    >
                      {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-3 py-2.5 pr-10 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-nvx-text-muted hover:text-nvx-text-primary"
                    >
                      {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                  />
                </div>
                {passwordError && (
                  <p className="text-xs text-nvx-sell">{passwordError}</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="px-4 py-2 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                  {passwordSuccess && (
                    <span className="text-xs text-nvx-buy flex items-center gap-1">
                      <Check size={14} /> Password updated
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* 2FA */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-nvx-text-primary">Two-Factor Authentication</h3>
                <p className="text-xs text-nvx-text-muted mt-0.5">
                  {twoFAEnabled
                    ? 'Your account is protected with TOTP-based 2FA'
                    : 'Add an extra layer of security with an authenticator app'}
                </p>
              </div>
              <Toggle
                checked={twoFAEnabled}
                onChange={(v) => {
                  if (v) {
                    handleStart2FASetup();
                  } else {
                    handleStartDisable2FA();
                  }
                }}
              />
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* Active Sessions */}
            <div>
              <h3 className="text-sm font-medium text-nvx-text-primary mb-2">Active Sessions</h3>
              <div className="bg-nvx-bg-primary border border-nvx-border rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Monitor size={16} className="text-nvx-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-nvx-text-primary">Current Session</p>
                    <p className="text-xs text-nvx-text-muted">This device, active now</p>
                  </div>
                  <span className="text-xs text-nvx-buy">Active</span>
                </div>
              </div>
              <p className="text-xs text-nvx-text-muted mt-2">
                Session management coming soon.
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* API Keys */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-nvx-text-primary">API Key Management</h3>
                  <p className="text-xs text-nvx-text-muted mt-0.5">
                    Generate API keys to access the NovEx trading API programmatically.
                  </p>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(true)}
                  className="px-3 py-1.5 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Generate API Key
                </button>
              </div>

              {/* API Key List */}
              {apiKeysLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="text-nvx-text-muted animate-spin" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="bg-nvx-bg-primary border border-nvx-border rounded-lg p-4 text-center">
                  <Key size={20} className="text-nvx-text-muted mx-auto mb-2" />
                  <p className="text-xs text-nvx-text-muted">No API keys yet. Generate one to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className={cn(
                        'bg-nvx-bg-primary border rounded-lg p-3',
                        apiKey.isActive ? 'border-nvx-border' : 'border-nvx-border opacity-50',
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Key size={14} className={apiKey.isActive ? 'text-nvx-primary' : 'text-nvx-text-muted'} />
                          <span className="text-sm font-medium text-nvx-text-primary">{apiKey.label}</span>
                          {!apiKey.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-nvx-sell/10 text-nvx-sell font-medium">Revoked</span>
                          )}
                        </div>
                        {apiKey.isActive && (
                          <button
                            onClick={() => handleRevokeApiKey(apiKey.id)}
                            className="text-xs text-nvx-sell hover:text-nvx-sell/80 font-medium transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-xs text-nvx-text-muted font-mono bg-nvx-bg-tertiary px-2 py-0.5 rounded">
                          {apiKey.keyPrefix}{'***'}
                        </code>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {apiKey.permissions.trading && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nvx-primary/10 text-nvx-primary font-medium">Trading</span>
                        )}
                        {apiKey.permissions.marketData && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nvx-buy/10 text-nvx-buy font-medium">Market Data</span>
                        )}
                        {apiKey.permissions.wallet && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-medium">Wallet</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-nvx-text-muted">
                        <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                        {apiKey.lastUsedAt && <span>Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}</span>}
                        {apiKey.expiresAt && <span>Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ═══════ Preferences ═══════ */}
        <Section icon={Bell} title={t('settings_preferences')} description={t('settings_preferences_desc')}>
          <div className="space-y-6">
            {/* Default Trading Pair */}
            <div>
              <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Default Trading Pair</label>
              <div className="relative">
                <select
                  value={defaultPair}
                  onChange={(e) => setDefaultPair(e.target.value)}
                  className="w-full sm:w-48 appearance-none px-3 py-2.5 pr-8 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary focus:outline-none focus:border-nvx-primary"
                >
                  <option value="BTC_USDT">BTC / USDT</option>
                  <option value="ETH_USDT">ETH / USDT</option>
                  <option value="SOL_USDT">SOL / USDT</option>
                  <option value="ETH_BTC">ETH / BTC</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nvx-text-muted pointer-events-none" />
              </div>
            </div>

            {/* Currency display */}
            <div>
              <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Currency Display</label>
              <div className="flex gap-2">
                {(['USD', 'EUR', 'GBP'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-lg border transition-colors',
                      currency === c
                        ? 'border-nvx-primary bg-nvx-primary/10 text-nvx-primary'
                        : 'border-nvx-border bg-nvx-bg-primary text-nvx-text-secondary hover:border-nvx-border-light',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* Notification Preferences */}
            <div>
              <h3 className="text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider mb-3">
                {t('settings_email_notifications')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-nvx-text-primary">Trade fills</p>
                    <p className="text-xs text-nvx-text-muted">Receive email when an order is filled</p>
                  </div>
                  <Toggle checked={notifTradeFill} onChange={setNotifTradeFill} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-nvx-text-primary">Deposits</p>
                    <p className="text-xs text-nvx-text-muted">Receive email when a deposit is credited</p>
                  </div>
                  <Toggle checked={notifDeposit} onChange={setNotifDeposit} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-nvx-text-primary">Withdrawals</p>
                    <p className="text-xs text-nvx-text-muted">Receive email when a withdrawal completes</p>
                  </div>
                  <Toggle checked={notifWithdrawal} onChange={setNotifWithdrawal} />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* Language */}
            <div>
              <h3 className="text-xs font-semibold text-nvx-text-secondary uppercase tracking-wider mb-3">
                {t('settings_language')}
              </h3>
              <p className="text-xs text-nvx-text-muted mb-3">{t('settings_language_desc')}</p>
              <LanguageSelector compact={false} />
            </div>

            {/* Divider */}
            <div className="border-t border-nvx-border" />

            {/* Theme */}
            <ThemeSelector />
          </div>
        </Section>

        {/* ═══════ Danger Zone ═══════ */}
        <Section icon={AlertTriangle} title={t('settings_danger_zone')} description={t('settings_danger_zone_desc')} danger>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-nvx-text-primary">Delete Account</p>
              <p className="text-xs text-nvx-text-muted">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <button
              disabled
              onClick={() => setShowDeleteWarning(true)}
              className="px-4 py-2 bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm font-medium rounded-lg opacity-50 cursor-not-allowed flex items-center gap-2 flex-shrink-0"
            >
              <Trash2 size={14} />
              Delete Account
            </button>
          </div>
          <p className="text-xs text-nvx-text-muted mt-3">
            Account deletion is currently disabled. Please contact support if you wish to close your account.
          </p>
        </Section>

        {/* ═══════ Recent Activity ═══════ */}
        <Section icon={Activity} title="Recent Activity" description="Your latest account actions">
          <div className="space-y-1">
            {activityLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-nvx-primary border-t-transparent" />
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-nvx-text-muted text-center py-6">No recent activity</p>
            ) : (
              recentActivity.map((item: any) => {
                const actionConfig: Record<string, { icon: typeof LogIn; label: string; color: string }> = {
                  login: { icon: LogIn, label: 'Login', color: 'text-nvx-primary' },
                  logout: { icon: LogOut, label: 'Logout', color: 'text-nvx-text-muted' },
                  password_change: { icon: Key, label: 'Password Changed', color: 'text-yellow-400' },
                  '2fa_enable': { icon: ShieldCheck, label: '2FA Enabled', color: 'text-nvx-buy' },
                  '2fa_disable': { icon: ShieldOff, label: '2FA Disabled', color: 'text-nvx-sell' },
                  order_placed: { icon: ShoppingCart, label: 'Order Placed', color: 'text-nvx-primary' },
                  order_cancelled: { icon: XCircle, label: 'Order Cancelled', color: 'text-nvx-sell' },
                  withdrawal_request: { icon: ArrowUpRight, label: 'Withdrawal', color: 'text-yellow-400' },
                  api_key_created: { icon: Key, label: 'API Key Created', color: 'text-nvx-primary' },
                  settings_change: { icon: Settings, label: 'Settings Changed', color: 'text-nvx-text-secondary' },
                };
                const config = actionConfig[item.action] ?? { icon: Activity, label: item.action, color: 'text-nvx-text-muted' };
                const ActionIcon = config.icon;
                const timeAgo = getTimeAgo(item.createdAt);

                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-nvx-bg-primary/50 transition-colors">
                    <div className={cn('w-7 h-7 rounded-md flex items-center justify-center bg-nvx-bg-primary', config.color)}>
                      <ActionIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-nvx-text-primary truncate">{config.label}</p>
                      <p className="text-xs text-nvx-text-muted font-mono">{item.ipAddress ?? '--'}</p>
                    </div>
                    <span className="text-xs text-nvx-text-muted flex-shrink-0">{timeAgo}</span>
                  </div>
                );
              })
            )}
            {recentActivity.length > 0 && (
              <div className="pt-3 border-t border-nvx-border">
                <Link
                  href="/settings/activity"
                  className="inline-flex items-center gap-1.5 text-xs text-nvx-primary hover:text-nvx-primary/80 transition-colors font-medium"
                >
                  View All Activity
                  <ExternalLink size={12} />
                </Link>
              </div>
            )}
          </div>
        </Section>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>

      {/* ═══════ 2FA Setup / Disable Modal ═══════ */}
      <Modal isOpen={show2faModal} onClose={close2FAModal} title="Two-Factor Authentication" size="sm">
        <div className="py-2">
          {/* ── Setup: loading ── */}
          {twoFAStep === 'setup' && twoFALoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-nvx-primary border-t-transparent mx-auto mb-3" />
              <p className="text-sm text-nvx-text-secondary">Generating secret...</p>
            </div>
          )}

          {/* ── Setup: error before data loaded ── */}
          {twoFAStep === 'setup' && !twoFALoading && twoFAError && !twoFASetupData && (
            <div className="text-center py-4">
              <p className="text-sm text-nvx-sell mb-4">{twoFAError}</p>
              <button
                onClick={close2FAModal}
                className="px-4 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* ── Verify step: QR code + code input ── */}
          {twoFAStep === 'verify' && twoFASetupData && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-nvx-text-primary font-medium mb-1">Scan this QR code</p>
                <p className="text-xs text-nvx-text-muted mb-4">
                  Use Google Authenticator, Authy, or any TOTP app
                </p>
                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="bg-white p-3 rounded-lg inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={twoFASetupData.qrCodeUrl}
                      alt="2FA QR Code"
                      width={180}
                      height={180}
                      className="block"
                    />
                  </div>
                </div>
              </div>

              {/* Manual key */}
              <div>
                <p className="text-xs text-nvx-text-muted mb-1">Or enter this key manually:</p>
                <div className="bg-nvx-bg-primary border border-nvx-border rounded-lg px-3 py-2 font-mono text-sm text-nvx-text-primary select-all break-all">
                  {twoFASetupData.secret}
                </div>
              </div>

              {/* Verification code input */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Enter the 6-digit code from your app
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFACode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTwoFACode(v);
                    setTwoFAError('');
                  }}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono text-center text-lg tracking-[0.5em]"
                />
              </div>

              {twoFAError && <p className="text-xs text-nvx-sell">{twoFAError}</p>}

              <div className="flex gap-3">
                <button
                  onClick={close2FAModal}
                  className="flex-1 px-4 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerify2FA}
                  disabled={twoFALoading || twoFACode.length !== 6}
                  className="flex-1 px-4 py-2 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {twoFALoading ? 'Verifying...' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          )}

          {/* ── Disable step ── */}
          {twoFAStep === 'disable' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-nvx-sell/10 flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-nvx-sell" />
                </div>
                <p className="text-sm text-nvx-text-primary font-medium mb-1">Disable Two-Factor Authentication</p>
                <p className="text-xs text-nvx-text-muted">
                  Enter your current authenticator code to confirm disabling 2FA.
                  Your account will be less secure.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">
                  Current 2FA Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFACode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTwoFACode(v);
                    setTwoFAError('');
                  }}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono text-center text-lg tracking-[0.5em]"
                />
              </div>

              {twoFAError && <p className="text-xs text-nvx-sell">{twoFAError}</p>}

              <div className="flex gap-3">
                <button
                  onClick={close2FAModal}
                  className="flex-1 px-4 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable2FA}
                  disabled={twoFALoading || twoFACode.length !== 6}
                  className="flex-1 px-4 py-2 bg-nvx-sell/20 border border-nvx-sell/40 text-nvx-sell text-sm font-medium rounded-lg hover:bg-nvx-sell/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {twoFALoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══════ Delete Warning Modal ═══════ */}
      <Modal isOpen={showDeleteWarning} onClose={() => setShowDeleteWarning(false)} title="Delete Account" size="sm">
        <div className="py-2">
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-nvx-sell font-medium">Warning: This action is irreversible</p>
            <p className="text-xs text-nvx-sell/80 mt-1">
              All your data, trading history, and wallet balances will be permanently deleted.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteWarning(false)}
              className="px-4 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled
              className="px-4 py-2 bg-nvx-sell text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
            >
              Delete Account
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════ API Key Generation Modal ═══════ */}
      <Modal isOpen={showApiKeyModal} onClose={closeApiKeyModal} title="Generate API Key" size="sm">
        <div className="py-2">
          {!generatedKey ? (
            <div className="space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Label</label>
                <input
                  type="text"
                  value={apiKeyLabel}
                  onChange={(e) => setApiKeyLabel(e.target.value)}
                  placeholder="e.g., Trading Bot, My App"
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-2">Permissions</label>
                <div className="space-y-2">
                  {([
                    { key: 'trading' as const, label: 'Trading', desc: 'Place and cancel orders' },
                    { key: 'marketData' as const, label: 'Market Data', desc: 'Read prices, orderbook, candles' },
                    { key: 'wallet' as const, label: 'Wallet', desc: 'View balances and transaction history' },
                  ] as const).map((perm) => (
                    <label key={perm.key} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apiKeyPerms[perm.key]}
                        onChange={(e) => setApiKeyPerms((prev) => ({ ...prev, [perm.key]: e.target.checked }))}
                        className="mt-0.5 rounded border-nvx-border text-nvx-primary focus:ring-nvx-primary bg-nvx-bg-primary"
                      />
                      <div>
                        <p className="text-sm text-nvx-text-primary">{perm.label}</p>
                        <p className="text-xs text-nvx-text-muted">{perm.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-2">Expiry</label>
                <div className="flex gap-2">
                  {([
                    { days: 30, label: '30 days' },
                    { days: 90, label: '90 days' },
                    { days: undefined, label: 'Never' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setApiKeyExpiry(opt.days)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                        apiKeyExpiry === opt.days
                          ? 'border-nvx-primary bg-nvx-primary/10 text-nvx-primary'
                          : 'border-nvx-border bg-nvx-bg-primary text-nvx-text-secondary hover:border-nvx-border-light',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {apiKeyError && <p className="text-xs text-nvx-sell">{apiKeyError}</p>}

              <div className="flex gap-3">
                <button
                  onClick={closeApiKeyModal}
                  className="flex-1 px-4 py-2 bg-nvx-bg-tertiary text-nvx-text-secondary text-sm font-medium rounded-lg hover:bg-nvx-bg-tertiary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateApiKey}
                  disabled={apiKeyGenerating || !apiKeyLabel.trim()}
                  className="flex-1 px-4 py-2 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {apiKeyGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Key'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <p className="text-sm text-yellow-400 font-medium">Save this key now</p>
                </div>
                <p className="text-xs text-yellow-400/80">
                  This is the only time you will see the full API key. Copy it and store it securely.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-nvx-text-secondary mb-1.5">Your API Key</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-xs text-nvx-text-primary font-mono break-all select-all">
                    {generatedKey}
                  </code>
                  <button
                    onClick={handleCopyKey}
                    className={cn(
                      'flex-shrink-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                      keyCopied
                        ? 'bg-nvx-buy/10 text-nvx-buy border border-nvx-buy/30'
                        : 'bg-nvx-bg-tertiary text-nvx-text-secondary hover:bg-nvx-bg-tertiary/80 border border-nvx-border',
                    )}
                  >
                    {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                    {keyCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <button
                onClick={closeApiKeyModal}
                className="w-full px-4 py-2 bg-nvx-primary hover:bg-nvx-primary/80 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
