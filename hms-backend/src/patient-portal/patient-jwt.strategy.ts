import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PatientJwtPayload } from './patient-jwt-payload.interface';

@Injectable()
export class PatientJwtStrategy extends PassportStrategy(Strategy, 'patient-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Separate secret from staff tokens (auth/jwt.strategy.ts) - a
      // leaked staff JWT_SECRET doesn't automatically compromise patient
      // sessions and vice versa.
      secretOrKey: config.getOrThrow<string>('PATIENT_JWT_SECRET'),
    });
  }

  async validate(payload: PatientJwtPayload) {
    return payload;
  }
}
