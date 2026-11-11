import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Returned value becomes `req.user`. We intentionally keep this a
    // plain pass-through of the token claims - no DB hit on every
    // request. If a user is deactivated mid-session, that's caught by
    // a short token expiry (JWT_EXPIRES_IN) plus a revocation check
    // at login/refresh, not on every single request.
    return payload;
  }
}
