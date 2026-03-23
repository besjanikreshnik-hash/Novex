'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', networks: ['Bitcoin'], minDeposit: '0.0001 BTC', confirmations: 2 },
  { symbol: 'ETH', name: 'Ethereum', networks: ['ERC-20'], minDeposit: '0.001 ETH', confirmations: 12 },
  { symbol: 'SOL', name: 'Solana', networks: ['Solana'], minDeposit: '0.01 SOL', confirmations: 32 },
  { symbol: 'USDT', name: 'Tether', networks: ['ERC-20', 'TRC-20', 'BEP-20'], minDeposit: '1 USDT', confirmations: 12 },
  { symbol: 'USDC', name: 'USD Coin', networks: ['ERC-20', 'TRC-20', 'BEP-20'], minDeposit: '1 USDC', confirmations: 12 },
  { symbol: 'BNB', name: 'BNB', networks: ['BEP-20'], minDeposit: '0.001 BNB', confirmations: 15 },
  { symbol: 'XRP', name: 'Ripple', networks: ['XRP Ledger'], minDeposit: '0.1 XRP', confirmations: 1 },
  { symbol: 'DOGE', name: 'Dogecoin', networks: ['Dogecoin'], minDeposit: '1 DOGE', confirmations: 20 },
];

const MOCK_ADDRESSES: Record<string, Record<string, string>> = {
  BTC: { Bitcoin: '3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5' },
  ETH: { 'ERC-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18' },
  SOL: { Solana: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
  USDT: {
    'ERC-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    'TRC-20': 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
    'BEP-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  },
  USDC: {
    'ERC-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    'TRC-20': 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
    'BEP-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  },
  BNB: { 'BEP-20': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18' },
  XRP: { 'XRP Ledger': 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh' },
  DOGE: { Dogecoin: 'D7Y55bJKpVgaSMwEXqRy6SJ1R3W3oU9RpN' },
};

export default function DepositPage() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]!);
  const [selectedNetwork, setSelectedNetwork] = useState(ASSETS[0]!.networks[0]!);
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const address = MOCK_ADDRESSES[selectedAsset.symbol]?.[selectedNetwork] ?? '';

  const handleAssetSelect = (asset: (typeof ASSETS)[number]) => {
    setSelectedAsset(asset);
    setSelectedNetwork(asset.networks[0]!);
    setAssetDropdownOpen(false);
    setCopied(false);
  };

  const handleNetworkSelect = (network: string) => {
    setSelectedNetwork(network);
    setNetworkDropdownOpen(false);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
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
        <h1 className="text-xl font-bold text-nvx-text-primary mb-1">Deposit</h1>
        <p className="text-sm text-nvx-text-muted mb-6">Deposit crypto to your NovEx wallet</p>

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

          {/* Deposit address */}
          <div>
            <label className="block text-xs text-nvx-text-muted uppercase tracking-wider mb-2">
              Deposit Address
            </label>
            <p className="text-[10px] text-nvx-warning mb-2">
              Address generation coming soon
            </p>

            {/* QR code placeholder */}
            <div className="flex justify-center mb-4">
              <div className="w-40 h-40 border-2 border-dashed border-nvx-border rounded-lg flex items-center justify-center">
                <span className="text-sm text-nvx-text-muted">QR Code</span>
              </div>
            </div>

            {/* Address display with copy */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-nvx-bg-primary border border-nvx-border rounded-lg px-4 py-3 font-mono text-xs text-nvx-text-secondary break-all select-all">
                {address || 'No address available'}
              </div>
              <button
                onClick={handleCopy}
                disabled={!address}
                className="flex-shrink-0 p-3 bg-nvx-primary/20 text-nvx-primary rounded-lg hover:bg-nvx-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Copy address"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* Notices */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2 p-3 bg-nvx-bg-primary border border-nvx-border rounded-lg">
              <Info size={14} className="text-nvx-warning mt-0.5 flex-shrink-0" />
              <div className="text-xs text-nvx-text-secondary">
                <p className="font-medium text-nvx-text-primary mb-0.5">Minimum Deposit</p>
                <p>
                  The minimum deposit amount is <span className="text-nvx-text-primary font-mono">{selectedAsset.minDeposit}</span>.
                  Deposits below this amount will not be credited.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-nvx-bg-primary border border-nvx-border rounded-lg">
              <Info size={14} className="text-nvx-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-nvx-text-secondary">
                <p className="font-medium text-nvx-text-primary mb-0.5">Confirmations Required</p>
                <p>
                  Your deposit will be credited after{' '}
                  <span className="text-nvx-text-primary font-mono">{selectedAsset.confirmations}</span>{' '}
                  network confirmation{selectedAsset.confirmations > 1 ? 's' : ''}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
