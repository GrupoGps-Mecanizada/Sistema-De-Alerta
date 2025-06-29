/**
 * Motor de Processamento de Regras - RuleEngine.js
 * Processa regras simples e avançadas com suporte a grupos de equipamentos
 */

import { Logger } from '../utils/logger.js';
import { PerformanceTimer } from '../utils/performance.js';
import { parseDateString } from '../utils/dateParser.js';

export class RuleEngine {
  constructor(config = {}) {
    this.config = {
      maxConcurrentRules: 50,
      processingTimeout: 30000,
      enableValidation: true,
      ...config
    };
    
    this.logger = new Logger('RuleEngine');
    this.ruleCache = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
    
    this.metrics = {
      rulesProcessed: 0,
      alertsGenerated: 0,
      averageProcessingTime: 0,
      cacheHits: 0,
      validationErrors: 0
    };
  }
  
  /**
   * Verifica se uma regra deve ser aplicada aos grupos do equipamento
   */
  shouldApplyRule(rule, equipmentGroups) {
    // Se regra não especifica grupos, aplica a todos
    if (!rule.equipmentGroups || rule.equipmentGroups.length === 0 || rule.applyToAllGroups) {
      return true;
    }
    
    // Verificar se algum grupo do equipamento coincide com grupos da regra
    return rule.equipmentGroups.some(ruleGroup => 
      equipmentGroups.includes(ruleGroup)
    );
  }
  
