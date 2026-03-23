import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel as KafkaLogLevel } from 'kafkajs';
import { AuditLog } from './audit.entity';

export interface AuditEvent {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  private static readonly TOPIC = 'novex.audit.events';

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    const brokers = this.configService.get<string[]>('kafka.brokers', [
      'localhost:9092',
    ]);
    const clientId = this.configService.get<string>(
      'kafka.clientId',
      'novex-backend',
    );

    this.kafka = new Kafka({
      clientId,
      brokers,
      logLevel: KafkaLogLevel.WARN,
      retry: { initialRetryTime: 300, retries: 5 },
    });

    this.producer = this.kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka audit producer connected');
    } catch (err) {
      this.logger.warn(
        'Kafka producer connection failed — audit events will only be persisted to DB',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.logger.log('Kafka audit producer disconnected');
    }
  }

  /**
   * Log an audit event:
   *   1. Persist to PostgreSQL (audit_logs table)
   *   2. Publish to Kafka topic for downstream consumers (analytics, compliance)
   */
  async logEvent(event: AuditEvent): Promise<AuditLog> {
    // Persist to database
    const entity = this.auditRepo.create({
      userId: event.userId ?? null,
      action: event.action,
      resourceType: event.resourceType ?? null,
      resourceId: event.resourceId ?? null,
      metadata: event.metadata ?? null,
      ipAddress: event.ipAddress ?? null,
    });

    const saved = await this.auditRepo.save(entity);

    // Publish to Kafka (fire-and-forget; don't block the caller)
    this.publishToKafka(saved).catch((err) => {
      this.logger.error(`Failed to publish audit event to Kafka: ${err.message}`);
    });

    return saved;
  }

  private async publishToKafka(log: AuditLog): Promise<void> {
    if (!this.connected) return;

    await this.producer.send({
      topic: AuditService.TOPIC,
      messages: [
        {
          key: log.userId ?? log.id,
          value: JSON.stringify({
            id: log.id,
            userId: log.userId,
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            metadata: log.metadata,
            ipAddress: log.ipAddress,
            timestamp: log.createdAt.toISOString(),
          }),
          headers: {
            action: log.action,
          },
        },
      ],
    });
  }
}
