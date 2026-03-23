'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Info, Shield, Clock } from 'lucide-react';
import { walletApi, type BalanceDto } from '@/lib/api';
import { cn } from '@/lib/utils';

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['Bitcoin'], fee: '0.0005 BTC' },
  { symbol: 'ETH', name: 'Ethereum', networks: ['ERC-20'], fee: '0.005 ETH' },
  { symbol: 'SOL', name: 'Solana', networks: ['Solana'], fee: '0.01 SOL' },
  { symbol: 'USDT', name: 'Tether', networks: ['ERC-20', 'TRC-20', 'BEP-20'], fee: '1 USDT' },
  { symbol: 'USDC', name: 'USD Coin', networks: ['ERC-20', 'TRC-20', 'BEP-20'], fee: '1 USDC' },
  { symbol: 'BNB', name: 'BNB', networks: ['BEP-20'], fee: '0.001 BNB' },
  { symbol: 'XRP', name: 'Ripple', networks: ['XRP Ledger'], fee: '0.1 XRP' },
  { symbol: 'DOGE', name: 'Dogecoin', networks: ['Dogecoin'], fee: '2 DOGE' },
];

const NETWORK_FEES: Record<string, Record<string, string>> = {
  USDT: { 'ERC-20': '5 USDT', 'TRC-20': '1 USDT', 'BEP-20': '0.80 USDT' },
  USDC: { 'ERC-20': '5 USDC', 'TRC-20': '1 USDC', 'BEP-20': '0.80 USDC' },
};

