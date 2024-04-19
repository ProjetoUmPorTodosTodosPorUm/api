import { Controller, Get, Post, Body, Param, Delete, Query, Put } from '@nestjs/common'
import { ContactService } from './contact.service'
import { CreateContactDto } from './dto'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
	ApiBatchResponse,
	ApiCreatedResponse,
	ApiResponse,
	HardRemoveDto,
	Public,
	RestoreDto,
	User as Jwt,
} from 'src/utils'
import { Throttle } from '@nestjs/throttler'
import { HOUR_IN_SECS } from 'src/constants'
import { PaginationDto } from 'src/prisma/dto'
import { Roles } from 'src/auth/roles'
import { Role, User } from '@prisma/client'

@ApiTags('Contato')
@Controller('contact')
export class ContactController {
	constructor(private readonly contactService: ContactService) {}

	@ApiCreatedResponse(CreateContactDto)
	@Public()
	@Throttle({ default: { limit: 3, ttl: HOUR_IN_SECS } })
	@Post()
	create(@Body() createContactDto: CreateContactDto) {
		return this.contactService.create(createContactDto)
	}

	@ApiBearerAuth()
	@ApiResponse(CreateContactDto, { paginated: true })
	@Public()
	@Get()
	findAll(@Query() query?: PaginationDto) {
		return this.contactService.findAll(query)
	}

	@ApiBearerAuth()
	@ApiResponse(CreateContactDto)
	@Public()
	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.contactService.findOne(id)
	}

	@ApiBearerAuth()
	@ApiBatchResponse()
	@Roles(Role.WEB_MASTER)
	@Put('restore')
	restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
		return this.contactService.restore(restoreDto, user)
	}

	@ApiBearerAuth()
	@ApiBatchResponse()
	@Roles(Role.WEB_MASTER)
	@Delete('hard-remove')
	hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
		return this.contactService.hardRemove(hardRemoveDto, user)
	}

	@ApiBearerAuth()
	@ApiResponse(CreateContactDto)
	@Roles(Role.WEB_MASTER)
	@Delete(':id')
	remove(@Param('id') id: string, @Jwt() user: User) {
		return this.contactService.remove(id, user)
	}
}
