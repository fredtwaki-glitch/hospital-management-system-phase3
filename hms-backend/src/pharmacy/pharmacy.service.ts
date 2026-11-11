import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/event-bus.service';
import { CreatePharmacyItemDto, DispenseStockDto, ReceiveStockDto } from './dto/pharmacy-item.dto';
import { PharmacyItem, StockMovement, StockMovementType } from './pharmacy-item.entity';

@Injectable()
export class PharmacyService {
  constructor(
    private auditService: AuditService,
    private eventBus: DomainEventBus,
  ) {}

  async createItem(tenantDataSource: DataSource, dto: CreatePharmacyItemDto, actingUserId: string): Promise<PharmacyItem> {
    const repo = tenantDataSource.getRepository(PharmacyItem);
    const item = await repo.save(
      repo.create({ ...dto, unitPrice: dto.unitPrice.toFixed(2) }),
    );

    await this.auditService.record(tenantDataSource, {
      userId: actingUserId,
      action: 'pharmacy.item.created',
      resourceType: 'PharmacyItem',
      resourceId: item.id,
    });

    return item;
  }

  async findAll(tenantDataSource: DataSource): Promise<PharmacyItem[]> {
    return tenantDataSource.getRepository(PharmacyItem).find({ order: { name: 'ASC' } });
  }

  async findLowStock(tenantDataSource: DataSource): Promise<PharmacyItem[]> {
    const items = await tenantDataSource.getRepository(PharmacyItem).find();
    return items.filter((i) => i.quantityOnHand <= i.reorderThreshold);
  }

  async receiveStock(
    tenantDataSource: DataSource,
    tenantId: string,
    itemId: string,
    dto: ReceiveStockDto,
    actingUserId: string,
  ): Promise<PharmacyItem> {
    return this.applyMovement(tenantDataSource, tenantId, itemId, {
      type: StockMovementType.RECEIVED,
      quantityChange: dto.quantity,
      note: dto.note,
      recordedByUserId: actingUserId,
    });
  }

  async dispenseStock(
    tenantDataSource: DataSource,
    tenantId: string,
    itemId: string,
    dto: DispenseStockDto,
    actingUserId: string,
  ): Promise<PharmacyItem> {
    const itemRepo = tenantDataSource.getRepository(PharmacyItem);
    const item = await itemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Pharmacy item not found');
    }
    if (item.quantityOnHand < dto.quantity) {
      throw new BadRequestException(`Insufficient stock: ${item.quantityOnHand} ${item.unit}(s) on hand`);
    }

    return this.applyMovement(tenantDataSource, tenantId, itemId, {
      type: StockMovementType.DISPENSED,
      quantityChange: -dto.quantity,
      patientId: dto.patientId,
      prescriptionId: dto.prescriptionId,
      note: dto.note,
      recordedByUserId: actingUserId,
    });
  }

  private async applyMovement(
    tenantDataSource: DataSource,
    tenantId: string,
    itemId: string,
    movement: Omit<Partial<StockMovement>, 'itemId'>,
  ): Promise<PharmacyItem> {
    const itemRepo = tenantDataSource.getRepository(PharmacyItem);
    const movementRepo = tenantDataSource.getRepository(StockMovement);

    const item = await itemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('Pharmacy item not found');
    }

    item.quantityOnHand += movement.quantityChange ?? 0;
    const savedItem = await itemRepo.save(item);

    await movementRepo.save(movementRepo.create({ itemId, ...movement }));

    await this.auditService.record(tenantDataSource, {
      userId: movement.recordedByUserId ?? 'system',
      action: movement.type === StockMovementType.DISPENSED ? 'pharmacy.stock.dispensed' : 'pharmacy.stock.received',
      resourceType: 'PharmacyItem',
      resourceId: itemId,
      metadata: { quantityChange: movement.quantityChange, newQuantityOnHand: savedItem.quantityOnHand },
    });

    if (movement.type === StockMovementType.DISPENSED) {
      // Feeds pharmacy dispensing into billing (invoice line item) and,
      // later, the chatbot's "your prescription is ready" notification.
      await this.eventBus.publish(tenantDataSource, tenantId, 'prescription.dispensed', {
        itemId,
        patientId: movement.patientId,
        quantity: Math.abs(movement.quantityChange ?? 0),
      });
    }

    if (savedItem.quantityOnHand <= savedItem.reorderThreshold) {
      // This is the exact event the architecture doc calls out for the
      // Automation Suite's reorder workflow.
      await this.eventBus.publish(tenantDataSource, tenantId, 'inventory.low_stock', {
        itemId: savedItem.id,
        sku: savedItem.sku,
        name: savedItem.name,
        quantityOnHand: savedItem.quantityOnHand,
        reorderThreshold: savedItem.reorderThreshold,
      });
    }

    return savedItem;
  }
}
