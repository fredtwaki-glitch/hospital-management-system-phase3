import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainEventBus } from '../events/event-bus.service';
import { AuditService } from '../audit/audit.service';
import { User, UserRole } from '../users/user.entity';
import { CompleteShiftDto } from './dto/complete-shift.dto';
import { StaffShift, StaffShiftStatus } from './staff-shift.entity';

@Injectable()
export class StaffShiftsService {
  constructor(private readonly eventBus: DomainEventBus, private readonly audit: AuditService) {}

  async start(dataSource: DataSource, staffId: string): Promise<StaffShift> {
    try {
      return await dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const staff = await users.findOne({ where: { id: staffId, isActive: true } });
        if (!staff) throw new NotFoundException('Active staff account not found');

        const shifts = manager.getRepository(StaffShift);
        const active = await shifts.findOne({ where: { staffId, status: StaffShiftStatus.IN_PROGRESS } });
        if (active) throw new ConflictException('This staff member already has an active shift');

        const shift = await shifts.save(shifts.create({
          staffId: staff.id,
          staffNumber: staff.staffNumber,
          startedAt: new Date(),
          endedAt: null,
          status: StaffShiftStatus.IN_PROGRESS,
          breakMinutes: 0,
          minutesWorked: null,
          notes: null,
          createdByUserId: staffId,
        }));
        await this.audit.record(manager, {
          userId: staffId,
          action: 'staff.shift.started',
          resourceType: 'StaffShift',
          resourceId: shift.id,
        });
        return shift;
      });
    } catch (error: any) {
      if (error?.code === '23505' || error?.driverError?.code === '23505') throw new ConflictException('This staff member already has an active shift');
      throw error;
    }
  }

  async complete(
    dataSource: DataSource,
    tenantId: string,
    shiftId: string,
    actingUserId: string,
    actingRole: UserRole,
    dto: CompleteShiftDto,
  ): Promise<StaffShift> {
    return dataSource.transaction(async (manager) => {
      const shifts = manager.getRepository(StaffShift);
      const shift = await shifts.findOne({ where: { id: shiftId }, lock: { mode: 'pessimistic_write' } });
      if (!shift) throw new NotFoundException('Shift not found');
      if (shift.staffId !== actingUserId && actingRole !== UserRole.ADMIN) {
        throw new ForbiddenException('You can only complete your own shift');
      }
      if (shift.status !== StaffShiftStatus.IN_PROGRESS) {
        throw new ConflictException('This shift has already been completed');
      }

      const endedAt = new Date();
      const breakMinutes = dto.breakMinutes ?? shift.breakMinutes;
      const elapsedMinutes = Math.floor((endedAt.getTime() - shift.startedAt.getTime()) / 60_000);
      // This is a problem with the submitted values relative to the shift's
      // age, not a state conflict, so it is a 400 (a 409 is reserved for
      // "this shift is already completed" / "already has an active shift").
      // The message states the actual numbers so the UI can show something
      // actionable instead of a generic failure.
      if (elapsedMinutes <= breakMinutes) {
        throw new BadRequestException(
          elapsedMinutes < 1
            ? 'This shift was started less than a minute ago. Please wait at least one minute before completing it.'
            : `Break (${breakMinutes} min) must be shorter than the time elapsed since the shift started (${elapsedMinutes} min).`,
        );
      }
      shift.endedAt = endedAt;
      shift.breakMinutes = breakMinutes;
      shift.minutesWorked = elapsedMinutes - breakMinutes;
      shift.status = StaffShiftStatus.COMPLETED;
      if (dto.notes !== undefined) shift.notes = dto.notes;
      const saved = await shifts.save(shift);
      await this.audit.record(manager, {
        userId: actingUserId,
        action: 'staff.shift.completed',
        resourceType: 'StaffShift',
        resourceId: shift.id,
        metadata: { staffId: shift.staffId, minutesWorked: shift.minutesWorked },
      });

      const staff = await manager.getRepository(User).findOne({ where: { id: shift.staffId } });
      await this.eventBus.publish(manager, tenantId, 'staff.shift.completed', {
        shiftId: shift.id,
        staffId: shift.staffId,
        staffNumber: shift.staffNumber,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : undefined,
        department: staff?.department ?? null,
        role: staff?.role ?? null,
        startedAt: shift.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        breakMinutes,
        minutesWorked: shift.minutesWorked,
        notes: shift.notes,
      });
      return saved;
    });
  }

  async listMine(dataSource: DataSource, staffId: string): Promise<StaffShift[]> {
    return dataSource.getRepository(StaffShift).find({
      where: { staffId }, order: { startedAt: 'DESC' }, take: 100,
    });
  }

  async listAll(dataSource: DataSource): Promise<StaffShift[]> {
    return dataSource.getRepository(StaffShift).find({ order: { startedAt: 'DESC' }, take: 250 });
  }
}
