# Sprint 3 — Inteligência Artificial e Machine Learning

## Resumo da solução

O projeto aborda o risco de evasão na rede Ford de pós-venda. O objetivo do piloto é estimar se um veículo ficará sem retornar à rede autorizada nos 180 dias seguintes à observação, para ajudar a equipe a priorizar contato de retenção. O problema foi formulado como **classificação binária supervisionada**, com o alvo `churned_within_180d`.

Esta entrega implementa **Machine Learning preditivo**, não um chatbot ou modelo de IA generativa. O score apoia uma pessoa da concessionária; ele não envia ofertas sozinho, não altera preços e não nega serviços.

## Dados e variáveis

Como permitido pela atividade, foi criado um conjunto sintético, determinístico e sem dados de clientes ou identificadores reais. O gerador cria 1.200 observações usando seed `20260913` e data de referência `2026-09-13`. O rótulo é simulado a partir das variáveis abaixo, com variação aleatória; por isso, os resultados servem para demonstrar o fluxo, não para estimar a qualidade esperada em clientes reais.

| Variável | Significado | Justificativa no problema |
|---|---|---|
| `days_since_last_service` | Dias desde a última revisão | Intervalo longo pode indicar afastamento da rede. |
| `services_last_24_months` | Serviços registrados nos últimos 24 meses | Frequência recente representa vínculo com o pós-venda. |
| `vehicle_age_years` | Idade do veículo em anos | O ciclo de manutenção varia conforme a idade do veículo. |
| `voucher_usage_count` | Benefícios resgatados | Uso de benefícios é um sinal sintético de engajamento. |

## Preparação e qualidade dos dados

- O gerador limita os valores sintéticos: dias sem serviço de 7 a 900; serviços de 0 a 10; idade de 0,1 a 15 anos; vouchers de 0 a 8.
- Para demonstrar tratamento de ausência, são introduzidos valores ausentes independentes do rótulo, com taxa de 1% em cada variável de entrada. No conjunto gerado nesta execução, foram 50 valores ausentes em 1.200 linhas; o alvo não tem ausências.
- O treino valida colunas obrigatórias, datas, rótulos binários, IDs duplicados, valores numéricos, contagens inteiras e faixas do conjunto sintético. Datas inválidas, dados inconsistentes e valores fora das faixas são rejeitados antes do treino.
- Ausências nas variáveis de entrada são preenchidas pela mediana. A padronização usa `StandardScaler`. Ambos são etapas do `Pipeline` do scikit-learn, ajustadas dentro de cada fold de treino para evitar vazamento de informação.
- Os dados são ordenados por data. As 960 observações mais antigas formam a partição de treino/validação; as 240 mais recentes ficam reservadas para o teste final (`train_end_date`: `2025-07-30`; `test_start_date`: `2025-08-01`).

## Modelos e ajuste de parâmetros

Foram comparados dois classificadores ensinados com frequência em Machine Learning introdutório:

- **Regressão Logística:** referência linear, rápida e mais simples de explicar. Foram testados `C = 0,1`, `1` e `10`, com `class_weight=balanced` e `max_iter=3000`.
- **Random Forest:** referência por conjunto de árvores, capaz de representar relações não lineares. Foram testadas três combinações de número de árvores, profundidade e tamanho mínimo de folha: `(200, 6, 2)`, `(300, 10, 4)` e `(400, sem limite, 4)`, com `max_features=sqrt` e `class_weight=balanced`.

A busca usa três folds cronológicos expansivos dentro da partição de treino. Primeiro escolhe a melhor configuração de cada algoritmo; depois seleciona o algoritmo pela maior média de ROC-AUC na validação, usando F1 como desempate. O período de teste final não participa dessa seleção.

## Resultados

As métricas abaixo foram calculadas uma única vez no holdout cronológico de 240 observações sintéticas, usando limiar de classificação `0,5`.

| Modelo | ROC-AUC | Precisão | Recall | F1 |
|---|---:|---:|---:|---:|
| Regressão Logística (`C=0,1`) | **0,7911** | 0,4725 | **0,6935** | **0,5621** |
| Random Forest (`400 árvores`, profundidade sem limite, folha mínima `4`) | 0,7625 | 0,4627 | 0,5000 | 0,4806 |

