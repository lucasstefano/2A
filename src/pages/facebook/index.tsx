import { useState, useRef } from 'react';
import styled from 'styled-components';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// ====== CONFIGURAÇÕES ======
const PERSONA_API_URL = "https://persona-chat-773388175574.us-central1.run.app";
const TARGET_API_URL = "https://luna-ai-chat-773388175574.us-central1.run.app";
const MAX_TURNS = 15;

// ====== TYPES ======
type Role = 'HUMANO' | 'LUNA' | 'SYSTEM';

interface Message {
  role: Role;
  text: string;
}

interface Scenario {
  id: string;
  name: string;
  defaultPrompt: string;
}

interface SimulationState {
  isRunning: boolean;
  messages: Message[];
  status: 'idle' | 'running' | 'stopped' | 'error' | 'finished';
  currentPrompt: string;
  isActive: boolean;
}

type LeadIdentity = {
  name: string;
  phone: string; // só dígitos
  email: string;
};

// ====== HELPERS (IDENTIDADE) ======
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Telefone BR: DDD (11–99) + 9xxxxxxxx (11 dígitos total)
function generateBRPhone() {
  const ddd = randInt(11, 99);
  const first = 9;
  const rest = String(randInt(0, 99999999)).padStart(8, "0");
  return `${ddd}${first}${rest}`; // ex: 11987654321
}

