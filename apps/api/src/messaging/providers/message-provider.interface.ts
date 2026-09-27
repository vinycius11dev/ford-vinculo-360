import { MessageChannel } from "@prisma/client";
import { TemplateContent } from "../templates";

export type MessageDeliveryInput = {
  channel: MessageChannel;
  recipient: string;
  content: TemplateContent;
};

export type MessageDeliveryResult = {
  providerRef?: string;
};

export interface MessageProvider {
  send(input: MessageDeliveryInput): Promise<MessageDeliveryResult>;
}
