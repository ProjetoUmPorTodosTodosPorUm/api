import { IsDate, IsNotEmpty } from 'src/utils'

export class FindByRangeDto {
	@IsNotEmpty()
	@IsDate()
	lte: Date
	@IsNotEmpty()
	@IsDate()
	gte: Date
}
