import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common'
import { MonthlyOfferService } from './monthly-offer.service'
import { CreateMonthlyOfferDto, GetMonthlyOfferPeriod, UpdateMonthlyOfferDto } from './dto'
import {
	ApiBatchResponse,
	ApiCreatedResponse,
	ApiResponse,
	HardRemoveDto,
	Public,
	RestoreDto,
	User as Jwt,
} from 'src/utils'
import { PaginationDto } from 'src/prisma/dto'
import { Roles } from 'src/auth/roles'
import { Role, User } from '@prisma/client'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

@ApiTags('Monthly Food Offer')
@Controller('monthly-offer')
export class MonthlyOfferController {
	constructor(private readonly monthlyOfferService: MonthlyOfferService) {}

	@ApiBearerAuth()
	@ApiCreatedResponse(CreateMonthlyOfferDto)
	@Post()
	create(@Jwt() user: User, @Body() createMonthlyOfferDto: CreateMonthlyOfferDto) {
		return this.monthlyOfferService.create(user, createMonthlyOfferDto)
	}

	@ApiResponse(CreateMonthlyOfferDto, { paginated: true })
	@Public()
	@Get()
	findAll(@Query() query?: PaginationDto) {
		return this.monthlyOfferService.findAll(query)
	}

	@Public()
	@Get('period')
	getCollectedPeriod(@Query() query: GetMonthlyOfferPeriod) {
		return this.monthlyOfferService.getCollectedPeriod(query.field)
	}

	@ApiResponse(CreateMonthlyOfferDto)
	@Public()
	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.monthlyOfferService.findOne(id)
	}

	@ApiBearerAuth()
	@ApiBatchResponse()
	@Roles(Role.ADMIN)
	@Put('restore')
	restore(@Body() restoreDto: RestoreDto, @Jwt() user: User) {
		return this.monthlyOfferService.restore(restoreDto, user)
	}

	@ApiBearerAuth()
	@ApiResponse(CreateMonthlyOfferDto)
	@Put(':id')
	update(@Param('id') id: string, @Jwt() user: User, @Body() updateMonthlyOfferDto: UpdateMonthlyOfferDto) {
		return this.monthlyOfferService.update(id, user, updateMonthlyOfferDto)
	}

	@ApiBearerAuth()
	@ApiBatchResponse()
	@Roles(Role.ADMIN)
	@Delete('hard-remove')
	hardRemove(@Body() hardRemoveDto: HardRemoveDto, @Jwt() user: User) {
		return this.monthlyOfferService.hardRemove(hardRemoveDto, user)
	}

	@ApiBearerAuth()
	@ApiResponse(CreateMonthlyOfferDto)
	@Delete(':id')
	remove(@Param('id') id: string, @Jwt() user: User) {
		return this.monthlyOfferService.remove(id, user)
	}
}
