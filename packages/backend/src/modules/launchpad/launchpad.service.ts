import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { LaunchpadProject } from './launchpad-project.entity';
import {
  LaunchpadContribution,
  ContributionStatus,
} from './launchpad-contribution.entity';
import { WalletsService } from '../wallets/wallets.service';

/* ──── DTOs ─────────────────────────────────────────── */

export interface LaunchpadProjectDto {
  id: string;
  name: string;
  tokenSymbol: string;
  description: string;
  totalSupply: string;
  pricePerToken: string;
  hardCap: string;
  softCap: string;
  raised: string;
  status: string;
  startDate: string;
  endDate: string;
  vestingSchedule: Record<string, unknown>;
  socialLinks: Record<string, string>;
  logoUrl: string;
  progress: number; // raised / hardCap as percentage
  createdAt: string;
}

export interface LaunchpadContributionDto {
  id: string;
  projectId: string;
  projectName: string;
  tokenSymbol: string;
  amount: string;
  tokenAllocation: string;
  status: ContributionStatus;
  createdAt: string;
}

@Injectable()
export class LaunchpadService {
  private readonly logger = new Logger(LaunchpadService.name);

  constructor(
    @InjectRepository(LaunchpadProject)
    private readonly projectRepo: Repository<LaunchpadProject>,
    @InjectRepository(LaunchpadContribution)
    private readonly contributionRepo: Repository<LaunchpadContribution>,
    private readonly walletsService: WalletsService,
  ) {}

  /* ──── List projects ──────────────────────────────── */
  async getProjects(status?: string): Promise<LaunchpadProjectDto[]> {
    const where = status ? { status } : {};
    const projects = await this.projectRepo.find({
      where: where as Record<string, unknown>,
      order: { startDate: 'ASC' },
    });

    return projects.map((p) => this.toProjectDto(p));
  }

