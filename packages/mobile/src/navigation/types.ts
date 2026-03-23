import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// ── Auth Stack ────────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type LoginScreenProps = StackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = StackScreenProps<AuthStackParamList, 'Register'>;

// ── Main Tab Navigator ────────────────────────────────────────────────────────

export type MainTabParamList = {
  Markets: undefined;
  Trade: { symbol?: string } | undefined;
  Wallet: undefined;
  Portfolio: undefined;
  Profile: undefined;
};

export type MarketsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Markets'>,
  StackScreenProps<RootStackParamList>
>;

export type TradeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Trade'>,
  StackScreenProps<RootStackParamList>
>;

export type WalletScreenProps = BottomTabScreenProps<MainTabParamList, 'Wallet'>;
export type PortfolioScreenProps = BottomTabScreenProps<MainTabParamList, 'Portfolio'>;
export type ProfileScreenProps = BottomTabScreenProps<MainTabParamList, 'Profile'>;

// ── Root Stack ────────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
