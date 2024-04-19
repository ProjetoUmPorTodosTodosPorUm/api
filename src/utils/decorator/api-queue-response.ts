import { applyDecorators } from '@nestjs/common'
import { ApiOkResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger'
import { QueueResponseDto } from 'src/queue/dto'

export const ApiQueueResponse = () => {
	return applyDecorators(
		ApiExtraModels(QueueResponseDto),
		ApiOkResponse({
			schema: {
				properties: {
					message: {
						type: 'string',
					},
					data: {
						type: 'array',
						items: {
							allOf: [
								{ $ref: getSchemaPath(QueueResponseDto) }
							]
						},
					},
					timestamp: {
						type: 'string',
						format: 'date-time',
					},
				},
			},
		}),
	)
}
