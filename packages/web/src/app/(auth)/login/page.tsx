'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, complete2FALogin, isLoading, error, clearError, requires2FA, clear2FA } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [twoFACode, setTwoFACode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      const result = await login(email, password);
      if (!result.requires2FA) {
        router.push('/trade');
      }
      // If requires2FA, the UI will switch to the 2FA code input
    } catch {
      // error is set in store
    }
  };

  const handle2FACodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits

    const newCode = [...twoFACode];
    newCode[index] = value.slice(-1); // only last char
    setTwoFACode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handle2FAKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !twoFACode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handle2FAPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...twoFACode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setTwoFACode(newCode);

    // Focus last filled or the next empty
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const code = twoFACode.join('');
    if (code.length !== 6) return;

    try {
      await complete2FALogin(code);
      router.push('/trade');
    } catch {
      // error is set in store
      setTwoFACode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleBack = () => {
    clear2FA();
    clearError();
    setTwoFACode(['', '', '', '', '', '']);
  };

  const fillDemoAccount = (account: 'alice' | 'bob') => {
    const emails = { alice: 'alice@test.novex.io', bob: 'bob@test.novex.io' };
    setEmail(emails[account]);
    setPassword('NovEx_Test_2024!');
    clearError();
  };

  // ─── 2FA Code Input Screen ───
  if (requires2FA) {
    const code = twoFACode.join('');

    return (
      <div className="min-h-screen flex items-center justify-center bg-nvx-bg-primary px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-nvx-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-nvx-primary" />
            </div>
            <h1 className="text-2xl font-bold text-nvx-text-primary">Two-Factor Authentication</h1>
            <p className="text-nvx-text-secondary mt-2 text-sm">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={handle2FASubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* 6-digit code input */}
            <div className="flex justify-center gap-3" onPaste={handle2FAPaste}>
              {twoFACode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handle2FACodeChange(i, e.target.value)}
                  onKeyDown={(e) => handle2FAKeyDown(i, e)}
                  autoFocus={i === 0}
                  className="w-12 h-14 text-center text-xl font-mono bg-nvx-bg-secondary border border-nvx-border rounded-lg text-nvx-text-primary focus:outline-none focus:border-nvx-primary transition-colors"
                />
              ))}
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoading}
              disabled={code.length !== 6}
            >
              Verify
            </Button>
          </form>

          <button
            onClick={handleBack}
            className="w-full text-center text-sm text-nvx-text-muted mt-4 hover:text-nvx-text-secondary transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // ─── Normal Login Screen ───
  return (
    <div className="min-h-screen flex items-center justify-center bg-nvx-bg-primary px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-nvx-primary">NovEx</h1>
          <p className="text-nvx-text-secondary mt-2">Sign in to your account</p>
        </div>

        {/* Demo accounts */}
        <div className="bg-nvx-bg-tertiary rounded-lg p-4 mb-6 border border-nvx-border">
          <p className="text-xs text-nvx-text-muted mb-2 font-medium uppercase tracking-wide">
            Demo Accounts (seeded)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fillDemoAccount('alice')}
              className="flex-1 text-xs bg-nvx-bg-secondary border border-nvx-border rounded px-3 py-2 text-nvx-text-secondary hover:text-nvx-text-primary hover:border-nvx-primary transition-colors"
            >
              Alice (100K USDT)
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('bob')}
              className="flex-1 text-xs bg-nvx-bg-secondary border border-nvx-border rounded px-3 py-2 text-nvx-text-secondary hover:text-nvx-text-primary hover:border-nvx-primary transition-colors"
            >
              Bob (1 BTC)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-nvx-text-muted hover:text-nvx-text-secondary text-sm"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <p className="text-center text-sm text-nvx-text-muted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-nvx-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
