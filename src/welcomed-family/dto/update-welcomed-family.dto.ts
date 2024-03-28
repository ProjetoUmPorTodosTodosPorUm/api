import { PartialType } from '@nestjs/swagger'
import { CreateWelcomedFamilyDto } from './create-welcomed-family.dto'

export class UpdateWelcomedFamilyDto extends PartialType(CreateWelcomedFamilyDto) {}
