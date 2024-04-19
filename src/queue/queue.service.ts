import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
    constructor(@InjectQueue('queue') private readonly queue: Queue) { }

    async findAll() {
        return await this.queue.getJobs(['active', 'completed', 'delayed', 'failed', 'paused', 'waiting'])
    }

    async findAllActive() {
        return await this.queue.getJobs(['active'])
    }

    async findAllCompleted() {
        return await this.queue.getJobs(['completed'])
    }

    async findAllDelayed() {
        return await this.queue.getJobs(['delayed'])
    }

    async findAllFailed() {
        return await this.queue.getJobs(['failed'])
    }

    async findAllPaused() {
        return await this.queue.getJobs(['paused'])
    }

    async findAllWaiting() {
        return await this.queue.getJobs(['waiting'])
    }
}
