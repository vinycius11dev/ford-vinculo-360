# E-mail transacional do piloto

O piloto usa e-mail como único canal externo real. SMS e push permanecem em modo de simulação até que exista uma decisão de fornecedor e contrato de integração.

## Configuração SMTP

Preencha `apps/api/.env` (ou as variáveis equivalentes no ambiente de produção):

```env
MAIL_FROM="Ford Vínculo 360 <no-reply@seudominio.com>"
SMTP_HOST="smtp.seuprovedor.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="usuario-smtp"
SMTP_PASS="senha-ou-app-password"
APP_WEB_URL="https://piloto.seudominio.com"
```

Use senha de aplicativo quando o provedor exigir MFA. Nunca versione `SMTP_PASS` nem coloque credenciais no frontend.

## Validar antes do piloto

1. Entre em **Configurações → Integrações** com perfil Administrador Ford ou Gerente.
2. Confirme que **E-mail transacional** aparece como **SMTP configurado**.
3. Informe uma caixa de teste e clique em **Enviar teste**.
4. Confira recebimento, remetente, botão e pasta de spam.
5. Abra **Fila de mensageria** e confirme status `Entregue` e a referência retornada pelo provedor.

O status `Entregue` significa que o servidor SMTP aceitou a mensagem; a confirmação de leitura depende do provedor de e-mail e não é tratada como prova de entrega. Falhas ficam registradas com retentativa e podem ser reenviadas pela fila.

## Templates e segurança

Os templates têm versão texto e HTML responsivo, escapam conteúdo de campanha e só aceitam links HTTP(S) ou caminhos internos. O disparo de campanha exige consentimento `MARKETING` concedido e registra a mensagem na fila com auditoria.