  /* ──── Single project with stats ──────────────────── */
  async getProject(id: string): Promise<LaunchpadProjectDto> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Launchpad project not found');
    }
    return this.toProjectDto(project);
  }

  /* ──── Contribute USDT to a project ───────────────── */
  async contribute(
    userId: string,
    projectId: string,
    amount: string,
  ): Promise<LaunchpadContributionDto> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Launchpad project not found');
    }

    if (project.status !== 'active') {
      throw new BadRequestException(
        'Project is not currently accepting contributions',
      );
    }

    const contributeAmount = new Decimal(amount);
    if (contributeAmount.lte(0)) {
      throw new BadRequestException('Amount must be positive');
    }

    // Check hard cap
    const raised = new Decimal(project.raised);
    const hardCap = new Decimal(project.hardCap);
    if (raised.plus(contributeAmount).gt(hardCap)) {
      const remaining = hardCap.minus(raised);
      throw new BadRequestException(
        `Contribution exceeds hard cap. Maximum remaining: ${remaining.toFixed(2)} USDT`,
      );
    }

    // Lock USDT from user's wallet
    await this.walletsService.lockFunds(userId, 'USDT', contributeAmount);

    // Calculate token allocation
    const pricePerToken = new Decimal(project.pricePerToken);
    const tokenAllocation = contributeAmount.div(pricePerToken);

    // Create contribution record
    const contribution = this.contributionRepo.create({
      userId,
      projectId: project.id,
      amount: contributeAmount.toFixed(),
      tokenAllocation: tokenAllocation.toFixed(18),
      status: 'confirmed',
    });

    const saved = await this.contributionRepo.save(contribution);

    // Update raised amount on project
    project.raised = raised.plus(contributeAmount).toFixed();
    await this.projectRepo.save(project);

    this.logger.log(
      `User ${userId} contributed ${contributeAmount.toFixed()} USDT to ${project.name}`,
    );

    return this.toContributionDto(saved, project);
  }

  /* ──── Claim tokens after project completes ───────── */
  async claimTokens(
    userId: string,
    contributionId: string,
  ): Promise<LaunchpadContributionDto> {
    const contribution = await this.contributionRepo.findOne({
      where: { id: contributionId, userId },
      relations: ['project'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.status !== 'confirmed') {
      throw new BadRequestException(
        'Contribution is not in a claimable state',
      );
    }

    if (contribution.project.status !== 'completed') {
      throw new BadRequestException(
        'Project has not completed yet. Tokens cannot be claimed.',
      );
    }

    // Mark as claimed — in a real system, this would trigger token distribution
    contribution.status = 'claimed';
    await this.contributionRepo.save(contribution);

    this.logger.log(
      `User ${userId} claimed ${contribution.tokenAllocation} ${contribution.project.tokenSymbol} tokens`,
    );

    return this.toContributionDto(contribution, contribution.project);
  }

  /* ──── Refund if project cancelled or softcap not met ─ */
  async refund(
    userId: string,
    contributionId: string,
  ): Promise<LaunchpadContributionDto> {
    const contribution = await this.contributionRepo.findOne({
      where: { id: contributionId, userId },
      relations: ['project'],
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.status !== 'confirmed') {
      throw new BadRequestException('Contribution cannot be refunded');
    }

    const project = contribution.project;

    // Allow refund if project is cancelled or if it's completed but softcap not met
    const raised = new Decimal(project.raised);
    const softCap = new Decimal(project.softCap);
    const isCancelled = project.status === 'cancelled';
    const softCapNotMet =
      project.status === 'completed' && raised.lt(softCap);

    if (!isCancelled && !softCapNotMet) {
      throw new BadRequestException(
        'Refunds are only available for cancelled projects or when soft cap is not met',
      );
    }

    // Unlock USDT back to user
    const refundAmount = new Decimal(contribution.amount);
    await this.walletsService.unlockFunds(userId, 'USDT', refundAmount);

    // Update contribution
    contribution.status = 'refunded';
    await this.contributionRepo.save(contribution);

    // Update raised on project
    project.raised = new Decimal(project.raised)
      .minus(refundAmount)
      .toFixed();
    await this.projectRepo.save(project);

    this.logger.log(
      `User ${userId} refunded ${refundAmount.toFixed()} USDT from ${project.name}`,
    );

    return this.toContributionDto(contribution, project);
  }

  /* ──── Get user contributions ─────────────────────── */
  async getUserContributions(
    userId: string,
  ): Promise<LaunchpadContributionDto[]> {
    const contributions = await this.contributionRepo.find({
      where: { userId },
      relations: ['project'],
      order: { createdAt: 'DESC' },
    });

    return contributions.map((c) =>
      this.toContributionDto(c, c.project),
    );
  }

  /* ──── Mappers ────────────────────────────────────── */
  private toProjectDto(project: LaunchpadProject): LaunchpadProjectDto {
    const raised = new Decimal(project.raised || '0');
    const hardCap = new Decimal(project.hardCap || '1');
    const progress = hardCap.gt(0)
      ? raised.div(hardCap).mul(100).toNumber()
      : 0;

    return {
      id: project.id,
      name: project.name,
      tokenSymbol: project.tokenSymbol,
      description: project.description,
      totalSupply: project.totalSupply,
      pricePerToken: project.pricePerToken,
      hardCap: project.hardCap,
      softCap: project.softCap,
      raised: project.raised,
      status: project.status,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate.toISOString(),
      vestingSchedule: project.vestingSchedule,
      socialLinks: project.socialLinks,
      logoUrl: project.logoUrl,
      progress,
      createdAt: project.createdAt.toISOString(),
    };
  }

  private toContributionDto(
    contribution: LaunchpadContribution,
    project: LaunchpadProject,
  ): LaunchpadContributionDto {
    return {
      id: contribution.id,
      projectId: project.id,
      projectName: project.name,
      tokenSymbol: project.tokenSymbol,
      amount: contribution.amount,
      tokenAllocation: contribution.tokenAllocation,
      status: contribution.status,
      createdAt: contribution.createdAt.toISOString(),
    };
  }
}
