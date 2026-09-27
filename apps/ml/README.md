# Ford App — modelo de risco de evasão

Este diretório contém um pipeline reproduzível para o piloto acadêmico de previsão de evasão da rede de pós-venda. Ele **não usa dados de clientes reais**: gera um CSV sintético, anônimo e determinístico para demonstrar todo o ciclo de ciência de dados.

## O que o pipeline entrega

- `data/generate_training_data.py`: gera histórico sintético sem nome, CPF/CNPJ, e-mail, telefone, VIN, placa ou outro identificador real.
- `train.py`: faz separação cronológica (os registros mais antigos treinam e os mais recentes testam), compara Regressão Logística e Random Forest e mede ROC-AUC, precisão, recall e F1.
- `artifacts/churn_model.joblib`: dicionário com as chaves `model` e `metadata`.
- `artifacts/metrics.json`: resultado da comparação, regra de seleção, período de treino/teste e metadados do artefato.

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
python -m pip install -r requirements.txt
```

Gere os dados sintéticos com seed fixa e treine:

```powershell
python data/generate_training_data.py --output data/training_data.csv --rows 1200 --seed 20260913
python train.py --data data/training_data.csv --artifacts-dir artifacts
```

Para repetir exatamente o conjunto de dados, mantenha a mesma seed, quantidade de linhas e data de referência. O horário `trained_at` muda a cada treino porque registra a execução do artefato.

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
        "model_version": "churn-risk-pilot-v1",
        "selected_model": "logistic_regression ou random_forest",
        "trained_at": "data/hora UTC ISO-8601",
    },
}
```

## Limites e LGPD

Este é um piloto com dados sintéticos, portanto suas métricas não representam desempenho em produção. Antes de usar dados reais, é necessário definir finalidade, base legal, retenção, controle de acesso, anonimização/pseudonimização, avaliação de viés e governança humana. O risco calculado deve priorizar atendimento; não deve negar serviço, determinar preço ou tomar decisão automática sobre uma pessoa.
