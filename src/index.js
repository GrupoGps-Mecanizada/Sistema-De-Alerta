/**
 * Sistema de Alertas GrupoGPS v2.1
 * Ponto de entrada principal da aplicação modular
 */

// Core System
export { AlertSystem } from './core/AlertSystem.js';
export { ConsolidationEngine } from './core/ConsolidationEngine.js';
export { RuleEngine } from './core/RuleEngine.js';
export { StateManager } from './core/StateManager.js';

// Sync Modules
export { SyncManager } from './modules/sync/SyncManager.js';
export { GitHubAdapter } from './modules/sync/GitHubAdapter.js';
export { LocalStorageAdapter } from './modules/sync/LocalStorageAdapter.js';

// Equipment Modules
export { GroupDetector } from './modules/equipment/GroupDetector.js';
export { GroupManager } from './modules/equipment/GroupManager.js';
export { EquipmentClassifier } from './modules/equipment/EquipmentClassifier.js';

// Rules Modules
export { SimpleRuleBuilder } from './modules/rules/SimpleRuleBuilder.js';
export { AdvancedRuleBuilder } from './modules/rules/AdvancedRuleBuilder.js';
export { RuleValidator } from './modules/rules/RuleValidator.js';

// Alerts Modules
export { AlertGenerator } from './modules/alerts/AlertGenerator.js';
export { AlertDeduplicator } from './modules/alerts/AlertDeduplicator.js';
export { AlertConsolidator } from './modules/alerts/AlertConsolidator.js';

// UI Modules
export { UIManager } from './modules/ui/UIManager.js';
export { TabManager } from './modules/ui/TabManager.js';
export { ModalManager } from './modules/ui/ModalManager.js';
export { NotificationManager } from './modules/ui/NotificationManager.js';
export { GroupSelector } from './modules/ui/GroupSelector.js';

// Reports Modules
export { ReportGenerator } from './modules/reports/ReportGenerator.js';
export { ExcelExporter } from './modules/reports/ExcelExporter.js';
export { AnalyticsEngine } from './modules/reports/AnalyticsEngine.js';

// Utilities
export { generateHash } from './utils/hash.js';
export { debounce } from './utils/debounce.js';
export { parseDateString } from './utils/dateParser.js';
export { PerformanceTimer } from './utils/performance.js';
export { Logger } from './utils/logger.js';
export { ErrorHandler } from './utils/errorHandler.js';

// Configuration
export { EQUIPMENT_GROUPS, GROUP_DETECTION_CONFIG } from './config/equipmentGroups.js';
export { ENDPOINTS_CONFIG, EndpointManager } from './config/endpoints.js';
export { DEFAULT_CONFIG } from './config/default.js';

// Types
export { Alert } from './types/Alert.js';
export { Rule } from './types/Rule.js';
export { Equipment } from './types/Equipment.js';

/**
 * Configuração padrão do sistema
 */
export const DEFAULT_SYSTEM_CONFIG = {
  // Configuração GitHub
  githubConfig: {
    repo: 'GrupoGps-Mecanizada/Monitoramento-De-Produtividade',
    token: '',
    branch: 'main',
    rulesFile: 'data/alert-rules.json',
    alertsFile: 'data/alerts-generated.json',
    statesFile: 'data/active-states.json'
  },
  
  // Configuração de consolidação
  consolidationConfig: {
    maxGapMinutes: 15,
    mode: 'auto',
    cacheMode: 'hybrid'
  },
  
  // Configuração de grupos
  equipmentGroups: EQUIPMENT_GROUPS,
  
  // Configuração de performance
  performanceConfig: {
    enableMetrics: true,
    enableDebug: false,
    batchSize: 1000,
    processingTimeout: 30000
  },
  
  // Configuração de interface
  uiConfig: {
    enableAnimations: true,
    enableNotifications: true,
    autoRefresh: true,
    refreshInterval: 300000
  }
};

/**
 * Função de inicialização rápida
 * Para uso simples sem configuração customizada
 */
export async function initializeAlertSystem(config = {}) {
  const finalConfig = {
    ...DEFAULT_SYSTEM_CONFIG,
    ...config,
    githubConfig: {
      ...DEFAULT_SYSTEM_CONFIG.githubConfig,
      ...(config.githubConfig || {})
    },
    consolidationConfig: {
      ...DEFAULT_SYSTEM_CONFIG.consolidationConfig,
      ...(config.consolidationConfig || {})
    }
  };
  
  const alertSystem = new AlertSystem(finalConfig);
  await alertSystem.initialize();
  
  return alertSystem;
}

/**
 * Função para verificar compatibilidade do browser
 */
export function checkBrowserCompatibility() {
  const requirements = {
    fetch: typeof fetch !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    promise: typeof Promise !== 'undefined',
    asyncAwait: (async () => {})().constructor.name === 'AsyncFunction',
    map: typeof Map !== 'undefined',
    set: typeof Set !== 'undefined'
  };
  
  const unsupported = Object.entries(requirements)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);
  
  return {
    compatible: unsupported.length === 0,
    unsupported,
    requirements
  };
}

/**
 * Função utilitária para configuração rápida em ambiente de desenvolvimento
 */
export function createDevelopmentConfig(overrides = {}) {
  return {
    ...DEFAULT_SYSTEM_CONFIG,
    performanceConfig: {
      ...DEFAULT_SYSTEM_CONFIG.performanceConfig,
      enableDebug: true,
      enableMetrics: true
    },
    consolidationConfig: {
      ...DEFAULT_SYSTEM_CONFIG.consolidationConfig,
      mode: 'auto',
      cacheMode: 'local'
    },
    ...overrides
  };
}

/**
 * Função utilitária para configuração de produção
 */
export function createProductionConfig(overrides = {}) {
  return {
    ...DEFAULT_SYSTEM_CONFIG,
    performanceConfig: {
      ...DEFAULT_SYSTEM_CONFIG.performanceConfig,
      enableDebug: false,
      enableMetrics: true
    },
    consolidationConfig: {
      ...DEFAULT_SYSTEM_CONFIG.consolidationConfig,
      mode: 'auto',
      cacheMode: 'hybrid'
    },
    ...overrides
  };
}

/**
 * Versão e metadados do sistema
 */
export const VERSION_INFO = {
  version: '2.1.0',
  buildDate: new Date().toISOString(),
  features: [
    'equipment-groups',
    'consolidation-engine',
    'hybrid-cache',
    'github-sync',
    'advanced-rules',
    'performance-monitoring',
    'offline-support'
  ],
  compatibility: {
    browsers: ['Chrome 80+', 'Firefox 75+', 'Safari 13+', 'Edge 80+'],
    node: '14.0.0+'
  }
};

// Validação de ambiente no carregamento
if (typeof window !== 'undefined') {
  const compatibility = checkBrowserCompatibility();
  if (!compatibility.compatible) {
    console.warn('GrupoGPS Alert System: Browser não suportado. Recursos não suportados:', compatibility.unsupported);
  }
}

// Export default da classe principal para uso simples
export default AlertSystem;
