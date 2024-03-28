import { PartialType } from '@nestjs/swagger'
import { CreateRecoveryHouseDto } from './create-recovery-house.dto'

export class UpdateRecoveryHouseDto extends PartialType(CreateRecoveryHouseDto) {}
