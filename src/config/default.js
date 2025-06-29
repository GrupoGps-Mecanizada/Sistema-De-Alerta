/**
 * Configuração Padrão do Sistema de Alertas
 * Define valores padrão e configurações resilientes
 */

import { EQUIPMENT_GROUPS } from './equipmentGroups.js';
import { ENDPOINTS_CONFIG } from './endpoints.js';

export const DEFAULT_CONFIG = {
  // Informações do sistema
  system: {
    name: 'GrupoGPS Alert System',
    version: '2.1.0',
    environment: 'production',
    debug: false
  },

  // Configuração GitHub (opcional)
  github: {
    enabled: true,
    repo: 'GrupoGps-Mecanizada/Monitoramento-De-Produtividade',
    token: '', // Será configurado pelo usuário
    branch: 'main',
    files: {
      rules: 'data/alert-rules.json',
      alerts: 'data/alerts-generated.json',
      states: 'data/active-states.json'
    },
    autoSync: true,
    syncInterval: 300000, // 5 minutos
    maxRetries: 3
  },

  // Configuração de endpoints
  endpoints: ENDPOINTS_CONFIG,

  // Configuração de consolidação
  consolidation: {
    enabled: true,
    mode: 'auto', // 'auto', 'manual', 'disabled'
    maxGapMinutes: 15,
    minDurationMinutes: 1,
    allowOverlap: false,
    mergeStrategy: 'extend', // 'extend', 'replace', 'skip'
    conflictResolution: 'latest' // 'latest', 'earliest', 'longest'
  },

  // Configuração de cache
  cache: {
    mode: 'hybrid', // 'hybrid', 'local', 'github', 'disabled'
    localStorage: {
      enabled: true,
      prefix: 'alertSystem_',
      maxSize: 50 * 1024 * 1024, // 50MB
      compression: false
    },
    memory: {
      enabled: true,
      maxItems: 10000,
      ttl: 3600000 // 1 hora
    },
    cleanup: {
      interval: 3600000, // 1 hora
      maxAge: 2592000000 // 30 dias
    }
  },

  // Configuração de grupos de equipamentos
  equipmentGroups: {
    enabled: true,
    autoDetection: true,
    customGroups: [],
    defaultGroup: 'GERAL',
    groups: EQUIPMENT_GROUPS,
    detection: {
      caseSensitive: false,
      partialMatch: true,
      minMatchLength: 4,
      excludeWords: ['GPS', 'SISTEMA', 'EQUIPAMENTO']
    }
  },

  // Configuração de regras
  rules: {
    enabled: true,
    autoProcessing: true,
    processingInterval: 60000, // 1 minuto
    maxConcurrentRules: 50,
    validation: {
      strict: false,
      allowEmptyConditions: false,
      requireMessage: true
    },
    defaults: {
      severity: 'medium',
      active: true,
      type: 'simple'
    }
  },

  // Configuração de alertas
  alerts: {
    enabled: true,
    deduplication: {
      enabled: true,
      strategy: 'hash', // 'hash', 'id', 'content'
      windowMinutes: 60
    },
    retention: {
      maxAlerts: 10000,
      maxAgeDays: 30,
      autoCleanup: true
    },
    notifications: {
      enabled: true,
      sounds: false,
      desktop: false
    }
  },

  // Configuração de performance
  performance: {
    monitoring: {
      enabled: true,
      collectMetrics: true,
      logSlowOperations: true,
      slowThreshold: 1000 // 1 segundo
    },
    optimization: {
      enableDebounce: true,
      debounceDelay: 300,
      batchProcessing: true,
      batchSize: 100,
      maxProcessingTime: 30000 // 30 segundos
    },
    limits: {
      maxCsvRecords: 50000,
      maxJsonRecords: 50000,
      maxAlerts: 10000,
      maxRules: 100
    }
  },

  // Configuração de interface
  ui: {
    theme: 'auto', // 'light', 'dark', 'auto'
    animations: true,
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutos
    tabs: {
      defaultTab: 'history',
      enableAll: true,
      order: ['history', 'rules', 'reports', 'stats', 'config']
    },
    notifications: {
      enabled: true,
      duration: 4000,
      position: 'top-right'
    },
    tables: {
      pageSize: 50,
      enablePagination: true,
      enableSorting: true,
      enableFiltering: true
    }
  },

  // Configuração de relatórios
  reports: {
    enabled: true,
    formats: ['json', 'excel', 'csv'],
    defaultFormat: 'excel',
    analytics: {
      enabled: true,
      intelligentAnalysis: true,
      trends: true,
      predictions: false
    },
    export: {
      maxRecords: 100000,
      includeMetadata: true,
      compression: true
    }
  },

  // Configuração de logs
  logging: {
    enabled: true,
    level: 'info', // 'debug', 'info', 'warn', 'error'
    console: true,
    storage: false,
    maxLogSize: 1024 * 1024, // 1MB
    structured: true
  },

  // Configuração de segurança
  security: {
    validateInputs: true,
    sanitizeOutputs: true,
    csrfProtection: false,
    rateLimit: {
      enabled: false,
      maxRequests: 100,
      windowMinutes: 15
    }
  },

  // Configuração de dados de exemplo para desenvolvimento
  development: {
    useExampleData: true,
    mockApiCalls: false,
    simulateLatency: false,
    debugMode: false
  }
};

