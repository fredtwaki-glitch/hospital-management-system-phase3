import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant/tenant.entity';
import { PlatformAdmin } from './platform-admin/platform-admin.entity';
import { PlatformAuditLog } from './platform-admin/platform-audit-log.entity';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core.module';
import { AiModule } from './ai/ai.module';
import { PatientsModule } from './patients/patients.module';
import { UsersModule } from './users/users.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { BillingModule } from './billing/billing.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { ClinicalNotesModule } from './clinical-notes/clinical-notes.module';
import { LabOrdersModule } from './lab-orders/lab-orders.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { OrgProfileModule } from './org-profile/org-profile.module';
import { PayersModule } from './payers/payers.module';
import { InsuranceCoversModule } from './insurance-covers/insurance-covers.module';
import { CommunicationsModule } from './communications/communications.module';
import { PatientPortalModule } from './patient-portal/patient-portal.module';
import { SupplierCommsModule } from './supplier-comms/supplier-comms.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { MpesaModule } from './mpesa/mpesa.module';
import { EventsModule } from './events/events.module';
import { StaffShiftsModule } from './staff-shifts/staff-shifts.module';
import { TenantResolverMiddleware } from './common/middleware/tenant-resolver.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Named connection "control" - the tenant registry only. Per-tenant
    // data connections are opened dynamically by TenantConnectionManager,
    // not registered here, since the set of tenants grows at runtime.
    TypeOrmModule.forRootAsync({
      name: 'control',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        ssl: { rejectUnauthorized: false },
        host: config.get('CONTROL_DB_HOST'),
        port: config.get('CONTROL_DB_PORT'),
        username: config.get('CONTROL_DB_USER'),
        password: config.get('CONTROL_DB_PASSWORD'),
        database: config.get('CONTROL_DB_NAME'),
        entities: [Tenant, PlatformAdmin, PlatformAuditLog],
        synchronize: false,
      }),
    }),
    CoreModule,
    AiModule,
    TenantModule,
    AuthModule,
    PatientsModule,
    UsersModule,
    AppointmentsModule,
    BillingModule,
    PharmacyModule,
    ClinicalNotesModule,
    LabOrdersModule,
    PrescriptionsModule,
    OrgProfileModule,
    PayersModule,
    InsuranceCoversModule,
    CommunicationsModule,
    PatientPortalModule,
    SupplierCommsModule,
    PlatformAdminModule,
    MpesaModule,
    EventsModule,
    StaffShiftsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Platform admin routes AND M-Pesa's Safaricom-facing callback
    // routes are excluded from tenant resolution - platform admin has
    // no single tenant context, and Safaricom's servers physically
    // cannot send our X-Tenant-Slug header (see MpesaCallbackController
    // for how tenant is resolved for those instead).
    consumer
      .apply(TenantResolverMiddleware)
      .exclude(
        { path: 'platform/(.*)', method: RequestMethod.ALL },
        { path: 'mpesa/callback/(.*)', method: RequestMethod.ALL },
        { path: 'mpesa/c2b/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