  /**
   * Processa uma regra específica contra dados de equipamento
   */
  async processRule(rule, equipmentName, equipmentData) {
    const startTime = PerformanceTimer.start();
    
    try {
      // Validar regra se habilitado
      if (this.config.enableValidation) {
        const validation = this.validateRule(rule);
        if (!validation.valid) {
          this.metrics.validationErrors++;
          this.logger.warn('Regra inválida ignorada', { 
            ruleId: rule.id, 
            errors: validation.errors 
          });
          return [];
        }
      }
      
      let alerts = [];
      
      // Processar baseado no tipo de regra
      if (rule.type === 'advanced') {
        alerts = await this.processAdvancedRule(rule, equipmentName, equipmentData);
      } else {
        alerts = await this.processSimpleRule(rule, equipmentName, equipmentData);
      }
      
      // Atualizar métricas
      const processingTime = PerformanceTimer.end(startTime);
      this.updateMetrics(processingTime, alerts.length);
      
      this.logger.debug('Regra processada', {
        ruleId: rule.id,
        equipment: equipmentName,
        alertsGenerated: alerts.length,
        processingTime: `${processingTime}ms`
      });
      
      return alerts;
      
    } catch (error) {
      this.logger.error('Erro no processamento de regra', {
        ruleId: rule.id,
        equipment: equipmentName,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Processa regra simples
   */
  async processSimpleRule(rule, equipmentName, equipmentData) {
    const alerts = [];
    const conditions = rule.conditions;
    
    // Processar eventos consolidados de status
    if (equipmentData.consolidatedStatus) {
      for (const statusEvent of equipmentData.consolidatedStatus) {
        if (this.evaluateSimpleConditions(statusEvent, conditions, 'status')) {
          const alert = this.createAlert(rule, equipmentName, statusEvent, equipmentData);
          if (alert) alerts.push(alert);
        }
      }
    }
    
    // Processar eventos consolidados de apontamentos
    if (equipmentData.consolidatedApontamentos) {
      for (const apontEvent of equipmentData.consolidatedApontamentos) {
        if (this.evaluateSimpleConditions(apontEvent, conditions, 'apontamento')) {
          const alert = this.createAlert(rule, equipmentName, apontEvent, equipmentData);
          if (alert) alerts.push(alert);
        }
      }
    }
    
    return alerts;
  }
  
  /**
   * Avalia condições de regra simples
   */
  evaluateSimpleConditions(event, conditions, eventType) {
    const checks = [];
    
    // Verificar condição de apontamento
    if (conditions.apontamento) {
      if (eventType === 'apontamento') {
        checks.push(event.identifier === conditions.apontamento);
      } else {
        checks.push(false); // Status não pode satisfazer condição de apontamento
      }
    }
    
    // Verificar condição de status
    if (conditions.status) {
      if (eventType === 'status') {
        checks.push(event.identifier === conditions.status);
      } else {
        checks.push(false); // Apontamento não pode satisfazer condição de status
      }
    }
    
    // Verificar condição de tempo
    if (conditions.timeOperator && conditions.timeValue !== undefined) {
      const timeCheck = this.evaluateTimeCondition(
        event.duration, 
        conditions.timeOperator, 
        conditions.timeValue
      );
      checks.push(timeCheck);
    }
    
    // Se não há condições específicas, considerar verdadeiro
    if (checks.length === 0) {
      return true;
    }
    
    // Aplicar operador lógico
    if (conditions.operator === 'OR') {
      return checks.some(check => check);
    } else {
      return checks.every(check => check);
    }
  }
  
  /**
   * Processa regra avançada com lógica complexa
   */
  async processAdvancedRule(rule, equipmentName, equipmentData) {
    const alerts = [];
    const conditions = rule.conditions;
    
    // Avaliar condições complexas
    const evaluation = this.evaluateAdvancedConditions(conditions, equipmentData);
    
    if (evaluation.satisfied) {
      // Encontrar evento mais relevante que satisfaz as condições
      const relevantEvent = this.findMostRelevantEvent(evaluation.matchingEvents);
      
      if (relevantEvent) {
        const alert = this.createAlert(rule, equipmentName, relevantEvent, equipmentData);
        if (alert) alerts.push(alert);
      }
    }
    
    return alerts;
  }
  
  /**
   * Avalia condições avançadas com lógica complexa
   */
  evaluateAdvancedConditions(conditions, equipmentData) {
    const allEvents = [
      ...(equipmentData.consolidatedStatus || []),
      ...(equipmentData.consolidatedApontamentos || [])
    ];
    
    if (allEvents.length === 0) {
      return { satisfied: false, matchingEvents: [] };
    }
    
    const matchingEvents = [];
    
    // Avaliar cada evento contra as regras
    for (const event of allEvents) {
      if (this.evaluateComplexLogic(conditions, event, equipmentData)) {
        matchingEvents.push(event);
      }
    }
    
    return {
      satisfied: matchingEvents.length > 0,
      matchingEvents
    };
  }
  
  /**
   * Avalia lógica complexa (AND, OR, NOT)
   */
  evaluateComplexLogic(conditions, event, equipmentData) {
    if (!conditions.rules || conditions.rules.length === 0) {
      return false;
    }
    
    const results = conditions.rules.map(rule => 
      this.evaluateIndividualCondition(rule, event, equipmentData)
    );
    
    switch (conditions.logic) {
      case 'AND':
        return results.every(result => result);
      case 'OR':
        return results.some(result => result);
      case 'NOT':
        return !results.some(result => result);
      default:
        return results.every(result => result);
    }
  }
  
  /**
   * Avalia condição individual
   */
  evaluateIndividualCondition(condition, event, equipmentData) {
    switch (condition.type) {
      case 'apontamento':
        return this.compareValues(
          event.eventType === 'apontamento' ? event.identifier : null,
          condition.value,
          condition.operator
        );
        
      case 'status':
        return this.compareValues(
          event.eventType === 'status' ? event.identifier : null,
          condition.value,
          condition.operator
        );
        
      case 'time':
        return this.compareValues(
          event.duration,
          condition.value,
          condition.operator
        );
        
      case 'equipment':
        return this.compareValues(
          equipmentData.name,
          condition.value,
          condition.operator
        );
        
      case 'group':
        return equipmentData.groups && equipmentData.groups.includes(condition.value);
        
      default:
        this.logger.warn('Tipo de condição desconhecido', { type: condition.type });
        return false;
    }
  }
  
  /**
   * Compara valores usando operador especificado
   */
  compareValues(actual, expected, operator) {
    if (actual === null || actual === undefined) {
      return operator === 'not_equals' || operator === 'not_contains';
    }
    
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'greater_than':
      case '>':
        return parseFloat(actual) > parseFloat(expected);
      case 'less_than':
      case '<':
        return parseFloat(actual) < parseFloat(expected);
      case 'greater_equal':
      case '>=':
        return parseFloat(actual) >= parseFloat(expected);
      case 'less_equal':
      case '<=':
        return parseFloat(actual) <= parseFloat(expected);
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'not_contains':
        return !String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'starts_with':
        return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
      case 'ends_with':
        return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());
      case 'regex':
        try {
          const regex = new RegExp(expected, 'i');
          return regex.test(String(actual));
        } catch (e) {
          this.logger.warn('Regex inválida', { pattern: expected });
          return false;
        }
      default:
        this.logger.warn('Operador de comparação desconhecido', { operator });
        return false;
    }
  }
  
  /**
   * Avalia condição de tempo
   */
  evaluateTimeCondition(duration, operator, threshold) {
    const durationMinutes = parseFloat(duration);
    const thresholdMinutes = parseFloat(threshold);
    
    if (isNaN(durationMinutes) || isNaN(thresholdMinutes)) {
      return false;
    }
    
    switch (operator) {
      case '>':
      case 'greater_than':
        return durationMinutes > thresholdMinutes;
      case '<':
      case 'less_than':
        return durationMinutes < thresholdMinutes;
      case '=':
      case 'equals':
        return Math.abs(durationMinutes - thresholdMinutes) < 1;
      case '>=':
      case 'greater_equal':
        return durationMinutes >= thresholdMinutes;
      case '<=':
      case 'less_equal':
        return durationMinutes <= thresholdMinutes;
      default:
        return false;
    }
  }
  
  /**
   * Encontra evento mais relevante baseado em critérios
   */
  findMostRelevantEvent(events) {
    if (events.length === 0) return null;
    if (events.length === 1) return events[0];
    
    // Priorizar por: 1) Maior duração, 2) Mais recente, 3) Consolidado
    return events.sort((a, b) => {
      // Primeiro critério: duração
      if (b.duration !== a.duration) {
        return b.duration - a.duration;
      }
      
      // Segundo critério: mais recente
      if (b.endTime.getTime() !== a.endTime.getTime()) {
        return b.endTime.getTime() - a.endTime.getTime();
      }
      
      // Terceiro critério: eventos consolidados têm prioridade
      if (b.consolidated !== a.consolidated) {
        return b.consolidated ? 1 : -1;
      }
      
      return 0;
    })[0];
  }
  
  /**
   * Cria alerta baseado em regra e evento
   */
  createAlert(rule, equipmentName, event, equipmentData) {
    try {
      const now = new Date();
      const formattedTime = this.formatDuration(event.duration);
      const timeRange = this.formatTimeRange(event.startTime, event.endTime);
      
      // Substituir placeholders na mensagem
      let message = rule.message || '{equipamento} - {tipo} há {tempo}';
      
      message = message
        .replace(/{equipamento}/g, this.formatEquipmentName(equipmentName))
        .replace(/{tipo}/g, event.identifier || 'Evento')
        .replace(/{tempo}/g, formattedTime)
        .replace(/{duracao}/g, formattedTime)
        .replace(/{apontamento}/g, event.eventType === 'apontamento' ? event.identifier : '')
        .replace(/{status}/g, event.eventType === 'status' ? event.identifier : '')
        .replace(/{grupos}/g, equipmentData.groups ? equipmentData.groups.join(', ') : '')
        .replace(/{periodo}/g, timeRange);
      
      const alert = {
        id: this.generateAlertId(rule, equipmentName, event),
        uniqueId: this.generateUniqueId(rule, equipmentName, event),
        equipamento: equipmentName,
        equipmentGroups: equipmentData.groups || [],
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type || 'simple',
        message: message,
        severity: rule.severity || 'medium',
        eventType: event.eventType,
        eventIdentifier: event.identifier,
        duration: formattedTime,
        durationMinutes: event.duration,
        timeRange: timeRange,
        startTime: event.startTime,
        endTime: event.endTime,
        consolidated: event.consolidated || false,
        recordCount: event.recordCount || 1,
        timestamp: now.getTime(),
        date: now.toLocaleDateString('pt-BR'),
        time: now.toLocaleTimeString('pt-BR'),
        
        // Metadados adicionais
        metadata: {
          originalEvent: event.originalEvents ? event.originalEvents[0] : event.originalEvent,
          consolidationData: event.consolidated ? {
            totalRecords: event.recordCount,
            efficiency: event.consolidationMetadata?.efficiency
          } : null,
          ruleConditions: rule.conditions,
          processingTimestamp: now.toISOString()
        }
      };
      
      return alert;
      
    } catch (error) {
      this.logger.error('Erro ao criar alerta', {
        ruleId: rule.id,
        equipment: equipmentName,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Valida estrutura de regra
   */
  validateRule(rule) {
    const errors = [];
    
    // Validações básicas
    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Nome da regra é obrigatório');
    }
    
    if (!rule.message || rule.message.trim().length === 0) {
      errors.push('Mensagem da regra é obrigatória');
    }
    
    if (!rule.severity || !['low', 'medium', 'high', 'critical'].includes(rule.severity)) {
      errors.push('Gravidade deve ser: low, medium, high ou critical');
    }
    
    // Validações específicas por tipo
    if (rule.type === 'advanced') {
      errors.push(...this.validateAdvancedRule(rule));
    } else {
      errors.push(...this.validateSimpleRule(rule));
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Valida regra simples
   */
  validateSimpleRule(rule) {
    const errors = [];
    const conditions = rule.conditions;
    
    if (!conditions) {
      errors.push('Condições são obrigatórias para regras simples');
      return errors;
    }
    
    // Validar operador lógico
    if (conditions.operator && !['AND', 'OR'].includes(conditions.operator)) {
      errors.push('Operador deve ser AND ou OR');
    }
    
    // Validar condição de tempo
    if (conditions.timeOperator && conditions.timeValue !== undefined) {
      if (!['>', '<', '=', '>=', '<='].includes(conditions.timeOperator)) {
        errors.push('Operador de tempo inválido');
      }
      
      if (isNaN(parseFloat(conditions.timeValue)) || conditions.timeValue < 0) {
        errors.push('Valor de tempo deve ser um número positivo');
      }
    }
    
    return errors;
  }
  
  /**
   * Valida regra avançada
   */
  validateAdvancedRule(rule) {
    const errors = [];
    const conditions = rule.conditions;
    
    if (!conditions || !conditions.rules || !Array.isArray(conditions.rules)) {
      errors.push('Regras avançadas devem ter array de condições');
      return errors;
    }
    
    if (conditions.rules.length === 0) {
      errors.push('Pelo menos uma condição é necessária');
    }
    
    // Validar lógica
    if (!['AND', 'OR', 'NOT'].includes(conditions.logic)) {
      errors.push('Lógica deve ser AND, OR ou NOT');
    }
    
    // Validar cada condição individual
    conditions.rules.forEach((condition, index) => {
      if (!condition.type) {
        errors.push(`Condição ${index + 1}: tipo é obrigatório`);
      }
      
      if (condition.value === undefined || condition.value === null) {
        errors.push(`Condição ${index + 1}: valor é obrigatório`);
      }
      
      if (!condition.operator) {
        errors.push(`Condição ${index + 1}: operador é obrigatório`);
      }
    });
    
    return errors;
  }
  
  /**
   * Gera ID único para alerta
   */
  generateAlertId(rule, equipmentName, event) {
    return `alert_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Gera ID único baseado em conteúdo para deduplicação
   */
  generateUniqueId(rule, equipmentName, event) {
    const components = [
      equipmentName,
      rule.id,
      event.identifier,
      event.startTime.getTime(),
      event.endTime.getTime(),
      event.consolidated
    ];
    
    return this.simpleHash(components.join('|'));
  }
  
  /**
   * Formata duração em minutos para string legível
   */
  formatDuration(minutes) {
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
    const startStr = startTime.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endStr = endTime.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `${startStr} a ${endStr}`;
  }
  
  /**
   * Formata nome do equipamento para exibição
   */
  formatEquipmentName(name) {
    return name
      .replace(/CAMINHAO/g, 'CAMINHÃO')
      .replace(/VACUO/g, 'VÁCUO')
      .replace(/PRESSAO/g, 'PRESSÃO');
  }
  
  /**
   * Atualiza métricas de performance
   */
  updateMetrics(processingTime, alertsGenerated) {
    this.metrics.rulesProcessed++;
    this.metrics.alertsGenerated += alertsGenerated;
    
    // Calcular média de tempo de processamento
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.rulesProcessed - 1) + processingTime) / 
      this.metrics.rulesProcessed;
  }
  
  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.ruleCache.size,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }
  
  /**
   * Limpa cache de regras
   */
  clearCache() {
    this.ruleCache.clear();
    this.logger.debug('Cache de regras limpo');
  }
  
  /**
   * Hash simples para geração de IDs
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }
}

export default RuleEngine;
