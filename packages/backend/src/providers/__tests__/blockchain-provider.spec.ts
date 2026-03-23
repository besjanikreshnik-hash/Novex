/**
 * NovEx — Blockchain Provider Tests
 *
 * Tests the MockBlockchainProvider for deposit detection, confirmation
 * counting, withdrawal broadcast, and failure scenarios.
 *
 * Run: npm run test:providers
 */
import { MockBlockchainProvider } from '../blockchain/mock.provider';

describe('MockBlockchainProvider', () => {
  let provider: MockBlockchainProvider;

  beforeEach(() => {
    provider = new MockBlockchainProvider();
    provider.reset();
  });

  describe('Address generation', () => {
    it('generates unique addresses', async () => {
      const a1 = await provider.generateAddress('user-1', 'ETH', 'ethereum');
      const a2 = await provider.generateAddress('user-2', 'ETH', 'ethereum');
      expect(a1.address).not.toBe(a2.address);
      expect(a1.address.startsWith('0x')).toBe(true);
    });

    it('generates bitcoin testnet address', async () => {
      const addr = await provider.generateAddress('user-1', 'BTC', 'bitcoin');
      expect(addr.address.startsWith('tb1q')).toBe(true);
    });
  });

  describe('Deposit detection', () => {
    it('detects simulated deposits', async () => {
      const addr = await provider.generateAddress('user-1', 'ETH', 'ethereum');

      provider.simulateDeposit({
        txHash: '0xdeposit1',
        address: addr.address,
        amount: '1.5',
        asset: 'ETH',
        network: 'ethereum',
        confirmations: 0,
        blockNumber: 1000,
      });

      const deposits = await provider.detectDeposits([addr.address], 'ethereum');
      expect(deposits).toHaveLength(1);
      expect(deposits[0].txHash).toBe('0xdeposit1');
      expect(deposits[0].amount).toBe('1.5');
    });

    it('does not detect deposits for other addresses', async () => {
      provider.simulateDeposit({
        txHash: '0xother',
        address: '0xdifferent',
        amount: '1',
        asset: 'ETH',
        network: 'ethereum',
        confirmations: 0,
        blockNumber: 1000,
      });

      const deposits = await provider.detectDeposits(['0xmyaddr'], 'ethereum');
      expect(deposits).toHaveLength(0);
    });

    it('returns duplicate deposits (idempotency handled by FundingService)', async () => {
      provider.simulateDeposit({
        txHash: '0xdup',
        address: '0xaddr',
        amount: '1',
        asset: 'ETH',
        network: 'ethereum',
        confirmations: 3,
        blockNumber: 1000,
      });

      const d1 = await provider.detectDeposits(['0xaddr'], 'ethereum');
      const d2 = await provider.detectDeposits(['0xaddr'], 'ethereum');
      expect(d1).toHaveLength(1);
      expect(d2).toHaveLength(1);
      expect(d1[0].txHash).toBe(d2[0].txHash);
    });
  });

  describe('Confirmation counting', () => {
    it('tracks confirmation advancement', async () => {
      provider.simulateDeposit({
        txHash: '0xconf_test',
        address: '0xaddr',
        amount: '1',
        asset: 'ETH',
        network: 'ethereum',
        confirmations: 0,
        blockNumber: 1000,
      });

      let status = await provider.getTransactionStatus('0xconf_test');
      expect(status.confirmations).toBe(0);
      expect(status.status).toBe('pending');

      provider.advanceConfirmations('0xconf_test', 5);

      status = await provider.getTransactionStatus('0xconf_test');
      expect(status.confirmations).toBe(5);
      expect(status.status).toBe('confirmed');
    });

    it('unknown txHash returns pending with 0 confirmations', async () => {
      const status = await provider.getTransactionStatus('0xunknown');
      expect(status.confirmations).toBe(0);
      expect(status.status).toBe('pending');
    });
  });

  describe('Withdrawal broadcast', () => {
    it('returns a mock txHash', async () => {
      const result = await provider.broadcastWithdrawal('0xrecipient', '1.5', 'ETH', 'ethereum');
      expect(result.txHash).toBeTruthy();
      expect(result.txHash.startsWith('0xmock_wd_')).toBe(true);
    });

    it('broadcast can be confirmed', async () => {
      const result = await provider.broadcastWithdrawal('0xrecipient', '1', 'ETH', 'ethereum');
      provider.advanceConfirmations(result.txHash, 12);

      const status = await provider.getTransactionStatus(result.txHash);
      expect(status.status).toBe('confirmed');
      expect(status.confirmations).toBe(12);
    });

    it('broadcast can be failed', async () => {
      const result = await provider.broadcastWithdrawal('0xrecipient', '1', 'ETH', 'ethereum');
      provider.failBroadcast(result.txHash);

      const status = await provider.getTransactionStatus(result.txHash);
      expect(status.status).toBe('failed');
    });
  });

  describe('Block tracking', () => {
    it('starts at block 1000', async () => {
      expect(await provider.getCurrentBlock()).toBe(1000);
    });

    it('advances blocks', async () => {
      provider.advanceBlocks(10);
      expect(await provider.getCurrentBlock()).toBe(1010);
    });
  });
});
