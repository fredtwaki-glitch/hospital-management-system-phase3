import { Global, Module } from '@nestjs/common';
import { AnthropicClientService } from './anthropic-client.service';

@Global()
@Module({
  providers: [AnthropicClientService],
  exports: [AnthropicClientService],
})
export class AiModule {}
