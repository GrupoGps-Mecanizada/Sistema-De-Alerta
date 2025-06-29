/**
 * Deduplicador de Alertas - AlertDeduplicator.js
 * Remove alertas duplicados usando múltiplas estratégias de detecção
 */

import { Logger } from '../../utils/logger.js';
import { generateHash } from '../../utils/hash.js';

export class AlertDeduplicator {
  constructor(config = {}) {
    this.config = {
      strategy: 'hash', // 'hash', 'id', 'content', 'smart'
      windowMinutes: 60, // Janela de tempo para considerar duplicatas
      enableTimeWindow: true,
      enableContentAnalysis: true,
      enableSmartMerging: false,
      contentThreshold: 0.9, // Limiar de similaridade para conteúdo
      enableCaching: true,
      maxCacheSize: 10000,
      ...config
    };
    
    this.logger = new Logger('AlertDeduplicator');
    
    // Cache de hashes para performance
    this.alertHashCache = new Map();
    this.contentCache = new Map();
    this.timeWindowCache = new Map();
    
    // Estatísticas
    this.stats = {
      totalProcessed: 0,
      duplicatesFound: 0,
      uniqueAlerts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      mergedAlerts: 0
    };
    
    this.logger.debug('AlertDeduplicator inicializado', {
      strategy: this.config.strategy,
      windowMinutes: this.config.windowMinutes
    });
  }
  
  /**
   * Remove duplicatas de uma lista de novos alertas contra alertas existentes
   */
  deduplicate(newAlerts, existingAlerts = []) {
    if (!Array.isArray(newAlerts)) {
      this.logger.warn('newAlerts deve ser um array');
      return [];
    }
    
    this.stats.totalProcessed += newAlerts.length;
    
    const startTime = performance.now();
    const uniqueAlerts = [];
    
    this.logger.debug('Iniciando deduplicação', {
      newAlerts: newAlerts.length,
      existing: existingAlerts.length,
      strategy: this.config.strategy
    });
    
    // Construir índices para performance
    const existingIndex = this.buildDeduplicationIndex(existingAlerts);
    const processedIndex = new Map();
    
    for (const alert of newAlerts) {
      try {
        const isDuplicate = this.isAlertDuplicate(alert, existingIndex, processedIndex);
        
        if (!isDuplicate) {
          uniqueAlerts.push(alert);
          this.stats.uniqueAlerts++;
          
          // Adicionar ao índice de processados
          this.addToIndex(alert, processedIndex);
        } else {
          this.stats.duplicatesFound++;
          this.logger.debug('Alerta duplicado detectado', {
            id: alert.id,
            equipment: alert.equipamento,
            rule: alert.ruleName
          });
        }
      } catch (error) {
        this.logger.error('Erro ao verificar duplicata', {
          alertId: alert.id,
          error: error.message
        });
        
        // Em caso de erro, incluir alerta para evitar perda
        uniqueAlerts.push(alert);
      }
    }
    
    const processingTime = performance.now() - startTime;
    
    this.logger.info('Deduplicação concluída', {
      processed: newAlerts.length,
      unique: uniqueAlerts.length,
      duplicates: this.stats.duplicatesFound,
      processingTime: `${processingTime.toFixed(2)}ms`
    });
    
    return uniqueAlerts;
  }
  
  /**
   * Constrói índice para deduplicação rápida
   */
  buildDeduplicationIndex(alerts) {
    const index = {
      byHash: new Map(),
      byUniqueId: new Map(),
      byContent: new Map(),
      byTimeWindow: new Map()
    };
    
    for (const alert of alerts) {
      this.addToIndex(alert, index);
    }
    
    return index;
  }
  
  /**
   * Adiciona alerta aos índices
   */
  addToIndex(alert, index) {
    // Índice por hash
    const hash = this.generateAlertHash(alert);
    index.byHash.set(hash, alert);
    
    // Índice por uniqueId
    if (alert.uniqueId) {
      index.byUniqueId.set(alert.uniqueId, alert);
    }
    
    // Índice por conteúdo (se habilitado)
    if (this.config.enableContentAnalysis) {
      const contentKey = this.generateContentKey(alert);
      if (!index.byContent.has(contentKey)) {
        index.byContent.set(contentKey, []);
      }
      index.byContent.get(contentKey).push(alert);
    }
    
    // Índice por janela de tempo (se habilitado)
    if (this.config.enableTimeWindow) {
      const timeKey = this.generateTimeWindowKey(alert);
      if (!index.byTimeWindow.has(timeKey)) {
        index.byTimeWindow.set(timeKey, []);
      }
      index.byTimeWindow.get(timeKey).push(alert);
    }
  }
  
