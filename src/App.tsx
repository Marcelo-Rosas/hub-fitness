import React from 'react';
import { PlannerProvider, usePlanner } from './context/PlannerContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginScreen } from './components/LoginScreen';
import { Shell } from './components/Shell';
import { CellInspector } from './components/CellInspector';
import { M1Dashboard } from './components/modules/M1Dashboard';
import { M2Dre } from './components/modules/M2Dre';
import { M3CadastroFinanceiro } from './components/modules/M3CadastroFinanceiro';
import { M4Caixa } from './components/modules/M4Caixa';
import { M5FatorR } from './components/modules/M5FatorR';
import { M6MixCenarios } from './components/modules/M6MixCenarios';
import { M7Ano3Expansao } from './components/modules/M7Ano3Expansao';
import { M8SpinOff } from './components/modules/M8SpinOff';
import { M9ExportGovernanca } from './components/modules/M9ExportGovernanca';
import { M10AssistenteCompras } from './components/modules/M10AssistenteCompras';
import { M11PlanoDeContas } from './components/modules/M11PlanoDeContas';
import { KnowledgeBasePage } from './components/modules/KnowledgeBasePage';
import { M12ContratosSla } from './components/modules/M12ContratosSla';
import { M13PipelineCrm } from './components/modules/M13PipelineCrm';
import { M14CpqPropostas } from './components/modules/M14CpqPropostas';
import { M15RhBenchmark } from './components/modules/M15RhBenchmark';
import { M16BenchmarkCustos } from './components/modules/M16BenchmarkCustos';
import { M17SimuladorAnexoV } from './components/modules/M17SimuladorAnexoV';
import { M18Comex } from './components/modules/M18Comex';
import { M19Intranet } from './components/modules/M19Intranet';

const ModuleRouter: React.FC = () => {
  const { activeModule } = usePlanner();

  switch (activeModule) {
    case 'M1':
      return <M1Dashboard />;
    case 'M2':
      return (
        <ProtectedRoute role="CFO_ADMIN">
          <M2Dre />
        </ProtectedRoute>
      );
    case 'M3':
      return <M3CadastroFinanceiro />;
    case 'M4':
      return (
        <ProtectedRoute role="CFO_ADMIN">
          <M4Caixa />
        </ProtectedRoute>
      );
    case 'M5':
      return <M5FatorR />;
    case 'M6':
      return <M6MixCenarios />;
    case 'M7':
      return <M7Ano3Expansao />;
    case 'M8':
      return <M8SpinOff />;
    case 'M9':
      return <M9ExportGovernanca />;
    case 'M10':
      return <M10AssistenteCompras />;
    case 'M11':
      return <M11PlanoDeContas readOnly />;
    case 'KB':
      return <KnowledgeBasePage />;
    case 'M12':
      return <M12ContratosSla />;
    case 'M13':
      return <M13PipelineCrm />;
    case 'M14':
      return <M14CpqPropostas />;
    case 'M15':
      return <M15RhBenchmark />;
    case 'M16':
      return <M16BenchmarkCustos />;
    case 'M17':
      return <M17SimuladorAnexoV />;
    case 'M18':
      return <M18Comex />;
    case 'M19':
      return <M19Intranet />;
    default:
      return <M1Dashboard />;
  }
};

const MainLayout: React.FC = () => {
  const { isAuthenticated } = usePlanner();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Shell>
      <ModuleRouter />
      <CellInspector />
    </Shell>
  );
};

export default function App() {
  return (
    <PlannerProvider>
      <MainLayout />
    </PlannerProvider>
  );
}
