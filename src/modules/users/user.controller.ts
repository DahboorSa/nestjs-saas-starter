import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuditContext, CurrentUser, JwtOnly, Public } from '../auth/decorator';
import { AuditContextDto, UserInfoDto } from '../../common/dto';
import { UpdateUserDto, UpdateUserEmailDto } from './dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @JwtOnly()
  async findAll(@CurrentUser() user: UserInfoDto) {
    return await this.userService.getDetails(user);
  }

  @Patch('me')
  @JwtOnly()
  async update(
    @AuditContext() auditContext: AuditContextDto,
    @CurrentUser() user: UserInfoDto,
    @Body() body: UpdateUserDto,
  ) {
    return await this.userService.update(auditContext, user, body);
  }

  @Post('me/email')
  @JwtOnly()
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @CurrentUser() user: UserInfoDto,
    @Body() body: UpdateUserEmailDto,
  ) {
    return await this.userService.changeEmail(user, body);
  }

  @Post('me/email/confirm')
  @Public()
  @HttpCode(HttpStatus.OK)
  async confirmEmail(
    @AuditContext() auditContext: AuditContextDto,
    @Query('token') token: string,
  ) {
    return await this.userService.confirmEmailChange(auditContext, token);
  }
}
