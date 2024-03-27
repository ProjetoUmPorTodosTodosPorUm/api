import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Roles } from 'src/auth/roles';
import { PaginationDto } from 'src/prisma/dto';
import {
  ApiBatchResponse,
  ApiCreatedResponse,
  ApiResponse,
  HardRemoveDto,
  Public,
  RestoreDto,
  User as Jwt,
} from 'src/utils';
import { WelcomedFamilyService } from './welcomed-family.service';
import { CreateWelcomedFamilyDto, UpdateWelcomedFamilyDto } from './dto';

@ApiTags('Welcomed Family')
@Controller('welcomed-family')
export class WelcomedFamilyController {
  constructor(private readonly welcomedFamilyService: WelcomedFamilyService) { }

  @ApiBearerAuth()
  @ApiCreatedResponse(CreateWelcomedFamilyDto)
  @Post()
  create(
    @Jwt() user: User,
    @Body() createWelcomedFamilyDto: CreateWelcomedFamilyDto,
  ) {
    return this.welcomedFamilyService.create(user, createWelcomedFamilyDto);
  }

  @ApiResponse(CreateWelcomedFamilyDto, { paginated: true })
  @Public()
  @Get()
  findAll(@Query() query?: PaginationDto) {
    return this.welcomedFamilyService.findAll(query);
  }

  @ApiResponse(CreateWelcomedFamilyDto)
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.welcomedFamilyService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Put('restore')
  restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
    return this.welcomedFamilyService.restore(restoreDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateWelcomedFamilyDto)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Jwt() user: User,
    @Body() updateWelcomedFamilyDto: UpdateWelcomedFamilyDto,
  ) {
    return this.welcomedFamilyService.update(id, user, updateWelcomedFamilyDto);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Delete('hard-remove')
  hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
    return this.welcomedFamilyService.hardRemove(hardRemoveDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateWelcomedFamilyDto)
  @Delete(':id')
  remove(@Param('id') id: string, @Jwt() user: User) {
    return this.welcomedFamilyService.remove(id, user);
  }
}
