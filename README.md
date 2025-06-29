# Sistema de Alertas GrupoGPS v2.1

Sistema de alertas otimizado com consolidação de eventos e grupos de equipamentos para monitoramento de frotas.

## Características Principais

- **Consolidação Inteligente**: Unifica eventos contínuos em alertas únicos
- **Grupos de Equipamentos**: Classificação automática e regras específicas por grupos
- **Cache Híbrido**: Armazenamento local + sincronização GitHub opcional
- **Arquitetura Modular**: Componentes independentes e testáveis
- **Sistema Resiliente**: Funciona offline com fallbacks automáticos
- **Performance Otimizada**: Processamento eficiente e métricas de performance

## Grupos de Equipamentos Suportados

- **Alta Pressão**: Equipamentos com "ALTA PRESSÃO", "ALTA PRESSAO", "HIGH PRESSURE"
- **Auto Vácuo**: Equipamentos com "AUTO VÁCUO", "AUTO VACUO", "AUTO VAC"
- **Hiper Vácuo**: Equipamentos com "HIPER VÁCUO", "HIPER VACUO", "HYPER VAC"
- **Brook**: Equipamentos com "BROOK"

## Instalação

### Via NPM

```bash
npm install @grupogps/alert-system
```

### Via CDN

```html
<script src="https://unpkg.com/@grupogps/alert-system@latest/dist/grupogps-alert-system.min.js"></script>
```

### Download Direto

Baixe o arquivo standalone: `dist/standalone/index.html`

## Uso Básico

### Como Módulo ES6

```javascript
import { AlertSystem } from '@grupogps/alert-system';

const alertSystem = new AlertSystem({
  githubConfig: {
    repo: 'seu-usuario/seu-repo',
    token: 'seu-github-token' // opcional
  },
  consolidationConfig: {
    maxGapMinutes: 15,
    mode: 'auto'
  }
});

await alertSystem.initialize();
```

### Como Script UMD

```html
<script src="dist/grupogps-alert-system.min.js"></script>
<script>
  const alertSystem = new GrupoGpsAlertSystem.AlertSystem({
    // configurações
  });
  
  alertSystem.initialize();
</script>
```

### Standalone (Plug & Play)

```html
<!-- Abra o arquivo dist/standalone/index.html no navegador -->
<!-- Sistema funciona sem configuração adicional -->
```

## Configuração

### GitHub (Opcional)

```javascript
const config = {
  githubConfig: {
    repo: 'GrupoGps-Mecanizada/Monitoramento-De-Produtividade',
    token: 'ghp_xxxxxxxxxxxx', // Personal Access Token
    branch: 'main',
    rulesFile: 'data/alert-rules.json',
    alertsFile: 'data/alerts-generated.json',
    statesFile: 'data/active-states.json'
  }
};
```

### Consolidação

```javascript
const config = {
  consolidationConfig: {
    maxGapMinutes: 15, // Intervalo máximo entre registros contínuos
    mode: 'auto', // 'auto', 'manual', 'disabled'
    cacheMode: 'hybrid' // 'hybrid', 'local', 'github'
  }
};
```

### Grupos de Equipamentos

```javascript
const config = {
  equipmentGroups: {
    'ALTA_PRESSAO': {
      name: 'Alta Pressão',
      patterns: ['ALTA PRESSÃO', 'ALTA PRESSAO', 'HIGH PRESSURE'],
      color: '#e74c3c',
      icon: '🔴'
    }
    // outros grupos...
  }
};
```

## API Principal

### AlertSystem

```javascript
// Inicialização
const alertSystem = new AlertSystem(config);
await alertSystem.initialize();

// Adicionar regra simples
alertSystem.addRule({
  name: "Refeição Prolongada - Alta Pressão",
  equipmentGroups: ['ALTA_PRESSAO'],
  conditions: {
    apontamento: "Refeição Motorista",
    timeOperator: ">",
    timeValue: 30
  },
  severity: "high"
});

// Adicionar regra avançada
alertSystem.addAdvancedRule({
  name: "Condições Complexas",
  equipmentGroups: ['AUTO_VACUO'],
  conditions: {
    logic: "AND",
    rules: [
      { type: "apontamento", operator: "equals", value: "Documentação" },
      { type: "status", operator: "equals", value: "on" },
      { type: "time", operator: ">", value: 45 }
    ]
  },
  severity: "critical"
});

// Obter alertas
const alerts = alertSystem.getAlerts();
const filteredAlerts = alertSystem.getAlerts({
  equipmentGroups: ['ALTA_PRESSAO'],
  severity: 'critical',
  period: 'today'
});

// Forçar processamento
await alertSystem.processAlerts();

// Gerar relatório
const report = alertSystem.generateReport({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  equipmentGroups: ['ALTA_PRESSAO', 'AUTO_VACUO']
});
```

