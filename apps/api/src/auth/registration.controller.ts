import {
  Controller,
  Post,
  HttpCode,
  Header,
  Req,
  Res,
  Inject,
  ForbiddenException,
  UnsupportedMediaTypeException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { RegistrationService, RegistrationThrottled } from './registration.service.js';

interface RegistrationRequest {
  get(name: string): string | undefined;
  socket: { remoteAddress?: string };
  body: unknown;
}
interface RegistrationResponse {
  setHeader(name: string, value: string): void;
}

@Controller('auth')
export class RegistrationController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    private readonly registration: RegistrationService,
  ) {}

  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  async register(
    @Req() request: RegistrationRequest,
    @Res({ passthrough: true }) response: RegistrationResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    if (!this.config) throw new ServiceUnavailableException('Registration is unavailable.');
    const fetchSite = request.get('sec-fetch-site');
    if (
      request.get('origin') !== this.config.origin ||
      request.get('x-devflow-request') !== 'browser' ||
      (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'same-site')
    )
      throw new ForbiddenException('Request origin is not allowed.');
    if (request.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
      throw new UnsupportedMediaTypeException('Use application/json.');
    // Do not trust user-controlled forwarding headers. Proxy support is a later deployment task.
    const ip = request.socket.remoteAddress;
    if (!ip) throw new ServiceUnavailableException('Registration is unavailable.');
    try {
      return await this.registration.register(request.body, ip);
    } catch (error) {
      if (error instanceof RegistrationThrottled) {
        response.setHeader('Retry-After', String(error.retryAfter));
        throw new HttpException('Too many registration requests.', 429);
      }
      throw error;
    }
  }
}
