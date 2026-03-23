import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum NotificationType {
  TRADE_FILL = 'trade_fill',
  DEPOSIT_CREDITED = 'deposit_credited',
  WITHDRAWAL_COMPLETED = 'withdrawal_completed',
  SECURITY_ALERT = 'security_alert',
  SYSTEM = 'system',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'read'])
export class Notification extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;
}
