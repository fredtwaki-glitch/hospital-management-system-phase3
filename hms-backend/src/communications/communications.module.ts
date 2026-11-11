import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';
import { LabOrdersModule } from '../lab-orders/lab-orders.module';
import { OrgProfileModule } from '../org-profile/org-profile.module';
import { PayersModule } from '../payers/payers.module';
import { AiResponderService } from './ai-responder.service';
import { ConversationsService } from './conversations.service';
import { PublicInquiriesController } from './public-inquiries.controller';
import { StaffInboxController } from './staff-inbox.controller';

@Module({
  imports: [AppointmentsModule, PrescriptionsModule, LabOrdersModule, OrgProfileModule, PayersModule],
  controllers: [PublicInquiriesController, StaffInboxController],
  providers: [AiResponderService, ConversationsService],
  exports: [AiResponderService, ConversationsService],
})
export class CommunicationsModule {}
