import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography } from '../../theme';
import type { OrderSide, OrderType } from '../../types';

interface OrderFormProps {
  symbol: string;
  currentPrice: string;
  baseAsset: string;
  quoteAsset: string;
  baseBalance?: string;
  quoteBalance?: string;
  onSubmit?: (order: {
    side: OrderSide;
    type: OrderType;
    price: string;
    amount: string;
  }) => void;
}

const PERCENT_BUTTONS = [25, 50, 75, 100] as const;

export function OrderForm({ symbol, currentPrice, baseAsset, quoteAsset, baseBalance, quoteBalance, onSubmit }: OrderFormProps) {
  const [side, setSide] = useState<OrderSide>('buy');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [price, setPrice] = useState(currentPrice);
  const [amount, setAmount] = useState('');

  const isBuy = side === 'buy';

  const handleSideChange = useCallback((newSide: OrderSide) => {
    setSide(newSide);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleTypeChange = useCallback((newType: OrderType) => {
    setOrderType(newType);
    if (newType === 'market') {
      setPrice(currentPrice);
    }
  }, [currentPrice]);

  const handlePercentPress = useCallback(
    (pct: number) => {
      if (isBuy) {
        // Buying: calculate how much base we can buy with pct of quote balance
        const availableQuote = parseFloat(quoteBalance ?? '0');
        const priceNum = parseFloat(price) || parseFloat(currentPrice) || 1;
        const maxBase = availableQuote / priceNum;
        const pctAmount = (maxBase * pct) / 100;
        setAmount(pctAmount > 0 ? pctAmount.toFixed(6) : '');
      } else {
        // Selling: use pct of base balance
        const availableBase = parseFloat(baseBalance ?? '0');
        const pctAmount = (availableBase * pct) / 100;
        setAmount(pctAmount > 0 ? pctAmount.toFixed(6) : '');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [isBuy, price, currentPrice, baseBalance, quoteBalance],
  );

  const handleSubmit = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit?.({ side, type: orderType, price, amount });
  }, [side, orderType, price, amount, onSubmit]);

  const estimatedTotal = (() => {
    const p = parseFloat(price) || 0;
    const a = parseFloat(amount) || 0;
    return (p * a).toFixed(2);
  })();

  return (
    <View style={styles.container}>
      {/* Buy / Sell Tabs */}
      <View style={styles.sideToggle}>
        <TouchableOpacity
          style={[styles.sideTab, isBuy && styles.sideTabBuyActive]}
          onPress={() => handleSideChange('buy')}
          activeOpacity={0.8}
        >
          <Text style={[styles.sideTabText, isBuy && styles.sideTabTextActive]}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sideTab, !isBuy && styles.sideTabSellActive]}
          onPress={() => handleSideChange('sell')}
          activeOpacity={0.8}
        >
          <Text style={[styles.sideTabText, !isBuy && styles.sideTabTextActive]}>Sell</Text>
        </TouchableOpacity>
      </View>

      {/* Order Type Toggle */}
      <View style={styles.typeToggle}>
        {(['limit', 'market'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeTab, orderType === type && styles.typeTabActive]}
            onPress={() => handleTypeChange(type)}
          >
            <Text style={[styles.typeTabText, orderType === type && styles.typeTabTextActive]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Price Input */}
      {orderType === 'limit' && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Price ({quoteAsset})</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textTertiary}
            placeholder="0.00"
          />
        </View>
      )}

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount ({baseAsset})</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textTertiary}
          placeholder="0.00"
        />
      </View>

      {/* Percentage Buttons */}
      <View style={styles.percentRow}>
        {PERCENT_BUTTONS.map((pct) => (
          <TouchableOpacity
            key={pct}
            style={styles.percentButton}
            onPress={() => handlePercentPress(pct)}
            activeOpacity={0.7}
          >
            <Text style={styles.percentText}>{pct}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Estimated Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Est. Total</Text>
        <Text style={styles.totalValue}>
          {estimatedTotal} {quoteAsset}
        </Text>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isBuy ? styles.submitBuy : styles.submitSell]}
        onPress={handleSubmit}
        activeOpacity={0.8}
      >
        <Text style={styles.submitText}>
          {isBuy ? 'Buy' : 'Sell'} {baseAsset}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: spacing.lg,
  },
  sideToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderRadius: borderRadius.sm,
    padding: 2,
    marginBottom: spacing.md,
  },
  sideTab: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm - 1,
    alignItems: 'center',
  },
  sideTabBuyActive: {
    backgroundColor: colors.success,
  },
  sideTabSellActive: {
    backgroundColor: colors.danger,
  },
  sideTabText: {
    ...typography.bodyBold,
    color: colors.textTertiary,
  },
  sideTabTextActive: {
    color: '#FFFFFF',
  },
  typeToggle: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  typeTab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeTabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  typeTabText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  typeTabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    ...typography.mono,
    fontSize: 15,
  },
  percentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  percentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  percentText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  totalValue: {
    ...typography.tabular,
    color: colors.text,
  },
  submitButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  submitBuy: {
    backgroundColor: colors.success,
  },
  submitSell: {
    backgroundColor: colors.danger,
  },
  submitText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontSize: 16,
  },
});
