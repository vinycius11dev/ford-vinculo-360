import { Module } from "@nestjs/common";
import { PilotImportController } from "./pilot-import.controller";
import { PilotImportService } from "./pilot-import.service";

@Module({ controllers: [PilotImportController], providers: [PilotImportService] })
export class PilotImportModule {}
