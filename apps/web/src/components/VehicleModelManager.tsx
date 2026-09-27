import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CarFront, ImagePlus, Layers3, Plus, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../lib/api';
import { EquipmentSelector, emptyEquipment, type EquipmentMap } from './EquipmentSelector';

type TechnicalSpecifications = {
  brand: string; bodyType: string; generation: string; platform: string; countryOfOrigin: string;
  lengthMm: string; widthMm: string; heightMm: string; wheelbaseMm: string; groundClearanceMm: string;
  curbWeightKg: string; payloadKg: string; towingCapacityKg: string; cargoVolumeLiters: string; fuelTankLiters: string;
};

type VehicleModel = {
  id: string; slug: string; name: string; modelCode: string | null; modelYear: number; category: string;
  summary: string; description: string; dimensions: string | null; seats: number | null; doors: number | null;
  warrantyLabel: string | null; basePrice: number; imageUrl: string | null; published: boolean;
  technicalSpecifications: Partial<TechnicalSpecifications> | null; standardEquipment: Partial<EquipmentMap> | null;
};

type ModelDraft = Omit<VehicleModel, 'id' | 'slug'> & { slug: string; technicalSpecifications: TechnicalSpecifications; standardEquipment: EquipmentMap };

const emptyTechnical = (): TechnicalSpecifications => ({
  brand: 'Ford', bodyType: '', generation: '', platform: '', countryOfOrigin: '', lengthMm: '', widthMm: '', heightMm: '',
  wheelbaseMm: '', groundClearanceMm: '', curbWeightKg: '', payloadKg: '', towingCapacityKg: '', cargoVolumeLiters: '', fuelTankLiters: '',
});
const emptyDraft = (): ModelDraft => ({
  slug: '', name: '', modelCode: '', modelYear: new Date().getFullYear(), category: '', summary: '', description: '', dimensions: '',
  seats: 5, doors: 4, warrantyLabel: '3 anos', basePrice: 0, imageUrl: '', published: true,
  technicalSpecifications: emptyTechnical(), standardEquipment: emptyEquipment(),
});

function draftFromModel(model: VehicleModel): ModelDraft {
  return {
    ...model,
    modelCode: model.modelCode ?? '',
    dimensions: model.dimensions ?? '',
    warrantyLabel: model.warrantyLabel ?? '',
    imageUrl: model.imageUrl ?? '',
    technicalSpecifications: { ...emptyTechnical(), ...(model.technicalSpecifications ?? {}) },
    standardEquipment: { ...emptyEquipment(), ...(model.standardEquipment ?? {}) } as EquipmentMap,
  };
}

