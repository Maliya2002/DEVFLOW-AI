import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Param,
  Inject,
  HttpCode,
  HttpException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { SessionService } from './session.service.js';
import { AuthThrottled } from './login-rate-limiter.js';
import { emptyInput, parseInput, sessionIdInput } from './session-input.js';
import { readSessionCookie, sessionCookie, requireBrowserMutation } from './session-http.js';

@Controller('auth')
export class SessionController {
  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    private readonly sessions: SessionService,
  ) {}

  private async handle<T>(
    request: Request,
    response: Response,
    mutation: boolean,
    work: (token: string | null) => Promise<T>,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    if (!this.config) throw new ServiceUnavailableException('Authentication is unavailable.');
    if (mutation) requireBrowserMutation(request, this.config);
    try {
      return await work(readSessionCookie(request.get('cookie'), this.config));
    } catch (error) {
      if (error instanceof UnauthorizedException)
        response.setHeader('Set-Cookie', sessionCookie(this.config, null));
      if (error instanceof AuthThrottled) {
        response.setHeader('Retry-After', String(error.retryAfter));
        throw new HttpException('Too many authentication requests.', 429);
      }
      throw error;
    }
  }

  private ip(request: Request) {
    if (!request.socket.remoteAddress)
      throw new ServiceUnavailableException('Authentication is unavailable.');
    return request.socket.remoteAddress;
  }

  @Post('login')
  @HttpCode(200)
  login(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, true, async (token) => {
      const result = await this.sessions.login(request.body, this.ip(request), token);
      response.setHeader('Set-Cookie', sessionCookie(this.config!, result.token, result.maxAge));
      return { user: result.identity };
    });
  }

  @Post('reauthenticate')
  @HttpCode(200)
  reauthenticate(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, true, async (token) => {
      const result = await this.sessions.reauthenticate(token, request.body, this.ip(request));
      response.setHeader('Set-Cookie', sessionCookie(this.config!, result.token, result.maxAge));
      return { user: result.identity };
    });
  }

  @Post('password/change')
  @HttpCode(204)
  changePassword(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, true, async (token) => {
      await this.sessions.changePassword(token, request.body, this.ip(request));
      response.setHeader('Set-Cookie', sessionCookie(this.config!, null));
    });
  }

  @Get('session')
  current(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, false, (token) => this.sessions.current(token));
  }

  @Get('sessions')
  list(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, false, (token) => this.sessions.list(token));
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, true, async (token) => {
      parseInput(emptyInput, request.body);
      await this.sessions.logout(token);
      response.setHeader('Set-Cookie', sessionCookie(this.config!, null));
    });
  }

  @Post('logout-all')
  @HttpCode(204)
  logoutAll(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.handle(request, response, true, async (token) => {
      parseInput(emptyInput, request.body);
      await this.sessions.logoutAll(token);
      response.setHeader('Set-Cookie', sessionCookie(this.config!, null));
    });
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revoke(
    @Param('id') id: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.handle(request, response, true, async (token) => {
      parseInput(emptyInput, request.body);
      const result = await this.sessions.revoke(token, parseInput(sessionIdInput, id));
      if (result.current) response.setHeader('Set-Cookie', sessionCookie(this.config!, null));
    });
  }
}
