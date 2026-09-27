# Jornada de campanha e conversão

O disparo de uma campanha agora fecha o primeiro ciclo de comunicação do
piloto:

```text
alvo com proprietário ativo
→ consentimento de marketing
→ mensagem enfileirada
→ entrega pelo provedor ou simulação
→ oferta visualizada no app
→ ordem de serviço concluída
→ CampaignTarget.convertedAt preenchido
```

## Regras

- A campanha precisa ter `publicTitle` e `publicDescription` para ser enviada.
- O proprietário precisa ter consentimento `MARKETING` concedido.
- O canal preferido é e-mail; SMS é usado quando não há e-mail.
- Cada mensagem guarda o `campaignTargetId`, o template e os eventos de entrega.
- Alvos sem consentimento, proprietário ativo ou canal de contato são retornados
  como `skipped` e permanecem disponíveis para revisão.
- A conversão é registrada na conclusão da primeira ordem de serviço posterior
  ao envio para aquele VIN.

## Provedores

Sem `SMTP_HOST`, o e-mail usa o provider simulado local e continua visível na
fila administrativa. Com SMTP configurado, a mesma fila entrega ao provedor
real. SMS e push permanecem explicitamente simulados; eles não são apresentados
como canais externos homologados neste piloto. Veja o passo a passo em
[`docs/email-setup.md`](email-setup.md).