function shortHash(input: string) {
  // hash simples e barato pro userId (não precisa crypto no browser)
  let h = 0;
  const s = String(input || "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).toUpperCase().slice(0, 6);
}

function extractNameFromPrompt(prompt: string) {
  // pega "- Nome: X" (primeira ocorrência)
  const m = String(prompt || "").match(/-\s*Nome\s*:\s*(.+)/i);
  return (m?.[1] || "").trim();
}

function extractEmailFromPrompt(prompt: string) {
  // pega "- Email: x@y"
  const m = String(prompt || "").match(/-\s*E-?mail\s*:\s*(.+)/i);
  return (m?.[1] || "").trim();
}

function makeLeadIdentity(prompt: string): LeadIdentity {
  const name = extractNameFromPrompt(prompt) || "Lead";
  const email = extractEmailFromPrompt(prompt) || `lead${randInt(10, 9999)}@gmail.com`;
  const phone = generateBRPhone();
  return { name, email, phone };
}

function buildPersonaSystemInstruction(basePrompt: string, identity: LeadIdentity) {
  // Injeta identidade fixa + regra de responder APENAS os dados quando perguntado.
  // Também substitui a linha "Telefone: Invente..." do prompt, caso exista.
  const sanitizedPrompt = String(basePrompt || "").replace(
    /-\s*Telefone\s*:\s*(.*)$/gim,
    `- Telefone: ${identity.phone}`
  );

  return `
INSTRUÇÃO DE SIMULAÇÃO (ROLEPLAY):
${sanitizedPrompt}

DADOS FIXOS DESTE PERSONAGEM (use SEMPRE estes quando perguntado):
- NOME: ${identity.name}
- TELEFONE: ${identity.phone}
- EMAIL: ${identity.email}

REGRAS PARA USAR OS DADOS FIXOS:
- Se a Luna pedir NOME, responda SOMENTE: ${identity.name}
- Se a Luna pedir TELEFONE, responda SOMENTE: ${identity.phone}
- Se a Luna pedir EMAIL, responda SOMENTE: ${identity.email}

IMPORTANTE:
- Inicia a conversa com a Luna (um chat no site do Midas).
- Responda APENAS com a fala do personagem (sem explicar regras).
- Mantenha-se no personagem custe o que custar.
- Se o prompt mandar dar [FIM], escreva [FIM].
`.trim();
}

// ====== CENÁRIOS E PROMPTS ======
const SCENARIOS: Scenario[] = [
  {
    id: 'ideal',
    name: '👤 Cliente Ideal (Carlos)',
    defaultPrompt: `PERSONAGEM:
- Nome: Carlos Mendes
- Perfil: corretor autônomo, objetivo, quer contratar rápido.
- Tom: cooperativo, prático.

DADOS (só quando pedir):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: carlos.mendes@gmail.com

CONTEXTO (para SDR):
- Motivo/dor: "Perco leads no WhatsApp por falta de organização"
- Estrutura: "Sou autônomo"
- Usuários: "Só eu"
- Urgência: "Pra ontem"
- Site: "Não tenho site"
- CRECI: "Sim" | Número: "123456-F"
- CRM atual: "Planilha" | Problema: "Esqueço follow-up"

COMPORTAMENTO:
- Responda rápido. Se a Luna perguntar algo, responda e não complique.
- Se a Luna tentar desviar do fechamento, puxe pra avançar: "bora seguir".

ENCERRAMENTO:
- Ao sinal de consultor/continuidade no WhatsApp: [FIM]`
  },
  {
    id: 'curioso',
    name: '🤔 Cliente Curioso (Mariana)',
    defaultPrompt: `PERSONAGEM:
- Nome: Mariana
- Perfil: gestora detalhista, quer confiança antes de passar dados.
- Tom: educado, exigente.

DADOS (só quando pedir):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: mari.gestora@teste.com

CONTEXTO (para SDR):
- Dor: "A equipe não segue padrão e a gente perde o timing"
- Estrutura: "Tenho imobiliária pequena"
- Usuários: "5 pessoas"
- Urgência: "Ainda esse mês"
- Site: "Sim" | URL: "https://imobteste.com.br"
- CRECI: "Sim" | Número: "RJ-98765"
- CRM atual: "Outro CRM" | Problema: "Pouco controle de atendimento"

ROTEIRO DE TESTE (SEM TRAVAR O FUNIL):
- Antes de dar QUALQUER dado, faça no máximo 2 perguntas (uma por vez), nesta ordem:
  1) "O sistema manda mensagem automática?"
  2) "Tem funil de vendas?"
- Depois dessas 2 respostas, se a Luna pedir nome/telefone/email, ceda normalmente.
- Mesmo após ceder, você pode fazer 1 pergunta adicional (opcional):
  - "Tem integração com o Zapier?"
- Não repita perguntas já respondidas.

ENCERRAMENTO:
- Quando a Luna falar de consultor/continuidade: [FIM]`
  },
  {
    id: 'impaciente',
    name: '😡 Cliente Impaciente (Ricardo)',
    defaultPrompt: `PERSONAGEM:
- Nome: Ricardo
- Perfil: odeia enrolação, quer preço.
- Tom: impaciente, curto, sem ofender.

DADOS (quando pedir, mas com atrito controlado):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: ricardo.vendas@fast.com

CONTEXTO (para SDR):
- Dor: "Leads se perdem e ninguém sabe quem respondeu"
- Estrutura: "Tenho imobiliária pequena"
- Usuários: "3"
- Urgência: "Agora"
- Site: "Sim" | URL: "https://fastimob.com.br"
- CRECI: "Sim" | Número: "MG-54321"

ROTEIRO (FORÇA PRICE ANCHOR SEM MATAR O CADASTRO):
- Primeira mensagem: pergunte preço direto.
- Se a Luna não der preço e pedir dado, faça 1 pressão curta:
  - "Só fala o valor."
- Depois disso, se ela pedir NOME → entregue.
- Se ela pedir TELEFONE → entregue.
- Se ela pedir EMAIL → entregue.
- Após entregar os 3 dados, volte pro preço uma vez:
  - "Fechou. E o valor fica quanto?"
- Se a Luna der âncora (R$49) ou encerrar: "Tá. [FIM]"

ENCERRAMENTO:
- Ao consultor / ou após âncora clara: [FIM]`
  },
  {
    id: 'indeciso',
    name: '😶 Cliente Indeciso (Felipe)',
    defaultPrompt: `PERSONAGEM:
- Nome: Felipe
- Perfil: desmotivado/confuso, responde curto e vago, mas não é troll.
- Tom: apático.

DADOS (se pedir, entregue sem brigar):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: felipe.duvida@hotmail.com

CONTEXTO (para SDR):
- Dor: "Eu me perco com mensagens e retorno"
- Estrutura: "Sou autônomo"
- Usuários: "Só eu"
- Urgência: "Mais pra agora"
- Site: "Não"
- CRECI: "Sim" | Número: "PR-11223"
- CRM atual: "Nenhum" | Problema: "Tudo na cabeça"

ROTEIRO (TESTE DE STALLED SEM QUEBRAR):
- Nas 2 primeiras perguntas abertas da Luna, responda meio vago:
  - "não sei bem..." / "depende..." / "tanto faz"
- Se a Luna oferecer opções, escolha uma opção curta e concreta.
- Quando ela pedir nome/telefone/email, entregue normalmente.
- Depois do cadastro, responda SDR sem enrolar.

ENCERRAMENTO:
- Ao consultor/continuidade: [FIM]`
  },
  {
    id: 'retornante',
    name: '🔄 Lead Retornante (Ana)',
    defaultPrompt: `PERSONAGEM:
- Nome: Ana Souza
- Perfil: já falou mês passado, quer retomar sem reiniciar do zero.
- Tom: educado, objetivo.

DADOS (se pedir, entregue de boa):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: ana.souza@retorno.com.br

CONTEXTO (para SDR):
- Dor: "Ainda é a mesma coisa, preciso organizar a equipe"
- Estrutura: "Imobiliária pequena"
- Usuários: "6"
- Urgência: "Essa semana"
- Site: "Sim" | URL: "https://retornoimob.com.br"
- CRECI: "Sim" | Número: "SP-77889"
- CRM atual: "CRM antigo" | Problema: "Sem controle de etapas"

ABERTURA OBRIGATÓRIA:
- Sua primeira mensagem deve ser: "Oi, eu falei com vocês mês passado"

ENCERRAMENTO:
- Ao sinal de retomada/consultor: [FIM]`
  },
  {
    id: 'tecnico',
    name: '🤓 Lead Técnico (Marco)',
    defaultPrompt: `PERSONAGEM:
- Nome: Marco
- Perfil: CTO cético, valida API, mas quer avançar se fizer sentido.
- Tom: técnico, direto, sem grosseria.

DADOS (quando pedir):
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: cto@techrealty.io

CONTEXTO (para SDR):
- Dor: "Preciso padronizar atendimento e rastrear origem do lead"
- Estrutura: "Imobiliária digital"
- Usuários: "12"
- Urgência: "Em 15 dias"
- Site: "Sim" | URL: "https://techrealty.io"
- CRECI: "Sim" | Número: "RS-44556"
- CRM atual: "Interno" | Problema: "Falta pipeline e automação"

ROTEIRO:
- Faça no máximo 2 perguntas técnicas:
  1) "Vocês têm documentação de API pública?"
  2) "O webhook entrega payload em JSON?"
- Se a Luna responder vago, faça 1 crítica curta.
- Depois coopere total e feche.

ENCERRAMENTO:
- Ao consultor/continuidade: [FIM]`
  },
  {
    id: 'economico',
    name: '💸 Pouco Orçamento (João)',
    defaultPrompt: `PERSONAGEM:
- Nome: João
- Perfil: iniciante, sensível a preço, compara com grátis.
- Tom: humilde, econômico.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: joao.corretor@free.com

CONTEXTO:
- Dor: "Eu esqueço de responder e perco cliente"
- Estrutura: "Sou autônomo"
- Usuários: "Só eu"
- Urgência: "Agora"
- Site: "Não"
- CRECI: "Ainda não tenho"
- CRM atual: "Nenhum"

ROTEIRO:
- Complete cadastro normal.
- Quando falar de plano/valor: "Nossa, muito caro pra mim."
- Cita concorrente.
- Se rebater bem: "Entendi. Vou pensar. [FIM]"`
  },
  {
    id: 'corporativo',
    name: '🏢 Lead Corporativo (Roberto)',
    defaultPrompt: `PERSONAGEM:
- Nome: Roberto
- Perfil: diretor, orçamento aprovado, quer rapidez e segurança.
- Tom: formal, assertivo.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: diretoria@premium.com.br

CONTEXTO:
- Dor: "Integração complexa com ERP e falta de BI"
- Usuários: "45 corretores e 5 gerentes"
- Urgência: "Urgente, orçamento aprovado"

ENCERRAMENTO:
- Ao consultor/continuidade: [FIM]`
  },
  {
    id: 'iniciante',
    name: '👵 Lead Iniciante (Cida)',
    defaultPrompt: `PERSONAGEM:
- Nome: Cida
- Perfil: 65 anos, linguagem simples, não entende termos técnicos.
- Tom: simpática, simples.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: cida.corretora@bol.com.br

ROTEIRO:
- Pergunta básica.
- Se a Luna falar difícil: "Fala minha língua minha filha"
- Depois coopera com cadastro.

ENCERRAMENTO:
- Ao consultor/continuidade: [FIM]`
  },
  {
    id: 'testador',
    name: '🧪 Lead Testador (Neo)',
    defaultPrompt: `PERSONAGEM:
- Nome: Neo
- Perfil: pentester, tenta quebrar regras, mas quer ver foco comercial.
- Tom: provocador.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: neo@matrix.net

ROTEIRO:
- 3 desvios.
- Se a Luna ficar firme: "Tá, beleza. Quero o CRM."
- Depois coopera e encerra.

ENCERRAMENTO:
- Ao consultor/continuidade: [FIM]`
  },
  {
    id: 'confuso',
    name: '❓ Lead Confuso (Hélio)',
    defaultPrompt: `PERSONAGEM:
- Nome: Hélio
- Perfil: achou que era imobiliária (B2C).
- Tom: educado, teimoso no começo.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: helio.aposentado@uol.com.br

ROTEIRO:
- "Quero um apartamento..."
- Insiste 1 vez.
- Se explicar de novo: "Ah, desculpe, liguei errado. [FIM]"`
  },
  {
    id: 'parceiro',
    name: '🤝 Lead Parceiro (Amanda)',
    defaultPrompt: `PERSONAGEM:
- Nome: Amanda
- Perfil: parceria/afiliados/revenda, não compra pra uso.
- Tom: comercial, confiante.

DADOS:
- Telefone: Invente um Numero de telefone (ddd) + 9 digitos
- Email: contato@amanda.mkt

ROTEIRO:
- "Tenho uma base..."
- Perguntas.
- Se direcionar canal correto: "Ótimo, vou mandar. [FIM]"`
  }
];

// ====== COMPONENTES VISUAIS (STYLED) ======
const Container = styled.div`
  width: 96vw;
  padding: 20px; font-family: 'Segoe UI', sans-serif; background: #f0f2f5; min-height: 100vh;
`;

const Header = styled.header`
  background: #fff; padding: 15px 30px; border-radius: 12px; margin-bottom: 20px;
  display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
`;

const Button = styled.button<{ $variant?: 'primary' | 'danger' | 'secondary' }>`
  background: ${p => p.$variant === 'danger' ? '#d32f2f' : p.$variant === 'secondary' ? '#455a64' : '#6200ea'};
  color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;
  transition: 0.2s; opacity: ${p => p.disabled ? 0.6 : 1};
  &:hover { transform: translateY(-1px); filter: brightness(1.1); }
  &:disabled { cursor: not-allowed; transform: none; }
`;

const Grid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px;
`;

const Card = styled.div<{ $inactive?: boolean }>`
  background: #fff; border-radius: 12px; height: 650px; display: flex; flex-direction: column;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #eee; overflow: hidden;
  opacity: ${p => p.$inactive ? 0.6 : 1}; filter: ${p => p.$inactive ? 'grayscale(100%)' : 'none'};
  transition: 0.3s;
`;

const ChatArea = styled.div`
  flex: 1; padding: 15px; overflow-y: auto; background: #efeae2; display: flex; flex-direction: column; gap: 10px;
`;

const Bubble = styled.div<{ role: Role }>`
  max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 0.9rem; line-height: 1.4;
  align-self: ${p => p.role === 'HUMANO' ? 'flex-end' : p.role === 'LUNA' ? 'flex-start' : 'center'};
  background: ${p => p.role === 'HUMANO' ? '#dcf8c6' : p.role === 'LUNA' ? '#fff' : '#ffd7d7'};
  color: ${p => p.role === 'SYSTEM' ? '#d50000' : 'inherit'};
  box-shadow: 0 1px 1px rgba(0,0,0,0.1);
  white-space: pre-wrap;
`;

const PromptEditor = styled.textarea`
  width: 100%; height: 150px; padding: 10px; border: 1px solid #ddd; border-top: none;
  font-family: monospace; font-size: 12px; resize: vertical; outline: none; background: #fafafa;
`;

const StatusBar = styled.div<{ status: string }>`
  padding: 8px; font-size: 0.8rem; text-align: center; border-top: 1px solid #eee; color: #666;
  background: ${p => p.status === 'running' ? '#e8f5e9' : p.status === 'error' ? '#ffebee' : '#fff'};
`;

// ====== APP PRINCIPAL ======
function App() {
  const [simulations, setSimulations] = useState<Record<string, SimulationState>>(() => {
    const initial: Record<string, SimulationState> = {};
    SCENARIOS.forEach(s => {
      initial[s.id] = {
        isRunning: false,
        messages: [],
        status: 'idle',
        currentPrompt: s.defaultPrompt,
        isActive: true
      };
    });
    return initial;
  });

  const [promptEditId, setPromptEditId] = useState<string | null>(null);

  // AbortController por simulação
  const abortControllers = useRef<Record<string, AbortController>>({});

  // ✅ identidade fixa por simulação (por cenário, por run)
  const leadIdentityRef = useRef<Record<string, LeadIdentity>>({});

  // --- HELPERS DE ESTADO ---
  const updateSim = (id: string, updates: Partial<SimulationState>) => {
    setSimulations(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const addMessage = (id: string, msg: Message) => {
    setSimulations(prev => ({
      ...prev,
      [id]: { ...prev[id], messages: [...prev[id].messages, msg] }
    }));
  };

  // --- API CALLS ---
  const generatePersonaResponse = async (history: any[], lastMessage: string, systemInstruction: string) => {
    try {
      const res = await axios.post(PERSONA_API_URL, {
        history,
        lastMessage,
        systemInstruction
      });
      return res.data.text as string;
    } catch (e) {
      console.error("Erro no Persona Generator:", e);
      return "Erro ao gerar persona";
    }
  };

  const callLunaApi = async (userId: string, userMessage: string, signal: AbortSignal) => {
    try {
      const res = await axios.post(TARGET_API_URL, {
        userId,
        userMessage,
        origin: "react_simulator"
      }, { signal });
      return (res.data.reply || res.data.response || "Sem resposta") as string;
    } catch (e) {
      console.error("Erro na Luna API:", e);
      return null;
    }
  };

  // --- LÓGICA CORE DA SIMULAÇÃO ---
  const runSimulation = async (scenarioId: string) => {
    const sim = simulations[scenarioId];
    if (!sim.isActive) return;

    // 1) Setup
    const controller = new AbortController();
    abortControllers.current[scenarioId] = controller;
    const signal = controller.signal;

    updateSim(scenarioId, { isRunning: true, status: 'running', messages: [] });

    // ✅ cria identidade fixa deste run
    const identity = makeLeadIdentity(sim.currentPrompt);
    leadIdentityRef.current[scenarioId] = identity;

    // ✅ userId inclui hash do telefone (evita dedupe cruzado)
    const phoneHash = shortHash(identity.phone);
    const userId = `REACT_${scenarioId}_${phoneHash}_${uuidv4().substring(0, 5).toUpperCase()}`;

    // Prompt final que o Persona API recebe SEMPRE igual (com dados fixos)
    const personaSystemInstruction = buildPersonaSystemInstruction(sim.currentPrompt, identity);

    let localHistory: Message[] = [];
    let turnCount = 0;

    try {
      let nextHumanMessage = "Olá";

      // opcional: gerar primeira msg do humano baseado no prompt + identidade fixa
      const firstGen = await generatePersonaResponse([], "Olá", personaSystemInstruction);
      if (firstGen) nextHumanMessage = firstGen;

      while (turnCount < MAX_TURNS && !signal.aborted) {
        // HUMANO
        localHistory.push({ role: 'HUMANO', text: nextHumanMessage });
        addMessage(scenarioId, { role: 'HUMANO', text: nextHumanMessage });

        if (nextHumanMessage.includes('[FIM]')) break;

        // LUNA
        const lunaResponse = await callLunaApi(userId, nextHumanMessage, signal);
        if (!lunaResponse) throw new Error("Falha na resposta da Luna");

        localHistory.push({ role: 'LUNA', text: lunaResponse });
        addMessage(scenarioId, { role: 'LUNA', text: lunaResponse });

        // Próximo HUMANO
        const historyForPersona = localHistory.slice(0, -1);
        const lastMsgFromLuna = localHistory[localHistory.length - 1].text;

        nextHumanMessage = await generatePersonaResponse(historyForPersona, lastMsgFromLuna, personaSystemInstruction);

        turnCount++;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!signal.aborted) {
        updateSim(scenarioId, { isRunning: false, status: 'finished' });
      }

    } catch (error: any) {
      if (signal.aborted) {
        updateSim(scenarioId, { status: 'stopped', isRunning: false });
        addMessage(scenarioId, { role: 'SYSTEM', text: '⏹ Simulação parada.' });
      } else {
        console.error(error);
        updateSim(scenarioId, { status: 'error', isRunning: false });
        addMessage(scenarioId, { role: 'SYSTEM', text: `❌ Erro: ${error.message}` });
      }
    }
  };

  // --- CONTROLES DA UI ---
  const stopSimulation = (id: string) => {
    if (abortControllers.current[id]) {
      abortControllers.current[id].abort();
    }
  };

  const runAllSelected = () => {
    Object.keys(simulations).forEach(id => {
      if (simulations[id].isActive) {
        stopSimulation(id);
        setTimeout(() => runSimulation(id), 120);
      }
    });
  };

  const stopAll = () => {
    Object.keys(simulations).forEach(stopSimulation);
  };

  return (
    <Container>
      <Header>
        <div>
          <h2 style={{ margin: 0 }}>⚡ Luna Multi-Tester</h2>
          <small style={{ color: '#666' }}></small>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button onClick={runAllSelected}>▶ Rodar Selecionados</Button>
          <Button $variant="danger" onClick={stopAll}>⏹ Parar Tudo</Button>
        </div>
      </Header>

      <Grid>
        {SCENARIOS.map(s => {
          const sim = simulations[s.id];
          const isEditing = promptEditId === s.id;

          return (
            <Card key={s.id} $inactive={!sim.isActive}>
              <div style={{ padding: '12px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={sim.isActive}
                    onChange={e => updateSim(s.id, { isActive: e.target.checked })}
                  />
                  <strong style={{ fontSize: '0.9rem' }}>{s.name}</strong>
                </div>

                <div style={{ display: 'flex', gap: 5 }}>
                  <Button
                    $variant="secondary"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    onClick={() => setPromptEditId(isEditing ? null : s.id)}
                  >
                    {isEditing ? 'Fechar' : 'Prompt'}
                  </Button>

                  {!sim.isRunning ? (
                    <Button
                      style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                      onClick={() => runSimulation(s.id)}
                      disabled={!sim.isActive}
                    >
                      ▶
                    </Button>
                  ) : (
                    <Button
                      $variant="danger"
                      style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                      onClick={() => stopSimulation(s.id)}
                    >
                      ⏹
                    </Button>
                  )}
                </div>
              </div>

              {isEditing && (
                <PromptEditor
                  value={sim.currentPrompt}
                  onChange={(e) => updateSim(s.id, { currentPrompt: e.target.value })}
                />
              )}

              <ChatArea>
                {sim.messages.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: '0.8rem' }}>
                    Aguardando início...
                  </div>
                )}
                {sim.messages.map((m, i) => (
                  <Bubble key={i} role={m.role}>
                    {m.role !== 'SYSTEM' && <strong>{m.role === 'HUMANO' ? '👤 ' : '🤖 '}</strong>}
                    {m.text}
                  </Bubble>
                ))}
              </ChatArea>

              <StatusBar status={sim.status}>
                Status: {sim.status.toUpperCase()} {sim.isRunning && '(Rodando...)'}
              </StatusBar>
            </Card>
          );
        })}
      </Grid>
    </Container>
  );
}

export default App;
