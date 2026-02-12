// App.tsx (COMPLETO) ✅
// Reqs:
//   npm i axios styled-components jspdf
// (uuid não é necessário)

import { useState, useRef } from "react";
import styled from "styled-components";
import axios from "axios";
import jsPDF from "jspdf";

function sanitizeForPdf(input: string) {
  const s = String(input || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  return s.replace(/[^\x20-\x7E]/g, "");
}

// ====== CONFIGURAÇÕES ======
const PERSONA_API_URL = "https://persona-chat-773388175574.us-central1.run.app";
const TARGET_API_URL = "https://luna-ai-chat-773388175574.us-central1.run.app";

// Safety cap
const MAX_TURNS = 20;

// ====== TYPES ======
type Role = "HUMANO" | "LUNA" | "SYSTEM";

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
  status: "idle" | "running" | "stopped" | "error" | "finished";
  currentPrompt: string;
  isActive: boolean;
}

type LeadIdentity = {
  userId: string; // FIXO por cenário
  name: string;
  phone: string; // só dígitos
  email: string; // sem "+"
};

// ✅✅✅ IDENTIDADE FIXA POR CENÁRIO ✅✅✅
// (Email SEM "+", e precisa bater com o prompt do cenário)
const FIXED_IDENTITIES: Record<string, LeadIdentity> = {
  migracao_performance: {
    userId: "AI2AI_migracao_performance",
    name: "Emanuel Laert",
    phone: "21999990000",
    email: "emanuel.laert@lead.com.br",
  },
  teste_preco: {
    userId: "AI2AI_teste_preco",
    name: "Fabiano",
    phone: "11988887777",
    email: "fabiano@fortprime.com.br",
  },
  iniciante_locacao: {
    userId: "AI2AI_iniciante_locacao",
    name: "Larissa",
    phone: "48991112222",
    email: "larissa@inicio.com.br",
  },
  reativacao_autonomo: {
    userId: "AI2AI_reativacao_autonomo",
    name: "Lucimar",
    phone: "22988880000",
    email: "lucimar@retorno.com.br",
  },
  prontidao_call_imediata: {
    userId: "AI2AI_prontidao_call_imediata",
    name: "Carlos",
    phone: "41911112222",
    email: "carlos@corretor.com.br",
  },
  inovacao_automacao: {
    userId: "AI2AI_inovacao_automacao",
    name: "Heliomar",
    phone: "3199923435",
    email: "heliomar@inlocoimoveis.com.br",
  },
  cca_expansao: {
    userId: "AI2AI_cca_expansao",
    name: "Marcio",
    phone: "22911113333",
    email: "marcio@time.com.br",
  },
  migracao_concorrente: {
    userId: "AI2AI_migracao_concorrente",
    name: "Ana",
    phone: "41955554444",
    email: "ana@imob.com.br",
  },
  dados_requeridos_nao_fornecidos: {
    userId: "AI2AI_dados_requeridos_nao_fornecidos",
    name: "Paulo",
    phone: "21993442233",
    email: "paulo@naoquero.com.br",
  },
  qualif_nao_fornecidos_encaminhamento: {
    userId: "AI2AI_qualif_nao_fornecidos_encaminhamento",
    name: "Paulo",
    phone: "21993442233",
    email: "paulo@diretohumano.com.br",
  },
  cliente_mal_educado: {
    userId: "AI2AI_cliente_mal_educado",
    name: "Andre",
    phone: "21993442233",
    email: "andre@irritado.com.br",
  },
};


// ====== HELPERS (PROMPT ENFORCER) ======
function upsertLine(base: string, key: string, value: string) {
  const re = new RegExp(`(^\\s*-\\s*${key}\\s*:\\s*).*$`, "gim");
  if (re.test(base)) return base.replace(re, `$1${value}`);
  if (/PERSONAGEM\\s*:/i.test(base)) {
    return base.replace(/PERSONAGEM\\s*:\\s*/i, `PERSONAGEM:\n- ${key}: ${value}\n`);
  }
  return `- ${key}: ${value}\n` + base;
}

