# Arquitetura inicial

Para os diagramas atualizados, fronteiras de serviço, fluxos JWT/RBAC e pendências
da rubrica da Sprint 3, consulte [Arquitetura orientada a serviços](sprint-3-architecture.md).

O Ford Vínculo 360 é organizado como monorepo, com aplicações independentes e contratos compartilháveis.

```text
apps/mobile (Expo) ─┐
                   ├── apps/api (NestJS) ── MySQL
apps/web (React)  ──┘          │
                               └── apps/ml (FastAPI)
```

O `Vehicle.vin` é único e permanente. Mudanças de propriedade criam registros em `VehicleOwnership`; nunca recriam o veículo. Dados pessoais ficam em `User` e não devem ser expostos em consultas de histórico do veículo.

## Primeira entrega técnica

- API e esquema MySQL para veículos, vínculos, serviços, fidelidade, vouchers, campanhas e agendamentos.
- Painel web demonstrando os indicadores de pós-venda.
- App móvel inicial para a visão do proprietário.
- Serviço Python com uma previsão explicável de risco de evasão como baseline substituível por modelo treinado.

## Fronteiras de acesso

1. Cliente: somente os próprios veículos e agendamentos.
2. Concessionária: veículos e operações da própria rede/unidade.
3. Ford Admin: visão consolidada e campanhas.
4. Histórico técnico do veículo pode persistir; dados pessoais do proprietário anterior não acompanham a transferência.