/**
 * Configurações específicas por ambiente
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ...DEFAULT_CONFIG,
    system: {
      ...DEFAULT_CONFIG.system,
      environment: 'development',
      debug: true
    },
    cache: {
      ...DEFAULT_CONFIG.cache,
      mode: 'local'
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      level: 'debug'
    },
    development: {
      ...DEFAULT_CONFIG.development,
      useExampleData: true,
      debugMode: true
    },
    performance: {
      ...DEFAULT_CONFIG.performance,
      limits: {
        ...DEFAULT_CONFIG.performance.limits,
        maxCsvRecords: 1000,
        maxJsonRecords: 1000,
        maxAlerts: 1000
      }
    }
  },

  staging: {
    ...DEFAULT_CONFIG,
    system: {
      ...DEFAULT_CONFIG.system,
      environment: 'staging'
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      level: 'debug',
      storage: true
    }
  },

  production: DEFAULT_CONFIG
};

/**
 * Função para obter configuração baseada no ambiente
 */
export function getEnvironmentConfig(environment = 'production') {
  const config = ENVIRONMENT_CONFIGS[environment];
  
  if (!config) {
    console.warn(`Ambiente '${environment}' não encontrado, usando configuração de produção`);
    return ENVIRONMENT_CONFIGS.production;
  }
  
  return config;
}

/**
 * Função para mesclar configuração customizada com padrão
 */
export function mergeConfig(customConfig = {}, environment = 'production') {
  const baseConfig = getEnvironmentConfig(environment);
  
  return deepMerge(baseConfig, customConfig);
}

/**
 * Função utilitária para merge profundo de objetos
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Função para verificar se valor é objeto
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Função para validar configuração
 */
export function validateConfig(config) {
  const errors = [];
  
  // Validar configuração GitHub
  if (config.github?.enabled && config.github?.repo) {
    if (!config.github.repo.includes('/')) {
      errors.push('GitHub repo deve estar no formato "owner/repository"');
    }
  }
  
  // Validar configuração de consolidação
  if (config.consolidation?.maxGapMinutes < 1) {
    errors.push('maxGapMinutes deve ser maior que 0');
  }
  
  // Validar configuração de cache
  if (!['hybrid', 'local', 'github', 'disabled'].includes(config.cache?.mode)) {
    errors.push('Modo de cache inválido');
  }
  
  // Validar limites de performance
  if (config.performance?.limits?.maxCsvRecords < 1) {
    errors.push('maxCsvRecords deve ser maior que 0');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Configuração de dados de fallback
 */
export const FALLBACK_CONFIG = {
  useLocalStorage: true,
  generateExampleData: true,
  enableOfflineMode: true,
  showFallbackNotifications: true
};
