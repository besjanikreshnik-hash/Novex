import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('deposit_addresses')
@Index(['userId', 'asset', 'network'])
export class DepositAddress extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  asset: string;

  @Column({ type: 'varchar', length: 20 })
  network: string;

  @Column({ type: 'varchar', length: 200 })
  @Index({ unique: true })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  memo: string | null;
}
