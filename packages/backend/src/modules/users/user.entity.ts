import { Entity, Column, Index, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../common/entities/base.entity';
import { Wallet } from '../wallets/wallet.entity';
import { Order } from '../trading/entities/order.entity';

export enum UserRole {
  USER = 'user',
  /** View admin dashboards, read-only ops access */
  SUPPORT = 'support',
  /** KYC review, user management */
  COMPLIANCE = 'compliance',
  /** Trading pair management, fee config */
  OPS = 'ops',
  /** Withdrawal approval/processing, funding ops */
  TREASURY = 'treasury',
  /** Full access, system config, role management */
  ADMIN = 'admin',
}

export enum KycStatus {
  NONE = 'none',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  passwordHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.NONE })
  kycStatus: KycStatus;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  twoFactorSecret: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  refreshTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets: Wallet[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];
}