  /**
   * Verifica se alerta é duplicata
   */
  isAlertDuplicate(alert, existingIndex, processedIndex) {
    switch (this.config.strategy) {
      case 'hash':
        return this.isDuplicateByHash(alert, existingIndex, processedIndex);
      
      case 'id':
        return this.isDuplicateById(alert, existingIndex, processedIndex);
      
      case 'content':
        return this.isDuplicateByContent(alert, existingIndex, processedIndex);
      
      case 'smart':
        return this.isDuplicateBySmart(alert, existingIndex, processedIndex);
      
      default:
        return this.isDuplicateByHash(alert, existingIndex, processedIndex);
    }
  }
  
  /**
   * Verifica duplicata por hash
   */
  isDuplicateByHash(alert, existingIndex, processedIndex) {
    const hash = this.generateAlertHash(alert);
    
    // Verificar cache primeiro
    if (this.config.enableCaching && this.alertHashCache.has(hash)) {
      this.stats.cacheHits++;
      return true;
    }
    
    this.stats.cacheMisses++;
    
    // Verificar nos índices
    const isDuplicate = existingIndex.byHash.has(hash) || processedIndex.byHash.has(hash);
    
    // Atualizar cache
    if (this.config.enableCaching && isDuplicate) {
      this.updateCache(hash);
    }
    
    return isDuplicate;
  }
  
  /**
   * Verifica duplicata por uniqueId
   */
  isDuplicateById(alert, existingIndex, processedIndex) {
    if (!alert.uniqueId) {
      return false;
    }
    
    return existingIndex.byUniqueId.has(alert.uniqueId) || 
           processedIndex.byUniqueId.has(alert.uniqueId);
  }
  