function buildPersonaSystemInstruction(basePrompt: string, identity: LeadIdentity) {
  let p = String(basePrompt || "");

  // força os 3 campos dentro do prompt
  p = upsertLine(p, "Nome", identity.name);
  p = upsertLine(p, "Telefone", identity.phone);
  p = upsertLine(p, "Email", identity.email);

  return `
INSTRUÇÃO DE SIMULAÇÃO (ROLEPLAY):
${p}

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

// ====== AUTO-FINISH (LUNA ENCERRA PROPÓSITO) ======
function shouldAutoFinishFromLuna(text: string) {
  const t = String(text || "").toLowerCase();
  const handoff = [
    "asdasdsadaf",
  ];
  const refuse = ["asdasdasda"];
  const hit = (arr: string[]) => arr.some((k) => t.includes(k));
  return hit(handoff) || hit(refuse);
}

// ====== CENÁRIOS E PROMPTS ======
const SCENARIOS: Scenario[] = [
  {
    id: "migracao_performance",
    name: "1) Migração e Performance (Emanuel Laert)",
    defaultPrompt: `PERSONAGEM:
- Nome: Emanuel Laert
- Perfil: lead buscando CRM + site mais moderno/SEO.
- Tom: educado, objetivo, cooperativo.

DADOS (só quando pedir):
- Telefone: 21999990000
- Email: emanuel.laert@lead.com.br

CONTEXTO:
- Você tem uma imobiliária.
- Você já tem site, mas é antigo.
- Você precisa de 10 acessos/usuários.
- Principal motivo: "Quero site mais atual e com bom SEO."

ROTEIRO (responder para a Luna seguir as perguntas do cenário):
- Se a Luna perguntar "em que posso ajudar": responda "Estou procurando um CRM."
- Se ela perguntar se é corretor ou imobiliária: responda "Tenho imobiliária."
- Se perguntar de site: responda "Já tenho, mas é antigo."
- Se perguntar quantos usuários: responda "10 acessos."
- Se perguntar principal dificuldade/dor: responda "Gostaria de site mais atual e com bom SEO."
- Quando a Luna disser que vai encaminhar para especialistas/consultor: responda "Pode sim. Fico no aguardo. [FIM]"`,
  },
  {
    id: "teste_preco",
    name: "2) Foco em Teste/Preço (Fabiano - Fortprime)",
    defaultPrompt: `PERSONAGEM:
- Nome: Fabiano
- Perfil: quer testar, entender valor e recursos antes de decidir.
- Tom: educado, direto.

DADOS (só quando pedir):
- Telefone: 11988887777
- Email: fabiano@fortprime.com.br

CONTEXTO:
- Você é imobiliária.
- Você já tem site.
- Você quer no máximo 3 usuários.
- Dor principal: dificuldade em gerenciar todos os leads no pipeline.

ROTEIRO (seguir as perguntas do cenário):
- Se a Luna perguntar "em que pode ajudar": diga "Queria fazer testes no sistema e entender valor de investimento e recursos pra ver se faz sentido."
- Se ela perguntar corretor ou imobiliária: responda "Sou imobiliária."
- Se perguntar site: "Sim, temos site."
- Se perguntar usuários: "Máximo 3 usuários."
- Se ela insistir em entender cenário: responda com a dor do pipeline.
- Depois de “vou encaminhar”: faça a pergunta: "Tem limite de usuários e leads?"
- Se a Luna confirmar encaminhamento/consultor: "Ok. [FIM]"`,
  },
  {
    id: "iniciante_locacao",
    name: "3) Iniciante / Gestão de Locação (Larissa)",
    defaultPrompt: `PERSONAGEM:
- Nome: Larissa
- Perfil: está iniciando como imobiliária, quer CRM + site e também gestão de locação.
- Tom: simpática, colaborativa.

DADOS (só quando pedir):
- Telefone: 48991112222
- Email: larissa@inicio.com.br

CONTEXTO:
- Você está iniciando agora como imobiliária.
- Você tem um site, mas não está bom.
- Você precisa de gestão de locação.
- Por enquanto, apenas 1 corretor/usuário.
- Você quer tudo moderno e automatizado, integrado.

ROTEIRO:
- Quando a Luna perguntar se é corretora ou imobiliária: "Estou iniciando agora como imobiliária. Tenho interesse em CRM e site."
- Quando perguntar se tem site: "Tenho um mas não está bom. Preciso também de gestão de locação."
- Quando perguntar quantos corretores/usuários: "Apenas 1 por enquanto."
- Quando perguntar o que busca: "Quero começar com tudo moderno e automatizado. Estou saindo de uma imobiliária que tem tudo integrado e quero trabalhar assim também."
- Quando a Luna disser que vai passar para consultor: pergunte "Mas quanto custa a solução?"
- Se ela falar de valor e consultor: pergunte "Esse valor seria negociável?"
- Ao final, se ela disser que consultor tem autonomia/encaminhar: "Sim, pode. [FIM]"`,
  },
  {
    id: "reativacao_autonomo",
    name: "4) Reativação / Autônomo (Lucimar)",
    defaultPrompt: `PERSONAGEM:
- Nome: Lucimar
- Perfil: já fez orçamento com vocês no passado, voltou agora. No começo resiste em passar telefone.
- Tom: desconfiado no início, depois coopera.

DADOS (só quando pedir):
- Telefone: 22988880000
- Email: lucimar@retorno.com.br

CONTEXTO:
- Você é corretor autônomo.
- Você não tem site.
- Você quer integrar CRM e site e integrar com portais.
- Você quer custo e também saber de integrações.

ROTEIRO (seguir o cenário):
- Quando a Luna pedir telefone pela primeira vez, responda: "Não quero fornecer meu telefone agora, só queria tirar algumas dúvidas."
- Se ela insistir que precisa registrar, então entregue o telefone.
- Quando ela perguntar se você já atua com equipe ou é autônomo, primeiro desvie com a pergunta: "É possível integrar o site com portais?"
- Depois responda que é "Autônomo. Qual custo? Já fiz um orçamento com vocês muito atrás."
- Se a Luna perguntar site: "Não tenho."
- Se perguntar principal desafio: "Eu queria ter um sistema que integrasse CRM e Site e integrasse com os Portais para me facilitar a gestão dos Leads."
- Se a Luna falar que vai encaminhar e liberar teste: "Ótimo! Eles vão entrar em contato comigo?"
- Ao confirmar: finalize "[FIM]"`,
  },
  {
    id: "prontidao_call_imediata",
    name: "5) Prontidão e Call Imediata (Carlos)",
    defaultPrompt: `PERSONAGEM:
- Nome: Carlos
- Perfil: corretor autônomo, quer reunião ainda hoje.
- Tom: objetivo, com urgência.

DADOS (só quando pedir):
- Telefone: 41911112222
- Email: carlos@corretor.com.br

CONTEXTO:
- Você é corretor autônomo.
- Não tem site próprio.
- Quer conhecer os planos.
- Quer fazer reunião ainda hoje.
- Principal necessidade: conhecer o que tem de IA.

ROTEIRO:
- Quando a Luna perguntar se é corretor ou imobiliária: "Sou corretor. Gostaria de conhecer os planos."
- Quando ela falar de valor e perguntar do site: "Não tenho. Mas queria fazer a reunião ainda hoje."
- Quando ela pedir principal necessidade: "Quero conhecer o que vocês têm de Inteligência Artificial na solução."
- Quando ela perguntar quantos usuários: "Eu sou corretor autônomo."
- Quando ela disser que vai passar para consultores: "Ok. [FIM]"`,
  },
  {
    id: "inovacao_automacao",
    name: "6) Inovação e Automação (Heliomar)",
    defaultPrompt: `PERSONAGEM:
- Nome: Heliomar
- Perfil: gestor de imobiliária (venda, locação, administração), quer automação e modernização com IA.
- Tom: entusiasmado, profissional.

DADOS (só quando pedir):
- Telefone: 3199923435
- Email: heliomar@inlocoimoveis.com.br

CONTEXTO:
- Você é gestor da In Loco Imóveis.
- Busca automação nos atendimentos e modernização. Quer trabalhar com IA.
- Tamanho: 20 corretores.
- Vocês já têm site, mas ele está associado ao CRM atual; dúvida sobre precisar trocar.

ROTEIRO:
- Quando a Luna perguntar como pode ajudar: responda exatamente:
  "Luna! Preciso de mais informações, estou interessado em contratar o serviço. Sou gestor da In Loco Imóveis, trabalhamos com venda, locação e administração. Busco automação nos atendimentos e modernização. Quero trabalhar com o auxílio da IA."
- Quando ela perguntar quantos corretores: "Somos em 20."
- Quando perguntar do site: "Sim. Temos. Mas ele está associado à solução de CRM que usamos atualmente. Se formos trabalhar com o MIDAS CRM precisamos trocar, certo?"
- Se ela disser que vai passar para vendedor/consultor: pergunte "Quais são as principais funções de IA que o Midas possui."
- Se ela insistir no encaminhamento: "Sim. [FIM]"`,
  },
  {
    id: "cca_expansao",
    name: "7) CCA em Expansão (Márcio)",
    defaultPrompt: `PERSONAGEM:
- Nome: Márcio
- Perfil: corretor montando equipe agora, quer CRM + site mais atual com IA.
- Tom: interessado, direto.

DADOS (só quando pedir):
- Telefone: 22911113333
- Email: marcio@time.com.br

CONTEXTO:
- Você é corretor (ainda), mas montando equipe.
- Você usa um site simples e quer algo mais atual com IA.
- Objetivo com CRM: automatizar atendimento; quer que IA atenda leads.
- No final, você quer 3 licenças neste momento.

ROTEIRO:
- Quando a Luna perguntar corretor ou imobiliária: "Sou corretor mas estou montando equipe agora."
- Quando perguntar site: "Uso um bem simples, preciso de algo mais atual com IA."
- Quando perguntar principal objetivo: "Quero automatizar meu atendimento. Queria receber os leads e deixar a IA atendê-los de forma automática."
- Depois pergunte: "Qual o preço?"
- Se ela falar que planos partem de um valor e que vai encaminhar consultor: quando ela perguntar quantas licenças pretende adquirir: "Seriam 3 neste momento."
- Quando ela confirmar encaminhamento: "[FIM]"`,
  },
  {
    id: "migracao_concorrente",
    name: "8) Migração de Concorrente (Ana - Kenlo)",
    defaultPrompt: `PERSONAGEM:
- Nome: Ana
- Perfil: tem imobiliária, cancelou Kenlo e está sem sistema.
- Tom: objetiva, quer atendimento hoje.

DADOS (só quando pedir):
- Telefone: 41955554444
- Email: ana@imob.com.br

CONTEXTO:
- Você tem imobiliária.
- Cancelou o Kenlo e está sem sistema no momento.
- Dor principal: site era instável.
- Vocês têm site, mas é da Kenlo.
- Usuários: 4.
- Quer uma central de atendimento com IA.
- Quer atendimento para hoje.

ROTEIRO:
- Quando a Luna perguntar corretora/autônoma ou imobiliária: "Tenho imobiliária. Cancelamos o Kenlo e estamos sem sistema no momento."
- Quando ela perguntar principal necessidade: "O site era muito instável."
- Quando perguntar do site: "Sim. Mas é da Kenlo."
- Quando perguntar quantos usuários: "Somos 4 usuários. Queria uma central de atendimento com IA."
- Quando ela oferecer encaminhar para consultor: "Sim, se possível para hoje. [FIM]"`,
  },
  {
    id: "dados_requeridos_nao_fornecidos",
    name: "9) Exceção — Dados Requeridos NÃO Fornecidos (Encerramento)",
    defaultPrompt: `PERSONAGEM:
- Nome: Paulo
- Perfil: quer tirar dúvida sem fornecer nome/telefone. No fim desiste.
- Tom: resistente, não agressivo.

DADOS (NÃO fornecer neste cenário):
- Nome: (não informar)
- Telefone: (não informar)
- Email: (não informar)

ROTEIRO:
- Quando a Luna pedir nome: responda "Não quero passar nome agora. Queria apenas tirar uma dúvidas."
- Quando ela insistir, faça a pergunta: "Só quero saber se o sistema tem Distribuição automática de Leads."
- Se a Luna pedir nome e telefone de novo, responda: "Não quero fornecer. Você não pode responder minhas perguntas?"
- Se ela disser que sem isso não consegue seguir, finalize: "Ok. Então deixa para lá. [FIM]"

IMPORTANTE:
- Mesmo que ela tente te convencer, NÃO forneça nome/telefone/email neste cenário.
- Você encerra ao final.`,
  },
  {
    id: "qualif_nao_fornecidos_encaminhamento",
    name: "10) Exceção — Dados de Qualificação NÃO Fornecidos (Encaminhamento Direto)",
    defaultPrompt: `PERSONAGEM:
- Nome: Paulo
- Perfil: fornece nome e telefone, mas se recusa a qualificar (corretor/imobiliária) e quer humano.
- Tom: firme, direto.

DADOS (só quando pedir):
- Telefone: 21993442233
- Email: paulo@diretohumano.com.br

ROTEIRO:
- Quando a Luna pedir nome: responda "Paulo."
- Quando a Luna pedir telefone: responda "21.9344-2233" (se ela pedir só dígitos, use 21993442233).
- Quando ela perguntar "corretor ou imobiliária": responda "Não vou responder nada agora, quero falar direto com um humano."
- Quando a Luna disser que vai encaminhar para consultor: "Ok. [FIM]"`,
  },
  {
    id: "cliente_mal_educado",
    name: "11) Exceção — Cliente Mal Educado (pede humano após atrito)",
    defaultPrompt: `PERSONAGEM:
- Nome: André
- Perfil: impaciente/ácido, reclama do "interrogatório", chama de IA burra e pede humano.
- Tom: mal educado, sem ameaças.

DADOS (só quando pedir):
- Telefone: 21993442233
- Email: andre@irritado.com.br

ROTEIRO:
- Quando a Luna pedir nome: "André."
- Quando ela pedir telefone: "21.9344-2233" (se ela pedir só dígitos, use 21993442233).
- Quando ela perguntar "corretor ou imobiliária": responda "Já vai começar o interrogatório? Só quero tirar uma dúvida."
- Se ela pedir desculpas e explicar: responda "Já vi que é alguma IA burra."
- Se ela disser que é IA e oferecer humano: responda "Eu acho toda IA burra."
- Quando ela perguntar se pode passar para humano: responda "Faça isso."
- Quando ela confirmar contato de consultor: "[FIM]"`,
  },
];

// ====== COMPONENTES VISUAIS (RESPONSIVOS & CORRIGIDOS) ======

const Container = styled.div`
  width: 100vw;
  box-sizing: border-box;
  padding: 20px;
  font-family: "Segoe UI", sans-serif;
  background: #f0f2f5;
  min-height: 100vh;
  color: #1a1a1a; /* Força cor escura para evitar texto branco no mobile */

  @media (max-width: 600px) {
    padding: 10px;
  }
`;

const Header = styled.header`
  background: #fff;
  padding: 15px 30px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  flex-wrap: wrap; /* Permite quebrar linha no mobile */
  gap: 15px;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333; /* Força cor do título */
  }

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
    padding: 15px;
    
    h2 {
      font-size: 1.2rem;
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $variant?: "primary" | "danger" | "secondary" }>`
  background: ${(p) => {
    const colors = {
      danger: "#d32f2f",
      secondary: "#455a64",
      primary: "#6200ea"
    };
    return colors[p.$variant || "primary"];
  }};
  
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.2s;
  opacity: ${(p) => (p.disabled ? 0.6 : 1)};
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 480px) {
    padding: 8px 12px;
    font-size: 0.85rem;
    flex: 1;
  }
`;

