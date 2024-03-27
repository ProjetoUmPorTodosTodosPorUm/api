import {
  Controller,
  Get,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, MeUpdateUserDto, RestrictUserDto, UnrestrictUserDto, UpdateUserDto } from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ApiBatchResponse,
  ApiBooleanResponse,
  ApiResponse,
  User as Jwt,
} from 'src/utils';
import { PaginationDto } from 'src/prisma/dto';
import { Role, User } from '@prisma/client';
import { Roles } from 'src/auth/roles';
import { RestoreDto, HardRemoveDto } from 'src/utils/dto';

@ApiTags('User')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @ApiResponse(CreateUserDto, { paginated: true })
  @Get()
  findAll(@Query() query?: PaginationDto) {
    return this.userService.findAll(query);
  }

  @ApiResponse(CreateUserDto)
  @Roles(Role.ADMIN, Role.VOLUNTEER)
  @Get('me')
  findMe(@Jwt() user: User) {
    return this.userService.findMe(user);
  }

  @ApiResponse(CreateUserDto)
  @Roles(Role.ADMIN, Role.VOLUNTEER)
  @Put('me')
  updateMe(@Jwt() user: User, @Body() updateUserDto: MeUpdateUserDto) {
    return this.userService.updateMe(user, updateUserDto);
  }

  @ApiResponse(CreateUserDto)
  @Roles(Role.ADMIN, Role.VOLUNTEER)
  @Delete('me')
  removeMe(@Jwt() user: User) {
    return this.userService.removeMe(user);
  }

  @ApiResponse(CreateUserDto)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @ApiBatchResponse()
  @Put('restore')
  restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
    return this.userService.restore(restoreDto, user);
  }

  @ApiBooleanResponse()
  @Put('restrict')
  restrict(@Body() restrictUserDto: RestrictUserDto, @Jwt() user: User) {
    return this.userService.restrict(restrictUserDto, user);
  }

  @ApiBooleanResponse()
  @Put('unrestrict')
  unrestrict(@Body() unrestrictUserDto: UnrestrictUserDto, @Jwt() user: User) {
    return this.userService.unrestrict(unrestrictUserDto, user);
  }

  @ApiResponse(CreateUserDto)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Jwt() user: User,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.userService.update(id, user, updateUserDto);
  }

  @ApiBatchResponse()
  @Delete('hard-remove')
  hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
    return this.userService.hardRemove(hardRemoveDto, user);
  }

  @ApiResponse(CreateUserDto)
  @Delete(':id')
  remove(@Param('id') id: string, @Jwt() user: User) {
    return this.userService.remove(id, user);
  }
}
