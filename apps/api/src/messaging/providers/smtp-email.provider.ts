import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, Transporter } from "nodemailer";
import {
  MessageDeliveryInput,
  MessageDeliveryResult,
  MessageProvider,
} from "./message-provider.interface";

@Injectable()
export class SmtpEmailProvider implements MessageProvider {
  private readonly logger = new Logger("MessagingSmtpProvider");
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  private client() {
    if (!this.transporter) {
      this.transporter = createTransport({
        host: this.config.get<string>("SMTP_HOST"),
        port: Number(this.config.get("SMTP_PORT") ?? 587),
        secure: this.config.get("SMTP_SECURE") === "true",
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        // Assinatura DKIM opcional, para servidores que não assinam sozinhos.
        dkim: this.config.get("DKIM_PRIVATE_KEY")
          ? {
              domainName: this.config.get<string>("DKIM_DOMAIN") ?? this.senderDomain(),
              keySelector: this.config.get<string>("DKIM_SELECTOR") ?? "default",
              // A chave vem do .env em uma linha, com "\n" literais.
              privateKey: this.config.get<string>("DKIM_PRIVATE_KEY")!.replace(/\\n/g, "\n"),
            }
          : undefined,
        auth: this.config.get("SMTP_USER")
          ? {
              user: this.config.get<string>("SMTP_USER"),
              pass: this.config.get<string>("SMTP_PASS"),
            }
          : undefined,
      });
    }
    return this.transporter;
  }

  private from() {
    return this.config.get<string>("MAIL_FROM") ?? "no-reply@ford360.local";
  }

  private senderDomain() {
    return this.from().match(/@([^>\s]+)/)?.[1] ?? "ford360.local";
  }

  async send(input: MessageDeliveryInput): Promise<MessageDeliveryResult> {
    const address = this.from().match(/<([^>]+)>/)?.[1] ?? this.from();
    const replyTo = this.config.get<string>("MAIL_REPLY_TO") ?? address;
    const info = await this.client().sendMail({
      from: this.from(),
      to: input.recipient,
      replyTo,
      subject: input.content.subject,
      text: input.content.text,
      html: input.content.html,
      // Cabeçalhos que provedores como Gmail esperam de remetentes legítimos.
      headers: {
        "List-Unsubscribe": `<mailto:${replyTo}?subject=Descadastrar>`,
      },
    });
    this.logger.log("E-mail entregue ao provedor.");
    return { providerRef: info.messageId };
  }
}
