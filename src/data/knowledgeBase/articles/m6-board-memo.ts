import type { KbArticle } from '../types';

export const M6_BOARD_MEMO: KbArticle = {
  id: 'm6-board-memo',
  moduleId: 'M6',
  title: 'Leitura técnica ao Board',
  stub: false,
  sections: [
    {
      heading: 'Viabilidade do blend',
      body: 'O Board lê o Mix como composição de carteira, não como cinco abas. Blend Alvo (20/30/25/25) é o equilíbrio entre giro, contrato e margem Premium. Conservador reduz Premium e exige VAS. Agressivo alavanca P5 Premium. Aplicar blend no Tornado é preview; Commit Mix no cadastro continua explícito.',
    },
    {
      heading: 'Veto monocliente',
      body: 'Concentração de um único cliente acima de 25% do mix é vetada por governança. Monocliente P1, P4 ou P5 não se aplica — a UI mostra Vetado e o clique é no-op. Política: máx 25% por cliente para evitar dependência de churn.',
    },
    {
      heading: 'P5 Premium como âncora',
      body: 'P5 Premium ancora margem estrutural. Queda abaixo de 20% no mix é alerta operacional (perda de margem), não um recálculo pedagógico. Board deve tratar o alerta como ação comercial, não como aula de perfil.',
    },
    {
      heading: 'Pós-carência M7',
      body: 'Aluguel de galpão tem carência de 6 meses (M1–M6). A partir de M7 o OPEX de ocupação entra cheio. Leitura de LL e caixa para o Board usa M7+ e âncora de caixa M24. Premissas numéricas do BP v3.5 (CAPEX R$ 207.300, Ad Valorem 0,10% na NF de serviço) são trava do plano, não widgets neste artigo.',
    },
  ],
  sources: [
    {
      label: 'HUB Mix & Cenários (rota única)',
      url: 'https://hub.vectracargo.com.br/?module=M6',
    },
  ],
};
