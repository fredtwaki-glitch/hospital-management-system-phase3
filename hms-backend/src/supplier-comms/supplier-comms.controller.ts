import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { ConversationStatus, MessageSenderType } from '../communications/conversation.entity';
import { ConversationsService } from '../communications/conversations.service';
import { ApproveSupplierDraftDto } from './dto/supplier-comms.dto';

/**
 * "Send" is intentionally a stub (see comment below) - no message ever
 * leaves the building without a human calling this endpoint first. The
 * AI never has a path to a live send.
 */
@Controller('supplier-comms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.PHARMACIST)
export class SupplierCommsController {
  constructor(private conversationsService: ConversationsService) {}

  @Patch(':conversationId/approve-and-send')
  async approveAndSend(@Req() req: TenantRequest, @Param('conversationId') conversationId: string, @Body() dto: ApproveSupplierDraftDto) {
    const user = req.user as any;

    const message = await this.conversationsService.appendMessage(req.tenantDataSource, {
      conversationId,
      senderType: MessageSenderType.STAFF,
      staffUserId: user.sub,
      content: dto.finalContent,
      isDraft: false,
    });

    // TODO: wire an actual email/SMS provider here (e.g. via
    // SupplierContact.contactEmail once populated). For now, approval
    // just records the final approved text - "sending" is a manual
    // step outside the system until that integration exists.
    await this.conversationsService.setStatus(req.tenantDataSource, conversationId, ConversationStatus.RESOLVED);

    return { approved: true, message };
  }
}
