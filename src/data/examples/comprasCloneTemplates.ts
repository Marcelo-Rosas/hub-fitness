import comprasExample from './compras-deep-research.example.json';
import rfqStretch from './compras-rfq-stretch.json';
import rfqPalete from './compras-rfq-palete.json';
import rfqEmpilhadeira from './compras-rfq-empilhadeira.json';

export const COMPRAS_CLONE_TEMPLATES = [
  {
    id: 'example',
    label: 'Exemplo pesquisa SC-PR-SP',
    done: 'Exemplo clonado no editor. Só estrutura — não grava no cadastro.',
    pack: comprasExample,
  },
  {
    id: 'rfq-stretch',
    label: 'RFQ stretch · Fort Plast + Teckplast',
    done: 'Folha RFQ stretch. Preencha preço/frete Itajaí, remova example: true. Não grava com preço 0.',
    pack: rfqStretch,
  },
  {
    id: 'rfq-palete',
    label: 'RFQ palete · Águia + Ecopack',
    done: 'Folha RFQ palete. Lote 300 ≠ volume mensal. Preencha R$/un + frete Itajaí.',
    pack: rfqPalete,
  },
  {
    id: 'rfq-empilhadeira',
    label: 'RFQ empilhadeira · Rioita + GV',
    done: 'Folha RFQ retrátil. SLA Itajaí eliminatório. Não usar R$ 8.000 da pesquisa.',
    pack: rfqEmpilhadeira,
  },
] as const;

export type ComprasCloneTemplateId = (typeof COMPRAS_CLONE_TEMPLATES)[number]['id'];
