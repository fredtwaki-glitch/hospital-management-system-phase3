import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Patient } from '../patients/patient.entity';
import { isMinor } from '../patients/patient-age.util';
import { PatientJwtPayload } from './patient-jwt-payload.interface';
import { PatientPortalOtp } from './patient-portal-otp.entity';
import { RequestPatientCodeDto, VerifyPatientCodeDto } from './dto/patient-portal.dto';

@Injectable()
export class PatientAuthService {
  private readonly logger = new Logger(PatientAuthService.name);

  constructor(private jwtService: JwtService) {}

  async requestCode(tenantDataSource: DataSource, dto: RequestPatientCodeDto): Promise<{ sent: boolean }> {
    const patient = await this.findMatchingPatient(tenantDataSource, dto.email, dto.mrn);
    // Same response whether or not a match was found (and, deliberately,
    // the same response for a minor patient too - see below) - do not
    // reveal whether a given email/MRN combination exists in the system,
    // or a minor's age status, through a differing response.
    if (!patient) {
      return { sent: true };
    }

    if (isMinor(patient.dateOfBirth)) {
      // A minor doesn't independently consent to their own care and
      // shouldn't hold their own unsupervised portal session - this is
      // a child-safety default, not an oversight. No OTP is generated;
      // the request silently no-ops so the response is indistinguishable
      // from "no matching patient," and a guardian/front-desk-mediated
      // access path (not yet built - see README) is the intended route
      // for a minor's portal access instead.
      this.logger.log(`Portal login blocked for minor patient ${patient.id} - guardian-mediated access not yet implemented`);
      return { sent: true };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const otpRepo = tenantDataSource.getRepository(PatientPortalOtp);
    await otpRepo.save(
      otpRepo.create({
        patientId: patient.id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      }),
    );

    // STUB: replace with real SMS/email delivery before production use.
    this.logger.log(`[PATIENT PORTAL OTP] patient=${patient.id} code=${code} (would be sent to ${dto.email})`);

    return { sent: true };
  }

  async verifyCode(tenantDataSource: DataSource, tenant: Tenant, dto: VerifyPatientCodeDto): Promise<{ accessToken: string }> {
    const patient = await this.findMatchingPatient(tenantDataSource, dto.email, dto.mrn);
    if (!patient) {
      throw new UnauthorizedException('Invalid code');
    }

    const otpRepo = tenantDataSource.getRepository(PatientPortalOtp);
    const candidate = await otpRepo.findOne({
      where: { patientId: patient.id },
      order: { createdAt: 'DESC' },
    });

    if (!candidate || candidate.consumedAt || candidate.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const valid = await bcrypt.compare(dto.code, candidate.codeHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid code');
    }

    candidate.consumedAt = new Date();
    await otpRepo.save(candidate);

    const payload: PatientJwtPayload = {
      sub: patient.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      scope: 'patient_portal',
    };

    return { accessToken: this.jwtService.sign(payload, { expiresIn: '30m' }) };
  }

  private async findMatchingPatient(tenantDataSource: DataSource, email: string, mrn: string): Promise<Patient | null> {
    return tenantDataSource.getRepository(Patient).findOne({ where: { email, mrn } });
  }
}
