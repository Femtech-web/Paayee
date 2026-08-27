import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Paayee chain worker is ready. Keep this process running.', 'WorkerBootstrap');
}

void bootstrap().catch((cause) => {
  Logger.error(
    cause instanceof Error ? cause.stack : String(cause),
    undefined,
    'WorkerBootstrap',
  );
  process.exitCode = 1;
});
