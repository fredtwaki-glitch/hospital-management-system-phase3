import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { AiResponderService } from '../communications/ai-responder.service';
import { ConversationsService } from '../communications/conversations.service';
import { ConversationChannel, ConversationStatus, MessageSenderType } from '../communications/conversation.entity';
import { PatientJwtAuthGuard } from './patient-jwt-auth.guard';
import { PatientChatMessageDto } from './dto/patient-portal.dto';

@Controller('patient-portal/chat')
@UseGuards(PatientJwtAuthGuard)
export class PatientChatController {
  constructor(
    private conversationsService: ConversationsService,
    private aiResponder: AiResponderService,
  ) {}

  @Post()
  async send(@Req() req: TenantRequest, @Body() dto: PatientChatMessageDto) {
    const patientUser = req.user as any; // PatientJwtPayload
    const patientId = patientUser.sub;

    let conversationId = dto.conversationId;
    let history: { role: 'user' | 'assistant'; content: string }[] = [];

    if (conversationId) {
      const conversation = await this.conversationsService.findOne(req.tenantDataSource, conversationId);
      // A patient can only ever continue their OWN conversation - never
      // trust a conversationId belonging to someone else, even if it's
      // a valid-looking UUID they happened to send.
      if (!conversation || conversation.patientId !== patientId) {
        conversationId = undefined;
      } else {
        const pastMessages = await this.conversationsService.getHistory(req.tenantDataSource, conversationId);
        history = pastMessages
          .filter((m) => m.senderType !== MessageSenderType.STAFF)
          .map((m) => ({
            role: (m.senderType === MessageSenderType.END_USER ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content,
          }));
      }
    }

    if (!conversationId) {
      const conversation = await this.conversationsService.createConversation(req.tenantDataSource, {
        channel: ConversationChannel.PATIENT_PORTAL,
        patientId,
        subject: dto.message.slice(0, 120),
      });
      conversationId = conversation.id;
    }

    await this.conversationsService.appendMessage(req.tenantDataSource, {
      conversationId,
      senderType: MessageSenderType.END_USER,
      content: dto.message,
    });

    const result = await this.aiResponder.respondToPatientMessage(req.tenantDataSource, patientId, [
      ...history,
      { role: 'user', content: dto.message },
    ]);

    if (result.replyText) {
      await this.conversationsService.appendMessage(req.tenantDataSource, {
        conversationId,
        senderType: MessageSenderType.AI,
        content: result.replyText,
      });
    }

    if (result.needsHuman) {
      await this.conversationsService.setStatus(req.tenantDataSource, conversationId, ConversationStatus.AWAITING_HUMAN);
    }

    return { conversationId, reply: result.replyText, needsHuman: result.needsHuman };
  }
}
