import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { P2pListing } from './p2p-listing.entity';
import { P2pOrder } from './p2p-order.entity';
import { WalletsService } from '../wallets/wallets.service';

/* ─── DTOs ─────────────────────────────────────────── */

export interface CreateListingDto {
  type: 'buy' | 'sell';
  asset: string;
  fiatCurrency: string;
  price: string;
  minAmount: string;
  maxAmount: string;
  totalAmount: string;
  paymentMethods: string[];
}

export interface ListingFilters {
  type?: 'buy' | 'sell';
  asset?: string;
  fiatCurrency?: string;
}

export interface P2pListingDto {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  asset: string;
  fiatCurrency: string;
  price: string;
  minAmount: string;
  maxAmount: string;
  paymentMethods: string[];
  status: string;
  totalAmount: string;
  filledAmount: string;
  createdAt: string;
}

export interface P2pOrderDto {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  fiatAmount: string;
  status: string;
  chatMessages: { sender: string; message: string; timestamp: string }[];
  createdAt: string;
  paidAt: string | null;
  releasedAt: string | null;
}

@Injectable()
export class P2pService {
  private readonly logger = new Logger(P2pService.name);

  constructor(
    @InjectRepository(P2pListing)
    private readonly listingRepo: Repository<P2pListing>,
    @InjectRepository(P2pOrder)
    private readonly orderRepo: Repository<P2pOrder>,
    private readonly walletsService: WalletsService,
    private readonly dataSource: DataSource,
  ) {}

  /* ──── Create listing ──────────────────────────── */
  async createListing(
    userId: string,
    dto: CreateListingDto,
  ): Promise<P2pListingDto> {
    // If selling, lock seller's crypto in escrow
    if (dto.type === 'sell') {
      const amount = new Decimal(dto.totalAmount);
      if (amount.lte(0)) {
        throw new BadRequestException('Total amount must be positive');
      }
      await this.walletsService.lockFunds(userId, dto.asset, amount);
    }

    const listing = this.listingRepo.create({
      userId,
      type: dto.type,
      asset: dto.asset.toUpperCase(),
      fiatCurrency: dto.fiatCurrency.toUpperCase(),
      price: dto.price,
      minAmount: dto.minAmount,
      maxAmount: dto.maxAmount,
      totalAmount: dto.totalAmount,
      filledAmount: '0',
      paymentMethods: dto.paymentMethods,
      status: 'active',
    });

    const saved = await this.listingRepo.save(listing);
    return this.toListingDto(saved);
  }

  /* ──── Get listings ────────────────────────────── */
  async getListings(filters: ListingFilters): Promise<P2pListingDto[]> {
    const qb = this.listingRepo.createQueryBuilder('l');
    qb.where('l.status = :status', { status: 'active' });

    if (filters.type) {
      qb.andWhere('l.type = :type', { type: filters.type });
    }
    if (filters.asset) {
      qb.andWhere('l.asset = :asset', { asset: filters.asset.toUpperCase() });
    }
    if (filters.fiatCurrency) {
      qb.andWhere('l.fiat_currency = :fiat', {
        fiat: filters.fiatCurrency.toUpperCase(),
      });
    }

    qb.orderBy('l.created_at', 'DESC');
    const listings = await qb.getMany();
    return listings.map((l) => this.toListingDto(l));
  }