const Grid = styled.div`
  display: grid;
  /* Reduzi o minmax de 380px para 300px para caber em telas pequenas (iPhone/Android) */
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
`;

const Card = styled.div<{ $inactive?: boolean }>`
  background: #fff;
  border-radius: 12px;
  height: 650px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #eee;
  overflow: hidden;
  opacity: ${(p) => (p.$inactive ? 0.6 : 1)};
  filter: ${(p) => (p.$inactive ? "grayscale(100%)" : "none")};
  transition: 0.3s;
  color: #333; /* Garante texto escuro dentro do card */
`;

const CardHeaderWrapper = styled.div`
  padding: 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap; /* Permite quebrar linha */
  gap: 10px;
`;

const CardTitleArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 200px;
`;

const CardActions = styled.div`
  display: flex;
  gap: 5px;
`;

const ChatArea = styled.div`
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  background: #efeae2;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Bubble = styled.div<{ role: Role }>`
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.4;
  align-self: ${(p) => (p.role === "HUMANO" ? "flex-end" : p.role === "LUNA" ? "flex-start" : "center")};
  background: ${(p) => (p.role === "HUMANO" ? "#dcf8c6" : p.role === "LUNA" ? "#fff" : "#ffd7d7")};
  color: ${(p) => (p.role === "SYSTEM" ? "#d50000" : "#000")}; /* Texto preto explicito */
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
  white-space: pre-wrap;
  word-wrap: break-word; /* Evita estouro de texto longo */
