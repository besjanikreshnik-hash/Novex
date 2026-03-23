'use client';

import { useState } from 'react';
import { Search, ChevronDown, ChevronRight, Mail, Rocket, BarChart3, Wallet, Shield, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqSection {
  title: string;
  icon: React.ElementType;
  items: FaqItem[];
}

const faqSections: FaqSection[] = [
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [
      {
        question: 'How to create an account',
        answer:
          'Visit the NovEx registration page and provide your email address and a secure password. You will receive a verification email to confirm your account. Once confirmed you can log in and start exploring the platform.',
      },
      {
        question: 'How to verify my identity',
        answer:
          'Navigate to Settings > Verification and follow the on-screen instructions. You will need to upload a government-issued photo ID and a selfie for comparison. Verification typically completes within a few minutes but may take up to 24 hours during peak times.',
      },
      {
        question: 'How to deposit funds',
        answer:
          'Go to Wallet > Deposit and select the asset you want to deposit. Copy the deposit address or scan the QR code, then send funds from your external wallet to that address. Make sure to select the correct network to avoid losing funds.',
      },
    ],
  },
  {
    title: 'Trading',
    icon: BarChart3,
    items: [
      {
        question: 'How to place a limit order',
        answer:
          'On the Trade page, select the "Limit" tab in the order form. Enter the price at which you want to buy or sell and the amount. Click "Buy" or "Sell" to submit. Your order will sit on the order book until it is filled or you cancel it.',
      },
      {
        question: 'How to place a market order',
        answer:
          'On the Trade page, select the "Market" tab. Enter only the amount you wish to buy or sell. A market order executes immediately at the best available price on the order book.',
      },
      {
        question: 'What are stop-limit orders',
        answer:
          'A stop-limit order combines a stop price (trigger) with a limit price. When the market reaches your stop price the system places a limit order at your specified limit price. This helps automate entries and exits while maintaining price control.',
      },
      {
        question: 'Understanding trading fees',
        answer:
          'NovEx uses a maker-taker fee model. Maker orders (those that add liquidity to the book) and taker orders (those that remove liquidity) may have different fee rates. Check the Fees page for the latest schedule. Volume-based discounts may apply.',
      },
      {
        question: 'How to read the order book',
        answer:
          'The order book displays current buy (bid) and sell (ask) orders. Green rows represent bids and red rows represent asks. The spread is the difference between the best bid and best ask. Larger bars indicate higher volume at that price level.',
      },
    ],
  },
  {
    title: 'Wallet & Funds',
    icon: Wallet,
    items: [
      {
        question: 'How to deposit cryptocurrency',
        answer:
          'Go to Wallet > Deposit and choose the asset. Each asset has a unique deposit address for each supported network. Copy the address, then initiate a transfer from your external wallet. Deposits are credited after the required number of network confirmations.',
      },
      {
        question: 'How to withdraw funds',
        answer:
          'Navigate to Wallet > Withdraw, select the asset and network, enter the destination address and amount, then confirm. You may need to complete email or 2FA verification before the withdrawal is processed.',
      },
      {
        question: 'Why is my withdrawal pending',
        answer:
          'Withdrawals may be pending due to security review, network congestion, or required confirmations. Large withdrawals may trigger additional manual review. If your withdrawal has been pending for more than 24 hours please contact support.',
      },
      {
        question: 'Supported networks',
        answer:
          'NovEx supports deposits and withdrawals on multiple blockchain networks depending on the asset. Common networks include Ethereum (ERC-20), BNB Smart Chain (BEP-20), and Solana. Always double-check the selected network matches your sending wallet.',
      },
    ],
  },
  {
    title: 'Security',
    icon: Shield,
    items: [
      {
        question: 'How to enable 2FA',
        answer:
          'Go to Settings > Security and click "Enable 2FA". Scan the QR code with an authenticator app such as Google Authenticator or Authy. Enter the 6-digit code to confirm. We strongly recommend enabling 2FA to protect your account.',
      },
      {
        question: 'How to change my password',
        answer:
          'Navigate to Settings > Security and click "Change Password". Enter your current password followed by your new password twice. Your new password should be at least 8 characters and include uppercase, lowercase, numbers, and symbols.',
      },
      {
        question: 'What if I lose my 2FA device',
        answer:
          'If you saved your 2FA backup codes during setup you can use one to log in. If you do not have backup codes, contact support with your registered email and identity verification documents. Account recovery may take 1-3 business days.',
      },
    ],
  },
  {
    title: 'Account',
    icon: UserCog,
    items: [
      {
        question: 'How to export trade history',
        answer:
          'Go to Settings > Trade History and click "Export CSV". You can filter by date range and trading pair before exporting. The downloaded file includes all executed trades with timestamps, prices, amounts, and fees.',
      },
      {
        question: 'How to use the referral program',
        answer:
          'Visit the Referral page from the main navigation. Copy your unique referral code or link and share it. When someone registers using your code and starts trading, both of you earn rewards. Check the Referral page for current reward rates.',
      },
      {
        question: 'Account verification levels',
        answer:
          'NovEx has multiple verification tiers. Basic accounts (email verified) have limited withdrawal amounts. Level 1 (ID verified) unlocks higher limits. Level 2 (advanced verification) provides the highest limits and access to all features.',
      },
    ],
  },
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredSections = faqSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-nvx-bg-primary p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-nvx-text-primary">
            Help &amp; Support
          </h1>
          <p className="text-nvx-text-secondary mt-2">
            Find answers to common questions or reach out to our team
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-nvx-text-muted"
          />
          <input
            type="text"
            placeholder="Search for a question..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-nvx-bg-secondary border border-nvx-border rounded-xl text-nvx-text-primary placeholder:text-nvx-text-muted focus:outline-none focus:border-nvx-primary transition-colors"
          />
        </div>

        {/* FAQ Sections */}
        {filteredSections.length === 0 ? (
          <div className="text-center py-12 text-nvx-text-muted">
            No results found for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSections.map((section) => (
              <div
                key={section.title}
                className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden"
              >
                {/* Section Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-nvx-border">
                  <div className="w-8 h-8 rounded-lg bg-nvx-primary/10 flex items-center justify-center">
                    <section.icon size={16} className="text-nvx-primary" />
                  </div>
                  <h2 className="text-sm font-semibold text-nvx-text-primary">
                    {section.title}
                  </h2>
                </div>

                {/* Items */}
                <div className="divide-y divide-nvx-border/50">
                  {section.items.map((item, idx) => {
                    const key = `${section.title}-${idx}`;
                    const isOpen = openItems.has(key);
                    return (
                      <div key={key}>
                        <button
                          onClick={() => toggleItem(key)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-nvx-bg-tertiary/50 transition-colors"
                        >
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isOpen
                                ? 'text-nvx-primary'
                                : 'text-nvx-text-secondary',
                            )}
                          >
                            {item.question}
                          </span>
                          {isOpen ? (
                            <ChevronDown
                              size={16}
                              className="text-nvx-primary shrink-0 ml-4"
                            />
                          ) : (
                            <ChevronRight
                              size={16}
                              className="text-nvx-text-muted shrink-0 ml-4"
                            />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-6 pb-4 text-sm leading-relaxed text-nvx-text-muted animate-fade-in">
                            {item.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact Support */}
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-nvx-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail size={22} className="text-nvx-primary" />
          </div>
          <h2 className="text-lg font-semibold text-nvx-text-primary">
            Still need help?
          </h2>
          <p className="text-sm text-nvx-text-muted mt-2 mb-4">
            Our support team is available 24/7 to assist you
          </p>
          <a
            href="mailto:support@novex.io"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-nvx-primary hover:bg-nvx-primary/90 rounded-xl text-sm font-medium text-white transition-colors"
          >
            <Mail size={16} />
            support@novex.io
          </a>
        </div>
      </div>
    </div>
  );
}
