/**
 * NovEx — Test Fixtures for Matching Engine & Settlement Tests
 *
 * Reusable factories for users, wallets, trading pairs, and orders.
 * All amounts use string decimals for consistency with the domain model.
 */
import Decimal from 'decimal.js';
import { BookOrder } from '../matching-engine.service';
import { OrderSide, OrderType, OrderStatus } from '../entities/order.entity';

/* ─── IDs ─────────────────────────────────────────────────── */

let idCounter = 0;

/** Deterministic UUID-like ID for test reproducibility */
export function nextId(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`;
}

export function resetIds(): void {
  idCounter = 0;
}

/* ─── Users ───────────────────────────────────────────────── */

export interface TestUser {
  id: string;
  email: string;
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id ?? nextId();
  return {
    id,
    email: overrides.email ?? `user-${id.slice(-4)}@test.novex.io`,
  };
}

/* ─── Trading Pairs ───────────────────────────────────────── */

export interface TestPair {
  id: string;
  symbol: string;
  baseCurrency: string;
  quoteCurrency: string;
  pricePrecision: number;
  quantityPrecision: number;
  minQuantity: string;
  makerFee: string;
  takerFee: string;
  isActive: boolean;
}

export function makePair(overrides: Partial<TestPair> = {}): TestPair {
  return {
    id: overrides.id ?? nextId(),
    symbol: 'BTC_USDT',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    pricePrecision: 2,
    quantityPrecision: 8,
    minQuantity: '0.00001',
    makerFee: '0.001',   // 0.1%
    takerFee: '0.001',   // 0.1%
    isActive: true,
    ...overrides,
  };
}

export const PAIRS = {
  BTC_USDT: makePair({ symbol: 'BTC_USDT', baseCurrency: 'BTC', quoteCurrency: 'USDT' }),
  ETH_USDT: makePair({ symbol: 'ETH_USDT', baseCurrency: 'ETH', quoteCurrency: 'USDT' }),
  SOL_USDT: makePair({ symbol: 'SOL_USDT', baseCurrency: 'SOL', quoteCurrency: 'USDT' }),
} as const;

/* ─── Book Orders ─────────────────────────────────────────── */

let tsCounter = 1000;

export function makeBookOrder(overrides: Partial<BookOrder> & { symbol?: string } = {}): BookOrder {
  tsCounter++;
  return {
    id: overrides.id ?? nextId(),
    userId: overrides.userId ?? nextId(),
    symbol: overrides.symbol ?? 'BTC_USDT',
    side: overrides.side ?? 'buy',
    price: overrides.price ?? new Decimal('50000'),
    remainingQty: overrides.remainingQty ?? new Decimal('1'),
    timestamp: overrides.timestamp ?? tsCounter,
  };
}

export function resetTimestamps(): void {
  tsCounter = 1000;
}

/* ─── Wallet Balances ─────────────────────────────────────── */

export interface TestBalance {
  userId: string;
  currency: string;
  available: string;
  locked: string;
}

export function makeBalance(overrides: Partial<TestBalance> = {}): TestBalance {
  return {
    userId: overrides.userId ?? nextId(),
    currency: overrides.currency ?? 'USDT',
    available: overrides.available ?? '100000',
    locked: overrides.locked ?? '0',
    ...overrides,
  };
}

/* ─── Order DTOs ──────────────────────────────────────────── */

export interface TestPlaceOrderDto {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  quantity: string;
}

export function makePlaceOrder(overrides: Partial<TestPlaceOrderDto> = {}): TestPlaceOrderDto {
  return {
    symbol: 'BTC_USDT',
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    price: '50000',
    quantity: '1',
    ...overrides,
  };
}

/* ─── Decimal Assertion Helpers ───────────────────────────── */

/**
 * Assert two decimal string values are equal, ignoring trailing zero differences.
 * e.g., '50000' === '50000.000000000000000000'
 */
export function expectDecimalEq(actual: string, expected: string, label?: string): void {
  const a = new Decimal(actual);
  const b = new Decimal(expected);
  if (!a.eq(b)) {
    const msg = label
      ? `${label}: expected ${expected}, got ${actual}`
      : `expected ${expected}, got ${actual}`;
    throw new Error(msg);
  }
}

/**
 * Assert a decimal string is greater than another.
 */
export function expectDecimalGt(actual: string, expected: string, label?: string): void {
  const a = new Decimal(actual);
  const b = new Decimal(expected);
  if (!a.gt(b)) {
    const msg = label
      ? `${label}: expected ${actual} > ${expected}`
      : `expected ${actual} > ${expected}`;
    throw new Error(msg);
  }
}

/* ─── Full Reset ──────────────────────────────────────────── */

export function resetFixtures(): void {
  resetIds();
  resetTimestamps();
}