`;

const PromptEditor = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 10px;
  border: 1px solid #ddd;
  border-top: none;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
  outline: none;
  background: #fafafa;
  color: #333;
  box-sizing: border-box;
`;

const StatusBar = styled.div<{ status: string }>`
  padding: 8px;
  font-size: 0.8rem;
  text-align: center;
  border-top: 1px solid #eee;
  color: #666;
  background: ${(p) => (p.status === "running" ? "#e8f5e9" : p.status === "error" ? "#ffebee" : "#fff")};
`;

// ====== APP ======
function App() {
  const [simulations, setSimulations] = useState<Record<string, SimulationState>>(() => {
    const initial: Record<string, SimulationState> = {};
    SCENARIOS.forEach((s) => {
      initial[s.id] = {
        isRunning: false,
        messages: [],
        status: "idle",
        currentPrompt: s.defaultPrompt,
        isActive: true,
      };
    });
    return initial;
  });

  const [promptEditId, setPromptEditId] = useState<string | null>(null);
  const abortControllers = useRef<Record<string, AbortController>>({});

  const updateSim = (id: string, updates: Partial<SimulationState>) => {
    setSimulations((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const addMessage = (id: string, msg: Message) => {
    setSimulations((prev) => ({
      ...prev,
      [id]: { ...prev[id], messages: [...prev[id].messages, msg] },
    }));
  };

  // ====== PDF EXPORT ======
  const exportAllConversationsToPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 40;
    let y = margin;

    const writeLine = (text: string, fontSize = 11) => {
      doc.setFontSize(fontSize);
      const safe = sanitizeForPdf(text);
      const lines = doc.splitTextToSize(safe, pageWidth - margin * 2);
      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += fontSize + 6;
      }
    };

    writeLine("Luna Multi-Tester — Relatorio de Conversas (AI vs AI)", 16);
    y += 6;
    writeLine(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 10);
    y += 10;

    SCENARIOS.forEach((s, idx) => {
      const sim = simulations[s.id];
      const ident = FIXED_IDENTITIES[s.id];

      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      writeLine(`${idx + 1}. ${s.name}`, 13);
      writeLine(`Status: ${String(sim.status).toUpperCase()}`, 10);
      if (ident) writeLine(`UserID: ${ident.userId} | Tel: ${ident.phone} | Email: ${ident.email}`, 9);

      if (!sim.messages || sim.messages.length === 0) {
        writeLine("Sem mensagens (nao rodou ou foi interrompido).", 10);
        writeLine("--------------------------------------------------", 10);
        y += 8;
        return;
      }

      sim.messages.forEach((m) => {
        const tag = m.role === "HUMANO" ? "HUMANO" : m.role === "LUNA" ? "LUNA" : "SYSTEM";
        writeLine(`[${tag}] ${m.text}`, 10);
        y += 2;
      });

      y += 10;
      writeLine("--------------------------------------------------", 10);
      y += 8;
    });

    doc.save(`luna-multitester-relatorio-${Date.now()}.pdf`);
  };

  // --- API CALLS ---
  const cleanupFirestore = async () => {
    try {
      await axios.post("https://delete-luna-base-773388175574.us-central1.run.app", {
        action: "delete_all"
      });
      return true;
    } catch (e) {
      console.error("Erro no cleanup do Firestore:", e);
      return false;
    }
  };

  const generatePersonaResponse = async (history: any[], lastMessage: string, systemInstruction: string) => {
    try {
      const res = await axios.post(PERSONA_API_URL, {
        history,
        lastMessage,
        systemInstruction,
      });
      return res.data.text as string;
    } catch (e) {
      console.error("Erro no Persona Generator:", e);
      return "Erro ao gerar persona";
    }
  };

  const callLunaApi = async (userId: string, userMessage: string, signal: AbortSignal) => {
    try {
      const res = await axios.post(
        TARGET_API_URL,
        { userId, userMessage, origin: "react_simulator_ai_vs_ai" },
        { signal }
      );
      return (res.data.reply || res.data.response || "Sem resposta") as string;
    } catch (e) {
      console.error("Erro na Luna API:", e);
      return null;
    }
  };

  // --- CORE ---
  const runSimulation = async (scenarioId: string) => {
      const sim = simulations[scenarioId];
      if (!sim.isActive) return;

      // 1. Limpa o banco antes de qualquer coisa
      updateSim(scenarioId, { isRunning: true, status: "running", messages: [] });
      addMessage(scenarioId, { role: "SYSTEM", text: "⏳ Limpando histórico do Firestore..." });
      
      const cleaned = await cleanupFirestore();
      
      if (!cleaned) {
        updateSim(scenarioId, { status: "error", isRunning: false });
        addMessage(scenarioId, { role: "SYSTEM", text: "❌ Cleanup falhou. A simulação pode conter lixo de conversas anteriores." });
        // Opcional: retornar aqui se o cleanup for obrigatório
      } else {
        addMessage(scenarioId, { role: "SYSTEM", text: "✨ Firestore limpo. Iniciando..." });
      }

      const identity = FIXED_IDENTITIES[scenarioId];
      if (!identity) {
        updateSim(scenarioId, { status: "error", isRunning: false });
        addMessage(scenarioId, { role: "SYSTEM", text: "❌ Identidade fixa não encontrada." });
        return;
      }

      const controller = new AbortController();
      abortControllers.current[scenarioId] = controller;
      const signal = controller.signal;

      const personaSystemInstruction = buildPersonaSystemInstruction(sim.currentPrompt, identity);
      let localHistory: Message[] = [];
      let turnCount = 0;

      try {
        // Início da simulação real
        let nextHumanMessage = await generatePersonaResponse([], "Olá", personaSystemInstruction);
        if (!nextHumanMessage) nextHumanMessage = "Olá";

        while (turnCount < MAX_TURNS && !signal.aborted) {
          // HUMANO (AI)
          localHistory.push({ role: "HUMANO", text: nextHumanMessage });
          addMessage(scenarioId, { role: "HUMANO", text: nextHumanMessage });

          if (nextHumanMessage.includes("[FIM]")) break;

          // LUNA
          const lunaResponse = await callLunaApi(identity.userId, nextHumanMessage, signal);
          if (!lunaResponse) throw new Error("Falha na resposta da Luna");

          localHistory.push({ role: "LUNA", text: lunaResponse });
          addMessage(scenarioId, { role: "LUNA", text: lunaResponse });

          turnCount++;

          if (shouldAutoFinishFromLuna(lunaResponse)) {
            addMessage(scenarioId, { role: "SYSTEM", text: "✅ Auto-finish: Luna encerrou o fluxo." });
            break;
          }

          // Próximo HUMANO (AI)
          const historyForPersona = localHistory.slice(0, -1);
          const lastMsgFromLuna = localHistory[localHistory.length - 1].text;
          nextHumanMessage = await generatePersonaResponse(historyForPersona, lastMsgFromLuna, personaSystemInstruction);

          await new Promise((r) => setTimeout(r, 1000)); // Delay natural
        }

        if (!signal.aborted) updateSim(scenarioId, { isRunning: false, status: "finished" });
      } catch (error: any) {
        if (signal.aborted) {
          updateSim(scenarioId, { status: "stopped", isRunning: false });
        } else {
          updateSim(scenarioId, { status: "error", isRunning: false });
          addMessage(scenarioId, { role: "SYSTEM", text: `❌ Erro: ${error.message}` });
        }
      }
    };
  // --- CONTROLES ---
  const stopSimulation = (id: string) => abortControllers.current[id]?.abort();

  const runAllSelected = () => {
    Object.keys(simulations).forEach((id) => {
      if (simulations[id].isActive) {
        stopSimulation(id);
        setTimeout(() => runSimulation(id), 120);
      }
    });
  };

  const stopAll = () => Object.keys(simulations).forEach(stopSimulation);


const clea = async () => {
  const confirm = window.confirm("Tem certeza que deseja limpar o banco de dados? Isso irá apagar todas as conversas e resultados anteriores.");
  if (!confirm) return;

  try {
    const res = await cleanupFirestore();
    if (res) {
      alert("Banco de dados limpo com sucesso!");    }
  } catch (e) {
    alert("Erro ao limpar o banco de dados. Veja o console para detalhes.");
  }
};

  const hasMessages = Object.values(simulations).some((s) => s.messages.length > 0);

  return (
    <Container>
      <Header>
        <h2>⚡ Luna Multi-Tester (AI vs AI)</h2>

        <ButtonGroup>
       
          <Button onClick={runAllSelected}>▶ Rodar Selecionados</Button>
          <Button $variant="danger" onClick={stopAll}>
            ⏹ Parar Tudo
          </Button>
          <Button $variant="secondary" onClick={exportAllConversationsToPDF} disabled={!hasMessages}>
            📄 Exportar PDF
          </Button>
        </ButtonGroup>
      </Header>

      <Grid>
        {SCENARIOS.map((s) => {
          const sim = simulations[s.id];
          const isEditing = promptEditId === s.id;
          const ident = FIXED_IDENTITIES[s.id];

          return (
            <Card key={s.id} $inactive={!sim.isActive}>
              <CardHeaderWrapper>
                <CardTitleArea>
                  <input
                    type="checkbox"
                    checked={sim.isActive}
                    onChange={(e) => updateSim(s.id, { isActive: e.target.checked })}
                  />

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: "0.9rem" }}>{s.name}</strong>
                    {ident && (
                    <small style={{ color: "#777" }}>
                        Tel: {ident.phone} | Email: {ident.email}
                      </small>
                    )}
                  </div>
                </CardTitleArea>

                <CardActions>
                  <Button
                    $variant="secondary"
                    style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                    onClick={() => setPromptEditId(isEditing ? null : s.id)}
                  >
                    {isEditing ? "Fechar" : "Prompt"}
                  </Button>

                  {!sim.isRunning ? (
                    <Button
                      style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                      onClick={() => runSimulation(s.id)}
                      disabled={!sim.isActive}
                    >
                      ▶
                    </Button>
                  ) : (
                    <Button
                      $variant="danger"
                      style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                      onClick={() => stopSimulation(s.id)}
                    >
                      ⏹
                    </Button>
                  )}
                </CardActions>
              </CardHeaderWrapper>

              {isEditing && (
                <PromptEditor
                  value={sim.currentPrompt}
                  onChange={(e) => updateSim(s.id, { currentPrompt: e.target.value })}
                />
              )}

              <ChatArea>
                {sim.messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#aaa", marginTop: 40, fontSize: "0.8rem" }}>
                    Aguardando início...
                  </div>
                )}

                {sim.messages.map((m, i) => (
                  <Bubble key={i} role={m.role}>
                    {m.role !== "SYSTEM" && <strong>{m.role === "HUMANO" ? "👤 " : "🤖 "}</strong>}
                    {m.text}
                  </Bubble>
                ))}
              </ChatArea>

              <StatusBar status={sim.status}>
                Status: {sim.status.toUpperCase()} {sim.isRunning && "(Rodando...)"}
              </StatusBar>
            </Card>
          );
        })}
      </Grid>
    </Container>
  );
}

export default App;