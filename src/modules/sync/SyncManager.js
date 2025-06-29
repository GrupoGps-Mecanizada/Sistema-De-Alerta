/**
 * Gerenciador de Sincronização - SyncManager.js
 * Orquestra sincronização entre múltiplas fontes de dados
 */

import { GitHubAdapter } from './GitHubAdapter.js';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { Logger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/errorHandler.js';
import { PerformanceTimer } from '../../utils/performance.js';

export class SyncManager {
  constructor(githubConfig = {}, endpointsConfig = {}) {
    this.githubConfig = githubConfig;
    this.endpointsConfig = endpointsConfig;
    
    this.logger = new Logger('SyncManager');
    this.errorHandler = new ErrorHandler();
    
    // Inicializar adapters
    this.githubAdapter = new GitHubAdapter(githubConfig);
    this.localStorageAdapter = new LocalStorageAdapter();
    
    // Estado de sincronização
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncQueue = [];
    
    // Métricas de sincronização
    this.metrics = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageSyncTime: 0,
      lastSyncDuration: 0,
      dataSourceStatus: {
        csv: 'unknown',
        json: 'unknown',
        github: 'unknown'
      }
    };
    
    // Cache de dados sincronizados
    this.syncedData = {
      csvData: [],
      jsonData: [],
      githubData: {
        rules: [],
        alerts: [],
        states: {}
      }
    };
  }
  
  /**
   * Sincroniza todos os dados disponíveis
   */
  async syncAllData() {
    if (this.syncInProgress) {
      this.logger.warn('Sincronização já em andamento');
      return this.syncedData;
    }
    
    this.syncInProgress = true;
    const startTime = PerformanceTimer.start();
    
    this.logger.info('Iniciando sincronização completa de dados');
    
    try {
      this.metrics.totalSyncs++;
      
      // Sincronização paralela de diferentes fontes
      const syncPromises = [
        this.syncCSVData(),
        this.syncJSONData(),
        this.syncGitHubData()
      ];
      
      const results = await Promise.allSettled(syncPromises);
      
      // Processar resultados
      this.processSyncResults(results);
      
      // Atualizar métricas
      const duration = PerformanceTimer.end(startTime);
      this.updateSyncMetrics(duration, true);
      
      this.lastSyncTime = Date.now();
      this.metrics.successfulSyncs++;
      
      this.logger.info('Sincronização completa concluída', {
        duration: `${duration}ms`,
        csvRecords: this.syncedData.csvData.length,
        jsonRecords: this.syncedData.jsonData.length,
        githubFiles: Object.keys(this.syncedData.githubData).length
      });
      
      return this.syncedData;
      
    } catch (error) {
      this.metrics.failedSyncs++;
      this.logger.error('Erro na sincronização completa', { error: error.message });
      throw error;
      
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Sincroniza dados CSV de apontamentos
   */
  async syncCSVData() {
    try {
      this.logger.debug('Sincronizando dados CSV');
      
      const primaryUrl = this.endpointsConfig.primary?.csv;
      const fallbackUrl = this.endpointsConfig.fallback?.csv;
      
      let csvData = null;
      
      // Tentar URL primária
      if (primaryUrl) {
        try {
          const response = await this.fetchWithRetry(primaryUrl);
          const csvText = await response.text();
          csvData = this.parseCSVData(csvText);
          
          this.metrics.dataSourceStatus.csv = 'primary';
          this.logger.debug('Dados CSV obtidos da fonte primária', { 
            records: csvData.length 
          });
          
        } catch (error) {
          this.logger.warn('Falha na fonte primária de CSV', { error: error.message });
        }
      }
      
      // Fallback para fonte secundária
      if (!csvData && fallbackUrl) {
        try {
          const response = await this.fetchWithRetry(fallbackUrl);
          const csvText = await response.text();
          csvData = this.parseCSVData(csvText);
          
          this.metrics.dataSourceStatus.csv = 'fallback';
          this.logger.debug('Dados CSV obtidos da fonte de fallback', { 
            records: csvData.length 
          });
          
        } catch (error) {
          this.logger.warn('Falha na fonte de fallback de CSV', { error: error.message });
        }
      }
      
      // Usar dados de exemplo se nenhuma fonte funcionar
      if (!csvData) {
        csvData = this.getExampleCSVData();
        this.metrics.dataSourceStatus.csv = 'example';
        this.logger.info('Usando dados de exemplo para CSV');
      }
      
      this.syncedData.csvData = csvData;
      return csvData;
      
    } catch (error) {
      this.metrics.dataSourceStatus.csv = 'error';
      this.logger.error('Erro na sincronização de CSV', { error: error.message });
      
      // Fallback para dados armazenados localmente
      const storedData = await this.localStorageAdapter.load('csvData');
      if (storedData) {
        this.syncedData.csvData = storedData;
        this.metrics.dataSourceStatus.csv = 'cached';
        return storedData;
      }
      
      throw error;
    }
  }
  
  /**
   * Sincroniza dados JSON de status de equipamentos
   */
  async syncJSONData() {
    try {
      this.logger.debug('Sincronizando dados JSON');
      
      const primaryUrl = this.endpointsConfig.primary?.json;
      const fallbackUrl = this.endpointsConfig.fallback?.json;
      
      let jsonData = null;
      
      // Tentar URL primária
      if (primaryUrl) {
        try {
          const response = await this.fetchWithRetry(primaryUrl);
          const data = await response.json();
          jsonData = Array.isArray(data) ? data : (data.records || []);
          
          this.metrics.dataSourceStatus.json = 'primary';
          this.logger.debug('Dados JSON obtidos da fonte primária', { 
            records: jsonData.length 
          });
          
        } catch (error) {
          this.logger.warn('Falha na fonte primária de JSON', { error: error.message });
        }
      }
      
      // Fallback para fonte secundária
      if (!jsonData && fallbackUrl) {
        try {
          const response = await this.fetchWithRetry(fallbackUrl);
          const data = await response.json();
          jsonData = Array.isArray(data) ? data : (data.records || []);
          
          this.metrics.dataSourceStatus.json = 'fallback';
          this.logger.debug('Dados JSON obtidos da fonte de fallback', { 
            records: jsonData.length 
          });
          
        } catch (error) {
          this.logger.warn('Falha na fonte de fallback de JSON', { error: error.message });
        }
      }
      
      // Usar dados de exemplo se nenhuma fonte funcionar
      if (!jsonData) {
        jsonData = this.getExampleJSONData();
        this.metrics.dataSourceStatus.json = 'example';
        this.logger.info('Usando dados de exemplo para JSON');
      }
      
      this.syncedData.jsonData = jsonData;
      return jsonData;
      
    } catch (error) {
      this.metrics.dataSourceStatus.json = 'error';
      this.logger.error('Erro na sincronização de JSON', { error: error.message });
      
      // Fallback para dados armazenados localmente
      const storedData = await this.localStorageAdapter.load('jsonData');
      if (storedData) {
        this.syncedData.jsonData = storedData;
        this.metrics.dataSourceStatus.json = 'cached';
        return storedData;
      }
      
      throw error;
    }
  }
  
  /**
   * Sincroniza dados do GitHub (regras, alertas, estados)
   */
  async syncGitHubData() {
    try {
      this.logger.debug('Sincronizando dados do GitHub');
      
      if (!this.githubConfig.enabled || !this.githubConfig.repo) {
        this.logger.info('Sincronização GitHub desabilitada');
        this.metrics.dataSourceStatus.github = 'disabled';
        return {};
      }
      
      const githubData = await this.githubAdapter.syncAllFiles();
      
      this.syncedData.githubData = {
        rules: githubData.rules || [],
        alerts: githubData.alerts || [],
        states: githubData.states || {}
      };
      
      this.metrics.dataSourceStatus.github = 'success';
      this.logger.debug('Dados GitHub sincronizados', {
        rules: this.syncedData.githubData.rules.length,
        alerts: this.syncedData.githubData.alerts.length,
        states: Object.keys(this.syncedData.githubData.states).length
      });
      
      return this.syncedData.githubData;
      
    } catch (error) {
      this.metrics.dataSourceStatus.github = 'error';
      this.logger.warn('Erro na sincronização GitHub', { error: error.message });
      
      // Continuar sem dados GitHub em caso de erro
      this.syncedData.githubData = {
        rules: [],
        alerts: [],
        states: {}
      };
      
      return this.syncedData.githubData;
    }
  }
  
  /**
   * Salva regras no GitHub
   */
  async saveRulesToGitHub(rules) {
    try {
      if (!this.githubConfig.enabled || !this.githubConfig.token) {
        this.logger.warn('Salvamento no GitHub indisponível - token não configurado');
        return false;
      }
      
      const result = await this.githubAdapter.saveRules(rules);
      
      if (result.success) {
        this.logger.info('Regras salvas no GitHub', { count: rules.length });
        return true;
      } else {
        this.logger.error('Falha ao salvar regras no GitHub', { error: result.error });
        return false;
      }
      
    } catch (error) {
      this.logger.error('Erro ao salvar regras no GitHub', { error: error.message });
      return false;
    }
  }
  
  /**
   * Salva alertas no GitHub
   */
  async saveAlertsToGitHub(alerts) {
    try {
      if (!this.githubConfig.enabled || !this.githubConfig.token) {
        this.logger.warn('Salvamento no GitHub indisponível - token não configurado');
        return false;
      }
      
      const result = await this.githubAdapter.saveAlerts(alerts);
      
      if (result.success) {
        this.logger.info('Alertas salvos no GitHub', { count: alerts.length });
        return true;
      } else {
        this.logger.error('Falha ao salvar alertas no GitHub', { error: result.error });
        return false;
      }
      
    } catch (error) {
      this.logger.error('Erro ao salvar alertas no GitHub', { error: error.message });
      return false;
    }
  }
  
  /**
   * Processa resultados de sincronização paralela
   */
  processSyncResults(results) {
    results.forEach((result, index) => {
      const source = ['CSV', 'JSON', 'GitHub'][index];
      
      if (result.status === 'fulfilled') {
        this.logger.debug(`Sincronização ${source} bem-sucedida`);
      } else {
        this.logger.warn(`Sincronização ${source} falhou`, { 
          reason: result.reason?.message 
        });
      }
    });
  }
  
  /**
   * Fetch com retry automático
   */
  async fetchWithRetry(url, options = {}) {
    const retryConfig = this.endpointsConfig.retry || {
      attempts: 3,
      delay: 1000,
      backoff: 'exponential'
    };
    
    let lastError;
    
    for (let attempt = 1; attempt <= retryConfig.attempts; attempt++) {
      try {
        this.logger.debug(`Tentativa ${attempt} para ${url}`);
        
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30 segundos timeout
          headers: {
            'Accept': 'application/json,text/plain,*/*',
            'Cache-Control': 'no-cache',
            ...options.headers
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < retryConfig.attempts) {
          const delay = this.calculateRetryDelay(attempt, retryConfig);
          this.logger.debug(`Tentativa ${attempt} falhou, aguardando ${delay}ms`, {
            error: error.message
          });
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Calcula delay para retry
   */
  calculateRetryDelay(attempt, config) {
    switch (config.backoff) {
      case 'exponential':
        return config.delay * Math.pow(2, attempt - 1);
      case 'linear':
        return config.delay * attempt;
      default:
        return config.delay;
    }
  }
  
  /**
   * Utilitário para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Parse de dados CSV
   */
  parseCSVData(csvText) {
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(delimiter).map(h => h.replace(/"/g, '').trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = this.parseCSVLine(line, delimiter);
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].replace(/"/g, '').trim() : '';
      });
      
      if (row['Data Inicial'] && row['Data Final']) {
        data.push(row);
      }
    }
    
    return data;
  }
  
  /**
   * Parse de linha CSV considerando aspas
   */
  parseCSVLine(line, delimiter) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  }
  
  /**
   * Atualiza métricas de sincronização
   */
  updateSyncMetrics(duration, success) {
    this.metrics.lastSyncDuration = duration;
    
    if (success) {
      this.metrics.averageSyncTime = 
        (this.metrics.averageSyncTime * (this.metrics.successfulSyncs) + duration) / 
        (this.metrics.successfulSyncs + 1);
    }
  }
  
  /**
   * Obtém status de sincronização
   */
  getSyncStatus() {
    return {
      inProgress: this.syncInProgress,
      lastSync: this.lastSyncTime,
      lastSyncFormatted: this.lastSyncTime ? 
        new Date(this.lastSyncTime).toLocaleString('pt-BR') : 'Nunca',
      metrics: { ...this.metrics },
      dataSourceStatus: { ...this.metrics.dataSourceStatus },
      queueSize: this.syncQueue.length
    };
  }
  
  /**
   * Força nova sincronização
   */
  async forceSyncNow() {
    this.logger.info('Forçando nova sincronização');
    return await this.syncAllData();
  }
  
  /**
   * Dados de exemplo para CSV
   */
  getExampleCSVData() {
    const now = new Date();
    const baseTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const formatDateTime = (date) => {
      return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR')}`;
    };
    
    return [
      {
        'Placa': 'EGC2983',
        'Vaga': 'CAMINHÃO ALTA PRESSÃO - GPS - 11',
        'Categoria Demora': 'Documentação',
        'Data Inicial': formatDateTime(new Date(baseTime.getTime())),
        'Data Final': formatDateTime(new Date(baseTime.getTime() + 45 * 60 * 1000)),
        'Tempo Indisponível (HH:MM)': '00:45'
      },
      {
        'Placa': 'FSA3D71',
        'Vaga': 'CAMINHÃO AUTO VÁCUO - GPS - 05',
        'Categoria Demora': 'Refeição Motorista',
        'Data Inicial': formatDateTime(new Date(baseTime.getTime() + 60 * 60 * 1000)),
        'Data Final': formatDateTime(new Date(baseTime.getTime() + 90 * 60 * 1000)),
        'Tempo Indisponível (HH:MM)': '00:30'
      }
    ];
  }
  
  /**
   * Dados de exemplo para JSON
   */
  getExampleJSONData() {
    const now = new Date();
    const baseTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    return [
      {
        vacancy_code: "404",
        vacancy_name: "CAMINHÃO ALTA PRESSÃO - GPS - 11",
        status: "off",
        status_title: "Motor Desligado",
        start: new Date(baseTime.getTime()).toISOString(),
        end: new Date(baseTime.getTime() + 45 * 60 * 1000).toISOString(),
        total_time: "0.75"
      },
      {
        vacancy_code: "316",
        vacancy_name: "CAMINHÃO AUTO VÁCUO - GPS - 05",
        status: "on",
        status_title: "Motor Ligado",
        start: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
        total_time: "1.0"
      }
    ];
  }
}

export default SyncManager;
