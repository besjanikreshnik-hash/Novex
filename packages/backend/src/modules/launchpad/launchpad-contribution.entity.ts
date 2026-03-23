import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';
import { LaunchpadProject } from './launchpad-project.entity';

export type ContributionStatus =
  | 'pending'
  | 'confirmed'
  | 'claimed'
  | 'refunded';

@Entity('launchpad_contributions')
@Index(['userId'])
@Index(['projectId'])
export class LaunchpadContribution extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => LaunchpadProject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: LaunchpadProject;

  @Column({
    type: 'decimal',
    precision: 36,
    scale: 18,
    comment: 'USDT amount contributed',
  })
  amount: string;

  @Column({
    name: 'token_allocation',
    type: 'decimal',
    precision: 36,
    scale: 18,
    default: '0',
    comment: 'Number of tokens allocated based on price',
  })
  tokenAllocation: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: ContributionStatus;
}
