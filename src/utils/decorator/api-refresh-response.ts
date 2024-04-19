import { applyDecorators } from '@nestjs/common'
import { ApiCreatedResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger'
import { RefreshResponseDto } from 'src/auth/dto'

export const ApiRefreshResponse = () => {
	return applyDecorators(
		ApiExtraModels(RefreshResponseDto),
		ApiCreatedResponse({
			schema: {
				properties: {
					message: {
						type: 'string',
					},
					data: {
						$ref: getSchemaPath(RefreshResponseDto),
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
