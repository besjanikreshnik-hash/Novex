import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KYC_PROVIDER } from './kyc/kyc-provider.interface';
import { SumsubProvider } from './kyc/sumsub.provider';
import { MockKycProvider } from './kyc/mock.provider';
import { BLOCKCHAIN_PROVIDER } from './blockchain/blockchain-provider.interface';
import { AlchemyProvider } from './blockchain/alchemy.provider';
import { MockBlockchainProvider } from './blockchain/mock.provider';
import { CUSTODY_PROVIDER } from './custody/custody-provider.interface';
import { MockCustodyProvider } from './custody/mock-custody.provider';
import { FireblocksCustodyProvider } from './custody/fireblocks.provider';
import { KmsSignerProvider } from './custody/kms-signer.provider';

/**
 * Provider module — selects real vs mock implementations based on env config.
 *
 *   KYC_PROVIDER_TYPE=sumsub|mock (default: mock)
 *   BLOCKCHAIN_PROVIDER_TYPE=alchemy|mock (default: mock)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KYC_PROVIDER,
      useFactory: (config: ConfigService) => {
        const type = config.get<string>('KYC_PROVIDER_TYPE', 'mock');
        if (type === 'sumsub') return new SumsubProvider(config);
        return new MockKycProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: BLOCKCHAIN_PROVIDER,
      useFactory: (config: ConfigService) => {
        const type = config.get<string>('BLOCKCHAIN_PROVIDER_TYPE', 'mock');
        if (type === 'alchemy') return new AlchemyProvider(config);
        return new MockBlockchainProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: CUSTODY_PROVIDER,
      useFactory: (config: ConfigService) => {
        const type = config.get<string>('CUSTODY_PROVIDER_TYPE', 'mock');
        if (type === 'fireblocks') return new FireblocksCustodyProvider(config);
        if (type === 'kms') return new KmsSignerProvider(config);
        return new MockCustodyProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [KYC_PROVIDER, BLOCKCHAIN_PROVIDER, CUSTODY_PROVIDER],
})
export class ProvidersModule {}
