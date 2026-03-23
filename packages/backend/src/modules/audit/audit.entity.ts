import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum AuditAction {
  USER_REGISTER = 'user.register',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  ORDER_PLACED = 'order.placed',
  ORDER_CANCELLED = 'order.cancelled',
  TRADE_EXECUTED = 'trade.executed',
  WALLET_LOCK = 'wallet.lock',
  WALLET_UNLOCK = 'wallet.unlock',
  WALLET_SETTLE = 'wallet.settle',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resourceType: string | null;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true, comment: 'Client IP' })
  ipAddress: string | null;
}
