import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';

import { AppConfig } from '../config';

export type PaayeeRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: { privyUserId: string };
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PaayeeRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = value?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Missing Paayee session token');

    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(this.config.supabaseJwtSecret), {
        audience: 'authenticated',
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('Token has no subject');
      request.user = { privyUserId: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired Paayee session token');
    }
  }
}