export default function WithdrawPage() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]!);
  const [selectedNetwork, setSelectedNetwork] = useState(ASSETS[0]!.networks[0]!);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [balances, setBalances] = useState<BalanceDto[]>([]);

  const loadBalances = useCallback(async () => {
    try {
      const bal = await walletApi.getBalances();
      setBalances(bal);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  const availableBalance = useMemo(() => {
    const b = balances.find((b) => b.currency === selectedAsset.symbol);
    return b ? parseFloat(b.available) || 0 : 0;
  }, [balances, selectedAsset]);

  const fee = NETWORK_FEES[selectedAsset.symbol]?.[selectedNetwork] ?? selectedAsset.fee;
  const feeNum = parseFloat(fee) || 0;
  const amountNum = parseFloat(amount) || 0;
  const totalDeduction = amountNum > 0 ? amountNum + feeNum : 0;

  const handleAssetSelect = (asset: (typeof ASSETS)[number]) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[0]!);
    setAssetDropdownOpen(false);
    setAmount('');
  };

  const handleNetworkSelect = (network: string) => {
    setSelectedNetwork(network);
    setNetworkDropdownOpen(false);
  };

  const handleMax = () => {
    const max = Math.max(0, availableBalance - feeNum);
    setAmount(max > 0 ? max.toString() : '0');
  };

  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        {/* Back link */}
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-sm text-nvx-text-muted hover:text-nvx-text-primary transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Wallet
        </Link>

        {/* Header */}
        <h1 className="text-xl font-bold text-nvx-text-primary mb-1">Withdraw</h1>
        <p className="text-sm text-nvx-text-muted mb-6">Withdraw crypto from your NovEx wallet</p>

        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 space-y-5">
          {/* Asset selector */}
          <div>
            <label className="block text-xs text-nvx-text-muted uppercase tracking-wider mb-2">
              Select Asset
            </label>
            <div className="relative">
              <button
                onClick={() => {
                  setAssetDropdownOpen(!assetDropdownOpen);
                  setNetworkDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary hover:border-nvx-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold">
                    {selectedAsset.symbol.slice(0, 1)}
                  </div>
                  <div className="text-left">
                    <span className="font-medium">{selectedAsset.symbol}</span>
                    <span className="text-nvx-text-muted ml-2">{selectedAsset.name}</span>
                  </div>
                </div>
                <ChevronDown size={16} className={cn('text-nvx-text-muted transition-transform', assetDropdownOpen && 'rotate-180')} />
              </button>

              {assetDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-nvx-bg-primary border border-nvx-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {ASSETS.map((asset) => (
                    <button
                      key={asset.symbol}
                      onClick={() => handleAssetSelect(asset)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-nvx-bg-tertiary transition-colors text-left',
                        asset.symbol === selectedAsset.symbol ? 'bg-nvx-bg-tertiary text-nvx-text-primary' : 'text-nvx-text-secondary',
                      )}
                    >
                      <div className="w-7 h-7 rounded-full bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-xs font-bold">
                        {asset.symbol.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-medium text-nvx-text-primary">{asset.symbol}</span>
                        <span className="text-nvx-text-muted ml-2">{asset.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Network selector */}
          {selectedAsset.networks.length > 1 && (
            <div>
              <label className="block text-xs text-nvx-text-muted uppercase tracking-wider mb-2">
                Network
              </label>
              <div className="relative">
                <button
                  onClick={() => {
                    setNetworkDropdownOpen(!networkDropdownOpen);
                    setAssetDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary hover:border-nvx-primary/50 transition-colors"
                >
                  <span>{selectedNetwork}</span>
                  <ChevronDown size={16} className={cn('text-nvx-text-muted transition-transform', networkDropdownOpen && 'rotate-180')} />
                </button>

                {networkDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-nvx-bg-primary border border-nvx-border rounded-lg shadow-xl">
                    {selectedAsset.networks.map((network) => (
                      <button
                        key={network}
                        onClick={() => handleNetworkSelect(network)}
                        className={cn(
                          'w-full px-4 py-2.5 text-sm text-left hover:bg-nvx-bg-tertiary transition-colors',
                          network === selectedNetwork ? 'bg-nvx-bg-tertiary text-nvx-text-primary' : 'text-nvx-text-secondary',
                        )}
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Destination address */}
          <div>
            <label className="block text-xs text-nvx-text-muted uppercase tracking-wider mb-2">
              Destination Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter withdrawal address"
              className="w-full px-4 py-3 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary transition-colors font-mono"
            />
          </div>

          {/* Amount input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-nvx-text-muted uppercase tracking-wider">
                Amount
              </label>
              <span className="text-xs text-nvx-text-muted">
                Available:{' '}
                <span className="text-nvx-text-secondary font-mono">
                  {availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} {selectedAsset.symbol}
                </span>
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
                className="w-full px-4 py-3 pr-20 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary transition-colors font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={handleMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-medium text-nvx-primary bg-nvx-primary/10 rounded hover:bg-nvx-primary/20 transition-colors"
              >
                Max
              </button>
            </div>
          </div>

          {/* Fee & total */}
          <div className="bg-nvx-bg-primary border border-nvx-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-nvx-text-muted">Network fee</span>
              <span className="text-nvx-text-secondary font-mono">~{fee}</span>
            </div>
            <div className="border-t border-nvx-border my-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-nvx-text-muted">Total deduction</span>
              <span className="text-nvx-text-primary font-mono font-medium">
                {totalDeduction > 0
                  ? `${totalDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${selectedAsset.symbol}`
                  : `-- ${selectedAsset.symbol}`}
              </span>
            </div>
          </div>

          {/* 2FA notice */}
          <div className="flex items-start gap-2 p-3 bg-nvx-primary/5 border border-nvx-primary/20 rounded-lg">
            <Shield size={14} className="text-nvx-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-nvx-text-secondary">
              <span className="font-medium text-nvx-text-primary">2FA required for withdrawals.</span>{' '}
              Two-factor authentication must be enabled to process withdrawal requests.
            </p>
          </div>

          {/* Submit button */}
          <button
            disabled
            className="w-full py-3 bg-nvx-primary/40 text-nvx-text-muted rounded-lg text-sm font-medium cursor-not-allowed"
          >
            Coming soon
          </button>
        </div>

        {/* Recent withdrawal history */}
        <div className="mt-6 bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nvx-border">
            <h2 className="text-sm font-semibold text-nvx-text-primary">Recent Withdrawals</h2>
          </div>
          <div className="px-5 py-10 text-center">
            <Clock size={24} className="mx-auto text-nvx-text-muted mb-2" />
            <p className="text-sm text-nvx-text-muted">No withdrawal history</p>
            <p className="text-xs text-nvx-text-muted mt-1">Your recent withdrawals will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
