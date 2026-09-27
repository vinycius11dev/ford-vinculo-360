import { useEffect, useState, type FormEvent } from 'react';
import { Check, Edit3, Eye, EyeOff, ImagePlus, Layers3, Plus, Save, Trash2, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../auth';
import { EquipmentSelector, emptyEquipment, type EquipmentMap } from './EquipmentSelector';

type ConfigurationDetails = {
  colorCode: string; paintType: string; upholstery: string; dashboardFinish: string;
  engineDisplacement: string; cylinders: string; aspiration: string; electrification: string;
  batteryCapacity: string; chargingTime: string; acceleration: string; topSpeed: string; emissions: string;
  wheelSize: string; tireSpec: string; suspension: string; brakes: string; steering: string;
};

type VehicleModel = {
  id: string;
  name: string;
  modelYear: number;
  category: string;
  basePrice: number;
  imageUrl: string | null;
  published: boolean;
};

type CatalogItem = {
  id: string;
  slug: string;
  modelId: string;
  version: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  additionalPrice: number;
  highlights: string | null;
  engine: string | null;
  fuelType: string | null;
  transmission: string | null;
  drive: string | null;
  power: string | null;
  torque: string | null;
  consumption: string | null;
  rangeLabel: string | null;
  imageUrl: string | null;
  stockLabel: string | null;
  sortOrder: number;
  published: boolean;
  configurationDetails: Partial<ConfigurationDetails> | null;
  equipment: Partial<EquipmentMap> | null;
  vehicleModel: VehicleModel;
};

type VariationDraft = Omit<CatalogItem, 'id' | 'slug' | 'vehicleModel'> & { slug: string; configurationDetails: ConfigurationDetails; equipment: EquipmentMap };

const emptyConfiguration = (): ConfigurationDetails => ({
  colorCode: '', paintType: '', upholstery: '', dashboardFinish: '', engineDisplacement: '', cylinders: '', aspiration: '', electrification: '',
  batteryCapacity: '', chargingTime: '', acceleration: '', topSpeed: '', emissions: '', wheelSize: '', tireSpec: '', suspension: '', brakes: '', steering: '',
});

function emptyDraft(modelId = ''): VariationDraft {
  return {
    slug: '', modelId, version: '', exteriorColor: '', interiorColor: '', additionalPrice: 0,
    highlights: '', engine: '', fuelType: '', transmission: '', drive: '', power: '', torque: '', consumption: '', rangeLabel: '',
    imageUrl: '', stockLabel: '', sortOrder: 0, published: true, configurationDetails: emptyConfiguration(), equipment: emptyEquipment(),
  };
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

export function CatalogManager() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const canManage = user?.role === 'DEALERSHIP_MANAGER' || user?.role === 'FORD_ADMIN';
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [draft, setDraft] = useState<VariationDraft>(() => emptyDraft(params.get('modelId') ?? ''));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedModel = models.find((item) => item.id === draft.modelId) ?? null;
  const config = draft.configurationDetails;

  async function load() {
    if (!canManage) return;
    setBusy(true); setError('');
    try {
      const [modelList, variationList] = await Promise.all([
        api<VehicleModel[]>('/catalog/models'),
        api<CatalogItem[]>('/catalog/admin'),
      ]);
      setModels(modelList);
      setItems(variationList);
      const requested = params.get('modelId');
      if (requested && modelList.some((model) => model.id === requested)) setDraft((current) => ({ ...current, modelId: requested }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as variações.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, [canManage]);

  function reset(modelId = draft.modelId) {
    setEditingId(null); setDraft(emptyDraft(modelId)); setMessage(''); setError('');
  }

  function setConfiguration(key: keyof ConfigurationDetails, value: string) {
    setDraft((current) => ({ ...current, configurationDetails: { ...current.configurationDetails, [key]: value } }));
  }

  function edit(item: CatalogItem) {
    setEditingId(item.id);
    setDraft({
      slug: item.slug,
      modelId: item.modelId,
      version: item.version ?? '',
      exteriorColor: item.exteriorColor ?? '',
      interiorColor: item.interiorColor ?? '',
      additionalPrice: item.additionalPrice,
      highlights: item.highlights ?? '',
      engine: item.engine ?? '',
      fuelType: item.fuelType ?? '',
      transmission: item.transmission ?? '',
      drive: item.drive ?? '',
      power: item.power ?? '',
      torque: item.torque ?? '',
      consumption: item.consumption ?? '',
      rangeLabel: item.rangeLabel ?? '',
      imageUrl: item.imageUrl ?? '',
      stockLabel: item.stockLabel ?? '',
      sortOrder: item.sortOrder,
      published: item.published,
      configurationDetails: { ...emptyConfiguration(), ...(item.configurationDetails ?? {}) },
      equipment: { ...emptyEquipment(), ...(item.equipment ?? {}) } as EquipmentMap,
    });
    setMessage(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadImage(file: File | undefined) {
    if (!file || uploadBusy) return;
    setUploadBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api<{ url: string }>('/catalog/upload', { method: 'POST', body: form });
      setDraft((current) => ({ ...current, imageUrl: result.url }));
      setMessage('Foto enviada. Salve a variação para concluir.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a foto.'); }
    finally { setUploadBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !selectedModel) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const path = editingId ? `/catalog/${editingId}` : '/catalog';
      const saved = await api<CatalogItem>(path, { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, slug: draft.slug || undefined }) });
      setItems((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setMessage(editingId ? 'Variação atualizada.' : 'Variação criada. Você já pode adicionar VINs idênticos ao estoque.');
      setEditingId(null);
      setDraft(emptyDraft(selectedModel.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a variação.'); }
    finally { setBusy(false); }
  }

  async function toggle(item: CatalogItem) {
    setBusy(true); setError('');
    try {
      const saved = await api<CatalogItem>(`/catalog/${item.id}`, { method: 'PATCH', body: JSON.stringify({ published: !item.published }) });
      setItems((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível alterar a publicação.'); }
    finally { setBusy(false); }
  }

  async function remove(item: CatalogItem) {
    if (!window.confirm(`Remover a variação “${item.version} · ${item.exteriorColor}”?`)) return;
    setBusy(true); setError('');
    try { await api(`/catalog/${item.id}`, { method: 'DELETE' }); setItems((current) => current.filter((entry) => entry.id !== item.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível remover a variação.'); }
    finally { setBusy(false); }
  }

  if (!canManage) return null;
  return <article className="card operation-card catalog-manager variation-manager" id="catalogo">
    <div className="operation-heading">
      <div><span className="eyebrow">ETAPA 2 · CONFIGURAÇÕES</span><h2>Variações do modelo</h2></div>
      <button className="secondary" type="button" onClick={() => reset()} disabled={busy}><Plus size={15} />Nova variação</button>
    </div>
    <p>Cadastre apenas o que muda e diferencia o carro: versão, conjunto mecânico, cor, acabamento, opcionais e acréscimo sobre o preço base.</p>
    {error && <div className="request-status" role="alert"><p>{error}</p></div>}
    {message && <div className="catalog-success" role="status"><span>{message}</span>{message.includes('adicionar VINs') && <Link className="primary" to="/veiculos/unidades/nova">Adicionar ao estoque</Link>}</div>}
    {!models.length && !busy && <div className="catalog-empty-callout"><div><b>Nenhum modelo principal cadastrado</b><p>Crie primeiro as informações que serão comuns a todas as variações.</p></div><Link className="primary" to="/veiculos/novo">Cadastrar modelo</Link></div>}
    {!!models.length && <div className="catalog-admin-layout">
      <form className="entity-form catalog-editor complete-variation-form" onSubmit={save}>
        <div className="variation-link-banner"><Layers3 size={20} /><div><b>Vincule a configuração ao veículo principal</b><span>Aqui entra somente o que pode mudar entre uma versão e outra. Nenhum VIN é solicitado.</span></div></div>
        <details className="vehicle-spec-section" open><summary><span>1</span><div><b>Vínculo, versão e preço</b><small>Escolha o veículo e identifique esta configuração</small></div></summary><div className="vehicle-spec-content">
          <label>Veículo principal<select required value={draft.modelId} onChange={(event) => setDraft({ ...draft, modelId: event.target.value })}><option value="">Selecione o veículo</option>{models.map((model) => <option value={model.id} key={model.id}>{model.name} · {model.modelYear}</option>)}</select></label>
          {selectedModel && <div className="variation-price-preview"><span>Preço base<b>{money(selectedModel.basePrice)}</b></span><i>+</i><span>Acréscimo<b>{money(draft.additionalPrice)}</b></span><i>=</i><span className="total">Preço desta variação<b>{money(selectedModel.basePrice + draft.additionalPrice)}</b></span></div>}
          <div className="form-grid"><label>Nome da versão<input required value={draft.version ?? ''} onChange={(event) => setDraft({ ...draft, version: event.target.value })} placeholder="Limited, XLT, Titanium..." /></label><label>Acréscimo no preço base (R$)<input required type="number" min="0" value={draft.additionalPrice} onChange={(event) => setDraft({ ...draft, additionalPrice: Number(event.target.value) })} /></label></div>
        </div></details>

        <details className="vehicle-spec-section" open><summary><span>2</span><div><b>Cores e acabamento</b><small>Crie uma configuração exata para cada combinação</small></div></summary><div className="vehicle-spec-content">
          <div className="form-grid form-grid-3"><label>Cor exterior<input required value={draft.exteriorColor ?? ''} onChange={(event) => setDraft({ ...draft, exteriorColor: event.target.value })} placeholder="Azul Belize" /></label><label>Código da cor<input value={config.colorCode} onChange={(event) => setConfiguration('colorCode', event.target.value)} placeholder="PN4GZ" /></label><label>Tipo de pintura<select value={config.paintType} onChange={(event) => setConfiguration('paintType', event.target.value)}><option value="">Selecione</option><option>Sólida</option><option>Metálica</option><option>Perolizada</option><option>Fosca</option><option>Especial</option></select></label></div>
          <div className="form-grid form-grid-3"><label>Cor interior<input required value={draft.interiorColor ?? ''} onChange={(event) => setDraft({ ...draft, interiorColor: event.target.value })} placeholder="Preto" /></label><label>Revestimento dos bancos<input value={config.upholstery} onChange={(event) => setConfiguration('upholstery', event.target.value)} placeholder="Couro preto premium" /></label><label>Acabamento do painel<input value={config.dashboardFinish} onChange={(event) => setConfiguration('dashboardFinish', event.target.value)} placeholder="Preto brilhante" /></label></div>
          <p className="variation-rule-note">Exemplo: Limited azul e Limited branca são duas configurações. Depois, cada uma pode receber centenas de VINs no estoque.</p>
        </div></details>

        <details className="vehicle-spec-section" open><summary><span>3</span><div><b>Motorização e desempenho</b><small>Conjunto mecânico que diferencia esta versão</small></div></summary><div className="vehicle-spec-content">
          <div className="form-grid form-grid-3"><label>Motor<input value={draft.engine ?? ''} onChange={(event) => setDraft({ ...draft, engine: event.target.value })} placeholder="3.0 V6 turbo" /></label><label>Cilindrada<input value={config.engineDisplacement} onChange={(event) => setConfiguration('engineDisplacement', event.target.value)} placeholder="2.993 cm³" /></label><label>Cilindros<input value={config.cylinders} onChange={(event) => setConfiguration('cylinders', event.target.value)} placeholder="6 em V" /></label><label>Aspiração<input value={config.aspiration} onChange={(event) => setConfiguration('aspiration', event.target.value)} placeholder="Turbo" /></label><label>Combustível<input value={draft.fuelType ?? ''} onChange={(event) => setDraft({ ...draft, fuelType: event.target.value })} placeholder="Diesel" /></label><label>Eletrificação<input value={config.electrification} onChange={(event) => setConfiguration('electrification', event.target.value)} placeholder="Combustão, híbrido, elétrico" /></label></div>
          <div className="form-grid form-grid-3"><label>Câmbio<input value={draft.transmission ?? ''} onChange={(event) => setDraft({ ...draft, transmission: event.target.value })} placeholder="Automático de 10 marchas" /></label><label>Tração<input value={draft.drive ?? ''} onChange={(event) => setDraft({ ...draft, drive: event.target.value })} placeholder="4x4" /></label><label>Potência<input value={draft.power ?? ''} onChange={(event) => setDraft({ ...draft, power: event.target.value })} placeholder="250 cv" /></label><label>Torque<input value={draft.torque ?? ''} onChange={(event) => setDraft({ ...draft, torque: event.target.value })} placeholder="600 Nm" /></label><label>Consumo<input value={draft.consumption ?? ''} onChange={(event) => setDraft({ ...draft, consumption: event.target.value })} placeholder="9,5 km/l" /></label><label>Autonomia<input value={draft.rangeLabel ?? ''} onChange={(event) => setDraft({ ...draft, rangeLabel: event.target.value })} placeholder="800 km" /></label></div>
          <div className="form-grid form-grid-3"><label>Bateria<input value={config.batteryCapacity} onChange={(event) => setConfiguration('batteryCapacity', event.target.value)} placeholder="Ex.: 88 kWh" /></label><label>Tempo de recarga<input value={config.chargingTime} onChange={(event) => setConfiguration('chargingTime', event.target.value)} placeholder="10% a 80% em 35 min" /></label><label>0–100 km/h<input value={config.acceleration} onChange={(event) => setConfiguration('acceleration', event.target.value)} placeholder="8,5 s" /></label><label>Velocidade máxima<input value={config.topSpeed} onChange={(event) => setConfiguration('topSpeed', event.target.value)} placeholder="180 km/h" /></label><label>Emissões<input value={config.emissions} onChange={(event) => setConfiguration('emissions', event.target.value)} placeholder="g CO₂/km" /></label></div>
        </div></details>

        <details className="vehicle-spec-section"><summary><span>4</span><div><b>Chassi, rodas e condução</b><small>Componentes que também podem mudar por versão</small></div></summary><div className="vehicle-spec-content"><div className="form-grid form-grid-3"><label>Rodas<input value={config.wheelSize} onChange={(event) => setConfiguration('wheelSize', event.target.value)} placeholder="Liga leve aro 18" /></label><label>Pneus<input value={config.tireSpec} onChange={(event) => setConfiguration('tireSpec', event.target.value)} placeholder="255/65 R18" /></label><label>Suspensão<input value={config.suspension} onChange={(event) => setConfiguration('suspension', event.target.value)} placeholder="Independente / eixo rígido" /></label><label>Freios<input value={config.brakes} onChange={(event) => setConfiguration('brakes', event.target.value)} placeholder="Discos ventilados" /></label><label>Direção<input value={config.steering} onChange={(event) => setConfiguration('steering', event.target.value)} placeholder="Elétrica progressiva" /></label></div></div></details>

        <details className="vehicle-spec-section" open><summary><span>5</span><div><b>O que esta versão possui</b><small>Segurança, conforto, tecnologia, exterior e interior</small></div></summary><div className="vehicle-spec-content"><EquipmentSelector value={draft.equipment} onChange={(equipment) => setDraft({ ...draft, equipment })} helper="Marque apenas os itens desta variação. Os equipamentos comuns já vêm da ficha do veículo principal." /><label>Pacotes, opcionais e observações<textarea value={draft.highlights ?? ''} onChange={(event) => setDraft({ ...draft, highlights: event.target.value })} placeholder="Pacote tecnologia · Kit reboque · Observações comerciais" /></label></div></details>

        <details className="vehicle-spec-section" open><summary><span>6</span><div><b>Imagem e disponibilidade</b><small>Foto específica e publicação da configuração</small></div></summary><div className="vehicle-spec-content"><div className="form-grid"><label>Disponibilidade<input value={draft.stockLabel ?? ''} onChange={(event) => setDraft({ ...draft, stockLabel: event.target.value })} placeholder="Pronta entrega" /></label><label>Ordem<input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label></div><div className="catalog-image-upload"><label className="catalog-file-label"><span><ImagePlus size={15} />Foto desta cor/variação</span><small>{uploadBusy ? 'Enviando…' : 'Deixe vazio para usar a foto do veículo'}</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }} disabled={uploadBusy || busy} /></label>{draft.imageUrl ? <img className="catalog-image-preview" src={draft.imageUrl} alt="Prévia da variação" /> : <div className="catalog-image-empty">Foto do veículo</div>}</div><label className="catalog-publish-toggle"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} /> Disponível para entrada no estoque e no aplicativo</label></div></details>
        <div className="catalog-editor-actions sticky-form-actions"><button className="primary" disabled={busy}><Save size={15} />{busy ? 'Salvando…' : editingId ? 'Salvar variação' : 'Vincular variação'}</button>{editingId && <button type="button" className="secondary" onClick={() => reset()}><X size={15} />Cancelar</button>}</div>
      </form>
      <div className="catalog-admin-list">
        {!items.length && <div className="empty-row">Nenhuma variação cadastrada.</div>}
        {models.map((model) => {
          const variations = items.filter((item) => item.modelId === model.id);
          if (!variations.length) return null;
          return <section className="catalog-model-group" key={model.id}><div className="catalog-model-group-heading"><div><span>MODELO</span><strong>{model.name}</strong><small>{model.modelYear} · {variations.length} {variations.length === 1 ? 'variação' : 'variações'}</small></div><div className="catalog-model-heading-actions"><Link className="catalog-edit-model" to={`/veiculos/modelos/${model.id}/editar`}><Edit3 size={13} />Editar veículo</Link><button type="button" className="catalog-add-variation" onClick={() => reset(model.id)}><Plus size={13} />Adicionar variação</button></div></div>{variations.map((item) => <div className={`catalog-admin-row${item.published ? '' : ' is-hidden'}`} key={item.id}><div className="catalog-admin-thumb">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{model.name.slice(0, 1)}</span>}</div><div className="catalog-admin-copy"><strong>{item.version} · {item.exteriorColor}</strong><small>{item.interiorColor} · + {money(item.additionalPrice)} · total {money(model.basePrice + item.additionalPrice)}</small><p>{[item.engine, item.transmission, item.drive].filter(Boolean).join(' · ') || 'Configuração de série'}</p></div><span className={item.published ? 'catalog-status published' : 'catalog-status'}>{item.published ? <><Check size={11} />Ativa</> : <><EyeOff size={11} />Oculta</>}</span><div className="catalog-admin-actions"><button className="settings-row-action" onClick={() => void toggle(item)} aria-label={item.published ? 'Ocultar' : 'Publicar'}>{item.published ? <EyeOff size={15} /> : <Eye size={15} />}</button><button className="settings-row-action" onClick={() => edit(item)} aria-label="Editar"><Edit3 size={15} /></button><button className="settings-row-action danger-action" onClick={() => void remove(item)} aria-label="Remover"><Trash2 size={15} /></button></div></div>)}</section>;
        })}
      </div>
    </div>}
  </article>;
}
