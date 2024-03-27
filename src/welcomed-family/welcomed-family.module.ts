import { Module } from '@nestjs/common';
import { WelcomedFamilyService } from './welcomed-family.service';
import { WelcomedFamilyController } from './welcomed-family.controller';

@Module({
  controllers: [WelcomedFamilyController],
  providers: [WelcomedFamilyService]
})
export class WelcomedFamilyModule {}
