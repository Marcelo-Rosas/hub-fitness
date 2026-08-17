import type { KbArticle } from '../types';

export const M6_ENQUADRAMENTO: KbArticle = {
  id: 'm6-enquadramento',
  moduleId: 'M6',
  title: 'Critérios técnicos de enquadramento',
  stub: false,
  sections: [
    {
      heading: 'Como classificar o cliente',
      body: 'O mix comercial usa quatro perfis humanos. A classificação é qualitativa (ticket, VAS, SLA, ciclo de estoque). Números de MC, BE e 4PL ficam na mestra do Mix — este artigo não replica coluna de break-even.',
    },
    {
      heading: 'P1 Estocador',
      body: 'Volume alto, giro baixo e pouco VAS. Palete permanece no hub sem expedição prevista. Se mais de 60% do saldo estiver estocado há mais de 45 dias sem previsão de saída nos próximos 15 dias, classifique como P1 Estocador antes da virada de M7. Ad Valorem 0,10% incide só na NF de serviço, não no valor da mercadoria parada.',
    },
    {
      heading: 'P2 Franquias',
      body: 'Rede de franquias com contrato estável e demanda de 4PL (control tower). Ticket médio, VAS operacional (inventário, etiquetagem). 4PL entra como CT mensal a partir de M12, com rampa em M24.',
    },
    {
      heading: 'P4 B2B Academias',
      body: 'B2B cíclico (academias e redes). Sazonalidade de inauguração e churn de unidades. Cap de mix para não concentrar risco setorial. VAS de montagem e reversa pontual, sem SLA de 24h.',
    },
    {
      heading: 'P5 Premium',
      body: 'Enquadra se ticket > R$ 100 por posição, ou VAS técnico (kitting, serialização, qualidade), ou SLA de reversa < 24h. É a âncora de margem do blend. Abaixo de 20% no mix dispara alerta operacional no M6 — não é aula, é gatilho de governança.',
    },
  ],
  sources: [
    {
      label: 'Spec Mix & Cenários unificado (pipeline Commit)',
      url: 'https://hub.vectracargo.com.br/?module=M6',
    },
  ],
};
