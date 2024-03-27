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
  FindByRangeDto,
  HardRemoveDto,
  Public,
  RestoreDto,
  User as Jwt,
} from 'src/utils';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto';

@ApiTags('Announcement')
@Controller('announcement')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) { }

  @ApiBearerAuth()
  @ApiCreatedResponse(CreateAnnouncementDto)
  @Post()
  create(
    @Jwt() user: User,
    @Body() createAnnouncementDto: CreateAnnouncementDto,
  ) {
    return this.announcementService.create(user, createAnnouncementDto);
  }

  @ApiResponse(CreateAnnouncementDto, { paginated: true })
  @Public()
  @Get()
  findAll(@Query() query?: PaginationDto) {
    return this.announcementService.findAll(query);
  }

  @ApiResponse(CreateAnnouncementDto, { paginated: true })
  @Public()
  @Get('range')
  findByRange(@Query() query: FindByRangeDto) {
    return this.announcementService.findByRange(query);
  }

  @ApiResponse(CreateAnnouncementDto)
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.announcementService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Put('restore')
  restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
    return this.announcementService.restore(restoreDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateAnnouncementDto)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Jwt() user: User,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    return this.announcementService.update(id, user, updateAnnouncementDto);
  }

  @ApiBearerAuth()
  @ApiBatchResponse()
  @Roles(Role.ADMIN)
  @Delete('hard-remove')
  hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
    return this.announcementService.hardRemove(hardRemoveDto, user);
  }

  @ApiBearerAuth()
  @ApiResponse(CreateAnnouncementDto)
  @Delete(':id')
  remove(@Param('id') id: string, @Jwt() user: User) {
    return this.announcementService.remove(id, user);
  }
}
