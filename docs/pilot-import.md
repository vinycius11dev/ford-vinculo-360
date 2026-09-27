# Importação de dados para o piloto

O primeiro adaptador de integração do Ford Vínculo 360 recebe um lote JSON
exportado de um DMS, CRM ou processo intermediário. Ele permite iniciar um
piloto controlado antes de homologar um conector específico de cada fornecedor.

## Onde usar

No painel web, acesse `Configurações → Integrações → Importar lote do piloto`.
O usuário precisa ser `DEALERSHIP_MANAGER` ou `FORD_ADMIN`. A tela permite
baixar o modelo, selecionar o arquivo, revisar a quantidade de registros e
enviar o lote.

## Contrato

```json
{
  "sourceSystem": "dms-exemplo",
  "vehicles": [
    {
      "externalId": "veiculo-001",
      "vin": "9BFXXXXXXXXXXXXXX",
      "model": "Ranger Limited",
      "modelYear": 2024,
      "manufactureYear": 2024,
      "currentMileage": 1200,
      "plate": "ABC1D23",
      "dealershipId": "seed-dealer-center-norte"
    }
  ],
  "serviceOrders": [
    {
      "externalId": "os-001",
      "vin": "9BFXXXXXXXXXXXXXX",
      "mileage": 1200,
      "status": "COMPLETED",
      "description": "Revisão periódica",
      "amount": 980,
      "completedAt": "2026-08-20T12:00:00.000Z",
      "dealershipId": "seed-dealer-center-norte"
    }
  ]
}
```

`externalId` é obrigatório e deve ser estável no sistema de origem. A mesma
combinação `sourceSystem + externalId` pode ser importada novamente sem criar
duplicatas. O VIN é normalizado em maiúsculas e nunca é trocado quando o
identificador externo já existe.

## Regras de segurança

- Gerentes só importam dados da própria concessionária.
- Administradores Ford informam a concessionária em cada registro.
- Lotes vazios, VINs inválidos, concessionárias desconhecidas e conflitos de
  identidade são rejeitados antes da conclusão.
- Ordens concluídas não podem ser reabertas pela importação.
- Cada lote aprovado gera um evento `PILOT_IMPORT` na trilha de auditoria.
- O arquivo fica apenas no navegador durante a seleção; a API recebe somente
  o JSON validado.

## Limites desta etapa

Este adaptador ainda é uma ponte de piloto. Ele não substitui a integração
homologada com um DMS/CRM, não cria automaticamente o vínculo do proprietário
e não dispara SMS ou push. Essas etapas continuam no backlog de integração
externa e devem ser homologadas antes de produção.
