import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/messaging.module';
import { OwnershipsController } from './ownerships.controller';
import { OwnershipsService } from './ownerships.service';

@Module({
  imports: [MessagingModule],
  controllers: [OwnershipsController],
  providers: [OwnershipsService],
})
export class OwnershipsModule {}
