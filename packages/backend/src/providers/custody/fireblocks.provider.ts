import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import {
  WithdrawalIntent,
  CustodyIntentResult,
  CustodySignResult,
  CustodyBroadcastResult,
  CustodyStatusResult,
  CustodyTxStatus,
} from './custody-provider.interface';
import { ResilientCustodyBase } from './resilient-custody.base';

/**
 * Fireblocks Custody Provider — Sandbox/Production
 *
 * Fireblocks is an MPC-based institutional custody platform.
 * Signing happens inside Fireblocks — private keys never leave their infrastructure.
 * NovEx creates transaction intents; Fireblocks handles the MPC ceremony,
 * signing, and optionally broadcasting.
 *
 * Required env vars:
 *   FIREBLOCKS_API_KEY       — API user ID
 *   FIREBLOCKS_PRIVATE_KEY   — RSA private key (PEM) for JWT signing
 *   FIREBLOCKS_BASE_URL      — https://sandbox-api.fireblocks.io (sandbox) or https://api.fireblocks.io
 *   FIREBLOCKS_VAULT_ID      — Source vault account ID (hot wallet)
 *
 * Asset mapping: NovEx asset names → Fireblocks asset IDs
 *   ETH → ETH_TEST5 (Sepolia), BTC → BTC_TEST (testnet), USDT → USDT_ERC20_TEST
 */

const ASSET_MAP: Record<string, Record<string, string>> = {
  sandbox: {
    ETH: 'ETH_TEST5',
    BTC: 'BTC_TEST',
    USDT: 'USDT_ERC20_T5',
    SOL: 'SOL_TEST',
  },
  production: {
    ETH: 'ETH',
    BTC: 'BTC',
    USDT: 'USDT_ERC20',
    SOL: 'SOL',
  },
};

/** Maps Fireblocks transaction status → NovEx CustodyTxStatus */
function mapFireblocksStatus(fbStatus: string): CustodyTxStatus {
  switch (fbStatus) {
    case 'SUBMITTED':
    case 'QUEUED':
    case 'PENDING_AUTHORIZATION':
      return CustodyTxStatus.PENDING_SIGNATURE;
    case 'PENDING_SIGNATURE':
    case 'PENDING_3RD_PARTY_MANUAL_APPROVAL':
    case 'PENDING_3RD_PARTY':
      return CustodyTxStatus.SIGNING;
    case 'BROADCASTING':
      return CustodyTxStatus.BROADCAST;
    case 'CONFIRMING':
      return CustodyTxStatus.BROADCAST;
    case 'COMPLETED':
      return CustodyTxStatus.CONFIRMED;
    case 'FAILED':
    case 'TIMEOUT':
      return CustodyTxStatus.FAILED;
    case 'CANCELLED':
    case 'BLOCKED':
    case 'REJECTED':
      return CustodyTxStatus.REJECTED;
    default:
      return CustodyTxStatus.PENDING_SIGNATURE;
  }
}

@Injectable()
export class FireblocksCustodyProvider extends ResilientCustodyBase {
  private readonly apiKey: string;
  private readonly privateKey: string;
  private readonly baseUrl: string;
  private readonly vaultId: string;
  private readonly assetMap: Record<string, string>;

  /** Maps intentId → Fireblocks txId for lookups */
  private readonly txIdMap = new Map<string, string>();

  constructor(private readonly config: ConfigService) {
    super('FireblocksCustody', {
      createIntentMs: 15_000,
      signatureMs: 60_000, // MPC can take up to 60s
      broadcastMs: 20_000,
      statusMs: 10_000,
    });

    this.apiKey = config.get<string>('FIREBLOCKS_API_KEY', '');
    this.privateKey = config.get<string>('FIREBLOCKS_PRIVATE_KEY', '');
    this.baseUrl = config.get<string>('FIREBLOCKS_BASE_URL', 'https://sandbox-api.fireblocks.io');
    this.vaultId = config.get<string>('FIREBLOCKS_VAULT_ID', '0');

    const env = this.baseUrl.includes('sandbox') ? 'sandbox' : 'production';
    this.assetMap = ASSET_MAP[env] ?? ASSET_MAP.sandbox;
  }

  /* ─── Fireblocks implementation ────────────────────── */

