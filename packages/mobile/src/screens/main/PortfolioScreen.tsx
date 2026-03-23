import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Circle as SvgCircle } from 'react-native-svg';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { AssetIcon } from '../../components/common/AssetIcon';
import type { PortfolioAllocation, Transaction } from '../../types';

// ── Mock Data ─────────────────────────────────────────────────────────────────

const TOTAL_VALUE = '$71,560.37';
const CHANGE_24H = '+$1,234.56';
const CHANGE_24H_PCT = '+1.75%';

const ALLOCATIONS: PortfolioAllocation[] = [
  { asset: 'BTC', name: 'Bitcoin', percentage: 42.5, valueUsd: '30,412.56', color: '#F7931A' },
  { asset: 'ETH', name: 'Ethereum', percentage: 24.7, valueUsd: '17,710.23', color: '#627EEA' },
  { asset: 'USDT', name: 'Tether', percentage: 17.4, valueUsd: '12,456.78', color: '#26A17B' },
  { asset: 'SOL', name: 'Solana', percentage: 6.4, valueUsd: '4,550.47', color: '#9945FF' },
  { asset: 'Others', name: 'Other assets', percentage: 9.0, valueUsd: '6,430.33', color: colors.textTertiary },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'trade', asset: 'BTC', amount: '+0.0124', status: 'completed', timestamp: '2025-03-22T14:30:00Z' },
  { id: '2', type: 'deposit', asset: 'USDT', amount: '+2,500.00', status: 'completed', timestamp: '2025-03-22T10:15:00Z' },
  { id: '3', type: 'trade', asset: 'ETH', amount: '-1.2500', status: 'completed', timestamp: '2025-03-21T18:45:00Z' },
  { id: '4', type: 'withdrawal', asset: 'SOL', amount: '-10.0000', status: 'pending', timestamp: '2025-03-21T12:00:00Z' },
  { id: '5', type: 'trade', asset: 'BTC', amount: '+0.0050', status: 'completed', timestamp: '2025-03-20T16:30:00Z' },
];

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ allocations }: { allocations: PortfolioAllocation[] }) {
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <View style={styles.donutContainer}>
      <Svg width={size} height={size}>
        {allocations.map((alloc, i) => {
          const offset = circumference * (1 - cumulativePercent / 100);
          const dash = circumference * (alloc.percentage / 100);
          cumulativePercent += alloc.percentage;

          return (
            <SvgCircle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={alloc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90, ${cx}, ${cy})`}
            />
          );
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutTotal}>{TOTAL_VALUE}</Text>
        <Text style={styles.donutLabel}>Total Value</Text>
      </View>
    </View>
  );
}

// ── Allocation Row ────────────────────────────────────────────────────────────

function AllocationRow({ alloc }: { alloc: PortfolioAllocation }) {
  return (
    <View style={styles.allocRow}>
      <View style={[styles.allocDot, { backgroundColor: alloc.color }]} />
      <AssetIcon asset={alloc.asset} size={30} style={styles.allocIcon} />
      <View style={styles.allocInfo}>
        <Text style={styles.allocAsset}>{alloc.asset}</Text>
        <Text style={styles.allocName}>{alloc.name}</Text>
      </View>
      <View style={styles.allocRight}>
        <Text style={styles.allocPct}>{alloc.percentage.toFixed(1)}%</Text>
        <Text style={styles.allocValue}>${alloc.valueUsd}</Text>
      </View>
    </View>
  );
}

// ── Transaction Row ───────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: Transaction }) {
  const isDeposit = tx.type === 'deposit' || tx.amount.startsWith('+');
  const iconColor = isDeposit ? colors.success : colors.danger;
  const isPending = tx.status === 'pending';

  const typeLabel = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
  const date = new Date(tx.timestamp);
  const dateStr = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isDeposit ? colors.successMuted : colors.dangerMuted }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d={isDeposit ? 'M12 5v14M5 12l7 7 7-7' : 'M12 19V5M5 12l7-7 7 7'}
            stroke={iconColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txType}>{typeLabel}</Text>
        <Text style={styles.txDate}>{dateStr}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isDeposit ? colors.success : colors.danger }]}>
          {tx.amount} {tx.asset}
        </Text>
        {isPending && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function PortfolioScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
        </View>

        {/* Total Value */}
        <View style={styles.valueCard}>
          <Text style={styles.valueLabel}>Total Portfolio Value</Text>
          <Text style={styles.valueAmount}>{TOTAL_VALUE}</Text>
          <View style={styles.valueChangeRow}>
            <Text style={styles.valueChange}>{CHANGE_24H}</Text>
            <Text style={styles.valueChangePct}>({CHANGE_24H_PCT})</Text>
            <Text style={styles.valueChangePeriod}> 24h</Text>
          </View>
        </View>

        {/* Donut Chart */}
        <DonutChart allocations={ALLOCATIONS} />

        {/* Allocations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Asset Allocation</Text>
          {ALLOCATIONS.map((alloc) => (
            <AllocationRow key={alloc.asset} alloc={alloc} />
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {MOCK_TRANSACTIONS.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
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
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  valueCard: {
    marginHorizontal: spacing.xl,
    marginVertical: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  valueLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  valueAmount: {
    ...typography.h1,
    color: colors.text,
    fontSize: 30,
    fontVariant: ['tabular-nums'],
  },
  valueChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  valueChange: {
    ...typography.captionBold,
    color: colors.success,
  },
  valueChangePct: {
    ...typography.caption,
    color: colors.success,
    marginLeft: spacing.xs,
  },
  valueChangePeriod: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutTotal: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 16,
  },
  donutLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 11,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  allocDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  allocIcon: {
    marginRight: spacing.md,
  },
  allocInfo: {
    flex: 1,
  },
  allocAsset: {
    ...typography.bodyBold,
    color: colors.text,
  },
  allocName: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  allocRight: {
    alignItems: 'flex-end',
  },
  allocPct: {
    ...typography.bodyBold,
    color: colors.text,
  },
  allocValue: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 1,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    ...typography.bodyBold,
    color: colors.text,
  },
  txDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...typography.tabular,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: colors.warningMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 3,
  },
  pendingText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning,
  },
  bottomPad: {
    height: spacing.xxxl,
  },
});
