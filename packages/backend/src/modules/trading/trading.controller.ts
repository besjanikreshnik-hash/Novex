import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  Res,
  ParseUUIDPipe,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiHeader,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import {
  ThrottleOrderPlacement,
  ThrottleOrderCancel,
} from '../../common/rate-limit/throttle-by.decorator';
import { TradingService, PlaceOrderDto, PlaceOCODto } from './trading.service';
import { OrderStatus } from './entities/order.entity';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { KycTierGuard, RequireKycTier } from '../../common/guards/kyc-tier.guard';
import { AccountStatusGuard } from '../../common/guards/account-status.guard';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../activity/activity.entity';

interface AuthenticatedRequest {
  user: { id: string; email: string; role: string };
}

@ApiTags('trading')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AccountStatusGuard, KycTierGuard, RateLimitGuard)
@RequireKycTier(0) // TODO: restore to 1 before production — relaxed for internal alpha
@Controller('orders')
export class TradingController {
  private readonly logger = new Logger(TradingController.name);

  constructor(
    private readonly tradingService: TradingService,
    private readonly idempotency: IdempotencyService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @ThrottleOrderPlacement()
  @ApiOperation({ summary: 'Place a new limit, market, stop-limit, or trailing-stop order' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Client-generated unique key to prevent duplicate order placement',
    required: false,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symbol', 'side', 'type', 'quantity'],
      properties: {
        symbol: { type: 'string', example: 'BTC_USDT' },
        side: { type: 'string', enum: ['buy', 'sell'] },
        type: { type: 'string', enum: ['limit', 'market', 'stop_limit', 'trailing_stop'] },
        price: { type: 'string', description: 'Required for limit and stop_limit orders', example: '50000' },
        quantity: { type: 'string', example: '0.1' },
        slippagePrice: { type: 'string', description: 'Max acceptable avg price for market orders' },
        stopPrice: { type: 'string', description: 'Trigger price for stop_limit orders. Required when type is stop_limit.', example: '49000' },
        trailingDelta: { type: 'string', description: 'Trailing distance in price units. Required when type is trailing_stop.', example: '100' },
        trailingActivationPrice: { type: 'string', description: 'Price at which trailing stop activates. Optional for trailing_stop orders.', example: '48000' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Order placed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or insufficient balance' })
  @ApiResponse({ status: 409, description: 'Duplicate request (idempotency key conflict)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async placeOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PlaceOrderDto,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.id;

    // ── Idempotency check ───────────────────────────────
    if (idempotencyKey) {
      const requestHash = IdempotencyService.hashPayload(dto as any);
      const check = await this.idempotency.acquire(
        idempotencyKey,
        userId,
        'place_order',
        requestHash,
      );
      if (check.alreadyCompleted) {
        res.status(check.cachedResponse!.status);
        return check.cachedResponse!.body;
      }
    }

    try {
      const order = await this.tradingService.placeOrder(userId, dto);
      const body = { ...order };

      // ── Log activity ──────────────────────────────────────
      this.activityService.logActivity(userId, ActivityAction.ORDER_PLACED, req as any, {
        symbol: dto.symbol,
        side: dto.side,
        type: dto.type,
        quantity: dto.quantity,
      }).catch(() => {});

      // ── Mark idempotency as complete ────────────────────
      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, HttpStatus.CREATED, body);
      }

      res.status(HttpStatus.CREATED);
      return body;
    } catch (err) {
      // Release idempotency key so the client can retry
      if (idempotencyKey) {
        await this.idempotency.release(idempotencyKey);
      }
      throw err;
    }
  }

  @Post('oco')
  @ThrottleOrderPlacement()
  @ApiOperation({ summary: 'Place an OCO (One-Cancels-Other) order pair' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Client-generated unique key to prevent duplicate OCO placement',
    required: false,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symbol', 'side', 'limitPrice', 'limitQuantity', 'stopPrice', 'stopQuantity'],
      properties: {
        symbol: { type: 'string', example: 'BTC_USDT' },
        side: { type: 'string', enum: ['buy', 'sell'] },
        limitPrice: { type: 'string', example: '52000' },
        limitQuantity: { type: 'string', example: '0.1' },
        stopPrice: { type: 'string', example: '48000' },
        stopQuantity: { type: 'string', example: '0.1' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'OCO order pair placed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or insufficient balance' })
  @ApiResponse({ status: 409, description: 'Duplicate request (idempotency key conflict)' })
  async placeOCO(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PlaceOCODto,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.id;

    if (idempotencyKey) {
      const requestHash = IdempotencyService.hashPayload(dto as any);
      const check = await this.idempotency.acquire(
        idempotencyKey,
        userId,
        'place_oco',
        requestHash,
      );
      if (check.alreadyCompleted) {
        res.status(check.cachedResponse!.status);
        return check.cachedResponse!.body;
      }
    }

    try {
      const result = await this.tradingService.placeOCO(userId, dto);
      const body = { limitOrder: { ...result.limitOrder }, stopOrder: { ...result.stopOrder } };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, HttpStatus.CREATED, body);
      }

      res.status(HttpStatus.CREATED);
      return body;
    } catch (err) {
      if (idempotencyKey) {
        await this.idempotency.release(idempotencyKey);
      }
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'List orders for the authenticated user' })
  @ApiQuery({ name: 'symbol', required: false, example: 'BTC_USDT' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getUserOrders(
    @Req() req: AuthenticatedRequest,
    @Query('symbol') symbol?: string,
    @Query('status') status?: OrderStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.tradingService.getUserOrders(
      req.user.id,
      symbol,
      status,
      limit ?? 50,
      offset ?? 0,
    );
  }

  @Delete(':id')
  @ThrottleOrderCancel()
  @ApiOperation({ summary: 'Cancel an open order' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    description: 'Client-generated unique key to prevent duplicate cancel',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async cancelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req.user.id;

    if (idempotencyKey) {
      const requestHash = IdempotencyService.hashPayload({ orderId: id });
      const check = await this.idempotency.acquire(
        idempotencyKey,
        userId,
        'cancel_order',
        requestHash,
      );
      if (check.alreadyCompleted) {
        res.status(check.cachedResponse!.status);
        return check.cachedResponse!.body;
      }
    }

    try {
      const order = await this.tradingService.cancelOrder(userId, id);
      const body = { ...order };

      if (idempotencyKey) {
        await this.idempotency.complete(idempotencyKey, HttpStatus.OK, body);
      }

      return body;
    } catch (err) {
      if (idempotencyKey) {
        await this.idempotency.release(idempotencyKey);
      }
      throw err;
    }
  }
}
