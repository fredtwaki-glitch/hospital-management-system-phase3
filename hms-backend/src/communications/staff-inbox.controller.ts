import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantRequest } from '../common/middleware/tenant-resolver.middleware';
import { UserRole } from '../users/user.entity';
import { ConversationChannel, ConversationStatus, MessageSenderType } from './conversation.entity';
import { ConversationsService } from './conversations.service';
import { StaffReplyDto } from './dto/staff-reply.dto';

/**
 * Front desk / admin triage view. Anything the AI flagged with
 * needsHuman=true across ANY of the three channels shows up here -
 * one inbox rather than three separate ones.
 */
@Controller('staff/conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.FRONT_DESK)
export class StaffInboxController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  list(@Req() req: TenantRequest, @Query('channel') channel?: ConversationChannel, @Query('status') status?: ConversationStatus) {
    if (channel) {
      return this.conversationsService.listByChannel(req.tenantDataSource, channel, status);
    }
    // No channel filter: pull all three and merge, most-recently-updated first.
    return Promise.all(
      Object.values(ConversationChannel).map((c) => this.conversationsService.listByChannel(req.tenantDataSource, c, status)),
    ).then((lists) => lists.flat().sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)));
  }

  @Get(':id/messages')
  getMessages(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.conversationsService.getHistory(req.tenantDataSource, id);
  }

  @Post(':id/reply')
  async reply(@Req() req: TenantRequest, @Param('id') id: string, @Body() dto: StaffReplyDto) {
    const user = req.user as any;
    const message = await this.conversationsService.appendMessage(req.tenantDataSource, {
      conversationId: id,
      senderType: MessageSenderType.STAFF,
      staffUserId: user.sub,
      content: dto.content,
    });

    await this.conversationsService.setStatus(req.tenantDataSource, id, dto.setStatus ?? ConversationStatus.RESOLVED);

    return message;
  }
}
