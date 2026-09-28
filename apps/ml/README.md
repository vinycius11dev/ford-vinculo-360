# Ford App — modelo de risco de evasão

Este diretório contém um pipeline reproduzível para o piloto acadêmico de previsão de evasão da rede de pós-venda. Ele **não usa dados de clientes reais**: gera um CSV sintético e determinístico para demonstrar o ciclo de ciência de dados. As métricas são didáticas e não representam desempenho esperado em produção.

## O que o pipeline entrega

- `generate_training_data.py`: gera histórico sintético sem nome, CPF/CNPJ, e-mail, telefone, VIN, placa ou outro identificador real. Inclui valores ausentes reproduzíveis para demonstrar imputação.
- `train.py`: valida schema, datas, IDs, faixas e tipos; usa imputação mediana e padronização; faz validação cronológica em três folds para comparar configurações de Regressão Logística e Random Forest; reserva o período mais recente para o teste final.
- `artifacts/churn_model.joblib`: dicionário com as chaves `model` e `metadata`.
- `artifacts/metrics.json`: métricas de validação e teste, configurações comparadas, regra de seleção, período e checagens dos dados.

O modelo recebe as mesmas quatro variáveis já expostas pela API:

1. `days_since_last_service`
2. `services_last_24_months`
3. `vehicle_age_years`
4. `voucher_usage_count`

## Executar localmente

Na pasta `apps/ml`, crie/ative um ambiente Python e instale as dependências:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-training.txt
```

Para executar a API FastAPI localmente, instale também as dependências de serviço com `python -m pip install -r requirements.txt`.

Gere os dados sintéticos com seed fixa e treine:

```powershell
python generate_training_data.py --output data/training_data.csv --rows 1200 --seed 20260913 --reference-date 2026-09-13 --missing-rate 0.01
python train.py --data data/training_data.csv --artifacts-dir artifacts
```

Para repetir o conjunto de dados, mantenha a mesma seed, quantidade de linhas, data de referência e taxa de valores ausentes. O gerador está fora dos diretórios ignorados pelo Git para que um clone limpo consiga executar os comandos. O CSV e os artefatos continuam sendo saídas locais geradas pelo pipeline.

## Método de treino e seleção

O dataset sintético tem 1.200 registros. O pipeline ordena as observações por data, usa os 80% mais antigos para treino/validação e mantém os 20% mais recentes como teste final intocado. Dentro da parte de treino, `TimeSeriesSplit` cria três folds expansivos; imputador e `StandardScaler` são ajustados dentro de cada fold para evitar vazamento entre períodos.

São avaliadas três configurações de cada algoritmo. A configuração de cada família e o modelo final são selecionados pela maior média de ROC-AUC na validação cronológica; a média de F1 desempata. O teste final é usado uma vez para reportar ROC-AUC, precisão, recall e F1 dos melhores representantes de cada família. A classificação usa limiar 0,5.

O gerador limita os atributos às faixas sintéticas definidas no próprio código e insere valores ausentes independentes do rótulo. O treinamento rejeita datas, rótulos, IDs duplicados, valores não numéricos e valores fora dessas faixas; valores ausentes nas quatro variáveis de entrada são imputados pela mediana aprendida somente no treino.

## Integração com a aplicação

O serviço FastAPI expõe `/health`, `/score/churn` e `/score/churn/batch`. Quando o artefato treinado está disponível, `/health` informa `trained-model`; sem ele, o serviço identifica explicitamente `heuristic-baseline`. A API TypeScript consome o serviço via `ML_SERVICE_URL` e preserva um fallback heurístico para indisponibilidade. O score serve para priorizar atendimento e requer revisão humana antes de uma recomendação de campanha.

Consulte [`docs/ia-machine-learning-sprint3.md`](../../docs/ia-machine-learning-sprint3.md) para a descrição do problema, comparação dos modelos, resultados e conclusão da entrega acadêmica.

## Formato do artefato

`artifacts/churn_model.joblib` é carregado com `joblib.load(...)` e possui:

```python
{
    "model": pipeline_sklearn,
    "metadata": {
        "feature_names": [
            "days_since_last_service",
            "services_last_24_months",
            "vehicle_age_years",
            "voucher_usage_count",
        ],
        "model_version": "churn-risk-pilot-v2",
        "selected_model": "logistic_regression ou random_forest",
        "selected_parameters": "configuração escolhida pela validação cronológica",
        "selected_validation_mean_metrics": "métricas médias da validação temporal",
        "trained_at": "data/hora UTC ISO-8601",
    },
}
```

## Limites e LGPD

Este é um piloto com dados sintéticos, portanto suas métricas não representam desempenho em produção. Antes de usar dados reais, é necessário definir finalidade, base legal, retenção, controle de acesso, anonimização/pseudonimização, avaliação de viés e governança humana. O risco calculado deve priorizar atendimento; não deve negar serviço, determinar preço ou tomar decisão automática sobre uma pessoa.
