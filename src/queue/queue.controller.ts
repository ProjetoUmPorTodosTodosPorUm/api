import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/roles';
import { QueueService } from './queue.service';
import { ApiQueueResponse } from 'src/utils/decorator/api-queue-response'

@ApiTags('Queue')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('queue')
export class QueueController {
    constructor(private readonly queueService: QueueService) { }

    @ApiQueueResponse()
    @Get()
    findAll() {
        return this.queueService.findAll()
    }

    @ApiQueueResponse()
    @Get('active')
    findAllActive() {
        return this.queueService.findAllActive()
    }

    @ApiQueueResponse()
    @Get('completed')
    findAllCompleted() {
        return this.queueService.findAllCompleted()
    }

    @ApiQueueResponse()
    @Get('failed')
    findAllFailed() {
        return this.queueService.findAllFailed()
    }

    @ApiQueueResponse()
    @Get('paused')
    findAllPaused() {
        return this.queueService.findAllPaused()
    }

    @ApiQueueResponse()
    @Get('waiting')
    findAllWaiting() {
        return this.queueService.findAllWaiting()
    }
}
