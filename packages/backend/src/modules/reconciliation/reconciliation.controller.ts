import {
  Controller,
  Post,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { MismatchType } from './entities/reconciliation-mismatch.entity';

/**
 * Admin-only reconciliation endpoints.
 *
 * In production, protect these with an admin guard and IP allowlist.
 * For now, the endpoints are open for development.
 */
@ApiTags('reconciliation')
@Controller('admin/reconciliation')
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(private readonly recon: ReconciliationService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a reconciliation run' })
  async triggerRun(@Query('trigger') trigger?: string) {
    this.logger.log(`Reconciliation triggered by: ${trigger ?? 'api'}`);
    const run = await this.recon.executeRun(trigger ?? 'api');
    return {
      runId: run.id,
      status: run.status,
      checksExecuted: run.checksExecuted,
      mismatchCount: run.mismatchCount,
      assetsChecked: run.assetsChecked,
      startedAt: run.createdAt,
      finishedAt: run.finishedAt,
      mismatches: run.mismatches?.map((m) => ({
        id: m.id,
        type: m.mismatchType,
        asset: m.asset,
        description: m.description,
        expected: m.expectedValue,
        actual: m.actualValue,
        difference: m.difference,
        referenceId: m.referenceId,
        referenceType: m.referenceType,
      })),
    };
  }

  @Get('runs')
  @ApiOperation({ summary: 'List past reconciliation runs' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listRuns(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.recon.listRuns(
      parseInt(limit ?? '20', 10),
      parseInt(offset ?? '0', 10),
    );
    return {
      runs: result.runs.map((r) => ({
        id: r.id,
        status: r.status,
        trigger: r.trigger,
        assetsChecked: r.assetsChecked,
        checksExecuted: r.checksExecuted,
        mismatchCount: r.mismatchCount,
        startedAt: r.createdAt,
        finishedAt: r.finishedAt,
      })),
      total: result.total,
    };
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get a specific reconciliation run with mismatches' })
  @ApiParam({ name: 'id' })
  async getRun(@Param('id') id: string) {
    const run = await this.recon.getRun(id);
    return {
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      assetsChecked: run.assetsChecked,
      checksExecuted: run.checksExecuted,
      mismatchCount: run.mismatchCount,
      startedAt: run.createdAt,
      finishedAt: run.finishedAt,
      errorMessage: run.errorMessage,
      mismatches: run.mismatches?.map((m) => ({
        id: m.id,
        type: m.mismatchType,
        asset: m.asset,
        description: m.description,
        expected: m.expectedValue,
        actual: m.actualValue,
        difference: m.difference,
        referenceId: m.referenceId,
        referenceType: m.referenceType,
        createdAt: m.createdAt,
      })),
    };
  }

  @Get('mismatches')
  @ApiOperation({ summary: 'List mismatches across runs' })
  @ApiQuery({ name: 'runId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: MismatchType })
  @ApiQuery({ name: 'asset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listMismatches(
    @Query('runId') runId?: string,
    @Query('type') type?: MismatchType,
    @Query('asset') asset?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.recon.listMismatches(
      runId,
      type,
      asset,
      parseInt(limit ?? '50', 10),
      parseInt(offset ?? '0', 10),
    );
    return {
      mismatches: result.mismatches.map((m) => ({
        id: m.id,
        runId: m.runId,
        type: m.mismatchType,
        asset: m.asset,
        description: m.description,
        expected: m.expectedValue,
        actual: m.actualValue,
        difference: m.difference,
        referenceId: m.referenceId,
        referenceType: m.referenceType,
        createdAt: m.createdAt,
      })),
      total: result.total,
    };
  }
}