  protected async _doCreateIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult> {
    const fbAssetId = this.assetMap[intent.asset] ?? intent.asset;

    const body = {
      assetId: fbAssetId,
      source: { type: 'VAULT_ACCOUNT', id: this.vaultId },
      destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: intent.to, tag: intent.memo } },
      amount: intent.amount,
      externalTxId: intent.intentId, // Fireblocks idempotency key
      note: `NovEx withdrawal ${intent.intentId}`,
      extraParameters: intent.metadata ? { novexMetadata: JSON.stringify(intent.metadata) } : undefined,
    };

    const response = await this.fireblocksRequest('POST', '/v1/transactions', body);

    this.txIdMap.set(intent.intentId, response.id);

    return {
      intentId: intent.intentId,
      providerRef: response.id,
      status: mapFireblocksStatus(response.status),
    };
  }

  protected async _doRequestSignature(intentId: string): Promise<CustodySignResult> {
    // Fireblocks handles signing internally after createIntent.
    // We poll for the signature status.
    const fbTxId = this.txIdMap.get(intentId);
    if (!fbTxId) throw new Error(`No Fireblocks txId for intent ${intentId}`);

    const response = await this.fireblocksRequest('GET', `/v1/transactions/${fbTxId}`);
    const status = mapFireblocksStatus(response.status);

    if (status === CustodyTxStatus.FAILED || status === CustodyTxStatus.REJECTED) {
      return {
        intentId,
        status,
        failureReason: response.subStatus || response.status,
      };
    }

    // Fireblocks signs and broadcasts in one flow — "signed" means it's past MPC
    const isSigned = [CustodyTxStatus.BROADCAST, CustodyTxStatus.CONFIRMED].includes(status)
      || response.status === 'BROADCASTING'
      || response.status === 'CONFIRMING'
      || response.status === 'COMPLETED';

    return {
      intentId,
      status: isSigned ? CustodyTxStatus.SIGNED : status,
      signedTx: response.signedMessages?.[0]?.signedRawTx,
    };
  }

  protected async _doBroadcast(intentId: string): Promise<CustodyBroadcastResult> {
    // Fireblocks broadcasts automatically after signing.
    // We poll to get the txHash.
    const fbTxId = this.txIdMap.get(intentId);
    if (!fbTxId) throw new Error(`No Fireblocks txId for intent ${intentId}`);

    const response = await this.fireblocksRequest('GET', `/v1/transactions/${fbTxId}`);
    const status = mapFireblocksStatus(response.status);

    if (status === CustodyTxStatus.FAILED) {
      return { intentId, status, failureReason: response.subStatus || 'Broadcast failed' };
    }

    return {
      intentId,
      status: response.txHash ? CustodyTxStatus.BROADCAST : status,
      txHash: response.txHash,
      providerResponse: { fireblocksId: fbTxId, fireblocksStatus: response.status },
    };
  }

  protected async _doGetStatus(intentId: string): Promise<CustodyStatusResult> {
    const fbTxId = this.txIdMap.get(intentId);
    if (!fbTxId) throw new Error(`No Fireblocks txId for intent ${intentId}`);

    const response = await this.fireblocksRequest('GET', `/v1/transactions/${fbTxId}`);

    return {
      intentId,
      status: mapFireblocksStatus(response.status),
      txHash: response.txHash,
      confirmations: response.numOfConfirmations ?? 0,
      blockNumber: response.blockInfo?.blockHeight,
    };
  }

  protected async _doCancelIntent(intentId: string): Promise<boolean> {
    const fbTxId = this.txIdMap.get(intentId);
    if (!fbTxId) return false;

    try {
      await this.fireblocksRequest('POST', `/v1/transactions/${fbTxId}/cancel`);
      this.txIdMap.delete(intentId);
      return true;
    } catch {
      return false; // already broadcast or other non-cancellable state
    }
  }

  /* ─── Fireblocks API client ────────────────────────── */

  private async fireblocksRequest(method: string, path: string, body?: any): Promise<any> {
    const token = this.generateJwt(path, body);

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fireblocks ${method} ${path}: ${res.status} ${text}`);
    }

    return res.json();
  }

  /** Generate Fireblocks-style JWT (RS256 signed with API private key) */
  private generateJwt(path: string, body?: any): string {
    const now = Math.floor(Date.now() / 1000);
    const nonce = Date.now().toString();

    const payload = {
      uri: path,
      nonce,
      iat: now,
      exp: now + 30,
      sub: this.apiKey,
      bodyHash: body
        ? require('crypto').createHash('sha256').update(JSON.stringify(body)).digest('hex')
        : require('crypto').createHash('sha256').update('').digest('hex'),
    };

    // Manual JWT construction (RS256)
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${header}.${payloadB64}`;

    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(this.privateKey, 'base64url');

    return `${signingInput}.${signature}`;
  }
}
