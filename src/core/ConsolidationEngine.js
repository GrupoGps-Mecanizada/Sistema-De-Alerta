/**
 * Motor de Consolidação de Eventos - ConsolidationEngine.js
 * Responsável por unificar eventos contínuos em períodos consolidados
 */

import { PerformanceTimer } from '../utils/performance.js';
import { Logger } from '../utils/logger.js';
import { parseDateString } from '../utils/dateParser.js';

export class ConsolidationEngine {
  constructor(config = {}) {
    this.config = {
      maxGapMinutes: 15,
      minDurationMinutes: 1,
      allowOverlap: false,
      mergeStrategy: 'extend',
      conflictResolution: 'latest',
      ...config
    };
    
    this.logger = new Logger('ConsolidationEngine');
    this.activeStates = new Map();
    this.consolidationCache = new Map();
    this.metrics = {
      totalProcessed: 0,
      totalConsolidated: 0,
      averageReduction: 0,
      processingTime: 0
    };
  }
  
  /**
   * Consolida eventos contínuos por equipamento
   */
  consolidateEvents(events, eventType = 'status') {
    if (!events || events.length === 0) {
      return [];
    }
    
    const startTime = PerformanceTimer.start();
    this.logger.debug(`Consolidando ${events.length} eventos do tipo ${eventType}`);
    
    try {
      // Normalizar e ordenar eventos
      const normalizedEvents = this.normalizeEvents(events, eventType);
      const sortedEvents = this.sortEventsByTime(normalizedEvents);
      
      // Aplicar estratégia de consolidação
      const consolidated = this.applyConsolidationStrategy(sortedEvents, eventType);
      
      // Calcular métricas
      this.updateMetrics(events.length, consolidated.length, startTime);
      
      this.logger.debug(`Consolidação concluída: ${events.length} → ${consolidated.length} eventos`);
      
      return consolidated;
      
    } catch (error) {
      this.logger.error('Erro na consolidação de eventos', { 
        error: error.message,
        eventType,
        eventCount: events.length
      });
      
      // Retornar eventos originais em caso de erro
      return events;
    }
  }
  
  /**
   * Normaliza eventos para formato padrão
   */
  normalizeEvents(events, eventType) {
    return events.map((event, index) => {
      try {
        let startTime, endTime, identifier, originalEvent;
        
        if (eventType === 'status') {
          startTime = parseDateString(event.start);
          endTime = parseDateString(event.end);
          identifier = event.status || event.status_title;
          originalEvent = event;
        } else {
          startTime = parseDateString(event['Data Inicial']);
          endTime = parseDateString(event['Data Final']);
          identifier = event['Categoria Demora'] || event.categoria;
          originalEvent = event;
        }
        
        if (!startTime || !endTime) {
          this.logger.warn('Evento com datas inválidas ignorado', { index, event });
          return null;
        }
        
        return {
          id: `${eventType}_${index}_${startTime.getTime()}`,
          startTime,
          endTime,
          identifier,
          duration: (endTime.getTime() - startTime.getTime()) / (1000 * 60), // minutos
          eventType,
          originalEvent,
          normalized: true
        };
        
      } catch (error) {
        this.logger.warn('Erro ao normalizar evento', { index, error: error.message });
        return null;
      }
    }).filter(event => event !== null);
  }
  
  /**
   * Ordena eventos por tempo de início
   */
  sortEventsByTime(events) {
    return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }
  
  /**
   * Aplica estratégia de consolidação baseada na configuração
   */
  applyConsolidationStrategy(sortedEvents, eventType) {
    const groups = this.groupContinuousEvents(sortedEvents);
    
    return groups.map(group => this.consolidateGroup(group, eventType));
  }
  
  /**
   * Agrupa eventos contínuos baseado no gap máximo
   */
  groupContinuousEvents(events) {
    if (events.length === 0) return [];
    
    const groups = [];
    let currentGroup = [events[0]];
    
    for (let i = 1; i < events.length; i++) {
      const currentEvent = events[i];
      const lastEvent = currentGroup[currentGroup.length - 1];
      
      if (this.shouldMergeEvents(lastEvent, currentEvent)) {
        currentGroup.push(currentEvent);
      } else {
        // Finalizar grupo atual e iniciar novo
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [currentEvent];
      }
    }
    
    // Adicionar último grupo
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }
  
  /**
   * Determina se dois eventos devem ser consolidados
   */
  shouldMergeEvents(event1, event2) {
    // Verificar se têm o mesmo identificador
    if (event1.identifier !== event2.identifier) {
      return false;
    }
    
    // Calcular gap entre eventos
    const gapMinutes = (event2.startTime.getTime() - event1.endTime.getTime()) / (1000 * 60);
    
    // Verificar se gap está dentro do limite
    if (gapMinutes > this.config.maxGapMinutes) {
      return false;
    }
    
    // Verificar overlaps se não permitidos
    if (!this.config.allowOverlap && gapMinutes < 0) {
      return this.config.conflictResolution === 'merge';
    }
    
    return true;
  }
  
