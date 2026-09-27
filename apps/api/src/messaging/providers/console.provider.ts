import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  MessageDeliveryInput,
  MessageDeliveryResult,
  MessageProvider,
} from "./message-provider.interface";

@Injectable()
export class ConsoleProvider implements MessageProvider {
  private readonly logger = new Logger("MessagingConsoleProvider");

  async send(input: MessageDeliveryInput): Promise<MessageDeliveryResult> {
    this.logger.log(`[${input.channel} · simulado] mensagem processada.`);
    return { providerRef: `console-${randomUUID()}` };
  }
}
