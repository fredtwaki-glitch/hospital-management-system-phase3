import { Body, Controller, Post, Req } from '@nestjs/common';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { AiResponderService } from './ai-responder.service';
import { ConversationsService } from './conversations.service';
import { ConversationChannel, ConversationStatus, MessageSenderType } from './conversation.entity';
import { ContinuePublicInquiryDto, StartPublicInquiryDto } from './dto/public-inquiry.dto';

/**
 * Deliberately UNAUTHENTICATED - this is the front door for prospective
 * patients and the general public, so there's no login to gate behind.
 * Still tenant-scoped (via TenantResolverMiddleware, same as every other
 * route), and the AI persona behind it has zero access to patient
 * records - see AiResponderService.respondToPublicInquiry.
 *
 * Rate limiting is NOT implemented here and should be added at the
 * infrastructure/gateway layer before this goes live publicly - an
 * open, unauthenticated endpoint that calls a paid LLM API is a cost
 * and abuse vector without it.
 */
@Controller('public/inquiries')
export class PublicInquiriesController {
  constructor(
    private conversationsService: ConversationsService,
    private aiResponder: AiResponderService,
  ) {}

  @Post()
  async start(@Req() req: TenantRequest, @Body() dto: StartPublicInquiryDto) {
    const conversation = await this.conversationsService.createConversation(req.tenantDataSource, {
      channel: ConversationChannel.PUBLIC_INQUIRY,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      subject: dto.message.slice(0, 120),
    });

    await this.conversationsService.appendMessage(req.tenantDataSource, {
      conversationId: conversation.id,
      senderType: MessageSenderType.END_USER,
      content: dto.message,
    });

    const result = await this.aiResponder.respondToPublicInquiry(req.tenantDataSource, [
      { role: 'user', content: dto.message },
    ]);

    if (result.replyText) {
      await this.conversationsService.appendMessage(req.tenantDataSource, {
        conversationId: conversation.id,
        senderType: MessageSenderType.AI,
        content: result.replyText,
      });
    }

    if (result.needsHuman) {
      await this.conversationsService.setStatus(req.tenantDataSource, conversation.id, ConversationStatus.AWAITING_HUMAN);
    }

    return {
      conversationId: conversation.id,
      reply: result.replyText,
      needsHuman: result.needsHuman,
    };
  }

  @Post('reply')
  async continue(@Req() req: TenantRequest, @Body() dto: ContinuePublicInquiryDto) {
    const history = await this.conversationsService.getHistory(req.tenantDataSource, dto.conversationId);

    await this.conversationsService.appendMessage(req.tenantDataSource, {
      conversationId: dto.conversationId,
      senderType: MessageSenderType.END_USER,
      content: dto.message,
    });

    const messageHistory = [
      ...history.map((m) => ({
        role: (m.senderType === MessageSenderType.END_USER ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: dto.message },
    ];

    const result = await this.aiResponder.respondToPublicInquiry(req.tenantDataSource, messageHistory);

    if (result.replyText) {
      await this.conversationsService.appendMessage(req.tenantDataSource, {
        conversationId: dto.conversationId,
        senderType: MessageSenderType.AI,
        content: result.replyText,
      });
    }

    if (result.needsHuman) {
      await this.conversationsService.setStatus(req.tenantDataSource, dto.conversationId, ConversationStatus.AWAITING_HUMAN);
    }

    return { reply: result.replyText, needsHuman: result.needsHuman };
  }
}
