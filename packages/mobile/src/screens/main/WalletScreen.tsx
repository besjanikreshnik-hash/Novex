import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { AssetIcon } from '../../components/common/AssetIcon';
import api from '../../lib/api';
import type { WalletAsset } from '../../types';

// ── Backend response types ──────────────────────────────────────────────────

interface BackendBalanceDto {
  currency: string;
  available: string;
  locked: string;
  total: string;
}

interface BackendTicker {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  quoteVolume24h: string;
  priceChangePercent24h: string;
  source?: string;
}

// Currency display names
const CURRENCY_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether',
  SOL: 'Solana',
  BNB: 'BNB',
  ADA: 'Cardano',
  XRP: 'XRP',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  LINK: 'Chainlink',
  MATIC: 'Polygon',
  DOGE: 'Dogecoin',
  UNI: 'Uniswap',
  ATOM: 'Cosmos',
  LTC: 'Litecoin',
  USD: 'US Dollar',
};

// ── Asset Row ─────────────────────────────────────────────────────────────────

const AssetRow = React.memo(function AssetRow({
  item,
  onDeposit,
  onWithdraw,
}: {
  item: WalletAsset;
  onDeposit: (asset: string) => void;
  onWithdraw: (asset: string) => void;
}) {
  const hasLocked = parseFloat(item.locked) > 0;

  return (
    <View style={styles.assetRow}>
      <View style={styles.assetLeft}>
        <AssetIcon asset={item.asset} size={40} />
        <View style={styles.assetInfo}>
          <Text style={styles.assetName}>{item.asset}</Text>
          <Text style={styles.assetFullName}>{item.name}</Text>
        </View>
      </View>
      <View style={styles.assetRight}>
        <Text style={styles.assetBalance}>{formatCrypto(item.available)}</Text>
        <Text style={styles.assetUsd}>${formatMoney(item.usdValue)}</Text>
        {hasLocked && (
          <Text style={styles.assetLocked}>
            {formatCrypto(item.locked)} locked
          </Text>
        )}
      </View>
      <View style={styles.assetActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDeposit(item.asset)}
          activeOpacity={0.7}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 5v14M5 12l7 7 7-7"
              stroke={colors.success}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onWithdraw(item.asset)}
          activeOpacity={0.7}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 19V5M5 12l7-7 7 7"
              stroke={colors.danger}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function WalletScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [totalBalance, setTotalBalance] = useState('0');

  const fetchWalletData = useCallback(async () => {
    try {
      // 1. Fetch balances
      const balances = await api.get<BackendBalanceDto[]>('/wallets/balances');

      // 2. Filter out zero balances
      const nonZero = balances.filter(
        (b) => parseFloat(b.available) > 0 || parseFloat(b.locked) > 0,
      );

      // 3. Fetch ticker prices for non-stablecoin assets to calculate USD value
      const priceMap: Record<string, number> = { USDT: 1, USD: 1, USDC: 1 };

      const tickerSymbols = nonZero
        .filter((b) => !priceMap[b.currency])
        .map((b) => b.currency);

      const tickerPromises = tickerSymbols.map((currency) =>
        api
          .get<BackendTicker>(`/market/ticker/${currency}_USDT`, { authenticated: false })
          .then((t) => ({ currency, price: parseFloat(t.lastPrice) }))
          .catch(() => ({ currency, price: 0 })),
      );
      const tickerResults = await Promise.all(tickerPromises);
      for (const { currency, price } of tickerResults) {
        priceMap[currency] = price;
      }

      // 4. Map to WalletAsset
      let total = 0;
      const walletAssets: WalletAsset[] = nonZero.map((b) => {
        const price = priceMap[b.currency] ?? 0;
        const totalAmount = parseFloat(b.available) + parseFloat(b.locked);
        const usdValue = totalAmount * price;
        total += usdValue;
        return {
          asset: b.currency,
          name: CURRENCY_NAMES[b.currency] ?? b.currency,
          available: b.available,
          locked: b.locked,
          usdValue: usdValue.toFixed(2),
        };
      });

      // Sort by USD value descending
      walletAssets.sort((a, b) => parseFloat(b.usdValue) - parseFloat(a.usdValue));

      setAssets(walletAssets);
      setTotalBalance(total.toFixed(2));
    } catch (err) {
      console.warn('Failed to fetch wallet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  }, [fetchWalletData]);

  const handleDeposit = useCallback((asset: string) => {
    // Navigate to deposit screen
  }, []);

  const handleWithdraw = useCallback((asset: string) => {
    // Navigate to withdraw screen
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: WalletAsset }) => (
      <AssetRow item={item} onDeposit={handleDeposit} onWithdraw={handleWithdraw} />
    ),
    [handleDeposit, handleWithdraw],
  );

  const keyExtractor = useCallback((item: WalletAsset) => item.asset, []);

  const formattedTotal = `$${parseFloat(totalBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const ListHeader = (
    <>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <TouchableOpacity
            onPress={() => setHideBalances(!hideBalances)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              {hideBalances ? (
                <Path
                  d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
                  stroke={colors.textTertiary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <>
                  <Path
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                    stroke={colors.textTertiary}
                    strokeWidth={2}
                  />
                  <Path
                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                    stroke={colors.textTertiary}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>
          {hideBalances ? '******' : formattedTotal}
        </Text>
        <View style={styles.balanceChangeRow}>
          <Text style={styles.balanceChange}>
            {hideBalances ? '***' : '--'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.successMuted }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12l7 7 7-7" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.quickActionLabel}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.dangerMuted }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M12 19V5M5 12l7-7 7 7" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.quickActionLabel}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} activeOpacity={0.7}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryMuted }]}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M8 7h12M8 7l4-4M8 7l4 4M16 17H4M16 17l-4 4M16 17l-4-4" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.quickActionLabel}>Transfer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Assets Header */}
      <View style={styles.assetsHeader}>
        <Text style={styles.assetsTitle}>Assets</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallet</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={assets}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function formatCrypto(val: string): string {
  const n = parseFloat(val);
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}

function formatMoney(val: string): string {
  const n = parseFloat(val);
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  balanceCard: {
    margin: spacing.xl,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  balanceAmount: {
    ...typography.h1,
    color: colors.text,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
  },
  balanceChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  balanceChange: {
    ...typography.captionBold,
    color: colors.success,
    marginRight: spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  assetsHeader: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  assetsTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetInfo: {
    marginLeft: spacing.md,
  },
  assetName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  assetFullName: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  assetRight: {
    alignItems: 'flex-end',
    marginRight: spacing.md,
  },
  assetBalance: {
    ...typography.tabular,
    color: colors.text,
  },
  assetUsd: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  assetLocked: {
    fontSize: 10,
    color: colors.warning,
    marginTop: 2,
  },
  assetActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