export function VehicleModelManager({ modelId }: { modelId?: string }) {
  const { user } = useAuth();
  const canManage = user?.role === 'DEALERSHIP_MANAGER' || user?.role === 'FORD_ADMIN';
  const editing = Boolean(modelId);
  const [draft, setDraft] = useState<ModelDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savedModelId, setSavedModelId] = useState('');

  useEffect(() => {
    if (!canManage || !modelId) return;
    let active = true;
    setBusy(true); setError(''); setMessage('');
    api<VehicleModel[]>('/catalog/models')
      .then((models) => {
        if (!active) return;
        const model = models.find((item) => item.id === modelId);
        if (!model) throw new Error('Veículo não encontrado.');
        setDraft(draftFromModel(model));
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o veículo.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [canManage, modelId]);

  function reset() { setDraft(emptyDraft()); setError(''); setMessage(''); setSavedModelId(''); }
  function setTechnical(key: keyof TechnicalSpecifications, value: string) {
    setDraft((current) => ({ ...current, technicalSpecifications: { ...current.technicalSpecifications, [key]: value } }));
  }
  async function uploadImage(file: File | undefined) {
    if (!file || uploadBusy) return;
    setUploadBusy(true); setError('');
    try {
      const form = new FormData(); form.append('file', file);
      const result = await api<{ url: string }>('/catalog/upload', { method: 'POST', body: form });
      setDraft((current) => ({ ...current, imageUrl: result.url })); setMessage('Foto enviada. Salve o veículo para concluir.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a foto.'); }
    finally { setUploadBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage(''); setSavedModelId('');
    try {
      const saved = await api<VehicleModel>(editing ? `/catalog/models/${modelId}` : '/catalog/models', {
        method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, slug: draft.slug || undefined }),
      });
      setSavedModelId(saved.id);
      if (editing) {
        setDraft(draftFromModel(saved));
        setMessage('Veículo atualizado. As informações principais já foram aplicadas às variações.');
      } else {
        setMessage('Veículo criado sem VIN. Agora você pode ir para a tela separada de variações.');
        setDraft(emptyDraft());
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o veículo.'); }
    finally { setBusy(false); }
  }

  if (!canManage) return null;
  const tech = draft.technicalSpecifications;
  return <article className="card operation-card catalog-manager model-manager">
    <div className="operation-heading"><div><span className="eyebrow">ETAPA 1 · FICHA-MÃE</span><h2>{editing ? 'Editar veículo' : 'Cadastrar veículo'}</h2></div>{editing ? <Link className="secondary" to="/veiculos/variacoes"><ArrowLeft size={15} />Voltar às variações</Link> : <button className="secondary" type="button" onClick={reset} disabled={busy}><Plus size={15} />Novo veículo</button>}</div>
    <div className="model-no-vin-note"><CarFront size={20} /><div><b>Nesta tela não existe VIN, placa ou estoque.</b><span>Cadastre uma vez tudo que é comum ao modelo. Cada carro físico será criado somente depois.</span></div></div>
    {error && <div className="request-status" role="alert"><p>{error}</p></div>}
    {message && <div className="catalog-success" role="status"><span>{message}</span>{savedModelId && <Link className="primary" to={`/veiculos/variacoes?modelId=${savedModelId}`}><Layers3 size={15} />Ir para variações</Link>}</div>}
    <div className="catalog-admin-layout">
      <form className="entity-form catalog-editor complete-vehicle-form" onSubmit={save}>
        <details className="vehicle-spec-section" open><summary><span>1</span><div><b>Identificação comercial</b><small>Marca, modelo, ano, categoria e valor inicial</small></div></summary><div className="vehicle-spec-content">
          <div className="form-grid form-grid-3"><label>Marca<input required value={tech.brand} onChange={(event) => setTechnical('brand', event.target.value)} placeholder="Ford" /></label><label>Nome do modelo<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Ranger" /></label><label>Categoria<input required value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Ex.: Picape média" /></label></div>
          <div className="form-grid form-grid-3"><label>Código do modelo<input value={draft.modelCode ?? ''} onChange={(event) => setDraft({ ...draft, modelCode: event.target.value })} placeholder="RNG-01" /></label><label>Ano/modelo<input required type="number" min="1900" max="2200" value={draft.modelYear} onChange={(event) => setDraft({ ...draft, modelYear: Number(event.target.value) })} /></label><label>Preço base (R$)<input required type="number" min="0" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: Number(event.target.value) })} /></label></div>
          <div className="form-grid form-grid-3"><label>Tipo de carroceria<select value={tech.bodyType} onChange={(event) => setTechnical('bodyType', event.target.value)}><option value="">Selecione</option><option>Hatch</option><option>Sedã</option><option>SUV</option><option>Picape</option><option>Van</option><option>Minivan</option><option>Cupê</option><option>Conversível</option><option>Perua</option><option>Utilitário</option></select></label><label>Geração<input value={tech.generation} onChange={(event) => setTechnical('generation', event.target.value)} placeholder="Ex.: 4ª geração" /></label><label>Plataforma<input value={tech.platform} onChange={(event) => setTechnical('platform', event.target.value)} placeholder="Ex.: T6.2" /></label></div>
          <label>País de origem/fabricação<input value={tech.countryOfOrigin} onChange={(event) => setTechnical('countryOfOrigin', event.target.value)} placeholder="Ex.: Argentina" /></label><label>Resumo<input required value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="Frase curta para identificar o veículo" /></label><label>Descrição principal<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Proposta, público e características gerais" /></label>
        </div></details>

        <details className="vehicle-spec-section" open><summary><span>2</span><div><b>Estrutura, medidas e capacidades</b><small>Ficha física que será herdada pelas variações</small></div></summary><div className="vehicle-spec-content">
          <div className="form-grid form-grid-3"><label>Comprimento (mm)<input type="number" min="0" value={tech.lengthMm} onChange={(event) => setTechnical('lengthMm', event.target.value)} /></label><label>Largura (mm)<input type="number" min="0" value={tech.widthMm} onChange={(event) => setTechnical('widthMm', event.target.value)} /></label><label>Altura (mm)<input type="number" min="0" value={tech.heightMm} onChange={(event) => setTechnical('heightMm', event.target.value)} /></label><label>Entre-eixos (mm)<input type="number" min="0" value={tech.wheelbaseMm} onChange={(event) => setTechnical('wheelbaseMm', event.target.value)} /></label><label>Vão livre do solo (mm)<input type="number" min="0" value={tech.groundClearanceMm} onChange={(event) => setTechnical('groundClearanceMm', event.target.value)} /></label><label>Peso em ordem de marcha (kg)<input type="number" min="0" value={tech.curbWeightKg} onChange={(event) => setTechnical('curbWeightKg', event.target.value)} /></label></div>
          <div className="form-grid form-grid-3"><label>Carga útil (kg)<input type="number" min="0" value={tech.payloadKg} onChange={(event) => setTechnical('payloadKg', event.target.value)} /></label><label>Capacidade de reboque (kg)<input type="number" min="0" value={tech.towingCapacityKg} onChange={(event) => setTechnical('towingCapacityKg', event.target.value)} /></label><label>Porta-malas/caçamba (L)<input type="number" min="0" value={tech.cargoVolumeLiters} onChange={(event) => setTechnical('cargoVolumeLiters', event.target.value)} /></label><label>Tanque de combustível (L)<input type="number" min="0" value={tech.fuelTankLiters} onChange={(event) => setTechnical('fuelTankLiters', event.target.value)} /></label><label>Lugares<input type="number" min="1" max="20" value={draft.seats ?? ''} onChange={(event) => setDraft({ ...draft, seats: Number(event.target.value) })} /></label><label>Portas<input type="number" min="2" max="6" value={draft.doors ?? ''} onChange={(event) => setDraft({ ...draft, doors: Number(event.target.value) })} /></label></div>
          <label>Dimensões resumidas para exibição<input value={draft.dimensions ?? ''} onChange={(event) => setDraft({ ...draft, dimensions: event.target.value })} placeholder="5,30 m × 1,95 m × 1,85 m" /></label>
        </div></details>

        <details className="vehicle-spec-section"><summary><span>3</span><div><b>Equipamentos comuns a todas as versões</b><small>Marque somente o que nunca muda neste modelo</small></div></summary><div className="vehicle-spec-content"><EquipmentSelector value={draft.standardEquipment} onChange={(standardEquipment) => setDraft({ ...draft, standardEquipment })} helper="Se um item existir apenas em algumas versões, deixe-o para a tela de variações." /></div></details>

        <details className="vehicle-spec-section" open><summary><span>4</span><div><b>Garantia, imagem e publicação</b><small>Finalização da ficha principal</small></div></summary><div className="vehicle-spec-content"><label>Garantia<input value={draft.warrantyLabel ?? ''} onChange={(event) => setDraft({ ...draft, warrantyLabel: event.target.value })} placeholder="3 anos ou 100.000 km" /></label><div className="catalog-image-upload"><label className="catalog-file-label"><span><ImagePlus size={15} />Foto principal do veículo</span><small>{uploadBusy ? 'Enviando…' : 'JPG, PNG ou WebP · até 5 MB'}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }} disabled={uploadBusy || busy} /></label>{draft.imageUrl ? <img className="catalog-image-preview" src={draft.imageUrl} alt="Prévia do veículo" /> : <div className="catalog-image-empty"><CarFront size={24} />Foto principal</div>}</div><label className="catalog-publish-toggle"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> Veículo ativo para receber novas variações</label></div></details>
        <div className="catalog-editor-actions sticky-form-actions"><button className="primary" disabled={busy}><Save size={15} />{busy ? (editing ? 'Carregando…' : 'Salvando…') : editing ? 'Salvar alterações' : 'Cadastrar veículo'}</button></div>
      </form>
    </div>
  </article>;
}
