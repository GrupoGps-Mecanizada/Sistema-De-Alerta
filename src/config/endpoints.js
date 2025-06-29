/**
 * Configuração de Endpoints Resiliente
 * Sistema com fallbacks automáticos e retry inteligente
 */

export const ENDPOINTS_CONFIG = {
  // URLs primárias de produção
  primary: {
    csv: 'https://raw.githubusercontent.com/GrupoGps-Mecanizada/Apontamento-Dos-Tablets/main/data/apontamentos-atuais.csv',
    json: 'https://raw.githubusercontent.com/GrupoGps-Mecanizada/Controle-Status-Equipamentos-/main/data/latest-fleet-data.json'
  },
  
  // URLs de fallback local
  fallback: {
    csv: './data-templates/example-apontamentos.csv',
    json: './data-templates/example-fleet-data.json'
  },
  
  // Configuração GitHub
  github: {
    baseUrl: 'https://api.github.com',
    rawUrl: 'https://raw.githubusercontent.com',
    repo: 'GrupoGps-Mecanizada/Monitoramento-De-Produtividade',
    branch: 'main',
    files: {
      rules: 'data/alert-rules.json',
      alerts: 'data/alerts-generated.json',
      states: 'data/active-states.json'
    }
  },
  
  // Configuração de retry
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 'exponential', // 'exponential', 'linear', 'fixed'
    maxDelay: 10000,
    retryOn: [408, 429, 500, 502, 503, 504],
    abortOn: [400, 401, 403, 404]
  },
  
  // Configuração de timeout
  timeout: {
    connect: 10000,
    read: 30000,
    total: 45000
  },
  
  // Cache de requisições
  cache: {
    enabled: true,
    maxAge: 300000, // 5 minutos
    maxSize: 50,
    strategy: 'lru' // 'lru', 'fifo'
  },
  
  // Headers padrão
  headers: {
    'Accept': 'application/json,text/plain,*/*',
    'User-Agent': 'GrupoGPS-AlertSystem/2.1.0',
    'Cache-Control': 'no-cache'
  }
};

/**
 * Configuração de endpoints por ambiente
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ...ENDPOINTS_CONFIG,
    primary: {
      csv: './data-templates/example-apontamentos.csv',
      json: './data-templates/example-fleet-data.json'
    },
    cache: {
      ...ENDPOINTS_CONFIG.cache,
      maxAge: 60000 // 1 minuto em dev
    }
  },
  
  staging: {
    ...ENDPOINTS_CONFIG,
    retry: {
      ...ENDPOINTS_CONFIG.retry,
      attempts: 5,
      delay: 2000
    }
  },
  
  production: ENDPOINTS_CONFIG
};

/**
 * Classe para gerenciamento de endpoints
 */
export class EndpointManager {
  constructor(environment = 'production') {
    this.config = ENVIRONMENT_CONFIGS[environment] || ENDPOINTS_CONFIG;
    this.cache = new Map();
    this.failures = new Map();
  }
  
  /**
   * Constrói URL completa do GitHub
   */
  buildGitHubUrl(repo, file, branch = 'main', useApi = false) {
    const baseUrl = useApi ? this.config.github.baseUrl : this.config.github.rawUrl;
    
    if (useApi) {
      return `${baseUrl}/repos/${repo}/contents/${file}?ref=${branch}`;
    } else {
      return `${baseUrl}/${repo}/${branch}/${file}`;
    }
  }
  
  /**
   * Obtém configuração de retry baseada no histórico de falhas
   */
  getRetryConfig(url) {
    const failures = this.failures.get(url) || 0;
    const baseConfig = { ...this.config.retry };
    
    // Aumenta delay baseado no histórico de falhas
    if (failures > 0) {
      baseConfig.delay = Math.min(
        baseConfig.delay * Math.pow(2, failures),
        baseConfig.maxDelay
      );
    }
    
    return baseConfig;
  }
  
  /**
   * Registra falha de endpoint
   */
  recordFailure(url) {
    const current = this.failures.get(url) || 0;
    this.failures.set(url, current + 1);
    
    // Limpa registros antigos após 24h
    setTimeout(() => {
      if (this.failures.get(url) === current + 1) {
        this.failures.delete(url);
      }
    }, 24 * 60 * 60 * 1000);
  }
  
  /**
   * Limpa falha registrada (em caso de sucesso)
   */
  clearFailure(url) {
    this.failures.delete(url);
  }
  
  /**
   * Verifica se endpoint está em estado de falha
   */
  isEndpointHealthy(url) {
    const failures = this.failures.get(url) || 0;
    return failures < this.config.retry.attempts;
  }
  
  /**
   * Obtém URLs priorizadas (primária + fallbacks)
   */
  getPrioritizedUrls(type) {
    const urls = [];
    
    // URL primária
    if (this.config.primary[type] && this.isEndpointHealthy(this.config.primary[type])) {
      urls.push({
        url: this.config.primary[type],
        type: 'primary',
        priority: 1
      });
    }
    
    // URL de fallback
    if (this.config.fallback[type]) {
      urls.push({
        url: this.config.fallback[type],
        type: 'fallback',
        priority: 2
      });
    }
    
    return urls.sort((a, b) => a.priority - b.priority);
  }
}

/**
 * Utilitário para validar URLs
 */
export function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'file:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Utilitário para construir headers com autenticação
 */
export function buildAuthHeaders(token, additionalHeaders = {}) {
  const headers = { ...ENDPOINTS_CONFIG.headers, ...additionalHeaders };
  
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  return headers;
}

/**
 * Configuração de monitoramento de endpoints
 */
export const MONITORING_CONFIG = {
  enabled: true,
  checkInterval: 300000, // 5 minutos
  healthThreshold: 0.8, // 80% de sucesso
  alertOnFailure: true,
  metrics: {
    responseTime: true,
    successRate: true,
    errorCodes: true
  }
};
