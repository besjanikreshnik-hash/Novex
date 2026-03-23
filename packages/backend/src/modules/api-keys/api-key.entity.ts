import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export interface ApiKeyPermissions {
  trading: boolean;
  marketData: boolean;
  wallet: boolean;
}

@Entity('api_keys')
@Index(['userId'])
@Index(['keyHash'], { unique: true })
export class ApiKey extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 16, name: 'key_prefix' })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 255, name: 'key_hash' })
  keyHash: string;

  @Column({ type: 'jsonb', default: '{"trading":false,"marketData":true,"wallet":false}' })
  permissions: ApiKeyPermissions;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'expires_at' })
  expiresAt: Date | null;
}
