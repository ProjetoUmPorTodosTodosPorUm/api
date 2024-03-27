import { ConfigModule } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing";
import configuration from "src/config/configuration";
import { HealthModule } from "src/health/health.module";
import { ResponseInterceptor } from "src/response.interceptor";
import { setAppConfig } from "src/utils/test";
import * as request from 'supertest';

describe('Health Controller E2E', () => {
    let app: NestExpressApplication

    const baseRoute = '/health';

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
            ]
        }).compile();

        app = moduleRef.createNestApplication();
        setAppConfig(app);
        await app.init();
    })

    afterAll(async () => {
        await app.close()
    })

    describe('Public Routes (as Non Logged User)', () => {
        it('Should Return "ok"', async () => {
            const response = await request(app.getHttpServer())
                .get(baseRoute)
                .expect(200)

            expect(response.body.data).toBe('ok')
        })
    })
})