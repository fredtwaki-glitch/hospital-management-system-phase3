import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CommunicationsModule } from '../communications/communications.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';
import { LabOrdersModule } from '../lab-orders/lab-orders.module';
import { InsuranceCoversModule } from '../insurance-covers/insurance-covers.module';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientChatController } from './patient-chat.controller';
import { PatientSelfServiceController } from './patient-self-service.controller';
import { PatientJwtStrategy } from './patient-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('PATIENT_JWT_SECRET'),
        signOptions: { expiresIn: '30m' },
      }),
    }),
    CommunicationsModule,
    AppointmentsModule,
    PrescriptionsModule,
    LabOrdersModule,
    InsuranceCoversModule,
  ],
  controllers: [PatientAuthController, PatientChatController, PatientSelfServiceController],
  providers: [PatientAuthService, PatientJwtStrategy],
})
export class PatientPortalModule {}