### Grupos de Equipamentos

```javascript
import { GroupDetector, GroupManager } from '@grupogps/alert-system';

// Detectar grupos automaticamente
const detector = new GroupDetector();
const groups = detector.getGroupsForEquipment('CAMINHÃO ALTA PRESSÃO - GPS - 11');
// Retorna: ['ALTA_PRESSAO']

// Gerenciar grupos
const manager = new GroupManager();
manager.addCustomGroup('ESPECIAL', {
  name: 'Equipamentos Especiais',
  patterns: ['ESPECIAL', 'CUSTOM'],
  color: '#9b59b6'
});
```

### Utilitários

```javascript
import { ErrorHandler, PerformanceTimer, Logger } from '@grupogps/alert-system';

// Error handling com retry
const errorHandler = new ErrorHandler();
const result = await errorHandler.handleWithFallback(
  () => fetch('https://api.exemplo.com/dados'),
  () => loadFromLocalStorage()
);

// Performance monitoring
const timer = PerformanceTimer.start();
// ... operação ...
const duration = PerformanceTimer.end(timer);

// Logging estruturado
const logger = new Logger('AlertSystem');
logger.info('Sistema inicializado', { version: '2.1.0' });
```

## Estrutura do Projeto

```
grupogps-alert-system/
├── src/
│   ├── index.js                 # Ponto de entrada principal
│   ├── core/                    # Sistema core
│   │   ├── AlertSystem.js       # Classe principal
│   │   ├── ConsolidationEngine.js # Motor de consolidação
│   │   ├── RuleEngine.js        # Processamento de regras
│   │   └── StateManager.js      # Gerenciamento de estados
│   ├── modules/
│   │   ├── sync/                # Sincronização GitHub/Local
│   │   ├── equipment/           # Grupos de equipamentos
│   │   ├── rules/               # Criação e validação de regras
│   │   ├── alerts/              # Geração e consolidação de alertas
│   │   ├── ui/                  # Componentes de interface
│   │   └── reports/             # Sistema de relatórios
│   ├── utils/                   # Utilitários
│   ├── config/                  # Configurações
│   └── types/                   # Definições de tipos
├── dist/                        # Build outputs
├── data-templates/              # Templates de dados JSON
├── docs/                        # Documentação
└── public/                      # Versão standalone
```

## Desenvolvimento

### Setup

```bash
git clone https://github.com/GrupoGps-Mecanizada/grupogps-alert-system.git
cd grupogps-alert-system
npm install
```

### Build

```bash
npm run build           # Build produção
npm run build:watch     # Build com watch
npm run dev             # Build desenvolvimento
```

### Servidor Local

```bash
npm run serve           # Inicia servidor na porta 8080
```

## Troubleshooting

### Problema: Erro 404 active-states.json

**Solução**: O sistema agora cria automaticamente arquivos faltantes com templates padrão.

### Problema: Sistema não salva regras

**Solução**: Configure o token GitHub ou use apenas armazenamento local.

### Problema: URLs hardcoded falham

**Solução**: Sistema implementa fallbacks automáticos para dados locais.

### Problema: Performance lenta

**Solução**: Ajuste configurações de consolidação e ative cache híbrido.

## Changelog

### v2.1.0
- Sistema de grupos de equipamentos
- Consolidação inteligente de eventos
- Cache híbrido com fallbacks
- Arquitetura modular completa
- Resolução de problemas críticos

### v2.0.0
- Refatoração completa
- Sistema de regras avançadas
- Interface melhorada

### v1.0.0
- Versão inicial
- Funcionalidades básicas de alertas

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## Suporte

- **Issues**: [GitHub Issues](https://github.com/GrupoGps-Mecanizada/grupogps-alert-system/issues)
- **Email**: suporte@grupogps.com
- **Documentação**: [docs/](./docs/)

## Autor

**Warlison Abreu** - Desenvolvedor Principal
- Email: warlison@grupogps.com
- GitHub: [@warlison](https://github.com/warlison)

---

**GrupoGPS** - Sistema de Alertas Otimizado v2.1