Na validação cronológica, a configuração selecionada de Regressão Logística obteve ROC-AUC média `0,8094` e F1 médio `0,5620`. O melhor Random Forest obteve ROC-AUC média `0,7938` e F1 médio `0,5659`. A regra prioriza ROC-AUC; assim, a Regressão Logística foi selecionada antes de observar o teste. No holdout, ela também alcançou maior recall: identificou uma parcela maior dos positivos sintéticos, embora sua precisão tenha ficado abaixo de 0,5.

**Interpretação e limite:** esses números descrevem apenas o dataset sintético, cujo próprio rótulo foi gerado por uma regra probabilística baseada nas mesmas variáveis de entrada. O holdout temporal reduz vazamento entre períodos, mas não substitui validação com comportamento real. Não se afirma que o sistema tenha ROC-AUC de `0,7911` em clientes Ford.

## Integração e possível implantação

O artefato selecionado (`churn-risk-pilot-v2`) é salvo como `apps/ml/artifacts/churn_model.joblib`. O serviço FastAPI em `apps/ml/app/main.py` carrega esse artefato e oferece `/health`, `/score/churn` e `/score/churn/batch`. A API NestJS chama o serviço pela configuração `ML_SERVICE_URL`; a integração de risco aparece no painel e nas rotas protegidas de previsões. Se o modelo não estiver disponível, a aplicação identifica e usa um baseline heurístico. Recomendações de campanha exigem revisão humana e são registradas na auditoria.

Para uma implantação futura, o serviço de ML deve permanecer em rede privada, com artefato e versão controlados, acesso restrito da API, health checks e monitoramento. Antes de substituir o dataset sintético por dados reais, é necessário autorizar a finalidade e o uso dos dados, definir o rótulo com a área de negócio e reavaliar métricas e limiares em períodos posteriores.

## Conclusão e trabalhos futuros

Para este piloto acadêmico, selecionamos a Regressão Logística com `C=0,1`, `class_weight=balanced` e `max_iter=3000`: teve a maior ROC-AUC média de validação entre as configurações comparadas e manteve melhor ROC-AUC, recall e F1 no holdout sintético. Ela pode apoiar a priorização de clientes para contato, sempre com decisão humana.

Os próximos passos para uso operacional são obter dados históricos apropriados e autorizados, confirmar a definição de evasão, testar a generalização em uma janela temporal futura, calibrar limiares conforme o custo de contato e avaliar vieses entre grupos. Também será necessário monitorar deriva, qualidade das previsões e resultados das ações de retenção. Até isso ocorrer, o modelo deve ser tratado somente como protótipo didático.

## Como reproduzir

Na raiz do repositório, com Python 3.12 e dependências de treino instaladas por `apps/ml/requirements-training.txt`:

```bash
python apps/ml/generate_training_data.py --output apps/ml/data/training_data.csv --rows 1200 --seed 20260913 --reference-date 2026-09-13 --missing-rate 0.01
python apps/ml/train.py --data apps/ml/data/training_data.csv --artifacts-dir apps/ml/artifacts --test-fraction 0.2 --validation-splits 3
```

O workflow [ML training evidence](../.github/workflows/ml-training-evidence.yml) executa essa sequência em um clone limpo, faz uma pontuação de smoke com o artefato treinado, publica a tabela no resumo da execução e anexa o CSV sintético, o modelo e `metrics.json` por 30 dias. Os dados e artefatos são saídas geradas e não são commitados no repositório.

### Arquivos da entrega

- Código de geração: [`apps/ml/generate_training_data.py`](../apps/ml/generate_training_data.py)
- Treino, validação, comparação e avaliação: [`apps/ml/train.py`](../apps/ml/train.py)
- Serviço de scoring: [`apps/ml/app/main.py`](../apps/ml/app/main.py)
- Instruções do pipeline: [`apps/ml/README.md`](../apps/ml/README.md)
