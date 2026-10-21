import {
  Controller,
  Header,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { requireBrowserMutation } from './session-http.js';
import { AuthThrottled } from './login-rate-limiter.js';
import { VerificationService } from './verification.service.js';

@Controller('auth/verification')
export class VerificationController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    private readonly service: VerificationService,
  ) {}
  private async execute(request: Request, response: Response, confirm: boolean) {
    requireBrowserMutation(request, this.config);
    const ip = request.socket.remoteAddress;
    if (!ip) throw new ServiceUnavailableException('Verification is unavailable.');
    try {
      return await (confirm
        ? this.service.confirm(request.body, ip)
        : this.service.request(request.body, ip));
    } catch (error) {
      if (error instanceof AuthThrottled) {
        response.setHeader('Retry-After', String(error.retryAfter));
        throw new HttpException('Too many verification requests.', 429);
      }
      throw error;
    }
  }
  @Post('request')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  request(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.execute(request, response, false);
  }
  @Post('confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  confirm(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.execute(request, response, true);
  }
}
