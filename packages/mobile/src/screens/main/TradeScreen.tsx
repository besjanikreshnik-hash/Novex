import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Rect, Line } from 'react-native-svg';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useMarketStore } from '../../stores/market.store';
import { MiniOrderBook } from '../../components/trading/MiniOrderBook';
import { OrderForm } from '../../components/trading/OrderForm';
import api, { toApiSymbol } from '../../lib/api';
import wsClient from '../../lib/ws';
import type { TradeScreenProps } from '../../navigation/types';
import type { OrderBookLevel, OrderSide, OrderType } from '../../types';

// ── Backend response types ──────────────────────────────────────────────────

interface BackendOrderBook {
  symbol: string;
  bids: [string, string][];  // [price, amount][]
  asks: [string, string][];
  timestamp: number;
}

interface BackendBalanceDto {
  currency: string;
  available: string;
  locked: string;
  total: string;
}

// ── Mini Chart Placeholder ────────────────────────────────────────────────────

function MiniChartPlaceholder() {
  const candles = Array.from({ length: 20 }, (_, i) => ({
    x: i * 16 + 8,
    open: 40 + Math.random() * 40,
    close: 40 + Math.random() * 40,
    high: 30 + Math.random() * 10,
    low: 80 + Math.random() * 10,
  }));

  return (
    <View style={styles.chartContainer}>
      <Svg width="100%" height={140} viewBox="0 0 340 140">
        {candles.map((c, i) => {
          const isGreen = c.close > c.open;
          const top = Math.min(c.open, c.close);
          const bottom = Math.max(c.open, c.close);
          const color = isGreen ? colors.success : colors.danger;
          return (
            <React.Fragment key={i}>
              <Line
                x1={c.x}
                y1={c.high}
                x2={c.x}
                y2={c.low}
                stroke={color}
                strokeWidth={1}
              />
              <Rect
                x={c.x - 4}
                y={top}
                width={8}
                height={Math.max(bottom - top, 2)}
                fill={color}
                rx={1}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function TradeScreen({ route }: TradeScreenProps) {
  const symbolParam = route?.params?.symbol;
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const pairs = useMarketStore((s) => s.pairs);
  const storeOrderBook = useMarketStore((s) => s.orderBook);

  const symbol = symbolParam ?? selectedSymbol;
  const apiSymbol = toApiSymbol(symbol); // "BTC/USDT" -> "BTC_USDT"
  const pair = pairs.find((p) => p.symbol === symbol);

  const currentPrice = pair?.lastPrice ?? '0';
  const change24h = pair?.change24h ?? '0';
  const high24h = pair?.high24h ?? '0';
  const low24h = pair?.low24h ?? '0';
  const volume24h = pair?.volume24h ?? '0';
  const baseAsset = pair?.baseAsset ?? symbol.split('/')[0] ?? 'BTC';
  const quoteAsset = pair?.quoteAsset ?? symbol.split('/')[1] ?? 'USDT';

  const changeNum = parseFloat(change24h);
  const isPositive = changeNum >= 0;

  const [localOrderBook, setLocalOrderBook] = useState<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] } | null>(null);
  const [balances, setBalances] = useState<BackendBalanceDto[]>([]);
  const [loadingBook, setLoadingBook] = useState(true);

  // Fetch order book from REST API
  const fetchOrderBook = useCallback(async () => {
    try {
      const data = await api.get<BackendOrderBook>(
        `/market/orderbook/${apiSymbol}?depth=20`,
        { authenticated: false },
      );

      let bidTotal = 0;
      let askTotal = 0;
      const bids: OrderBookLevel[] = data.bids.map(([price, amount]) => {
        bidTotal += parseFloat(amount);
        return { price, amount, total: bidTotal.toFixed(8) };
      });
      const asks: OrderBookLevel[] = data.asks.map(([price, amount]) => {
        askTotal += parseFloat(amount);
        return { price, amount, total: askTotal.toFixed(8) };
      });

      setLocalOrderBook({ bids, asks });
    } catch (err) {
      console.warn('Failed to fetch order book:', err);
    } finally {
      setLoadingBook(false);
    }
  }, [apiSymbol]);

  // Fetch user balances
  const fetchBalances = useCallback(async () => {
    try {
      const data = await api.get<BackendBalanceDto[]>('/wallets/balances');
      setBalances(data);
    } catch {
      // Not logged in or error - ignore
    }
  }, []);

  useEffect(() => {
    fetchOrderBook();
    fetchBalances();

    // Subscribe to WS orderbook updates
    wsClient.connect();
    wsClient.subscribeOrderBook(apiSymbol);

    return () => {
      wsClient.unsubscribeOrderBook(apiSymbol);
    };
  }, [apiSymbol, fetchOrderBook, fetchBalances]);

  // Prefer WS-updated orderbook from store, fall back to local REST fetch
  const orderBook = storeOrderBook ?? localOrderBook ?? { bids: [], asks: [] };

  // Get available balance for the base and quote assets
  const baseBalance = balances.find((b) => b.currency === baseAsset);
  const quoteBalance = balances.find((b) => b.currency === quoteAsset);

  const handleOrderSubmit = useCallback(async (order: {
    side: OrderSide;
    type: OrderType;
    price: string;
    amount: string;
  }) => {
    try {
      await api.post('/orders', {
        symbol: apiSymbol,
        side: order.side,
        type: order.type,
        price: order.type === 'limit' ? order.price : undefined,
        quantity: order.amount,
      });
      Alert.alert('Order Placed', `${order.side.toUpperCase()} ${order.amount} ${baseAsset} placed successfully.`);
      // Refresh balances after order placement
      fetchBalances();
    } catch (err: any) {
      Alert.alert('Order Failed', err?.message ?? 'Failed to place order.');
    }
  }, [apiSymbol, baseAsset, fetchBalances]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Pair Header */}
        <View style={styles.pairHeader}>
          <View>
            <Text style={styles.pairSymbol}>{symbol}</Text>
            <View style={styles.pairPriceRow}>
              <Text style={[styles.pairPrice, isPositive ? styles.priceUp : styles.priceDown]}>
                ${currentPrice}
              </Text>
              <View style={[styles.changeBadge, isPositive ? styles.changeBadgeUp : styles.changeBadgeDown]}>
                <Text style={[styles.changeText, isPositive ? styles.changeUp : styles.changeDown]}>
                  {isPositive ? '+' : ''}{change24h}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h High</Text>
            <Text style={styles.statValue}>${high24h}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>24h Low</Text>
            <Text style={styles.statValue}>${low24h}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>{formatVolume(volume24h)}</Text>
          </View>
        </View>

        {/* Balances Row */}
        {(baseBalance || quoteBalance) && (
          <View style={styles.balancesRow}>
            {baseBalance && (
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>{baseAsset} Available</Text>
                <Text style={styles.balanceValue}>{parseFloat(baseBalance.available).toFixed(6)}</Text>
              </View>
            )}
            {quoteBalance && (
              <View style={styles.balanceItem}>
                <Text style={styles.balanceLabel}>{quoteAsset} Available</Text>
                <Text style={styles.balanceValue}>{parseFloat(quoteBalance.available).toFixed(2)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Chart Area */}
        <MiniChartPlaceholder />

        {/* Order Book */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Book</Text>
          {loadingBook ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MiniOrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              lastPrice={currentPrice}
              maxLevels={7}
            />
          )}
        </View>

        {/* Order Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Place Order</Text>
          <OrderForm
            symbol={symbol}
            currentPrice={currentPrice}
            baseAsset={baseAsset}
            quoteAsset={quoteAsset}
            baseBalance={baseBalance?.available}
            quoteBalance={quoteBalance?.available}
            onSubmit={handleOrderSubmit}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

function formatVolume(vol: string): string {
  const n = parseFloat(vol);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return vol;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pairHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  pairSymbol: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pairPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pairPrice: {
    ...typography.monoLarge,
    fontSize: 24,
    marginRight: spacing.md,
  },
  priceUp: {
    color: colors.success,
  },
  priceDown: {
    color: colors.danger,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  changeBadgeUp: {
    backgroundColor: colors.successMuted,
  },
  changeBadgeDown: {
    backgroundColor: colors.dangerMuted,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  changeUp: {
    color: colors.success,
  },
  changeDown: {
    color: colors.danger,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  statValue: {
    ...typography.tabular,
    color: colors.textSecondary,
  },
  balancesRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  balanceItem: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  balanceValue: {
    ...typography.tabular,
    color: colors.text,
  },
  chartContainer: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    height: 160,
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bottomPad: {
    height: spacing.xxxl,
  },
});
