import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { LogModule } from './log/log.module';
import { TokenModule } from './token/token.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { FileModule } from './file/file.module';
import { UserModule } from './user/user.module';

import { LoggerMiddleware } from './logger.middleware';
import { ResponseInterceptor } from './response.interceptor';

import { VolunteerModule } from './volunteer/volunteer.module';
import { FieldModule } from './field/field.module';
import { AgendaModule } from './agenda/agenda.module';
import { WelcomedFamilyModule } from './welcomed-family/welcomed-family.module';
import { ChurchModule } from './church/church.module';
import { CollaboratorModule } from './collaborator/collaborator.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { OfferorFamilyModule } from './offeror-family/offeror-family.module';
import { ReportModule } from './report/report.module';
import { TestimonialModule } from './testimonial/testimonial.module';
import { MonthlyOfferModule } from './monthly-offer/monthly-offer.module';
import { ScheduleModule } from '@nestjs/schedule';
import { RecoveryHouseModule } from './recovery-house/recovery-house.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: config.get('throttle.ttl'),
        limit: config.get('throttle.limit'),
      })
    }),
    ScheduleModule.forRoot(),

    // Basic Routes
    AuthModule,
    LogModule,
    TokenModule,
    MailModule,
    PrismaModule,
    FileModule,
    UserModule,

    // Specific
    VolunteerModule,
    FieldModule,
    AgendaModule,
    WelcomedFamilyModule,
    ChurchModule,
    CollaboratorModule,
    AnnouncementModule,
    OfferorFamilyModule,
    ReportModule,
    TestimonialModule,
    MonthlyOfferModule,
    RecoveryHouseModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
