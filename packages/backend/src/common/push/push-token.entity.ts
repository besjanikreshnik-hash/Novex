import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

export type PushPlatform = 'ios' | 'android' | 'web';

@Entity('push_tokens')
@Index(['userId', 'token'], { unique: true })
@Index(['userId', 'isActive'])
export class PushToken extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: PushPlatform;

  @Column({ type: 'varchar', length: 255, name: 'device_name', default: '' })
  deviceName: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
