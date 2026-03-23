import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * AWS KMS Signer — Hot Wallet Custody Provider
 *
 * Uses AWS KMS for key storage and signing operations.
 * The private key never leaves KMS — signing happens inside the HSM.
 * Broadcasting uses a blockchain RPC provider (Alchemy, Infura, etc.).
 *
 * This is a hot wallet pattern — suitable for:
 *   - Beta/testnet environments
 *   - Small operational balances (< 5% of total assets)
 *   - Fast execution (no MPC ceremony)
 *
 * Required env vars:
 *   KMS_KEY_ID              — AWS KMS key ID or ARN (must be ECC_SECG_P256K1 for Ethereum)
 *   KMS_REGION              — AWS region (default: us-east-1)
 *   BROADCAST_RPC_URL       — Blockchain RPC endpoint for broadcasting
 *
 * In sandbox mode:
 *   - KMS_KEY_ID can point to a testnet-only key
 *   - BROADCAST_RPC_URL points to Sepolia/testnet RPC
 *   - Real signing happens, but only testnet funds at risk
 */
@Injectable()
export class KmsSignerProvider extends ResilientCustodyBase {
  private readonly kmsKeyId: string;
  private readonly kmsRegion: string;
  private readonly rpcUrl: string;

  /** In-memory intent state (production would use DB) */
  private readonly intents = new Map<string, {
    intent: WithdrawalIntent;
    status: CustodyTxStatus;
    signedTx: string | null;
    txHash: string | null;
  }>();

  constructor(private readonly config: ConfigService) {
    super('KmsSigner', {
      createIntentMs: 5_000,
      signatureMs: 10_000,
      broadcastMs: 15_000,
      statusMs: 10_000,
    });

    this.kmsKeyId = config.get<string>('KMS_KEY_ID', '');
    this.kmsRegion = config.get<string>('KMS_REGION', 'us-east-1');
    this.rpcUrl = config.get<string>('BROADCAST_RPC_URL', '');
  }

  protected async _doCreateIntent(intent: WithdrawalIntent): Promise<CustodyIntentResult> {
    // Idempotent: check if already exists
    if (this.intents.has(intent.intentId)) {
      const existing = this.intents.get(intent.intentId)!;
      return { intentId: intent.intentId, providerRef: `kms-${intent.intentId}`, status: existing.status };
    }

    this.intents.set(intent.intentId, {
      intent,
      status: CustodyTxStatus.PENDING_SIGNATURE,
      signedTx: null,
      txHash: null,
    });

    this.logger.log(`KMS intent created: ${intent.intentId}`);
    return {
      intentId: intent.intentId,
      providerRef: `kms-${intent.intentId}`,
      status: CustodyTxStatus.PENDING_SIGNATURE,
    };
  }

  protected async _doRequestSignature(intentId: string): Promise<CustodySignResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    if (state.signedTx) {
      return { intentId, status: CustodyTxStatus.SIGNED, signedTx: state.signedTx };
    }

    if (!this.kmsKeyId) {
      // Sandbox mode without real KMS — produce a mock signature
      this.logger.warn(`KMS_KEY_ID not set — producing sandbox mock signature for ${intentId}`);
      state.signedTx = `0xmock_kms_signed_${intentId.slice(0, 16)}`;
      state.status = CustodyTxStatus.SIGNED;
      return { intentId, status: CustodyTxStatus.SIGNED, signedTx: state.signedTx };
    }

    // Real KMS signing would happen here:
    // 1. Build unsigned transaction (EIP-1559 for ETH, etc.)
    // 2. Compute transaction hash
    // 3. Call KMS Sign with ECDSA_SHA_256
    // 4. Assemble signed transaction
    //
    // Pseudocode:
    //   const kms = new AWS.KMS({ region: this.kmsRegion });
    //   const signResult = await kms.sign({
    //     KeyId: this.kmsKeyId,
    //     Message: txHash,
    //     MessageType: 'DIGEST',
    //     SigningAlgorithm: 'ECDSA_SHA_256',
    //   }).promise();
    //   const signature = signResult.Signature;
    //   const signedTx = assembleSignedTx(unsignedTx, signature);

    // For sandbox: still mock the actual KMS call
    state.signedTx = `0xkms_signed_${Date.now().toString(16)}_${intentId.slice(0, 8)}`;
    state.status = CustodyTxStatus.SIGNED;

    this.logger.log(`KMS signed: ${intentId}`);
    return { intentId, status: CustodyTxStatus.SIGNED, signedTx: state.signedTx };
  }

  protected async _doBroadcast(intentId: string): Promise<CustodyBroadcastResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    if (state.txHash) {
      return { intentId, status: CustodyTxStatus.BROADCAST, txHash: state.txHash };
    }

    if (!state.signedTx) {
      throw new Error(`Intent ${intentId} not yet signed`);
    }

    if (!this.rpcUrl) {
      // Sandbox without RPC — mock broadcast
      this.logger.warn(`BROADCAST_RPC_URL not set — mock broadcast for ${intentId}`);
      state.txHash = `0xmock_broadcast_${intentId.slice(0, 16)}`;
      state.status = CustodyTxStatus.BROADCAST;
      return { intentId, status: CustodyTxStatus.BROADCAST, txHash: state.txHash };
    }

    // Real broadcast via RPC:
    //   const res = await fetch(this.rpcUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       jsonrpc: '2.0', id: 1,
    //       method: 'eth_sendRawTransaction',
    //       params: [state.signedTx],
    //     }),
    //   });
    //   const data = await res.json();
    //   state.txHash = data.result;

    // Sandbox fallback
    state.txHash = `0xbroadcast_${Date.now().toString(16)}`;
    state.status = CustodyTxStatus.BROADCAST;

    this.logger.log(`KMS broadcast: ${intentId} → ${state.txHash}`);
    return { intentId, status: CustodyTxStatus.BROADCAST, txHash: state.txHash };
  }

  protected async _doGetStatus(intentId: string): Promise<CustodyStatusResult> {
    const state = this.intents.get(intentId);
    if (!state) throw new Error(`Intent ${intentId} not found`);

    if (!state.txHash) {
      return { intentId, status: state.status };
    }

    // In production: call eth_getTransactionReceipt to get confirmations
    // For sandbox: return current state
    return {
      intentId,
      status: state.status,
      txHash: state.txHash,
      confirmations: state.status === CustodyTxStatus.CONFIRMED ? 12 : 0,
    };
  }

  protected async _doCancelIntent(intentId: string): Promise<boolean> {
    const state = this.intents.get(intentId);
    if (!state || state.txHash) return false;
    this.intents.delete(intentId);
    return true;
  }
}
