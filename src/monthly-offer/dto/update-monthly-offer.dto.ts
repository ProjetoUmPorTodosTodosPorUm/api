import { PartialType } from '@nestjs/swagger';
import { CreateMonthlyOfferDto } from './create-monthly-offer.dto';

export class UpdateMonthlyOfferDto extends PartialType(CreateMonthlyOfferDto) {}
