import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { TenantConnectionManager } from '../database/tenant-connection.manager';
import { DomainEventBus } from '../events/event-bus.service';
import { AiResponderService } from '../communications/ai-responder.service';
import { ConversationsService } from '../communications/conversations.service';
import { ConversationChannel, ConversationStatus, MessageSenderType } from '../communications/conversation.entity';
import { PharmacyItem } from '../pharmacy/pharmacy-item.entity';

/**
 * Unlike the public/patient controllers, this has no inbound HTTP
 * request to read req.tenantDataSource from - it's triggered by an
 * internal event. So it resolves the tenant's connection itself, from
 * the tenantId carried on the event payload.
 */
@Injectable()
export class SupplierCommsService implements OnModuleInit {
  private readonly logger = new Logger(SupplierCommsService.name);

  constructor(
    @InjectRepository(Tenant, 'control')
    private tenantRepo: Repository<Tenant>,
    private connectionManager: TenantConnectionManager,
    private eventBus: DomainEventBus,
    private aiResponder: AiResponderService,
    private conversationsService: ConversationsService,
  ) {}

  onModuleInit() {
    this.eventBus.subscribe('inventory.low_stock', (payload) => this.handleLowStock(payload));
  }

  private async handleLowStock(payload: {
    tenantId: string;
    itemId: string;
    sku: string;
    name: string;
    quantityOnHand: number;
    reorderThreshold: number;
  }): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id: payload.tenantId } });
    if (!tenant) {
      this.logger.warn(`Received low_stock event for unknown tenant ${payload.tenantId}`);
      return;
    }

    const tenantDataSource = await this.connectionManager.getConnection(tenant.schemaName);
    const item = await tenantDataSource.getRepository(PharmacyItem).findOne({ where: { id: payload.itemId } });

    if (!item?.supplier) {
      this.logger.log(`Low-stock item ${payload.name} has no supplier on file - skipping auto-draft, needs manual sourcing`);
      return;
    }

    const draftText = await this.aiResponder.draftSupplierMessage({
      supplierName: item.supplier,
      items: [{ name: item.name, sku: item.sku, quantityOnHand: item.quantityOnHand, reorderThreshold: item.reorderThreshold }],
    });

    const conversation = await this.conversationsService.createConversation(tenantDataSource, {
      channel: ConversationChannel.SUPPLIER,
      status: ConversationStatus.AWAITING_HUMAN,
      supplierName: item.supplier,
      subject: `Restock request: ${item.name}`,
    });

    await this.conversationsService.appendMessage(tenantDataSource, {
      conversationId: conversation.id,
      senderType: MessageSenderType.AI,
      content: draftText,
      isDraft: true,
    });

    this.logger.log(`Drafted restock request to ${item.supplier} for ${item.name} (conversation ${conversation.id})`);
  }
}
