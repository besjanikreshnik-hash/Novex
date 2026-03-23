import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';

import {
  ReconciliationRun,
  ReconciliationStatus,
} from './entities/reconciliation-run.entity';
import {
  ReconciliationMismatch,
  MismatchType,
} from './entities/reconciliation-mismatch.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Order, OrderStatus } from '../trading/entities/order.entity';
import { FeeLedger } from '../trading/entities/fee-ledger.entity';
import { WalletsService } from '../wallets/wallets.service';

const PLATFORM = WalletsService.PLATFORM_FEE_ACCOUNT;
const ZERO = new Decimal(0);
// Tolerance for floating point drift in quote calculations (price × qty)
const QUOTE_TOLERANCE = new Decimal('0.000000000001');

interface MismatchInput {
  type: MismatchType;
  asset: string;
  description: string;
  expected: string;
  actual: string;
  referenceId?: string;
  referenceType?: string;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(ReconciliationRun)
    private readonly runRepo: Repository<ReconciliationRun>,
    @InjectRepository(ReconciliationMismatch)
    private readonly mismatchRepo: Repository<ReconciliationMismatch>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(FeeLedger)
    private readonly feeRepo: Repository<FeeLedger>,
    private readonly dataSource: DataSource,
  ) {}

  /* ═══════════════════════════════════════════════════════
   * Public: execute a full reconciliation run
   * ═══════════════════════════════════════════════════════ */

  async executeRun(trigger: string = 'api'): Promise<ReconciliationRun> {
    // Discover all assets present in wallets
    const assets = await this.getDistinctAssets();

    // Create run record
    let run = this.runRepo.create({
      status: ReconciliationStatus.RUNNING,
      assetsChecked: assets.join(','),
      trigger,
      mismatchCount: 0,
      checksExecuted: 0,
    });
    run = await this.runRepo.save(run);

    const mismatches: MismatchInput[] = [];
    let checks = 0;

    try {
      // ── Invariant 1: No negative balances ─────────────
      const negResults = await this.checkNegativeBalances();
      checks += negResults.checks;
      mismatches.push(...negResults.mismatches);

      // ── Invariant 2: Fee ledger ↔ treasury balance ────
      for (const asset of assets) {
        const feeResult = await this.checkFeeLedgerVsTreasury(asset);
        checks += feeResult.checks;
        mismatches.push(...feeResult.mismatches);
      }

      // ── Invariant 3: Every trade has fee ledger entries ─
      const feeCoverage = await this.checkTradeFeeEntries();
      checks += feeCoverage.checks;
      mismatches.push(...feeCoverage.mismatches);

      // ── Invariant 4: No order overfills ────────────────
      const overfills = await this.checkOrderOverfills();
      checks += overfills.checks;
      mismatches.push(...overfills.mismatches);

      // ── Invariant 5: Trade quote = price × base ────────
      const quoteChecks = await this.checkTradeQuoteConsistency();
      checks += quoteChecks.checks;
      mismatches.push(...quoteChecks.mismatches);

      // ── Invariant 6: Trade settlement ↔ wallet balance ─
      for (const asset of assets) {
        const settleResult = await this.checkSettlementBalance(asset);
        checks += settleResult.checks;
        mismatches.push(...settleResult.mismatches);
      }

      // Persist mismatches
      if (mismatches.length > 0) {
        const entities = mismatches.map((m) =>
          this.mismatchRepo.create({
            runId: run.id,
            mismatchType: m.type,
            asset: m.asset,
            description: m.description,
            expectedValue: m.expected,
            actualValue: m.actual,
            difference: new Decimal(m.expected).minus(m.actual).abs().toFixed(),
            referenceId: m.referenceId ?? null,
            referenceType: m.referenceType ?? null,
          }),
        );
        await this.mismatchRepo.save(entities);
      }

      run.status =
        mismatches.length === 0
          ? ReconciliationStatus.PASSED
          : ReconciliationStatus.FAILED;
      run.mismatchCount = mismatches.length;
      run.checksExecuted = checks;
      run.finishedAt = new Date();
      await this.runRepo.save(run);

      this.logger.log(
        `Reconciliation run ${run.id}: ${run.status} — ${checks} checks, ${mismatches.length} mismatches`,
      );
    } catch (err) {
      run.status = ReconciliationStatus.ERROR;
      run.errorMessage = err instanceof Error ? err.message : String(err);
      run.finishedAt = new Date();
      run.checksExecuted = checks;
      await this.runRepo.save(run);
      this.logger.error(`Reconciliation run ${run.id} error: ${run.errorMessage}`);
    }

    return this.runRepo.findOneOrFail({
      where: { id: run.id },
      relations: ['mismatches'],
    });
  }

  /* ═══════════════════════════════════════════════════════
   * Public: query past runs and mismatches
   * ═══════════════════════════════════════════════════════ */

  async getRun(runId: string): Promise<ReconciliationRun> {
    return this.runRepo.findOneOrFail({
      where: { id: runId },
      relations: ['mismatches'],
    });
  }

  async listRuns(
    limit = 20,
    offset = 0,
  ): Promise<{ runs: ReconciliationRun[]; total: number }> {
    const [runs, total] = await this.runRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { runs, total };
  }

  async listMismatches(
    runId?: string,
    type?: MismatchType,
    asset?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ mismatches: ReconciliationMismatch[]; total: number }> {
    const qb = this.mismatchRepo
      .createQueryBuilder('m')
      .orderBy('m.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (runId) qb.andWhere('m.runId = :runId', { runId });
    if (type) qb.andWhere('m.mismatchType = :type', { type });
    if (asset) qb.andWhere('m.asset = :asset', { asset });

    const [mismatches, total] = await qb.getManyAndCount();
    return { mismatches, total };
  }

  /* ═══════════════════════════════════════════════════════
   * Invariant checks
   * ═══════════════════════════════════════════════════════ */

  /**
   * INV-1: No wallet should have negative available or locked balance.
   */
  private async checkNegativeBalances(): Promise<{
    checks: number;
    mismatches: MismatchInput[];
  }> {
    const mismatches: MismatchInput[] = [];

    const negAvailable: Wallet[] = await this.walletRepo
      .createQueryBuilder('w')
      .where('CAST(w.available AS DECIMAL) < 0')
      .getMany();

    const negLocked: Wallet[] = await this.walletRepo
      .createQueryBuilder('w')
      .where('CAST(w.locked AS DECIMAL) < 0')
      .getMany();

    for (const w of negAvailable) {
      mismatches.push({
        type: MismatchType.NEGATIVE_AVAILABLE,
        asset: w.currency,
        description: `Wallet ${w.id} (user=${w.userId}, ${w.currency}) has negative available balance`,
        expected: '>=0',
        actual: w.available,
        referenceId: w.id,
        referenceType: 'wallet',
      });
    }

    for (const w of negLocked) {
      mismatches.push({
        type: MismatchType.NEGATIVE_LOCKED,
        asset: w.currency,
        description: `Wallet ${w.id} (user=${w.userId}, ${w.currency}) has negative locked balance`,
        expected: '>=0',
        actual: w.locked,
        referenceId: w.id,
        referenceType: 'wallet',
      });
    }

    // 2 checks: one for available, one for locked
    return { checks: 2, mismatches };
  }

  /**
   * INV-2: Sum of fee_ledger amounts by asset = treasury wallet available for that asset.
   */
  private async checkFeeLedgerVsTreasury(
    asset: string,
  ): Promise<{ checks: number; mismatches: MismatchInput[] }> {
    const mismatches: MismatchInput[] = [];

    // Sum fee_ledger
    const result = await this.feeRepo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(CAST(f.amount AS DECIMAL)), 0)', 'total')
      .where('f.asset = :asset', { asset })
      .getRawOne();
    const ledgerTotal = new Decimal(result?.total ?? '0');

    // Treasury wallet balance
    const treasury = await this.walletRepo.findOne({
      where: { userId: PLATFORM, currency: asset },
    });
    const treasuryBalance = new Decimal(treasury?.available ?? '0');

    if (!ledgerTotal.eq(treasuryBalance)) {
      mismatches.push({
        type: MismatchType.FEE_LEDGER_TREASURY_MISMATCH,
        asset,
        description: `fee_ledger sum for ${asset} (${ledgerTotal.toFixed()}) ≠ treasury balance (${treasuryBalance.toFixed()})`,
        expected: ledgerTotal.toFixed(),
        actual: treasuryBalance.toFixed(),
      });
    }

    return { checks: 1, mismatches };
  }

  /**
   * INV-3: Each trade with non-zero fees should have matching fee_ledger entries.
   */
  private async checkTradeFeeEntries(): Promise<{
    checks: number;
    mismatches: MismatchInput[];
  }> {
    const mismatches: MismatchInput[] = [];
    let checks = 0;

    // Fetch trades with non-zero buyer fee
    const tradesWithBuyerFee: Trade[] = await this.tradeRepo
      .createQueryBuilder('t')
      .where('CAST(t.buyerFeeAmount AS DECIMAL) > 0')
      .getMany();

    for (const t of tradesWithBuyerFee) {
      checks++;
      const entry = await this.feeRepo.findOne({
        where: { tradeId: t.id, source: 'buyer_fee' },
      });
      if (!entry) {
        mismatches.push({
          type: MismatchType.MISSING_FEE_LEDGER_ENTRY,
          asset: t.buyerFeeAsset,
          description: `Trade ${t.id} has buyer_fee=${t.buyerFeeAmount} ${t.buyerFeeAsset} but no fee_ledger entry`,
          expected: t.buyerFeeAmount,
          actual: '0',
          referenceId: t.id,
          referenceType: 'trade',
        });
      }
    }

    // Same for seller fee
    const tradesWithSellerFee: Trade[] = await this.tradeRepo
      .createQueryBuilder('t')
      .where('CAST(t.sellerFeeAmount AS DECIMAL) > 0')
      .getMany();

    for (const t of tradesWithSellerFee) {
      checks++;
      const entry = await this.feeRepo.findOne({
        where: { tradeId: t.id, source: 'seller_fee' },
      });
      if (!entry) {
        mismatches.push({
          type: MismatchType.MISSING_FEE_LEDGER_ENTRY,
          asset: t.sellerFeeAsset,
          description: `Trade ${t.id} has seller_fee=${t.sellerFeeAmount} ${t.sellerFeeAsset} but no fee_ledger entry`,
          expected: t.sellerFeeAmount,
          actual: '0',
          referenceId: t.id,
          referenceType: 'trade',
        });
      }
    }

    if (checks === 0) checks = 1; // counted even if no trades
    return { checks, mismatches };
  }

  /**
   * INV-4: No filled/partial order should have filledQuantity > quantity.
   */
  private async checkOrderOverfills(): Promise<{
    checks: number;
    mismatches: MismatchInput[];
  }> {
    const mismatches: MismatchInput[] = [];

    const overfilled: Order[] = await this.orderRepo
      .createQueryBuilder('o')
      .where('CAST(o.filledQuantity AS DECIMAL) > CAST(o.quantity AS DECIMAL)')
      .getMany();

    for (const o of overfilled) {
      mismatches.push({
        type: MismatchType.ORDER_OVERFILL,
        asset: o.baseCurrency,
        description: `Order ${o.id} filled ${o.filledQuantity} > original quantity ${o.quantity}`,
        expected: o.quantity,
        actual: o.filledQuantity,
        referenceId: o.id,
        referenceType: 'order',
      });
    }

    return { checks: 1, mismatches };
  }

  /**
   * INV-5: For each trade, gross_quote should equal price × gross_base (within tolerance).
   */
  private async checkTradeQuoteConsistency(): Promise<{
    checks: number;
    mismatches: MismatchInput[];
  }> {
    const mismatches: MismatchInput[] = [];
    let checks = 0;

    const trades = await this.tradeRepo.find();
    for (const t of trades) {
      checks++;
      const expected = new Decimal(t.price).times(t.grossBase);
      const actual = new Decimal(t.grossQuote);
      if (expected.minus(actual).abs().gt(QUOTE_TOLERANCE)) {
        mismatches.push({
          type: MismatchType.TRADE_QUOTE_MISMATCH,
          asset: t.symbol,
          description: `Trade ${t.id}: gross_quote ${t.grossQuote} ≠ price(${t.price}) × gross_base(${t.grossBase}) = ${expected.toFixed()}`,
          expected: expected.toFixed(),
          actual: t.grossQuote,
          referenceId: t.id,
          referenceType: 'trade',
        });
      }
    }

    if (checks === 0) checks = 1;
    return { checks, mismatches };
  }

  /**
   * INV-6: For each asset, the sum of trade-derived credits/debits to the
   * treasury should match the treasury wallet's available balance.
   *
   * This cross-checks fee_ledger against actual wallet state, catching
   * cases where creditFee() was called with wrong amount.
   */
  private async checkSettlementBalance(
    asset: string,
  ): Promise<{ checks: number; mismatches: MismatchInput[] }> {
    const mismatches: MismatchInput[] = [];

    // Expected: sum of buyer fees where buyerFeeAsset = asset
    //         + sum of seller fees where sellerFeeAsset = asset
    const buyerFeeSum = await this.tradeRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(CAST(t.buyerFeeAmount AS DECIMAL)), 0)', 'total')
      .where('t.buyerFeeAsset = :asset', { asset })
      .getRawOne();

    const sellerFeeSum = await this.tradeRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(CAST(t.sellerFeeAmount AS DECIMAL)), 0)', 'total')
      .where('t.sellerFeeAsset = :asset', { asset })
      .getRawOne();

    const expectedTreasury = new Decimal(buyerFeeSum?.total ?? '0').plus(
      sellerFeeSum?.total ?? '0',
    );

    const treasury = await this.walletRepo.findOne({
      where: { userId: PLATFORM, currency: asset },
    });
    const actualTreasury = new Decimal(treasury?.available ?? '0');

    if (!expectedTreasury.eq(actualTreasury)) {
      mismatches.push({
        type: MismatchType.SETTLEMENT_BALANCE_DRIFT,
        asset,
        description: `Trade-derived treasury for ${asset} (${expectedTreasury.toFixed()}) ≠ actual treasury (${actualTreasury.toFixed()})`,
        expected: expectedTreasury.toFixed(),
        actual: actualTreasury.toFixed(),
      });
    }

    return { checks: 1, mismatches };
  }

  /* ═══════════════════════════════════════════════════════
   * Helpers
   * ═══════════════════════════════════════════════════════ */

  private async getDistinctAssets(): Promise<string[]> {
    const rows: { currency: string }[] = await this.walletRepo
      .createQueryBuilder('w')
      .select('DISTINCT w.currency', 'currency')
      .getRawMany();
    return rows.map((r) => r.currency).sort();
  }
}
