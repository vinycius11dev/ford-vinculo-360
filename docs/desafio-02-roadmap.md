# Desafio 02 — Roadmap do Ford Vínculo 360

## Ideia refinada

O Ford Vínculo 360 transforma o VIN em uma identidade digital contínua do
veículo e usa essa identidade para aumentar o VIN Share da rede autorizada.
O sistema conecta quatro etapas:

```text
dados do veículo → inteligência → lead recomendado → retorno à rede Ford
```

O foco não é apenas guardar o histórico. É ajudar cada concessionária a
decidir **qual veículo abordar, por que abordá-lo, qual ação oferecer e se a
ação resultou em serviço**.

## O que já existe

- Identidade permanente do veículo pelo VIN e histórico técnico contínuo.
- Separação entre histórico do veículo e dados pessoais do proprietário.
- Painel da concessionária com veículos, clientes, serviços, agenda, campanhas,
  fidelidade e oportunidades de recompra.
- App do proprietário com histórico, pontos, vouchers, ofertas, avisos e
  agendamento.
- VIN Share agregado, retenção por concessionária, classificação de risco e
  previsão de evasão.
- Autenticação, permissões, auditoria, consentimentos LGPD e testes de
  integração.

## Lacuna principal do desafio

O desafio pede uma camada analítica mais explícita. O próximo módulo deve ser
uma visão **Desafio 02 — Inteligência de VIN Share**, com:

- VIN Share e Service Share claramente diferenciados.
- Filtros por período, concessionária, região, modelo, idade do veículo e tipo
  de serviço.
- Evolução mensal e comparação entre concessionárias.
- Identificação de queda anormal, baixa cobertura e grupos com evasão provável.
- Lista de leads com risco, motivo, recomendação e resultado da ação.

### Entrega demonstrável atual

O painel já apresenta esses indicadores em uma visão filtrável e agora inclui
um modo de apresentação guiado: sinal → lead explicável → campanha → agenda →
serviço → impacto no VIN Share. Os valores continuam identificados como dados
de piloto, para não serem confundidos com resultados oficiais da Ford.

## Definições dos indicadores

### VIN Share

```text
veículos Ford elegíveis atendidos pela rede no período
÷ total de veículos Ford elegíveis no período
```

O painel deve mostrar o período, a população elegível e a fonte dos dados. A
versão atual é uma aproximação baseada na carteira monitorada local.

### Service Share

```text
serviços ou VINs atendidos por uma unidade/segmento
÷ total de serviços ou VINs elegíveis no mesmo segmento
```

O produto deve indicar se o cálculo está baseado em ordens ou em VINs únicos,
para que várias visitas do mesmo veículo não distorçam o resultado.

## Passo a passo de evolução

### Fase 1 — Módulo demonstrável para o desafio

1. Criar a tela “Desafio 02 — Inteligência de VIN Share”.
2. Exibir cartões de VIN Share, Service Share, retenção, veículos em risco e
   leads gerados.
3. Adicionar filtros de período, concessionária, modelo, idade e serviço.
4. Adicionar gráfico de tendência e ranking de unidades.
5. Mostrar uma definição curta e o denominador de cada indicador.

**Critério de aceite:** o professor consegue selecionar uma unidade e explicar
por que o indicador subiu ou caiu.

### Fase 2 — Leads explicáveis

1. Calcular o risco usando recência, quilometragem, idade, quantidade de
   serviços, garantia e uso de benefícios.
2. Mostrar o motivo do risco em linguagem simples.
3. Gerar uma ação recomendada: revisão, recall, campanha, contato ou oferta.
4. Registrar o estado do lead: novo, contatado, agendado, concluído ou perdido.
5. Medir a conversão de cada ação.

**Critério de aceite:** cada lead tem uma justificativa e uma ação rastreável.

### Fase 3 — Jornada fechada

1. Campanha criada.
2. Mensagem enviada.
3. Cliente visualizou ou recebeu o aviso.
4. Agendamento realizado.
5. Ordem de serviço concluída.
6. Pontos, voucher ou benefício concedido.
7. VIN Share atualizado.

**Critério de aceite:** uma ação iniciada no painel pode ser acompanhada até o
retorno efetivo à rede.

### Fase 4 — Validação do piloto

1. Escolher duas ou três concessionárias brasileiras.
2. Definir uma linha de base dos 12 meses anteriores.
3. Comparar unidades com e sem a nova jornada.
4. Medir retorno à rede, agendamento, conversão, receita e satisfação.
5. Ajustar regras antes de expandir para outros países da América do Sul.

## Métricas para provar valor

- VIN Share por unidade e por modelo.
- Service Share por tipo de serviço.
- Percentual de veículos em risco recuperados.
- Conversão de campanha em agendamento.
- Conversão de agendamento em serviço concluído.
- Receita de pós-venda por veículo.
- Tempo médio entre serviços.
- Uso e resgate de benefícios.

As metas devem ser apresentadas como hipóteses do piloto, não como resultados
já comprovados.

## Roteiro de apresentação

1. **Problema:** depois da venda, a Ford pode perder o relacionamento com o
   veículo e com o proprietário.
2. **Indicador:** VIN Share mostra quanto da frota elegível continua usando a
   rede autorizada.
3. **Ideia:** o VIN vira uma identidade contínua, independente da troca de
   proprietário.
4. **Inteligência:** o sistema encontra padrões, riscos e oportunidades.
5. **Ação:** a concessionária recebe um lead com recomendação personalizada.
6. **Resultado:** a jornada termina em agendamento, serviço e retorno à rede.
7. **Escala:** começa como piloto brasileiro e depois pode receber integrações
   e expansão sul-americana.

## Limites que devem ser declarados

- Os dados atuais são demonstrativos e ainda não vêm de DMS, CRM ou telemetria
  oficiais da Ford.
- O modelo de evasão atual é um baseline explicável, não um modelo produtivo.
- Mensageria externa, homologação jurídica, testes nativos e operação de
  produção ainda são etapas futuras.

## Frase central

> O Ford Vínculo 360 não apenas mostra quais veículos estão se afastando: ele
> explica o risco, recomenda a próxima ação e mede se a concessionária conseguiu
> trazer o veículo de volta para a rede Ford.
