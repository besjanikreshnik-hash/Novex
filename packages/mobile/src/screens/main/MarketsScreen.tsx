import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Polyline } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useMarketStore } from '../../stores/market.store';
import { AssetIcon } from '../../components/common/AssetIcon';
import api, { toDisplaySymbol } from '../../lib/api';
import wsClient from '../../lib/ws';
import type { TradingPair } from '../../types';
import type { MainTabParamList } from '../../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

// ── Backend response types ───────────────────────────────────────────────────

interface BackendPair {
  id: string;
  symbol: string;        // "BTC_USDT"
  baseCurrency: string;  // "BTC"
  quoteCurrency: string; // "USDT"
  isActive: boolean;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: string;
  makerFee: string;
  takerFee: string;
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

// ── Mini Sparkline ────────────────────────────────────────────────────────────

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const width = 60;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={positive ? colors.success : colors.danger}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Market Row ────────────────────────────────────────────────────────────────

const MarketRow = React.memo(function MarketRow({
  pair,
  onPress,
}: {
  pair: TradingPair;
  onPress: () => void;
}) {
  const changeNum = parseFloat(pair.change24h);
  const isPositive = changeNum >= 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <AssetIcon asset={pair.baseAsset} size={38} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowSymbol}>{pair.baseAsset}</Text>
        <Text style={styles.rowQuote}>{pair.quoteAsset}</Text>
      </View>
      <View style={styles.rowSparkline}>
        <MiniSparkline data={pair.sparkline} positive={isPositive} />
      </View>
      <View style={styles.rowPriceCol}>
        <Text style={styles.rowPrice}>${pair.lastPrice}</Text>
        <View style={[styles.changeBadge, isPositive ? styles.changeBadgeUp : styles.changeBadgeDown]}>
          <Text style={[styles.changeText, isPositive ? styles.changeTextUp : styles.changeTextDown]}>
            {isPositive ? '+' : ''}{pair.change24h}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ── Screen ────────────────────────────────────────────────────────────────────

export function MarketsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { searchQuery, setSearchQuery, setPairs, setSelectedSymbol } = useMarketStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMarketData = useCallback(async () => {
    try {
      // 1. Fetch all active trading pairs
      const backendPairs = await api.get<BackendPair[]>('/market/pairs', { authenticated: false });

      // 2. Fetch ticker for each pair in parallel
      const tickerPromises = backendPairs.map((p) =>
        api
          .get<BackendTicker>(`/market/ticker/${p.symbol}`, { authenticated: false })
          .catch(() => null),
      );
      const tickers = await Promise.all(tickerPromises);

      // 3. Map to mobile TradingPair format
      const pairs: TradingPair[] = backendPairs.map((p, i) => {
        const ticker = tickers[i];
        const lastPrice = ticker?.lastPrice ?? '0';
        const priceNum = parseFloat(lastPrice);
        return {
          symbol: toDisplaySymbol(p.symbol), // "BTC_USDT" -> "BTC/USDT"
          baseAsset: p.baseCurrency,
          quoteAsset: p.quoteCurrency,
          lastPrice,
          change24h: ticker?.priceChangePercent24h ?? '0',
          high24h: ticker?.highPrice24h ?? '0',
          low24h: ticker?.lowPrice24h ?? '0',
          volume24h: ticker?.volume24h ?? '0',
          sparkline: priceNum > 0 ? [priceNum * 0.99, priceNum * 0.995, priceNum * 1.002, priceNum * 0.998, priceNum * 1.001, priceNum * 1.003, priceNum] : [],
        };
      });

      setPairs(pairs);

      // 4. Subscribe to WS ticker updates for all pairs
      wsClient.connect();
      wsClient.subscribeAllTickers(backendPairs.map((p) => p.symbol));
    } catch (err) {
      console.warn('Failed to fetch market data:', err);
    } finally {
      setLoading(false);
    }
  }, [setPairs]);

  useEffect(() => {
    fetchMarketData();
    return () => {
      // Cleanup WS subscriptions handled by wsClient disconnect on logout
    };
  }, [fetchMarketData]);

  const filteredPairs = useMarketStore((s) => s.getFilteredPairs());

  const handlePairPress = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      navigation.navigate('Trade', { symbol });
    },
    [navigation, setSelectedSymbol],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMarketData();
    setRefreshing(false);
  }, [fetchMarketData]);

  const renderItem = useCallback(
    ({ item }: { item: TradingPair }) => (
      <MarketRow pair={item} onPress={() => handlePairPress(item.symbol)} />
    ),
    [handlePairPress],
  );

  const keyExtractor = useCallback((item: TradingPair) => item.symbol, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
          <Path
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            stroke={colors.textTertiary}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search trading pairs"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeaders}>
        <Text style={[styles.colHeader, { flex: 1 }]}>Pair</Text>
        <Text style={[styles.colHeader, { width: 70, textAlign: 'center' }]}>Chart</Text>
        <Text style={[styles.colHeader, { width: 100, textAlign: 'right' }]}>Price / 24h</Text>
      </View>

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        /* List */
        <FlatList
          data={filteredPairs}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          getItemLayout={(_data, index) => ({
            length: 68,
            offset: 68 * index,
            index,
          })}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={11}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colHeader: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    height: 68,
  },
  rowInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowSymbol: {
    ...typography.bodyBold,
    color: colors.text,
  },
  rowQuote: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  rowSparkline: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPriceCol: {
    width: 100,
    alignItems: 'flex-end',
  },
  rowPrice: {
    ...typography.tabular,
    color: colors.text,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 3,
  },
  changeBadgeUp: {
    backgroundColor: colors.successMuted,
  },
  changeBadgeDown: {
    backgroundColor: colors.dangerMuted,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  changeTextUp: {
    color: colors.success,
  },
  changeTextDown: {
    color: colors.danger,
  },
});
