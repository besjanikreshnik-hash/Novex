import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ContractType {
  PERPETUAL = 'perpetual',
  QUARTERLY = 'quarterly',
}

@Entity('futures_contracts')
@Index(['symbol'], { unique: true })
export class FuturesContract extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ name: 'base_asset', type: 'varchar', length: 10 })
  baseAsset: string;

  @Column({ name: 'quote_asset', type: 'varchar', length: 10 })
  quoteAsset: string;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: ContractType,
    default: ContractType.PERPETUAL,
  })
  contractType: ContractType;

  @Column({ name: 'max_leverage', type: 'int', default: 20 })
  maxLeverage: number;

  @Column({
    name: 'maintenance_margin_rate',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: '0.005',
  })
  maintenanceMarginRate: string;

  @Column({
    name: 'taker_fee',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: '0.0004',
  })
  takerFee: string;

  @Column({
    name: 'maker_fee',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: '0.0002',
  })
  makerFee: string;

  @Column({
    name: 'mark_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  markPrice: string;

  @Column({
    name: 'index_price',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
  })
  indexPrice: string;

  @Column({
    name: 'funding_rate',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: '0.0001',
  })
  fundingRate: string;

  @Column({
    name: 'next_funding_time',
    type: 'timestamptz',
    nullable: true,
  })
  nextFundingTime: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