  /* ──── Cancel listing ──────────────────────────── */
  async cancelListing(userId: string, listingId: string): Promise<void> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.userId !== userId)
      throw new ForbiddenException('Not your listing');
    if (listing.status !== 'active')
      throw new BadRequestException('Listing is not active');

    // If sell listing, unlock remaining escrowed funds
    if (listing.type === 'sell') {
      const remaining = new Decimal(listing.totalAmount).minus(
        listing.filledAmount,
      );
      if (remaining.gt(0)) {
        await this.walletsService.unlockFunds(
          userId,
          listing.asset,
          remaining,
        );
      }
    }

    listing.status = 'cancelled';
    await this.listingRepo.save(listing);
  }

  /* ──── Create order ────────────────────────────── */
  async createOrder(
    userId: string,
    listingId: string,
    amount: string,
  ): Promise<P2pOrderDto> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'active')
      throw new BadRequestException('Listing is no longer active');
    if (listing.userId === userId)
      throw new BadRequestException('Cannot trade with yourself');

    const orderAmount = new Decimal(amount);
    if (orderAmount.lt(listing.minAmount) || orderAmount.gt(listing.maxAmount))
      throw new BadRequestException(
        `Amount must be between ${listing.minAmount} and ${listing.maxAmount}`,
      );

    const remaining = new Decimal(listing.totalAmount).minus(
      listing.filledAmount,
    );
    if (orderAmount.gt(remaining))
      throw new BadRequestException('Insufficient remaining amount on listing');

    const fiatAmount = orderAmount.mul(listing.price).toFixed();

    // Determine buyer and seller
    let buyerId: string;
    let sellerId: string;

    if (listing.type === 'sell') {
      // Listing owner is selling, current user is buying
      sellerId = listing.userId;
      buyerId = userId;
    } else {
      // Listing owner wants to buy, current user is selling
      buyerId = listing.userId;
      sellerId = userId;
      // Lock seller's crypto
      await this.walletsService.lockFunds(userId, listing.asset, orderAmount);
    }

    const order = this.orderRepo.create({
      listingId,
      buyerId,
      sellerId,
      amount,
      fiatAmount,
      status: 'pending',
      chatMessages: [],
      paidAt: null,
      releasedAt: null,
    });

    const saved = await this.orderRepo.save(order);

    // Update filled amount
    listing.filledAmount = new Decimal(listing.filledAmount)
      .plus(orderAmount)
      .toFixed();
    if (new Decimal(listing.filledAmount).gte(listing.totalAmount)) {
      listing.status = 'completed';
    }
    await this.listingRepo.save(listing);

    return this.toOrderDto(saved);
  }

  /* ──── Mark as paid ────────────────────────────── */
  async markAsPaid(userId: string, orderId: string): Promise<P2pOrderDto> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId)
      throw new ForbiddenException('Only buyer can mark as paid');
    if (order.status !== 'pending')
      throw new BadRequestException('Order is not pending');

    order.status = 'paid';
    order.paidAt = new Date();
    const saved = await this.orderRepo.save(order);
    return this.toOrderDto(saved);
  }

  /* ──── Release crypto ──────────────────────────── */
  async releaseCrypto(userId: string, orderId: string): Promise<P2pOrderDto> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.sellerId !== userId)
      throw new ForbiddenException('Only seller can release crypto');
    if (order.status !== 'paid')
      throw new BadRequestException('Buyer has not marked as paid yet');

    const listing = await this.listingRepo.findOne({
      where: { id: order.listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    const amount = new Decimal(order.amount);

    // Transfer from seller's locked to buyer's available
    await this.dataSource.transaction(async (manager) => {
      // Deduct from seller locked
      const sellerWallet = await this.walletsService.getOrCreate(
        order.sellerId,
        listing.asset,
        manager,
      );
      const locked = new Decimal(sellerWallet.locked);
      if (locked.lt(amount)) {
        throw new BadRequestException('Insufficient locked balance');
      }
      sellerWallet.locked = locked.minus(amount).toFixed();
      await manager.save(sellerWallet);

      // Credit buyer available
      const buyerWallet = await this.walletsService.getOrCreate(
        order.buyerId,
        listing.asset,
        manager,
      );
      buyerWallet.available = new Decimal(buyerWallet.available)
        .plus(amount)
        .toFixed();
      await manager.save(buyerWallet);
    });

    order.status = 'released';
    order.releasedAt = new Date();
    const saved = await this.orderRepo.save(order);
    return this.toOrderDto(saved);
  }

  /* ──── Cancel order ────────────────────────────── */
  async cancelOrder(userId: string, orderId: string): Promise<P2pOrderDto> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.buyerId !== userId && order.sellerId !== userId)
      throw new ForbiddenException('Not your order');
    if (order.status !== 'pending')
      throw new BadRequestException('Only pending orders can be cancelled');

    const listing = await this.listingRepo.findOne({
      where: { id: order.listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found');

    // If listing was buy type, unlock seller's funds
    if (listing.type === 'buy') {
      const amount = new Decimal(order.amount);
      await this.walletsService.unlockFunds(
        order.sellerId,
        listing.asset,
        amount,
      );
    }

    // Restore filled amount on listing
    listing.filledAmount = new Decimal(listing.filledAmount)
      .minus(order.amount)
      .clampedTo(0, Infinity)
      .toFixed();
    if (listing.status === 'completed') {
      listing.status = 'active';
    }
    await this.listingRepo.save(listing);

    order.status = 'cancelled';
    const saved = await this.orderRepo.save(order);
    return this.toOrderDto(saved);
  }

  /* ──── Get my orders ───────────────────────────── */
  async getMyOrders(userId: string): Promise<P2pOrderDto[]> {
    const orders = await this.orderRepo.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      order: { createdAt: 'DESC' },
    });
    return orders.map((o) => this.toOrderDto(o));
  }

  /* ──── Mappers ─────────────────────────────────── */
  private toListingDto(l: P2pListing): P2pListingDto {
    return {
      id: l.id,
      userId: l.userId,
      type: l.type,
      asset: l.asset,
      fiatCurrency: l.fiatCurrency,
      price: l.price,
      minAmount: l.minAmount,
      maxAmount: l.maxAmount,
      paymentMethods: l.paymentMethods,
      status: l.status,
      totalAmount: l.totalAmount,
      filledAmount: l.filledAmount,
      createdAt: l.createdAt.toISOString(),
    };
  }

  private toOrderDto(o: P2pOrder): P2pOrderDto {
    return {
      id: o.id,
      listingId: o.listingId,
      buyerId: o.buyerId,
      sellerId: o.sellerId,
      amount: o.amount,
      fiatAmount: o.fiatAmount,
      status: o.status,
      chatMessages: o.chatMessages,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      releasedAt: o.releasedAt ? o.releasedAt.toISOString() : null,
    };
  }
}
