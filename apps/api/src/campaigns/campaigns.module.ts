import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { MessagingModule } from '../messaging/messaging.module';
@Module({ imports: [MessagingModule], controllers: [CampaignsController], providers: [CampaignsService] })
export class CampaignsModule {}
