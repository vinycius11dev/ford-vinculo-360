import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole } from "@prisma/client";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService, SessionContext } from "./auth.service";
import { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { LoginDto } from "./dto/login.dto";
import { MobileRefreshDto } from "./dto/mobile-refresh.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
};

type ResponseLike = {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
};

const REFRESH_COOKIE = "ford360_refresh";
const OWNER_COOKIE = 'ford360_owner_refresh';

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() input: LoginDto,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    return this.respondWithSession(
      await this.auth.login(input, this.context(request), [UserRole.FORD_ADMIN, UserRole.DEALERSHIP_MANAGER, UserRole.DEALERSHIP_AGENT]),
      response,
    );
  }

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(
    @Body() input: RegisterDto,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    return this.respondWithSession(
      await this.auth.register(input, this.context(request)),
      response,
    );
  }

  // Native clients store the rotating secret in Keychain/Keystore. Browser
  // clients continue to use the HttpOnly cookie routes above.
  @Post("mobile/login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  mobileLogin(@Body() input: LoginDto, @Req() request: RequestLike) {
    return this.auth.login(input, this.context(request), [UserRole.CUSTOMER]);
  }

  @Post('app/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async appLogin(@Body() input: LoginDto, @Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    return this.respondWithSession(await this.auth.login(input, this.context(request), [UserRole.CUSTOMER]), response, OWNER_COOKIE);
  }

  @Post('app/refresh')
  @HttpCode(HttpStatus.OK)
  async appRefresh(@Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    return this.respondWithSession(await this.auth.refresh(this.refreshToken(request, OWNER_COOKIE), this.context(request)), response, OWNER_COOKIE);
  }

  @Post('app/logout')
  @HttpCode(HttpStatus.OK)
  async appLogout(@Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    const result = await this.auth.logout(this.refreshToken(request, OWNER_COOKIE));
    this.clearRefreshCookie(response, OWNER_COOKIE);
    return result;
  }

  @Post("mobile/refresh")
  @HttpCode(HttpStatus.OK)
  mobileRefresh(@Body() input: MobileRefreshDto, @Req() request: RequestLike) {
    return this.auth.refresh(input.refreshToken, this.context(request));
  }

  @Post("mobile/logout")
  @HttpCode(HttpStatus.OK)
  mobileLogout(@Body() input: MobileRefreshDto) {
    return this.auth.logout(input.refreshToken);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    return this.respondWithSession(
      await this.auth.refresh(
        this.refreshToken(request),
        this.context(request),
      ),
      response,
    );
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const result = await this.auth.logout(this.refreshToken(request));
    this.clearRefreshCookie(response);
    return result;
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestPasswordReset(@Body() input: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(input);
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  confirmPasswordReset(@Body() input: ConfirmPasswordResetDto) {
    return this.auth.confirmPasswordReset(input);
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async acceptInvitation(
    @Body() input: AcceptInvitationDto,
    @Req() request: RequestLike,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    return this.respondWithSession(
      await this.auth.acceptInvitation(input, this.context(request)),
      response,
    );
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const result = await this.auth.logoutAll(user);
    this.clearRefreshCookie(response);
    return result;
  }

  @Get("sessions")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user);
  }

  @Delete("sessions/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auth.revokeSession(id, user);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.userId);
  }

  private respondWithSession<T extends { refreshToken: string }>(
    result: T,
    response: ResponseLike,
    cookieName = REFRESH_COOKIE,
  ): Omit<T, "refreshToken"> {
    this.setRefreshCookie(response, result.refreshToken, cookieName);
    const { refreshToken: _, ...body } = result;
    return body;
  }

  private context(request: RequestLike): SessionContext {
    const userAgent = request.headers["user-agent"];
    return {
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      ipAddress: request.ip ?? request.socket?.remoteAddress ?? undefined,
    };
  }

  private refreshToken(request: RequestLike, cookieName = REFRESH_COOKIE) {
    const header = request.headers.cookie;
    const cookie = Array.isArray(header) ? header.join("; ") : header;
    if (!cookie) return undefined;
    return cookie
      .split(";")
      .map((part) => part.trim().split("="))
      .find(([name]) => name === cookieName)?.[1];
  }

  private cookieOptions(cookieName = REFRESH_COOKIE) {
    return {
      httpOnly: true,
        secure: this.config.get("NODE_ENV") !== "development",
      sameSite: "lax",
      path: cookieName === OWNER_COOKIE ? '/api/v1/auth/app' : "/api/v1/auth",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }

  private setRefreshCookie(response: ResponseLike, token: string, cookieName = REFRESH_COOKIE) {
    response.cookie(cookieName, token, this.cookieOptions(cookieName));
  }

  private clearRefreshCookie(response: ResponseLike, cookieName = REFRESH_COOKIE) {
    response.clearCookie(cookieName, {
      ...this.cookieOptions(cookieName),
      maxAge: undefined,
    });
  }
}
