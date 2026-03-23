import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TextStyle } from 'react-native';
import { colors, typography } from '../../theme';

interface PriceTextProps {
  price: string;
  previousPrice?: string;
  style?: TextStyle;
  flashDuration?: number;
}

export function PriceText({ price, previousPrice, style, flashDuration = 300 }: PriceTextProps) {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const prevPriceRef = useRef(previousPrice ?? price);

  const direction = getDirection(price, prevPriceRef.current);

  useEffect(() => {
    if (previousPrice !== undefined && previousPrice !== price) {
      prevPriceRef.current = previousPrice;
      // Flash animation
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: 50,
          useNativeDriver: false,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: flashDuration,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [price, previousPrice, flashOpacity, flashDuration]);

  const textColor = direction === 'up' ? colors.success : direction === 'down' ? colors.danger : colors.text;
  const flashColor = direction === 'up' ? colors.successMuted : direction === 'down' ? colors.dangerMuted : 'transparent';

  return (
    <Animated.Text
      style={[
        styles.price,
        { color: textColor },
        { backgroundColor: flashOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: ['transparent', flashColor],
          }),
        },
        style,
      ]}
    >
      {price}
    </Animated.Text>
  );
}

function getDirection(current: string, previous: string): 'up' | 'down' | 'neutral' {
  const cur = parseFloat(current);
  const prev = parseFloat(previous);
  if (isNaN(cur) || isNaN(prev) || cur === prev) return 'neutral';
  return cur > prev ? 'up' : 'down';
}

const styles = StyleSheet.create({
  price: {
    ...typography.mono,
    color: colors.text,
  },
});
