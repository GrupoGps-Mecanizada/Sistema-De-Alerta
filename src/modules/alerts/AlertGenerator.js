/**
 * Gerador de Alertas - AlertGenerator.js
 * Responsável por criar alertas baseados em regras e eventos consolidados
 */

import { Logger } from '../../utils/logger.js';
import { generateHash } from '../../utils/hash.js';

export class AlertGenerator {
  constructor(config = {}) {
    this.config = {
      enableTemplating: true,
      enableContextualInfo: true,
      enableSeverityScaling: false,
      enableGroupSpecificMessages: true,
      defaultTemplate: '{equipamento} - {evento} há {tempo}',
      timeoutMinutes: 5,
      ...config
    };
    
    this.logger = new Logger('AlertGenerator');
    
    // Templates de mensagens por grupo
    this.groupTemplates = new Map();
    
    // Métricas
    this.metrics = {
      alertsGenerated: 0,
      templatesUsed: 0,
      contextualInfoAdded: 0,
      errorCount: 0,
      averageGenerationTime: 0
    };
    
    this.initializeGroupTemplates();
    
    this.logger.debug('AlertGenerator inicializado', {
      templating: this.config.enableTemplating,
      contextual: this.config.enableContextualInfo
    });
  }
  
  /**
   * Gera alerta baseado em regra e evento
   */
  generateAlert(rule, equipmentName, event, equipmentData = {}) {
    const startTime = performance.now();
    
    try {
      this.metrics.alertsGenerated++;
      
      // Preparar dados básicos do alerta
      const alertData = {
        id: this.generateAlertId(),
        uniqueId: this.generateUniqueId(rule, equipmentName, event),
        equipamento: equipmentName,
        equipmentGroups: equipmentData.groups || [],
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type || 'simple',
        severity: rule.severity || 'medium',
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('pt-BR'),
        time: new Date().toLocaleTimeString('pt-BR')
      };
      
      // Adicionar informações do evento
      this.addEventInformation(alertData, event);
      
      // Gerar mensagem
      alertData.message = this.generateMessage(rule, alertData, equipmentData);
      
      // Adicionar informações contextuais
      if (this.config.enableContextualInfo) {
        this.addContextualInformation(alertData, equipmentData);
      }
      
      // Escalar severidade se habilitado
      if (this.config.enableSeverityScaling) {
        this.scaleSeverity(alertData, equipmentData);
      }
      
      // Adicionar metadados de geração
      alertData.metadata = this.generateMetadata(rule, event, equipmentData);
      
      // Calcular tempo de geração
      const generationTime = performance.now() - startTime;
      this.updateMetrics(generationTime);
      
      this.logger.debug('Alerta gerado', {
        id: alertData.id,
        equipment: equipmentName,
        rule: rule.name,
        severity: alertData.severity,
        generationTime: `${generationTime.toFixed(2)}ms`
      });
      
      return alertData;
      
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Erro ao gerar alerta', {
        rule: rule.name,
        equipment: equipmentName,
        error: error.message
      });
      
