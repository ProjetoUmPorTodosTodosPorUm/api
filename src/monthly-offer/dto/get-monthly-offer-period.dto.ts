import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'src/utils';

export class GetMonthlyOfferPeriod {
    @ApiProperty({
        format: 'uuid'
    })
    @IsNotEmpty()
    @IsUUID('4')
    field: string
}