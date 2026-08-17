import type { KbArticle } from '../types';

export const M6_PISOS: KbArticle = {
  id: 'm6-pisos',
  moduleId: 'M6',
  title: 'Pisos de folha SC (CCT, mediana, CAGED)',
  stub: false,
  sections: [
    {
      heading: 'Três pisos, um pack',
      body: 'O Mix escolhe um piso de folha: Piso CCT (conservador), Mediana SC (equilibrado) ou Média CAGED (competitivo). O break-even do Mix soma folha live + OPEX não-HC do ledger. Não existe mais Enxuto/Original/Realista como proxy de piso.\n\nPack Simples = 27,44% (FGTS + 13º + férias). INSS/RAT/Sistema S não entram no pack — vão no DAS. Periculosidade só se o cargo tiver flag (empilhadeira).',
    },
    {
      heading: 'CCT — SITRAROIT × SEVEÍCULOS',
      body: 'Piso conservador vem da convenção coletiva da categoria em Santa Catarina, homologada no Mediador (MTE). Sindicato laboral SITRAROIT e patronal SEVEÍCULOS. Use o instrumento vigente no Mediador; não grave id interno de campo no produto.',
    },
    {
      heading: 'Mediana SC e CAGED',
      body: 'Mediana SC é o piso equilibrado de mercado local. CAGED / Portal Salário alimenta a média competitiva. Trocar o pill no Mix recalcula BE e LL; o pill mostra só o nome do piso, sem R$ no rótulo.',
    },
    {
      heading: 'DAS vs lançamento analítico',
      body: 'DAS (Simples) não se lança como folha analítica. Folha vai em 5.2.01.* (salários, pró-labore, FGTS, 13º, férias, benefícios, periculosidade). DAS permanece na conta de dedução tributária. Ad Valorem 0,10% só na NF de serviço.',
    },
    {
      heading: 'Empilhadeira — NR-11 e NR-16',
      body: 'Operador de empilhadeira: NR-11 (transporte e movimentação) e NR-16 / CLT arts. 193–194 para adicional de periculosidade quando o cargo estiver flagado. Default do Mix é peril 0 até o flag.',
    },
  ],
  sources: [
    {
      label: 'SITRAROIT × SEVEÍCULOS — Mediador MTE',
      url: 'https://www3.mte.gov.br/sistemas/mediador/',
    },
    {
      label: 'CAGED / Portal Salário',
      url: 'https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/caged',
    },
    {
      label: 'NR-16',
      url: 'https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-16.pdf',
    },
  ],
};
