import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { OrderBookLevel } from '../../types';

interface MiniOrderBookProps {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  maxLevels?: number;
  lastPrice?: string;
}

function calculateMaxTotal(levels: OrderBookLevel[]): number {
  return levels.reduce((max, l) => Math.max(max, parseFloat(l.total) || 0), 0);
}

const OrderRow = React.memo(function OrderRow({
  level,
  side,
  maxTotal,
}: {
  level: OrderBookLevel;
  side: 'bid' | 'ask';
  maxTotal: number;
}) {
  const total = parseFloat(level.total) || 0;
  const widthPercent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const isBid = side === 'bid';

  return (
    <View style={styles.row}>
      {/* Background bar */}
      <View
        style={[
          styles.bar,
          isBid ? styles.bidBar : styles.askBar,
          { width: `${widthPercent}%` },
          isBid ? { right: 0 } : { left: 0 },
        ]}
      />
      <Text style={[styles.price, isBid ? styles.bidPrice : styles.askPrice]}>
        {level.price}
      </Text>
      <Text style={styles.amount}>{level.amount}</Text>
      <Text style={styles.total}>{level.total}</Text>
    </View>
  );
});

export function MiniOrderBook({ bids, asks, maxLevels = 7, lastPrice }: MiniOrderBookProps) {
  const displayAsks = asks.slice(0, maxLevels).reverse();
  const displayBids = bids.slice(0, maxLevels);

  const allLevels = [...displayAsks, ...displayBids];
  const maxTotal = calculateMaxTotal(allLevels);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerText, { flex: 1 }]}>Price</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'center' }]}>Amount</Text>
        <Text style={[styles.headerText, { flex: 1, textAlign: 'right' }]}>Total</Text>
      </View>

      {/* Asks (sells) */}
      {displayAsks.map((level, i) => (
        <OrderRow key={`ask-${i}`} level={level} side="ask" maxTotal={maxTotal} />
      ))}

      {/* Spread / Last Price */}
      {lastPrice && (
        <View style={styles.spreadRow}>
          <Text style={styles.spreadPrice}>{lastPrice}</Text>
        </View>
      )}

      {/* Bids (buys) */}
      {displayBids.map((level, i) => (
        <OrderRow key={`bid-${i}`} level={level} side="bid" maxTotal={maxTotal} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  bidBar: {
    backgroundColor: colors.bidBar,
  },
  askBar: {
    backgroundColor: colors.askBar,
  },
  price: {
    flex: 1,
    ...typography.tabular,
    fontSize: 13,
  },
  bidPrice: {
    color: colors.success,
  },
  askPrice: {
    color: colors.danger,
  },
  amount: {
    flex: 1,
    ...typography.tabular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  total: {
    flex: 1,
    ...typography.tabular,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  spreadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSecondary,
  },
  spreadPrice: {
    ...typography.monoLarge,
    color: colors.text,
    fontSize: 16,
  },
});