  /**
   * Consolida um grupo de eventos em um único evento
   */
  consolidateGroup(eventGroup, eventType) {
    if (eventGroup.length === 1) {
      // Evento único, retornar com flag de consolidação
      return this.createConsolidatedEvent(eventGroup, eventType, false);
    }
    
    // Múltiplos eventos, consolidar
    return this.createConsolidatedEvent(eventGroup, eventType, true);
  }
  
  /**
   * Cria evento consolidado a partir de um grupo
   */
  createConsolidatedEvent(eventGroup, eventType, isConsolidated) {
    const firstEvent = eventGroup[0];
    const lastEvent = eventGroup[eventGroup.length - 1];
    
    // Determinar tempo de início e fim baseado na estratégia
    let consolidatedStart, consolidatedEnd;
    
    switch (this.config.mergeStrategy) {
      case 'extend':
        consolidatedStart = firstEvent.startTime;
        consolidatedEnd = new Date(Math.max(...eventGroup.map(e => e.endTime.getTime())));
        break;
        
      case 'replace':
        consolidatedStart = firstEvent.startTime;
        consolidatedEnd = lastEvent.endTime;
        break;
        
      case 'skip':
        // Manter apenas gaps pequenos
        consolidatedStart = firstEvent.startTime;
        consolidatedEnd = lastEvent.endTime;
        break;
        
      default:
        consolidatedStart = firstEvent.startTime;
        consolidatedEnd = lastEvent.endTime;
    }
    
    const totalDuration = (consolidatedEnd.getTime() - consolidatedStart.getTime()) / (1000 * 60);
    
    // Criar evento consolidado
    const consolidatedEvent = {
      id: this.generateConsolidatedId(eventGroup),
      startTime: consolidatedStart,
      endTime: consolidatedEnd,
      identifier: firstEvent.identifier,
      duration: totalDuration,
      eventType,
      consolidated: isConsolidated,
      recordCount: eventGroup.length,
      originalEvents: eventGroup.map(e => e.originalEvent),
      
      // Metadados de consolidação
      consolidationMetadata: {
        strategy: this.config.mergeStrategy,
        totalGaps: this.calculateTotalGaps(eventGroup),
        efficiency: this.calculateEfficiency(eventGroup, totalDuration),
        conflictsResolved: this.countConflicts(eventGroup)
      }
    };
    
    // Adicionar campos específicos do tipo de evento
    if (eventType === 'status') {
      consolidatedEvent.status = firstEvent.identifier;
      consolidatedEvent.vacancy_name = firstEvent.originalEvent.vacancy_name;
      consolidatedEvent.vacancy_code = firstEvent.originalEvent.vacancy_code;
    } else {
      consolidatedEvent.categoria = firstEvent.identifier;
      consolidatedEvent.vaga = firstEvent.originalEvent.Vaga || firstEvent.originalEvent.vaga;
      consolidatedEvent.placa = firstEvent.originalEvent.Placa || firstEvent.originalEvent.placa;
    }
    
    return consolidatedEvent;
  }
  
  /**
   * Gera ID único para evento consolidado
   */
  generateConsolidatedId(eventGroup) {
    const identifiers = eventGroup.map(e => e.id).join('|');
    const hash = this.simpleHash(identifiers);
    return `consolidated_${hash}_${Date.now()}`;
  }
  
  /**
   * Calcula gaps totais entre eventos do grupo
   */
  calculateTotalGaps(eventGroup) {
    if (eventGroup.length <= 1) return 0;
    
    let totalGap = 0;
    for (let i = 1; i < eventGroup.length; i++) {
      const gap = (eventGroup[i].startTime.getTime() - eventGroup[i-1].endTime.getTime()) / (1000 * 60);
      if (gap > 0) totalGap += gap;
    }
    
    return totalGap;
  }
  
  /**
   * Calcula eficiência da consolidação
   */
  calculateEfficiency(eventGroup, totalDuration) {
    const sumOriginalDurations = eventGroup.reduce((sum, event) => sum + event.duration, 0);
    const totalGaps = this.calculateTotalGaps(eventGroup);
    
    return {
      originalDuration: sumOriginalDurations,
      consolidatedDuration: totalDuration,
      gapsEliminated: totalGaps,
      compressionRatio: sumOriginalDurations / totalDuration
    };
  }
  
  /**
   * Conta conflitos de overlap resolvidos
   */
  countConflicts(eventGroup) {
    let conflicts = 0;
    
    for (let i = 1; i < eventGroup.length; i++) {
      const prevEvent = eventGroup[i-1];
      const currentEvent = eventGroup[i];
      
      if (currentEvent.startTime.getTime() < prevEvent.endTime.getTime()) {
        conflicts++;
      }
    }
    
    return conflicts;
  }
  
