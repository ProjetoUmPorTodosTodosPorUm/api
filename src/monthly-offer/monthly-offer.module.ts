import { Module } from '@nestjs/common'
import { MonthlyOfferService } from './monthly-offer.service'
import { MonthlyOfferController } from './monthly-offer.controller'

@Module({
	controllers: [MonthlyOfferController],
	providers: [MonthlyOfferService],
})
export class MonthlyOfferModule {}
