import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('referral_codes')
export class ReferralCode extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', unique: true })
  @Index({ unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 8, unique: true })
  @Index({ unique: true })
  code: string;
}
