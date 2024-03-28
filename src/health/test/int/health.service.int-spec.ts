import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import configuration from 'src/config/configuration'
import { HealthModule } from 'src/health/health.module'
import { HealthService } from 'src/health/health.service'
import { ResponseInterceptor } from 'src/response.interceptor'

describe('Health Controller E2E', () => {
	let healthService: HealthService

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					load: [configuration],
					isGlobal: true,
				}),

				// Specific
				HealthModule,
			],
			providers: [
				{
					provide: APP_INTERCEPTOR,
					useClass: ResponseInterceptor,
				},
			],
		}).compile()

		healthService = moduleRef.get(HealthService)
	})

	describe('findOne()', () => {
		it('Should Return "ok"', () => {
			const res = healthService.healthCheck()
			expect(res).toBe('ok')
		})
	})
})
