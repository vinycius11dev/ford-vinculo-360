import { CheckSquare2 } from 'lucide-react';

export type EquipmentMap = {
  safety: string[];
  comfort: string[];
  technology: string[];
  exterior: string[];
  interior: string[];
  other: string[];
};

export const emptyEquipment = (): EquipmentMap => ({
  safety: [], comfort: [], technology: [], exterior: [], interior: [], other: [],
});

const groups: Array<{ key: Exclude<keyof EquipmentMap, 'other'>; label: string; options: string[] }> = [
  { key: 'safety', label: 'Segurança e assistência', options: ['Airbags frontais', 'Airbags laterais', 'Airbags de cortina', 'Freios ABS com EBD', 'Controle de estabilidade', 'Controle de tração', 'Assistente de partida em rampa', 'Controle de descida', 'Frenagem autônoma de emergência', 'Piloto automático adaptativo', 'Alerta de colisão', 'Alerta e permanência em faixa', 'Monitor de ponto cego', 'Alerta de tráfego cruzado', 'Leitor de placas', 'Sensor de fadiga', 'Sensores de estacionamento', 'Câmera de ré', 'Câmera 360°', 'Monitoramento de pneus', 'ISOFIX', 'Alarme e imobilizador'] },
  { key: 'comfort', label: 'Conforto e conveniência', options: ['Ar-condicionado', 'Ar-condicionado digital', 'Climatização de duas zonas', 'Banco do motorista elétrico', 'Bancos dianteiros elétricos', 'Bancos aquecidos', 'Bancos ventilados', 'Memória dos bancos', 'Teto solar', 'Teto panorâmico', 'Chave presencial', 'Partida por botão', 'Partida remota', 'Porta-malas elétrico', 'Retrovisor eletrocrômico', 'Sensor de chuva', 'Acendimento automático dos faróis', 'Vidros elétricos', 'Retrovisores elétricos e rebatíveis', 'Piloto automático', 'Limitador de velocidade'] },
  { key: 'technology', label: 'Tecnologia e conectividade', options: ['Central multimídia', 'Apple CarPlay', 'Android Auto', 'Conexão sem fio para smartphone', 'Painel digital', 'Head-up display', 'Navegação GPS', 'Comandos de voz', 'Carregador por indução', 'Portas USB-C', 'Wi-Fi embarcado', 'Aplicativo conectado', 'Atualizações remotas OTA', 'Som premium', 'Bluetooth', 'Computador de bordo', 'Câmera interna', 'Assistente de estacionamento automático'] },
  { key: 'exterior', label: 'Exterior e utilidade', options: ['Faróis em LED', 'Luzes diurnas em LED', 'Farol alto automático', 'Faróis de neblina', 'Rodas de liga leve', 'Rack de teto', 'Estribos laterais', 'Engate para reboque', 'Protetor de caçamba', 'Capota marítima', 'Santo-antônio', 'Bagageiro de teto', 'Aerofólio', 'Retrovisores com aquecimento', 'Limpador traseiro', 'Tampa traseira com abertura elétrica'] },
  { key: 'interior', label: 'Interior e acabamento', options: ['Bancos em tecido', 'Bancos em couro', 'Bancos em material sintético', 'Volante revestido', 'Volante multifuncional', 'Ajuste de altura e profundidade do volante', 'Iluminação ambiente', 'Apoio de braço central', 'Saída de ar traseira', 'Banco traseiro rebatível', 'Paddle shifts', 'Tapetes de carpete', 'Tapetes de borracha', 'Revestimento premium do painel', 'Porta-objetos refrigerado'] },
];

function normalize(value?: Partial<EquipmentMap> | null): EquipmentMap {
  const blank = emptyEquipment();
  for (const key of Object.keys(blank) as Array<keyof EquipmentMap>) {
    blank[key] = Array.isArray(value?.[key]) ? value[key]!.filter((item): item is string => typeof item === 'string') : [];
  }
  return blank;
}

export function EquipmentSelector({ value, onChange, helper }: { value?: Partial<EquipmentMap> | null; onChange: (value: EquipmentMap) => void; helper?: string }) {
  const current = normalize(value);
  const selectedCount = Object.values(current).reduce((total, entries) => total + entries.length, 0);

  function toggle(group: Exclude<keyof EquipmentMap, 'other'>, item: string) {
    const selected = current[group];
    onChange({ ...current, [group]: selected.includes(item) ? selected.filter((entry) => entry !== item) : [...selected, item] });
  }

  return <div className="equipment-selector">
    <div className="equipment-selector-heading"><span><CheckSquare2 size={17} /><b>Marque o que este carro possui</b></span><em>{selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}</em></div>
    {helper && <p>{helper}</p>}
    <div className="equipment-groups">
      {groups.map((group) => <section key={group.key} className="equipment-group">
        <h4>{group.label}</h4>
        <div>{group.options.map((option) => <label className={current[group.key].includes(option) ? 'is-selected' : ''} key={option}><input type="checkbox" checked={current[group.key].includes(option)} onChange={() => toggle(group.key, option)} /><span>{option}</span></label>)}</div>
      </section>)}
    </div>
    <label className="equipment-other">Outros itens não listados<textarea value={current.other.join('\n')} onChange={(event) => onChange({ ...current, other: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="Digite um item por linha" /></label>
  </div>;
}
