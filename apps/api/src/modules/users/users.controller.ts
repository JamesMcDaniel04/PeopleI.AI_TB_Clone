import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  async getProfile(@CurrentUser() user: User) {
    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ) {
    const updated = await this.usersService.update(user.id, dto);
    return {
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Admin list of users' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  async listUsers(@CurrentUser() user: User) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    };
  }

  @Patch(':id/admin')
  @ApiOperation({ summary: 'Admin update user role/status' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.usersService.update(id, dto);
    return {
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        isActive: updated.isActive,
      },
    };
  }
}