      // Retornar alerta básico em caso de erro
      return this.generateFallbackAlert(rule, equipmentName, event, error);
    }
  }
  
  /**
   * Adiciona informações do evento ao alerta
   */
  addEventInformation(alertData, event) {
    if (!event) return;
    
    // Informações básicas do evento
    alertData.eventType = event.eventType || 'unknown';
    alertData.eventIdentifier = event.identifier || 'N/A';
    alertData.duration = this.formatDuration(event.duration || 0);
    alertData.durationMinutes = event.duration || 0;
    
    // Período de tempo
    if (event.startTime && event.endTime) {
      alertData.startTime = event.startTime;
      alertData.endTime = event.endTime;
      alertData.timeRange = this.formatTimeRange(event.startTime, event.endTime);
    }
    
    // Informações de consolidação
    alertData.consolidated = event.consolidated || false;
    alertData.recordCount = event.recordCount || 1;
    
    // Eficiência de consolidação
    if (event.consolidationMetadata) {
      alertData.consolidationEfficiency = event.consolidationMetadata.efficiency;
      alertData.gapsEliminated = event.consolidationMetadata.totalGaps || 0;
    }
  }
  
  /**
   * Gera mensagem do alerta
   */
  generateMessage(rule, alertData, equipmentData = {}) {
    let template = rule.message || this.config.defaultTemplate;
    
    // Usar template específico do grupo se disponível
    if (this.config.enableGroupSpecificMessages && alertData.equipmentGroups.length > 0) {
      const groupTemplate = this.getGroupTemplate(alertData.equipmentGroups[0]);
      if (groupTemplate) {
        template = groupTemplate;
        this.metrics.templatesUsed++;
      }
    }
    
    // Substituir placeholders
    return this.replacePlaceholders(template, alertData, equipmentData);
  }
  
  /**
   * Substitui placeholders na mensagem
   */
  replacePlaceholders(template, alertData, equipmentData = {}) {
    const placeholderMap = {
      '{equipamento}': this.formatEquipmentName(alertData.equipamento),
      '{evento}': alertData.eventIdentifier || 'evento',
      '{apontamento}': alertData.eventType === 'apontamento' ? alertData.eventIdentifier : '',
      '{status}': alertData.eventType === 'status' ? alertData.eventIdentifier : '',
      '{tempo}': alertData.duration || '0min',
      '{duracao}': alertData.duration || '0min',
      '{periodo}': alertData.timeRange || '',
      '{grupos}': alertData.equipmentGroups.join(', ') || '',
      '{tipo}': alertData.eventType || '',
      '{registros}': alertData.recordCount?.toString() || '1',
      '{data}': alertData.date || '',
      '{hora}': alertData.time || '',
      '{gravidade}': alertData.severity || 'medium'
    };
    
    // Placeholders contextuais
    if (equipmentData) {
      placeholderMap['{grupo_principal}'] = alertData.equipmentGroups[0] || '';
      placeholderMap['{total_grupos}'] = alertData.equipmentGroups.length.toString();
    }
    
    let message = template;
    
    // Substituir placeholders
    Object.entries(placeholderMap).forEach(([placeholder, value]) => {
      message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    });
    
    // Limpar placeholders não reconhecidos se configurado
    if (this.config.cleanUnknownPlaceholders) {
      message = message.replace(/\{[^}]+\}/g, '');
    }
    
    return message.trim();
  }
  
  /**
   * Adiciona informações contextuais ao alerta
   */
  addContextualInformation(alertData, equipmentData) {
    if (!equipmentData) return;
    
    // Informações operacionais
    if (equipmentData.status && Array.isArray(equipmentData.status)) {
      const recentStatuses = equipmentData.status.slice(-5);
      alertData.recentStatuses = recentStatuses.map(s => s.status || s.identifier);
      
      // Calcular taxa de utilização
      const onCount = recentStatuses.filter(s => (s.status || s.identifier) === 'on').length;
      alertData.utilizationRate = recentStatuses.length > 0 ? 
        Math.round((onCount / recentStatuses.length) * 100) : 0;
    }
    
    // Padrões de apontamentos
    if (equipmentData.apontamentos && Array.isArray(equipmentData.apontamentos)) {
      const recentApontamentos = equipmentData.apontamentos.slice(-5);
      const categories = recentApontamentos.map(a => a['Categoria Demora'] || a.categoria);
      alertData.recentApontamentos = [...new Set(categories)];
      
      // Frequência do tipo atual
      if (alertData.eventIdentifier) {
        const currentTypeCount = categories.filter(c => c === alertData.eventIdentifier).length;
        alertData.eventFrequency = recentApontamentos.length > 0 ? 
          Math.round((currentTypeCount / recentApontamentos.length) * 100) : 0;
      }
    }
    
    // Informações de grupos
    if (alertData.equipmentGroups.length > 0) {
      alertData.primaryGroup = alertData.equipmentGroups[0];
      alertData.groupCount = alertData.equipmentGroups.length;
      alertData.hasMultipleGroups = alertData.equipmentGroups.length > 1;
    }
    
    // Classificação de criticidade
    alertData.criticalityScore = this.calculateCriticalityScore(alertData, equipmentData);
    
    this.metrics.contextualInfoAdded++;
  }
  
  /**
   * Calcula score de criticidade do alerta
   */
  calculateCriticalityScore(alertData, equipmentData) {
    let score = 0;
    
    // Score base por severidade
    const severityScores = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    score += severityScores[alertData.severity] || 2;
    
    // Bonus por duração
    if (alertData.durationMinutes > 60) score += 2;
    else if (alertData.durationMinutes > 30) score += 1;
    
    // Bonus por consolidação (indica problema persistente)
    if (alertData.consolidated) score += 1;
    
    // Bonus por alta utilização
    if (alertData.utilizationRate && alertData.utilizationRate > 80) score += 1;
    
    // Bonus por frequência do evento
    if (alertData.eventFrequency && alertData.eventFrequency > 50) score += 1;
    
    // Normalizar para 0-10
    return Math.min(10, Math.max(0, score));
  }
  
  /**
   * Escala severidade baseada em contexto
   */
  scaleSeverity(alertData, equipmentData) {
    const originalSeverity = alertData.severity;
    
    // Fatores de escalamento
    let scaleUp = false;
    let scaleDown = false;
    
    // Escalar para cima se:
    if (alertData.durationMinutes > 120) scaleUp = true; // Muito longa duração
    if (alertData.consolidated && alertData.recordCount > 10) scaleUp = true; // Muitos registros
    if (alertData.utilizationRate && alertData.utilizationRate > 90) scaleUp = true; // Alta utilização
    
    // Escalar para baixo se:
    if (alertData.durationMinutes < 5) scaleDown = true; // Duração muito curta
    if (alertData.utilizationRate && alertData.utilizationRate < 10) scaleDown = true; // Baixa utilização
    
    // Aplicar escalamento
    if (scaleUp && !scaleDown) {
      alertData.severity = this.increaseSeverity(originalSeverity);
      if (alertData.severity !== originalSeverity) {
        alertData.severityScaled = true;
        alertData.originalSeverity = originalSeverity;
      }
    } else if (scaleDown && !scaleUp) {
      alertData.severity = this.decreaseSeverity(originalSeverity);
      if (alertData.severity !== originalSeverity) {
        alertData.severityScaled = true;
        alertData.originalSeverity = originalSeverity;
      }
    }
  }
  
  /**
   * Aumenta severidade
   */
  increaseSeverity(severity) {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(severity);
    return currentIndex < severityOrder.length - 1 ? 
      severityOrder[currentIndex + 1] : severity;
  }
  
  /**
   * Diminui severidade
   */
  decreaseSeverity(severity) {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(severity);
    return currentIndex > 0 ? 
      severityOrder[currentIndex - 1] : severity;
  }
  
  /**
   * Gera metadados do alerta
   */
  generateMetadata(rule, event, equipmentData) {
    return {
      generatedAt: new Date().toISOString(),
      ruleConditions: rule.conditions || {},
      eventData: {
        type: event?.eventType || 'unknown',
        duration: event?.duration || 0,
        consolidated: event?.consolidated || false,
        originalRecords: event?.recordCount || 1
      },
      equipmentInfo: {
        groups: equipmentData.groups || [],
        hasStatusData: !!(equipmentData.status && equipmentData.status.length > 0),
        hasApontamentos: !!(equipmentData.apontamentos && equipmentData.apontamentos.length > 0)
      },
      generator: {
        version: '2.1.0',
        features: {
          templating: this.config.enableTemplating,
          contextual: this.config.enableContextualInfo,
          severityScaling: this.config.enableSeverityScaling
        }
      }
    };
  }
  
  /**
   * Gera alerta de fallback em caso de erro
   */
  generateFallbackAlert(rule, equipmentName, event, error) {
    return {
      id: this.generateAlertId(),
      uniqueId: generateHash(`${equipmentName}_${rule.id}_${Date.now()}`),
      equipamento: equipmentName,
      equipmentGroups: [],
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type || 'simple',
      severity: 'medium',
      message: `${this.formatEquipmentName(equipmentName)} - Erro na geração de alerta`,
      eventType: 'error',
      duration: '0min',
      consolidated: false,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR'),
      error: true,
      errorMessage: error.message,
      metadata: {
        generatedAt: new Date().toISOString(),
        fallback: true,
        originalError: error.message
      }
    };
  }
  
  /**
   * Inicializa templates específicos por grupo
   */
  initializeGroupTemplates() {
    this.groupTemplates.set('ALTA_PRESSAO', 
      '{equipamento} (Alta Pressão) - {evento} há {tempo}');
    this.groupTemplates.set('AUTO_VACUO', 
      '{equipamento} (Auto Vácuo) - {evento} há {tempo}');
    this.groupTemplates.set('HIPER_VACUO', 
      '{equipamento} (Hiper Vácuo) - {evento} há {tempo}');
    this.groupTemplates.set('BROOK', 
      '{equipamento} (Brook) - {evento} há {tempo}');
    this.groupTemplates.set('TANQUE', 
      '{equipamento} (Tanque) - {evento} há {tempo}');
    this.groupTemplates.set('CAMINHAO', 
      '{equipamento} (Caminhão) - {evento} há {tempo}');
  }
  
  /**
   * Obtém template específico do grupo
   */
  getGroupTemplate(groupId) {
    return this.groupTemplates.get(groupId);
  }
  
  /**
   * Adiciona template customizado para grupo
   */
  addGroupTemplate(groupId, template) {
    if (!groupId || !template) {
      throw new Error('GroupId e template são obrigatórios');
    }
    
    this.groupTemplates.set(groupId, template);
    this.logger.debug('Template de grupo adicionado', { groupId, template });
  }
  
  /**
   * Remove template de grupo
   */
  removeGroupTemplate(groupId) {
    const removed = this.groupTemplates.delete(groupId);
    if (removed) {
      this.logger.debug('Template de grupo removido', { groupId });
    }
    return removed;
  }
  
  /**
   * Gera ID único para alerta
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Gera ID único baseado em conteúdo para deduplicação
   */
  generateUniqueId(rule, equipmentName, event) {
    const components = [
      equipmentName,
      rule.id,
      event?.identifier || 'unknown',
      event?.startTime?.getTime() || Date.now(),
      event?.endTime?.getTime() || Date.now(),
      event?.consolidated || false
    ];
    
    return generateHash(components.join('|'));
  }
  
  /**
   * Formata duração em minutos para string legível
   */
  formatDuration(minutes) {
    if (typeof minutes !== 'number' || minutes < 0) {
      return '0min';
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  }
  
  /**
   * Formata intervalo de tempo
   */
  formatTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
      return '';
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    const startStr = start.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endStr = end.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `${startStr} a ${endStr}`;
  }
  
  /**
   * Formata nome do equipamento para exibição
   */
  formatEquipmentName(name) {
    if (!name) return 'Equipamento Desconhecido';
    
    return name
      .replace(/CAMINHAO/g, 'CAMINHÃO')
      .replace(/VACUO/g, 'VÁCUO')
      .replace(/PRESSAO/g, 'PRESSÃO');
  }
  
  /**
   * Atualiza métricas de performance
   */
  updateMetrics(generationTime) {
    this.metrics.averageGenerationTime = 
      (this.metrics.averageGenerationTime * (this.metrics.alertsGenerated - 1) + generationTime) / 
      this.metrics.alertsGenerated;
  }
  
  /**
   * Obtém métricas do gerador
   */
  getMetrics() {
    return {
      ...this.metrics,
      templatesConfigured: this.groupTemplates.size,
      config: {
        templating: this.config.enableTemplating,
        contextual: this.config.enableContextualInfo,
        severityScaling: this.config.enableSeverityScaling
      }
    };
  }
  
  /**
   * Atualiza configuração do gerador
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug('Configuração do gerador atualizada', newConfig);
  }
  
  /**
   * Limpa métricas
   */
  resetMetrics() {
    this.metrics = {
      alertsGenerated: 0,
      templatesUsed: 0,
      contextualInfoAdded: 0,
      errorCount: 0,
      averageGenerationTime: 0
    };
    
    this.logger.debug('Métricas do gerador resetadas');
  }
}

export default AlertGenerator;