  /**
   * Verifica duplicata por análise de conteúdo
   */
  isDuplicateByContent(alert, existingIndex, processedIndex) {
    const contentKey = this.generateContentKey(alert);
    
    // Verificar alertas com conteúdo similar
    const similarAlerts = [
      ...(existingIndex.byContent.get(contentKey) || []),
      ...(processedIndex.byContent.get(contentKey) || [])
    ];
    
    for (const existingAlert of similarAlerts) {
      if (this.areContentsSimilar(alert, existingAlert)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica duplicata usando estratégia inteligente
   */
  isDuplicateBySmart(alert, existingIndex, processedIndex) {
    // Combinar múltiplas estratégias
    
    // 1. Verificar por hash primeiro (mais rápido)
    if (this.isDuplicateByHash(alert, existingIndex, processedIndex)) {
      return true;
    }
    
    // 2. Verificar por uniqueId
    if (this.isDuplicateById(alert, existingIndex, processedIndex)) {
      return true;
    }
    
    // 3. Verificar por janela de tempo se habilitado
    if (this.config.enableTimeWindow) {
      if (this.isDuplicateByTimeWindow(alert, existingIndex, processedIndex)) {
        return true;
      }
    }
    
    // 4. Verificar por conteúdo como último recurso
    if (this.config.enableContentAnalysis) {
      return this.isDuplicateByContent(alert, existingIndex, processedIndex);
    }
    
    return false;
  }
  
  /**
   * Verifica duplicata por janela de tempo
   */
  isDuplicateByTimeWindow(alert, existingIndex, processedIndex) {
    const timeKey = this.generateTimeWindowKey(alert);
    
    const candidateAlerts = [
      ...(existingIndex.byTimeWindow.get(timeKey) || []),
      ...(processedIndex.byTimeWindow.get(timeKey) || [])
    ];
    
    for (const candidate of candidateAlerts) {
      if (this.areAlertsInSameTimeWindow(alert, candidate)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Gera hash do alerta para deduplicação
   */
  generateAlertHash(alert) {
    // Usar campos chave para identificar alertas únicos
    const hashComponents = [
      alert.equipamento,
      alert.ruleId,
      alert.eventIdentifier || alert.eventType,
      this.normalizeTimestamp(alert.startTime || alert.timestamp),
      this.normalizeTimestamp(alert.endTime || alert.timestamp),
      alert.consolidated || false,
      alert.severity
    ].join('|');
    
    return generateHash(hashComponents);
  }
  
  /**
   * Gera chave de conteúdo para análise de similaridade
   */
  generateContentKey(alert) {
    // Usar campos que indicam mesmo tipo de problema
    return `${alert.equipamento}|${alert.ruleId}|${alert.eventType || 'unknown'}`;
  }
  
  /**
   * Gera chave de janela de tempo
   */
  generateTimeWindowKey(alert) {
    const timestamp = alert.timestamp || Date.now();
    const windowSize = this.config.windowMinutes * 60 * 1000;
    const windowIndex = Math.floor(timestamp / windowSize);
    
    return `${alert.equipamento}|${alert.ruleId}|${windowIndex}`;
  }
  
  /**
   * Verifica se dois alertas têm conteúdo similar
   */
  areContentsSimilar(alert1, alert2) {
    // Verificar campos essenciais
    if (alert1.equipamento !== alert2.equipamento) return false;
    if (alert1.ruleId !== alert2.ruleId) return false;
    if (alert1.eventType !== alert2.eventType) return false;
    
    // Verificar similaridade de tempo
    if (alert1.durationMinutes && alert2.durationMinutes) {
      const timeDiff = Math.abs(alert1.durationMinutes - alert2.durationMinutes);
      if (timeDiff > this.config.windowMinutes) return false;
    }
    
    // Verificar similaridade de mensagem
    const messageSimilarity = this.calculateMessageSimilarity(alert1.message, alert2.message);
    
    return messageSimilarity >= this.config.contentThreshold;
  }
  
  /**
   * Verifica se alertas estão na mesma janela de tempo
   */
  areAlertsInSameTimeWindow(alert1, alert2) {
    const time1 = alert1.timestamp || Date.now();
    const time2 = alert2.timestamp || Date.now();
    const timeDiff = Math.abs(time1 - time2);
    const windowMs = this.config.windowMinutes * 60 * 1000;
    
    // Devem ter mesmo equipamento e regra
    if (alert1.equipamento !== alert2.equipamento) return false;
    if (alert1.ruleId !== alert2.ruleId) return false;
    
    // Devem estar dentro da janela de tempo
    return timeDiff <= windowMs;
  }
  
  /**
   * Calcula similaridade entre mensagens
   */
  calculateMessageSimilarity(msg1, msg2) {
    if (!msg1 || !msg2) return 0;
    
    // Normalizar mensagens
    const norm1 = this.normalizeMessage(msg1);
    const norm2 = this.normalizeMessage(msg2);
    
    if (norm1 === norm2) return 1;
    
    // Calcular similaridade usando algoritmo simples
    return this.calculateStringSimilarity(norm1, norm2);
  }
  
  /**
   * Normaliza mensagem para comparação
   */
  normalizeMessage(message) {
    return message
      .toLowerCase()
      .replace(/\d+/g, 'NUM') // Substituir números por placeholder
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Calcula similaridade entre strings
   */
  calculateStringSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }
  
  /**
   * Calcula distância de Levenshtein
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Normaliza timestamp para comparação
   */
  normalizeTimestamp(timestamp) {
    if (!timestamp) return 0;
    
    if (timestamp instanceof Date) {
      return timestamp.getTime();
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime() || 0;
    }
    
    return Number(timestamp) || 0;
  }
  
  /**
   * Atualiza cache de hashes
   */
  updateCache(hash) {
    if (!this.config.enableCaching) return;
    
    // Limitar tamanho do cache
    if (this.alertHashCache.size >= this.config.maxCacheSize) {
      // Remover entradas mais antigas (FIFO)
      const firstKey = this.alertHashCache.keys().next().value;
      this.alertHashCache.delete(firstKey);
    }
    
    this.alertHashCache.set(hash, Date.now());
  }
  
  /**
   * Mescla alertas similares (se habilitado)
   */
  mergeAlerts(alerts) {
    if (!this.config.enableSmartMerging || alerts.length < 2) {
      return alerts;
    }
    
    const merged = [];
    const processed = new Set();
    
    for (let i = 0; i < alerts.length; i++) {
      if (processed.has(i)) continue;
      
      const baseAlert = alerts[i];
      const mergeCandidates = [baseAlert];
      processed.add(i);
      
      // Encontrar alertas para mesclar
      for (let j = i + 1; j < alerts.length; j++) {
        if (processed.has(j)) continue;
        
        if (this.canMergeAlerts(baseAlert, alerts[j])) {
          mergeCandidates.push(alerts[j]);
          processed.add(j);
        }
      }
      
      // Mesclar se houver múltiplos candidatos
      if (mergeCandidates.length > 1) {
        const mergedAlert = this.performAlertMerge(mergeCandidates);
        merged.push(mergedAlert);
        this.stats.mergedAlerts++;
      } else {
        merged.push(baseAlert);
      }
    }
    
    return merged;
  }
  
  /**
   * Verifica se alertas podem ser mesclados
   */
  canMergeAlerts(alert1, alert2) {
    // Devem ser do mesmo equipamento e regra
    if (alert1.equipamento !== alert2.equipamento) return false;
    if (alert1.ruleId !== alert2.ruleId) return false;
    
    // Devem ter severidade similar
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const sev1Index = severityOrder.indexOf(alert1.severity);
    const sev2Index = severityOrder.indexOf(alert2.severity);
    
    if (Math.abs(sev1Index - sev2Index) > 1) return false;
    
    // Devem estar próximos no tempo
    const time1 = alert1.timestamp || 0;
    const time2 = alert2.timestamp || 0;
    const timeDiff = Math.abs(time1 - time2);
    const windowMs = this.config.windowMinutes * 60 * 1000;
    
    return timeDiff <= windowMs;
  }
  
  /**
   * Executa mesclagem de alertas
   */
  performAlertMerge(alerts) {
    const baseAlert = alerts[0];
    
    // Usar alerta mais recente como base
    const sortedAlerts = alerts.sort((a, b) => 
      (b.timestamp || 0) - (a.timestamp || 0)
    );
    
    const mergedAlert = { ...sortedAlerts[0] };
    
    // Combinar informações
    mergedAlert.mergedFrom = alerts.map(a => a.id);
    mergedAlert.mergedCount = alerts.length;
    mergedAlert.recordCount = alerts.reduce((sum, a) => sum + (a.recordCount || 1), 0);
    
    // Usar maior severidade
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const maxSeverity = alerts.reduce((max, alert) => {
      const currentIndex = severityOrder.indexOf(alert.severity);
      const maxIndex = severityOrder.indexOf(max);
      return currentIndex > maxIndex ? alert.severity : max;
    }, 'low');
    
    mergedAlert.severity = maxSeverity;
    
    // Atualizar mensagem
    mergedAlert.message = `${mergedAlert.message} (${alerts.length} eventos mesclados)`;
    
    return mergedAlert;
  }
  
  /**
   * Limpa caches
   */
  clearCaches() {
    this.alertHashCache.clear();
    this.contentCache.clear();
    this.timeWindowCache.clear();
    
    this.logger.debug('Caches de deduplicação limpos');
  }
  
  /**
   * Obtém estatísticas
   */
  getStats() {
    const hitRate = this.stats.totalProcessed > 0 ? 
      (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 : 0;
    
    const deduplicationRate = this.stats.totalProcessed > 0 ?
      (this.stats.duplicatesFound / this.stats.totalProcessed) * 100 : 0;
    
    return {
      ...this.stats,
      cacheHitRate: hitRate,
      deduplicationRate,
      cacheSize: this.alertHashCache.size,
      config: {
        strategy: this.config.strategy,
        windowMinutes: this.config.windowMinutes,
        enableCaching: this.config.enableCaching
      }
    };
  }
  
  /**
   * Atualiza configuração
   */
  updateConfig(newConfig) {
    const oldStrategy = this.config.strategy;
    this.config = { ...this.config, ...newConfig };
    
    // Limpar caches se estratégia mudou
    if (oldStrategy !== this.config.strategy) {
      this.clearCaches();
    }
    
    this.logger.debug('Configuração do deduplicador atualizada', newConfig);
  }
  
  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      duplicatesFound: 0,
      uniqueAlerts: 0,
      cacheHits: 0,
      cacheMisses: 0,
      mergedAlerts: 0
    };
    
    this.logger.debug('Estatísticas do deduplicador resetadas');
  }
}

export default AlertDeduplicator;
