import { Module } from '@nestjs/common'
import { MailService } from './mail.service'
import { MailController } from './mail.controller'
import { BullModule } from '@nestjs/bull'
import { MulterModule } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'

@Module({
	imports: [
		BullModule.registerQueue({
			name: 'queue',
		}),
		MulterModule.registerAsync({
			useFactory: async (configService: ConfigService) => configService.get('multer'),
			inject: [ConfigService],
		}),
	],
	controllers: [MailController],
	providers: [MailService],
	exports: [MailService],
})
export class MailModule {}