  /**
   * Atualiza métricas de performance
   */
  updateMetrics(originalCount, consolidatedCount, startTime) {
    const processingTime = PerformanceTimer.end(startTime);
    
    this.metrics.totalProcessed += originalCount;
    this.metrics.totalConsolidated += consolidatedCount;
    this.metrics.processingTime += processingTime;
    
    const reduction = originalCount > 0 ? ((originalCount - consolidatedCount) / originalCount) * 100 : 0;
    this.metrics.averageReduction = (this.metrics.averageReduction + reduction) / 2;
  }
  
  /**
   * Define estados ativos para cache
   */
  setActiveStates(states) {
    if (states instanceof Map) {
      this.activeStates = states;
    } else if (Array.isArray(states)) {
      this.activeStates = new Map(states);
    } else if (typeof states === 'object') {
      this.activeStates = new Map(Object.entries(states));
    }
  }
  
  /**
   * Obtém estados ativos
   */
  getActiveStates() {
    return this.activeStates;
  }
  
  /**
   * Limpa cache de consolidação
   */
  clearCache() {
    this.consolidationCache.clear();
    this.logger.debug('Cache de consolidação limpo');
  }
  
  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.consolidationCache.size,
      activeStatesCount: this.activeStates.size
    };
  }
  
  /**
   * Configuração de consolidação para equipamento específico
   */
  setEquipmentConfig(equipmentName, config) {
    const equipmentKey = `equipment_${equipmentName}`;
    this.consolidationCache.set(equipmentKey, config);
  }
  
  /**
   * Função auxiliar para hash simples
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
  
  /**
   * Validação de configuração
   */
  validateConfig(config) {
    const errors = [];
    
    if (config.maxGapMinutes <= 0) {
      errors.push('maxGapMinutes deve ser maior que 0');
    }
    
    if (config.minDurationMinutes < 0) {
      errors.push('minDurationMinutes não pode ser negativo');
    }
    
    const validStrategies = ['extend', 'replace', 'skip'];
    if (!validStrategies.includes(config.mergeStrategy)) {
      errors.push(`mergeStrategy deve ser uma das opções: ${validStrategies.join(', ')}`);
    }
    
    const validResolutions = ['latest', 'earliest', 'longest', 'merge'];
    if (!validResolutions.includes(config.conflictResolution)) {
      errors.push(`conflictResolution deve ser uma das opções: ${validResolutions.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Atualiza configuração de consolidação
   */
  updateConfig(newConfig) {
    const validation = this.validateConfig(newConfig);
    
    if (!validation.valid) {
      throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
    }
    
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuração de consolidação atualizada', this.config);
  }
  
  /**
   * Análise de qualidade da consolidação
   */
  analyzeConsolidationQuality(originalEvents, consolidatedEvents) {
    const analysis = {
      reductionRatio: originalEvents.length > 0 ? 
        (originalEvents.length - consolidatedEvents.length) / originalEvents.length : 0,
      
      averageGroupSize: consolidatedEvents.length > 0 ? 
        originalEvents.length / consolidatedEvents.length : 0,
      
      consolidatedCount: consolidatedEvents.filter(e => e.consolidated).length,
      singleEventCount: consolidatedEvents.filter(e => !e.consolidated).length,
      
      totalOriginalDuration: originalEvents.reduce((sum, e) => 
        sum + ((parseDateString(e.end || e['Data Final']).getTime() - 
                parseDateString(e.start || e['Data Inicial']).getTime()) / (1000 * 60)), 0),
      
      totalConsolidatedDuration: consolidatedEvents.reduce((sum, e) => sum + e.duration, 0),
      
      qualityScore: 0 // Será calculado
    };
    
    // Calcular score de qualidade baseado em métricas
    analysis.qualityScore = this.calculateQualityScore(analysis);
    
    return analysis;
  }
  
  /**
   * Calcula score de qualidade (0-100)
   */
  calculateQualityScore(analysis) {
    let score = 0;
    
    // Score baseado na redução (0-40 pontos)
    score += Math.min(analysis.reductionRatio * 100, 40);
    
    // Score baseado no tamanho médio dos grupos (0-30 pontos)
    const idealGroupSize = 5;
    const groupSizeScore = Math.max(0, 30 - Math.abs(analysis.averageGroupSize - idealGroupSize) * 5);
    score += groupSizeScore;
    
    // Score baseado na preservação de duração (0-30 pontos)
    const durationPreservation = analysis.totalOriginalDuration > 0 ? 
      Math.min(analysis.totalConsolidatedDuration / analysis.totalOriginalDuration, 1) : 1;
    score += durationPreservation * 30;
    
    return Math.round(score);
  }
}

export default ConsolidationEngine;
