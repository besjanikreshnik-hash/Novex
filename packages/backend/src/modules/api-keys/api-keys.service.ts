import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { ApiKey, ApiKeyPermissions } from './api-key.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  /**
   * Generate a new API key for a user.
   * Returns the full key ONCE — it is never stored in plaintext.
   */
  async generateKey(
    userId: string,
    label: string,
    permissions: ApiKeyPermissions,
    expiresInDays?: number,
  ): Promise<{ id: string; key: string; label: string; permissions: ApiKeyPermissions; createdAt: Date }> {
    // Generate a cryptographically random key: "novex_" + 48 random hex chars
    const randomBytes = crypto.randomBytes(24);
    const fullKey = `novex_${randomBytes.toString('hex')}`;

    // Store only the hash
    const keyHash = await bcrypt.hash(fullKey, BCRYPT_ROUNDS);

    // First 8 chars after prefix for display (e.g., "novex_ab12cd34...")
    const keyPrefix = fullKey.slice(0, 14); // "novex_" + 8 chars

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = this.apiKeyRepo.create({
      userId,
      label,
      keyPrefix,
      keyHash,
      permissions,
      isActive: true,
      lastUsedAt: null,
      expiresAt,
    });

    const saved = await this.apiKeyRepo.save(apiKey);
    this.logger.log(`API key created for user ${userId}: ${keyPrefix}...`);

    return {
      id: saved.id,
      key: fullKey,
      label: saved.label,
      permissions: saved.permissions,
      createdAt: saved.createdAt,
    };
  }

  /**
   * List all keys for a user (prefix only, never the full key).
   */
  async listKeys(userId: string): Promise<
    {
      id: string;
      label: string;
      keyPrefix: string;
      permissions: ApiKeyPermissions;
      isActive: boolean;
      lastUsedAt: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
    }[]
  > {
    const keys = await this.apiKeyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return keys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }

  /**
   * Revoke (deactivate) an API key.
   */
  async revokeKey(userId: string, keyId: string): Promise<void> {
    const key = await this.apiKeyRepo.findOne({
      where: { id: keyId, userId },
    });

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    key.isActive = false;
    await this.apiKeyRepo.save(key);
    this.logger.log(`API key revoked: ${key.keyPrefix}... for user ${userId}`);
  }

  /**
   * Validate an API key by hashing it and looking it up.
   * Returns the key entity if valid, null otherwise.
   */
  async validateKey(fullKey: string): Promise<ApiKey | null> {
    // We must check all active keys and bcrypt-compare, since bcrypt
    // salts make direct hash lookup impossible.
    const activeKeys = await this.apiKeyRepo.find({
      where: { isActive: true },
    });

    for (const key of activeKeys) {
      const isMatch = await bcrypt.compare(fullKey, key.keyHash);
      if (isMatch) {
        // Check expiry
        if (key.expiresAt && new Date() > key.expiresAt) {
          return null;
        }

        // Update last used timestamp
        key.lastUsedAt = new Date();
        await this.apiKeyRepo.save(key);

        return key;
      }
    }

    return null;
  }
}
