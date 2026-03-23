import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  P2pService,
  CreateListingDto,
  P2pListingDto,
  P2pOrderDto,
} from './p2p.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('p2p')
@Controller('p2p')
export class P2pController {
  constructor(private readonly p2pService: P2pService) {}

  /* ── Listings ─────────────────────────────────── */

  @Post('listings')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a P2P listing' })
  @ApiResponse({ status: 201, description: 'Listing created' })
  async createListing(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateListingDto,
  ): Promise<P2pListingDto> {
    return this.p2pService.createListing(req.user.id, body);
  }

  @Get('listings')
  @ApiOperation({ summary: 'Get active P2P listings' })
  @ApiResponse({ status: 200, description: 'List of P2P listings' })
  async getListings(
    @Query('type') type?: 'buy' | 'sell',
    @Query('asset') asset?: string,
    @Query('fiatCurrency') fiatCurrency?: string,
  ): Promise<P2pListingDto[]> {
    return this.p2pService.getListings({ type, asset, fiatCurrency });
  }

  @Delete('listings/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a P2P listing' })
  @ApiResponse({ status: 200, description: 'Listing cancelled' })
  async cancelListing(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.p2pService.cancelListing(req.user.id, id);
    return { message: 'Listing cancelled' };
  }

  /* ── Orders ───────────────────────────────────── */

  @Post('orders')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a P2P order from a listing' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() body: { listingId: string; amount: string },
  ): Promise<P2pOrderDto> {
    return this.p2pService.createOrder(req.user.id, body.listingId, body.amount);
  }

  @Get('orders/my')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my P2P orders' })
  @ApiResponse({ status: 200, description: 'List of user P2P orders' })
  async getMyOrders(
    @Req() req: AuthenticatedRequest,
  ): Promise<P2pOrderDto[]> {
    return this.p2pService.getMyOrders(req.user.id);
  }

  @Patch('orders/:id/paid')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark order as paid (buyer)' })
  @ApiResponse({ status: 200, description: 'Order marked as paid' })
  async markAsPaid(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<P2pOrderDto> {
    return this.p2pService.markAsPaid(req.user.id, id);
  }

  @Patch('orders/:id/release')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Release crypto to buyer (seller)' })
  @ApiResponse({ status: 200, description: 'Crypto released to buyer' })
  async releaseCrypto(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<P2pOrderDto> {
    return this.p2pService.releaseCrypto(req.user.id, id);
  }

  @Patch('orders/:id/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a pending P2P order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  async cancelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<P2pOrderDto> {
    return this.p2pService.cancelOrder(req.user.id, id);
  }
}
