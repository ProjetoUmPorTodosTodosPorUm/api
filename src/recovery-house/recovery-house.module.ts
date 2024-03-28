import { Module } from '@nestjs/common'
import { RecoveryHouseService } from './recovery-house.service'
import { RecoveryHouseController } from './recovery-house.controller'

@Module({
	controllers: [RecoveryHouseController],
	providers: [RecoveryHouseService],
})
export class RecoveryHouseModule {}
