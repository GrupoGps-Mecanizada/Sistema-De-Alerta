/**
 * Sistema de Alertas Principal - AlertSystem.js
 * Classe principal que orquestra todos os módulos do sistema
 */

import { ConsolidationEngine } from './ConsolidationEngine.js';
import { RuleEngine } from './RuleEngine.js';
import { StateManager } from './StateManager.js';
import { SyncManager } from '../modules/sync/SyncManager.js';
import { GroupManager } from '../modules/equipment/GroupManager.js';
import { AlertGenerator } from '../modules/alerts/AlertGenerator.js';
import { AlertDeduplicator } from '../modules/alerts/AlertDeduplicator.js';
import { ReportGenerator } from '../modules/reports/ReportGenerator.js';
import { UIManager } from '../modules/ui/UIManager.js';
import { PerformanceTimer } from '../utils/performance.js';
import { Logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { DEFAULT_CONFIG } from '../config/default.js';

export class AlertSystem {
  constructor(config = {}) {
    // Mesclar configuração customizada com padrão
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
    
    // Inicializar logger
    this.logger = new Logger('AlertSystem', this.config.logging);
    
    // Inicializar handler de erros
    this.errorHandler = new ErrorHandler(this.config.logging);
    
    // Estado do sistema
    this.isInitialized = false;
    this.isProcessing = false;
    this.lastSyncTime = null;
    
    // Dados principais
    this.csvData = [];
    this.jsonData = [];
    this.equipmentMap = new Map();
    this.alerts = [];
    this.rules = [];
    
    // Métricas de performance
    this.metrics = {
      processingTime: 0,
      consolidatedEvents: 0,
      alertsGenerated: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Inicializar módulos principais
    this.initializeModules();
  }
  
  /**
   * Inicializa todos os módulos do sistema
   */
  initializeModules() {
    try {
      // Módulos core
      this.stateManager = new StateManager(this.config.cache);
      this.consolidationEngine = new ConsolidationEngine(this.config.consolidation);
      this.ruleEngine = new RuleEngine(this.config.rules);
      
      // Módulos de sincronização
      this.syncManager = new SyncManager(this.config.github, this.config.endpoints);
      
      // Módulos de equipamentos
      this.groupManager = new GroupManager(this.config.equipmentGroups);
      
      // Módulos de alertas
      this.alertGenerator = new AlertGenerator(this.config.alerts);
      this.alertDeduplicator = new AlertDeduplicator(this.config.alerts.deduplication);
      
      // Módulos de relatórios
      this.reportGenerator = new ReportGenerator(this.config.reports);
      
      // Módulo de interface (apenas em ambiente browser)
      if (typeof window !== 'undefined') {
        this.uiManager = new UIManager(this.config.ui);
      }
      
      this.logger.info('Módulos inicializados com sucesso');
      
    } catch (error) {
      this.logger.error('Erro ao inicializar módulos', { error: error.message });
      throw new Error(`Falha na inicialização dos módulos: ${error.message}`);
    }
  }
  
  /**
   * Inicializa o sistema completo
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.warn('Sistema já inicializado');
      return;
    }
    
    this.logger.info('Iniciando sistema de alertas', { version: this.config.system.version });
    const startTime = PerformanceTimer.start();
    
    try {
      // Carregar dados salvos
      await this.loadStoredData();
      
      // Sincronizar dados remotos
      await this.syncData();
      
      // Processar dados iniciais
      await this.processInitialData();
      
      // Inicializar interface (se disponível)
      if (this.uiManager) {
        await this.uiManager.initialize();
        this.setupUIEventListeners();
      }
      
      // Iniciar tarefas em background
      this.startBackgroundTasks();
      
      this.isInitialized = true;
      
      const duration = PerformanceTimer.end(startTime);
      this.metrics.processingTime = duration;
      
      this.logger.info('Sistema inicializado com sucesso', { 
        duration: `${duration}ms`,
        csvRecords: this.csvData.length,
        jsonRecords: this.jsonData.length,
        equipments: this.equipmentMap.size,
        rules: this.rules.length,
        alerts: this.alerts.length
      });
      
    } catch (error) {
      this.logger.error('Erro na inicialização do sistema', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Carrega dados salvos do armazenamento local e estado
   */
  async loadStoredData() {
    try {
      // Carregar regras
      const storedRules = await this.stateManager.load('rules');
      if (storedRules && Array.isArray(storedRules)) {
        this.rules = storedRules;
        this.logger.debug('Regras carregadas do armazenamento', { count: this.rules.length });
      }
      
      // Carregar alertas
      const storedAlerts = await this.stateManager.load('alerts');
      if (storedAlerts && Array.isArray(storedAlerts)) {
        this.alerts = this.filterRecentAlerts(storedAlerts);
        this.logger.debug('Alertas carregados do armazenamento', { count: this.alerts.length });
      }
      
      // Carregar estados ativos
      const activeStates = await this.stateManager.load('activeStates');
      if (activeStates) {
        this.consolidationEngine.setActiveStates(activeStates);
        this.logger.debug('Estados ativos carregados');
      }
      
      // Usar dados de exemplo se não houver dados armazenados
      if (this.config.development.useExampleData && this.csvData.length === 0) {
        this.loadExampleData();
      }
      
    } catch (error) {
      this.logger.warn('Erro ao carregar dados armazenados', { error: error.message });
      
      // Fallback para dados de exemplo
      if (this.config.development.useExampleData) {
        this.loadExampleData();
      }
    }
  }
  
  /**
   * Sincroniza dados remotos (CSV, JSON, GitHub)
   */
  async syncData() {
    try {
      this.logger.info('Iniciando sincronização de dados');
      
      const syncResults = await this.errorHandler.handleWithFallback(
        () => this.syncManager.syncAllData(),
        () => this.handleSyncFallback()
      );
      
      if (syncResults.csvData) {
        this.csvData = syncResults.csvData;
        this.logger.debug('Dados CSV sincronizados', { records: this.csvData.length });
      }
      
      if (syncResults.jsonData) {
        this.jsonData = syncResults.jsonData;
        this.logger.debug('Dados JSON sincronizados', { records: this.jsonData.length });
      }
      
      if (syncResults.githubData) {
        await this.processGitHubData(syncResults.githubData);
      }
      
      this.lastSyncTime = Date.now();
      
    } catch (error) {
      this.logger.warn('Falha na sincronização de dados', { error: error.message });
      
      // Sistema deve continuar funcionando mesmo sem sincronização
      if (this.csvData.length === 0 && this.jsonData.length === 0) {
        this.loadExampleData();
      }
    }
  }
  
  /**
   * Processa dados iniciais após carregamento
   */
  async processInitialData() {
    try {
      // Unificar dados de equipamentos
      this.unifyEquipmentData();
      
      // Classificar equipamentos em grupos
      await this.classifyEquipments();
      
      // Consolidar eventos
      await this.consolidateEvents();
      
      // Processar alertas iniciais
      await this.processAlerts();
      
      this.logger.info('Processamento inicial concluído', {
        equipments: this.equipmentMap.size,
        consolidatedEvents: this.metrics.consolidatedEvents,
        alerts: this.alerts.length
      });
      
    } catch (error) {
      this.logger.error('Erro no processamento inicial', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Unifica dados de CSV e JSON em estrutura de equipamentos
   */
  unifyEquipmentData() {
    this.equipmentMap.clear();
    
    // Processar dados CSV (apontamentos)
    this.csvData.forEach(record => {
      const equipName = this.normalizeEquipmentName(record.Vaga || record.Placa);
      if (!this.equipmentMap.has(equipName)) {
        this.equipmentMap.set(equipName, {
          name: equipName,
          apontamentos: [],
          status: [],
          groups: []
        });
      }
      this.equipmentMap.get(equipName).apontamentos.push(record);
    });
    
    // Processar dados JSON (status)
    this.jsonData.forEach(record => {
      const equipName = this.normalizeEquipmentName(record.vacancy_name);
      if (!this.equipmentMap.has(equipName)) {
        this.equipmentMap.set(equipName, {
          name: equipName,
          apontamentos: [],
          status: [],
          groups: []
        });
      }
      this.equipmentMap.get(equipName).status.push(record);
    });
    
    this.logger.debug('Dados de equipamentos unificados', { count: this.equipmentMap.size });
  }
  
  /**
   * Classifica equipamentos em grupos automaticamente
   */
  async classifyEquipments() {
    for (const [equipName, equipData] of this.equipmentMap) {
      const groups = this.groupManager.detectGroups(equipName);
      equipData.groups = groups;
    }
    
    this.logger.debug('Equipamentos classificados em grupos');
  }
  
  /**
   * Consolida eventos contínuos
   */
  async consolidateEvents() {
    if (!this.config.consolidation.enabled) {
      this.logger.info('Consolidação desabilitada');
      return;
    }
    
    this.logger.info('Iniciando consolidação de eventos');
    const startTime = PerformanceTimer.start();
    
    try {
      let totalConsolidated = 0;
      
      for (const [equipName, equipData] of this.equipmentMap) {
        // Consolidar eventos de status
        const consolidatedStatus = this.consolidationEngine.consolidateEvents(
          equipData.status, 'status'
        );
        
        // Consolidar apontamentos
        const consolidatedApontamentos = this.consolidationEngine.consolidateEvents(
          equipData.apontamentos, 'apontamento'
        );
        
        equipData.consolidatedStatus = consolidatedStatus;
        equipData.consolidatedApontamentos = consolidatedApontamentos;
        
        totalConsolidated += consolidatedStatus.length + consolidatedApontamentos.length;
      }
      
      const duration = PerformanceTimer.end(startTime);
      this.metrics.consolidatedEvents = totalConsolidated;
      
      this.logger.info('Consolidação concluída', {
        duration: `${duration}ms`,
        totalEvents: totalConsolidated
      });
      
    } catch (error) {
      this.logger.error('Erro na consolidação de eventos', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Processa regras e gera alertas
   */
  async processAlerts() {
    if (this.isProcessing) {
      this.logger.warn('Processamento já em andamento');
      return;
    }
    
    this.isProcessing = true;
    this.logger.info('Iniciando processamento de alertas');
    const startTime = PerformanceTimer.start();
    
    try {
      const newAlerts = [];
      
      for (const [equipName, equipData] of this.equipmentMap) {
        for (const rule of this.rules.filter(r => r.active)) {
          // Verificar se regra se aplica aos grupos do equipamento
          if (!this.ruleEngine.shouldApplyRule(rule, equipData.groups)) {
            continue;
          }
          
          // Processar regra
          const ruleAlerts = await this.ruleEngine.processRule(
            rule, equipName, equipData
          );
          
          newAlerts.push(...ruleAlerts);
        }
      }
      
      // Deduplicar alertas
      const uniqueAlerts = this.alertDeduplicator.deduplicate(newAlerts, this.alerts);
      
      // Adicionar novos alertas únicos
      if (uniqueAlerts.length > 0) {
        this.alerts.unshift(...uniqueAlerts);
        this.metrics.alertsGenerated += uniqueAlerts.length;
        
        // Salvar alertas
        await this.stateManager.save('alerts', this.alerts);
        
        this.logger.info('Novos alertas gerados', { count: uniqueAlerts.length });
      }
      
      const duration = PerformanceTimer.end(startTime);
      this.logger.debug('Processamento de alertas concluído', { duration: `${duration}ms` });
      
    } catch (error) {
      this.logger.error('Erro no processamento de alertas', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Adiciona nova regra ao sistema
   */
  async addRule(rule) {
    try {
      // Validar regra
      const validation = this.ruleEngine.validateRule(rule);
      if (!validation.valid) {
        throw new Error(`Regra inválida: ${validation.errors.join(', ')}`);
      }
      
      // Atribuir ID único
      rule.id = rule.id || Date.now();
      rule.active = rule.active !== false;
      
      // Adicionar à lista
      this.rules.push(rule);
      
      // Salvar regras
      await this.stateManager.save('rules', this.rules);
      
      // Sincronizar com GitHub se configurado
      if (this.config.github.enabled && this.config.github.token) {
        await this.syncManager.saveRulesToGitHub(this.rules);
      }
      
      this.logger.info('Nova regra adicionada', { 
        id: rule.id, 
        name: rule.name,
        type: rule.type || 'simple'
      });
      
      return rule;
      
    } catch (error) {
      this.logger.error('Erro ao adicionar regra', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Remove regra do sistema
   */
  async removeRule(ruleId) {
    try {
      const index = this.rules.findIndex(r => r.id === ruleId);
      if (index === -1) {
        throw new Error(`Regra com ID ${ruleId} não encontrada`);
      }
      
      const removedRule = this.rules.splice(index, 1)[0];
      
      // Salvar regras
      await this.stateManager.save('rules', this.rules);
      
      // Sincronizar com GitHub se configurado
      if (this.config.github.enabled && this.config.github.token) {
        await this.syncManager.saveRulesToGitHub(this.rules);
      }
      
      this.logger.info('Regra removida', { id: ruleId, name: removedRule.name });
      
      return removedRule;
      
    } catch (error) {
      this.logger.error('Erro ao remover regra', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Obtém alertas com filtros opcionais
   */
  getAlerts(filters = {}) {
    let filteredAlerts = [...this.alerts];
    
    // Filtro por grupos de equipamentos
    if (filters.equipmentGroups && filters.equipmentGroups.length > 0) {
      filteredAlerts = filteredAlerts.filter(alert => {
        const equipData = this.equipmentMap.get(alert.equipamento);
        if (!equipData) return false;
        
        return filters.equipmentGroups.some(group => 
          equipData.groups.includes(group)
        );
      });
    }
    
    // Filtro por gravidade
    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.severity === filters.severity
      );
    }
    
    // Filtro por período
    if (filters.period) {
      const now = Date.now();
      let cutoffTime;
      
      switch (filters.period) {
        case 'today':
          cutoffTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = 0;
      }
      
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.timestamp >= cutoffTime
      );
    }
    
    return filteredAlerts;
  }
  
  /**
   * Gera relatório com filtros
   */
  async generateReport(filters = {}) {
    try {
      const alerts = this.getAlerts(filters);
      
      const report = await this.reportGenerator.generate(alerts, {
        includeAnalytics: this.config.reports.analytics.enabled,
        format: filters.format || this.config.reports.defaultFormat,
        equipmentMap: this.equipmentMap,
        groupManager: this.groupManager
      });
      
      this.logger.info('Relatório gerado', { 
        totalAlerts: alerts.length,
        format: report.format
      });
      
      return report;
      
    } catch (error) {
      this.logger.error('Erro ao gerar relatório', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Força nova sincronização e processamento
   */
  async refresh() {
    try {
      this.logger.info('Forçando atualização do sistema');
      
      await this.syncData();
      this.unifyEquipmentData();
      await this.classifyEquipments();
      await this.consolidateEvents();
      await this.processAlerts();
      
      if (this.uiManager) {
        this.uiManager.refreshInterface();
      }
      
      this.logger.info('Atualização concluída');
      
    } catch (error) {
      this.logger.error('Erro na atualização', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Obtém métricas de performance do sistema
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.isInitialized ? Date.now() - this.lastSyncTime : 0,
      equipmentCount: this.equipmentMap.size,
      ruleCount: this.rules.length,
      alertCount: this.alerts.length,
      lastSync: this.lastSyncTime
    };
  }
  
  // Métodos auxiliares privados
  
  mergeConfig(baseConfig, customConfig) {
    const result = JSON.parse(JSON.stringify(baseConfig));
    
    function merge(target, source) {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = target[key] || {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      });
    }
    
    merge(result, customConfig);
    return result;
  }
  
  normalizeEquipmentName(name) {
    if (!name) return 'Equipamento Desconhecido';
    
    return name.toUpperCase().trim()
      .replace(/\s+/g, ' ')
      .replace(/CAMINHÃO/g, 'CAMINHAO')
      .replace(/VÁCUO/g, 'VACUO')
      .replace(/PRESSÃO/g, 'PRESSAO');
  }
  
  filterRecentAlerts(alerts) {
    const maxAge = this.config.alerts.retention.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    
    return alerts.filter(alert => alert.timestamp > cutoff);
  }
  
  loadExampleData() {
    // Dados de exemplo serão implementados nos templates
    this.logger.info('Carregando dados de exemplo para desenvolvimento');
  }
  
  async handleSyncFallback() {
    this.logger.warn('Usando dados locais como fallback');
    return {
      csvData: this.csvData,
      jsonData: this.jsonData,
      githubData: null
    };
  }
  
  async processGitHubData(githubData) {
    if (githubData.rules) {
      this.rules = githubData.rules;
      await this.stateManager.save('rules', this.rules);
    }
    
    if (githubData.alerts) {
      // Merge com alertas locais, evitando duplicatas
      const mergedAlerts = this.alertDeduplicator.deduplicate(
        githubData.alerts, this.alerts
      );
      this.alerts.unshift(...mergedAlerts);
      await this.stateManager.save('alerts', this.alerts);
    }
  }
  
  setupUIEventListeners() {
    // Event listeners serão implementados no UIManager
  }
  
  startBackgroundTasks() {
    if (!this.config.github.autoSync) return;
    
    // Sincronização periódica
    setInterval(() => {
      if (!this.isProcessing) {
        this.refresh().catch(error => 
          this.logger.warn('Erro na sincronização automática', { error: error.message })
        );
      }
    }, this.config.github.syncInterval);
    
    // Limpeza periódica
    setInterval(() => {
      this.cleanupOldData();
    }, this.config.cache.cleanup.interval);
  }
  
  cleanupOldData() {
    const maxAge = this.config.cache.cleanup.maxAge;
    const cutoff = Date.now() - maxAge;
    
    const originalCount = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
    
    if (this.alerts.length !== originalCount) {
      this.stateManager.save('alerts', this.alerts);
      this.logger.info('Limpeza automática executada', {
        removed: originalCount - this.alerts.length,
        remaining: this.alerts.length
      });
    }
  }
}

export default AlertSystem;
