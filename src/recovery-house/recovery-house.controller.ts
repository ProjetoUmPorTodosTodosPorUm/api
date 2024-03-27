import { Controller, Get, Post, Body, Param, Delete, Put, Query } from '@nestjs/common';
import { RecoveryHouseService } from './recovery-house.service';
import { CreateRecoveryHouseDto, UpdateRecoveryHouseDto } from './dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiBatchResponse, ApiCreatedResponse, ApiResponse, HardRemoveDto, User as Jwt, Public, RestoreDto } from 'src/utils';
import { Role, User } from '@prisma/client';
import { PaginationDto } from 'src/prisma/dto';
import { Roles } from 'src/auth/roles';

@ApiTags('Recovery House')
@Controller('recovery-house')
export class RecoveryHouseController {
  constructor(private readonly recoveryHouseService: RecoveryHouseService) { }

  @ApiBearerAuth()
  @ApiCreatedResponse(CreateRecoveryHouseDto)
  @Post()
  create(
    @Jwt() user: User,
    @Body() createRecoveryHouseDto: CreateRecoveryHouseDto) {
    return this.recoveryHouseService.create(user, createRecoveryHouseDto);
  }

  @ApiResponse(CreateRecoveryHouseDto, { paginated: true })
  @Public()
  @Get()
  findAll(@Query() query?: PaginationDto) {
    return this.recoveryHouseService.findAll(query);
  }

  @ApiResponse(CreateRecoveryHouseDto)
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recoveryHouseService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Put('restore')
  restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
    return this.recoveryHouseService.restore(restoreDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateRecoveryHouseDto)
  @Put(':id')
  update(
    @Param('id') id: string, 
    @Jwt() user: User,
    @Body() updateRecoveryHouseDto: UpdateRecoveryHouseDto) {
    return this.recoveryHouseService.update(id, user, updateRecoveryHouseDto);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Delete('hard-remove')
  hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
    return this.recoveryHouseService.hardRemove(hardRemoveDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateRecoveryHouseDto)
  @Delete(':id')
  remove(@Param('id') id: string, @Jwt() user: User) {
    return this.recoveryHouseService.remove(id, user);
  }
}
