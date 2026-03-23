import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, typography } from '../../theme';

interface AssetIconProps {
  asset: string;
  size?: number;
  style?: ViewStyle;
}

const ASSET_COLORS: Record<string, string> = {
  BTC: '#F7931A',
  ETH: '#627EEA',
  BNB: '#F3BA2F',
  SOL: '#9945FF',
  ADA: '#0033AD',
  DOT: '#E6007A',
  MATIC: '#8247E5',
  AVAX: '#E84142',
  LINK: '#2A5ADA',
  XRP: '#23292F',
  DOGE: '#C3A634',
  UNI: '#FF007A',
  USDT: '#26A17B',
  USDC: '#2775CA',
};

function getAssetColor(asset: string): string {
  if (ASSET_COLORS[asset]) return ASSET_COLORS[asset];
  // Deterministic color from asset name
  let hash = 0;
  for (let i = 0; i < asset.length; i++) {
    hash = asset.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

export function AssetIcon({ asset, size = 36, style }: AssetIconProps) {
  const bgColor = useMemo(() => getAssetColor(asset), [asset]);
  const letter = asset.charAt(0).toUpperCase();
  const fontSize = size * 0.42;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        style,
      ]}
    >
      <Text style={[styles.letter, { fontSize, lineHeight: size }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
});
