/**
 * Detector de Grupos - GroupDetector.js
 * Detecta automaticamente grupos de equipamentos baseado em padrões de nomes
 */

import { EQUIPMENT_GROUPS, GROUP_DETECTION_CONFIG } from '../../config/equipmentGroups.js';
import { Logger } from '../../utils/logger.js';

export class GroupDetector {
  constructor(config = {}) {
    this.config = {
      ...GROUP_DETECTION_CONFIG,
      ...config
    };
    
    this.logger = new Logger('GroupDetector');
    
    // Cache de detecções para performance
    this.detectionCache = new Map();
    this.maxCacheSize = this.config.cacheSize || 1000;
    
    // Grupos configurados
    this.groups = { ...EQUIPMENT_GROUPS };
    
    // Métricas
    this.metrics = {
      detections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      groupMatches: {},
      conflictResolutions: 0
    };
    
    // Inicializar métricas de grupos
    Object.keys(this.groups).forEach(groupId => {
      this.metrics.groupMatches[groupId] = 0;
    });
    
    this.logger.debug('GroupDetector inicializado', {
      groups: Object.keys(this.groups).length,
      cacheEnabled: this.config.enableCache,
      caseSensitive: this.config.caseSensitive
    });
  }
  
  /**
   * Detecta grupos para um equipamento específico
   */
  detectGroups(equipmentName) {
    if (!equipmentName || typeof equipmentName !== 'string') {
      return [];
    }
    
    this.metrics.detections++;
    
    // Verificar cache primeiro
    if (this.config.enableCache) {
      const cached = this.detectionCache.get(equipmentName);
      if (cached) {
        this.metrics.cacheHits++;
        return [...cached]; // Retornar cópia para evitar mutação
      }
      this.metrics.cacheMisses++;
    }
    
    const detectedGroups = this.performDetection(equipmentName);
    
    // Salvar no cache
    if (this.config.enableCache) {
      this.cacheDetection(equipmentName, detectedGroups);
    }
    
    // Atualizar métricas
    detectedGroups.forEach(groupId => {
      this.metrics.groupMatches[groupId]++;
    });
    
    this.logger.debug('Grupos detectados', {
      equipment: equipmentName,
      groups: detectedGroups
    });
    
    return detectedGroups;
  }
  
  /**
   * Executa a detecção real baseada nos padrões
   */
  performDetection(equipmentName) {
    const normalizedName = this.normalizeEquipmentName(equipmentName);
    const matches = [];
    
    // Detectar todos os grupos que fazem match
    for (const [groupId, groupConfig] of Object.entries(this.groups)) {
      if (this.matchesGroup(normalizedName, groupConfig)) {
        matches.push({
          groupId,
          priority: groupConfig.priority || 999,
          confidence: this.calculateConfidence(normalizedName, groupConfig)
        });
      }
    }
    
    // Resolver conflitos se múltiplos grupos foram detectados
    if (matches.length > 1) {
      return this.resolveConflicts(matches, normalizedName);
    }
    
    return matches.map(match => match.groupId);
  }
  
  /**
   * Verifica se um nome corresponde a um grupo específico
   */
  matchesGroup(normalizedName, groupConfig) {
    if (!groupConfig.patterns || groupConfig.patterns.length === 0) {
      return false;
    }
    
    for (const pattern of groupConfig.patterns) {
      if (this.matchesPattern(normalizedName, pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se um nome corresponde a um padrão específico
   */
  matchesPattern(normalizedName, pattern) {
    const normalizedPattern = this.normalizePattern(pattern);
    
    // Verificar se deve ser case sensitive
    const searchName = this.config.caseSensitive ? normalizedName : normalizedName.toLowerCase();
    const searchPattern = this.config.caseSensitive ? normalizedPattern : normalizedPattern.toLowerCase();
    
    // Match exato
    if (searchName.includes(searchPattern)) {
      return true;
    }
    
    // Match parcial se habilitado
    if (this.config.enablePartialMatch && searchPattern.length >= this.config.minimumMatchLength) {
      return this.performPartialMatch(searchName, searchPattern);
    }
    
    return false;
  }
  
  /**
   * Executa match parcial mais sofisticado
   */
  performPartialMatch(name, pattern) {
    // Dividir em palavras e verificar cada uma
    const nameWords = name.split(/\s+/);
    const patternWords = pattern.split(/\s+/);
    
    for (const patternWord of patternWords) {
      if (patternWord.length < this.config.minimumMatchLength) {
        continue;
      }
      
      for (const nameWord of nameWords) {
        if (nameWord.includes(patternWord) || patternWord.includes(nameWord)) {
          return true;
        }
        
        // Verificar similaridade usando distância de Levenshtein simplificada
        if (this.calculateSimilarity(nameWord, patternWord) > 0.8) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Calcula similaridade entre duas strings (0-1)
   */
  calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1;
    
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }
  
  /**
   * Calcula distância de Levenshtein entre duas strings
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
   * Calcula confiança da detecção (0-1)
   */
  calculateConfidence(normalizedName, groupConfig) {
    let maxConfidence = 0;
    
    for (const pattern of groupConfig.patterns) {
      const normalizedPattern = this.normalizePattern(pattern);
      
      // Confiança baseada na especificidade do match
      let confidence = 0;
      
      if (normalizedName.includes(normalizedPattern)) {
        // Match exato tem alta confiança
        confidence = 0.9;
        
        // Bonus por match de palavra completa
        const words = normalizedName.split(/\s+/);
        if (words.includes(normalizedPattern)) {
          confidence = 1.0;
        }
        
        // Penalidade se o padrão é muito genérico
        if (normalizedPattern.length < 4) {
          confidence *= 0.7;
        }
      } else if (this.config.enablePartialMatch) {
        // Match parcial tem confiança reduzida
        confidence = this.calculateSimilarity(normalizedName, normalizedPattern) * 0.6;
      }
      
      maxConfidence = Math.max(maxConfidence, confidence);
    }
    
    return maxConfidence;
  }
  
  /**
   * Resolve conflitos quando múltiplos grupos são detectados
   */
  resolveConflicts(matches, equipmentName) {
    this.metrics.conflictResolutions++;
    
    this.logger.debug('Resolvendo conflito de grupos', {
      equipment: equipmentName,
      matches: matches.map(m => ({ group: m.groupId, confidence: m.confidence }))
    });
    
    switch (this.config.conflictResolution) {
      case 'priority':
        // Retornar apenas o grupo com maior prioridade (menor número = maior prioridade)
        const topPriority = Math.min(...matches.map(m => m.priority));
        return matches
          .filter(m => m.priority === topPriority)
          .map(m => m.groupId);
      
      case 'confidence':
        // Retornar apenas o grupo com maior confiança
        const maxConfidence = Math.max(...matches.map(m => m.confidence));
        return matches
          .filter(m => m.confidence === maxConfidence)
          .map(m => m.groupId);
      
      case 'first':
        // Retornar apenas o primeiro match
        return [matches[0].groupId];
      
      case 'all':
        // Retornar todos os grupos detectados
        return matches.map(m => m.groupId);
      
      default:
        // Padrão: usar prioridade
        const defaultPriority = Math.min(...matches.map(m => m.priority));
        return matches
          .filter(m => m.priority === defaultPriority)
          .map(m => m.groupId);
    }
  }
  
  /**
   * Normaliza nome do equipamento para detecção
   */
  normalizeEquipmentName(name) {
    let normalized = name.trim();
    
    // Converter caracteres especiais
    normalized = normalized
      .replace(/CAMINHÃO/g, 'CAMINHAO')
      .replace(/VÁCUO/g, 'VACUO')
      .replace(/PRESSÃO/g, 'PRESSAO');
    
    // Remover palavras excluídas
    for (const excludeWord of this.config.excludeWords) {
      const regex = new RegExp(`\\b${excludeWord}\\b`, 'gi');
      normalized = normalized.replace(regex, '');
    }
    
    // Limpar espaços extras
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }
  
  /**
   * Normaliza padrão de busca
   */
  normalizePattern(pattern) {
    return pattern
      .trim()
      .replace(/CAMINHÃO/g, 'CAMINHAO')
      .replace(/VÁCUO/g, 'VACUO')
      .replace(/PRESSÃO/g, 'PRESSAO');
  }
  
  /**
   * Adiciona cache de detecção
   */
  cacheDetection(equipmentName, groups) {
    // Limitar tamanho do cache
    if (this.detectionCache.size >= this.maxCacheSize) {
      // Remover entradas mais antigas (FIFO)
      const firstKey = this.detectionCache.keys().next().value;
      this.detectionCache.delete(firstKey);
    }
    
    this.detectionCache.set(equipmentName, [...groups]);
  }
  
  /**
   * Adiciona grupo customizado
   */
  addCustomGroup(groupId, groupConfig) {
    if (this.groups[groupId]) {
      this.logger.warn('Grupo já existe, sobrescrevendo', { groupId });
    }
    
    // Validar configuração
    if (!groupConfig.patterns || !Array.isArray(groupConfig.patterns)) {
      throw new Error('Configuração de grupo deve ter array de padrões');
    }
    
    this.groups[groupId] = {
      priority: 999,
      ...groupConfig
    };
    
    // Inicializar métricas
    this.metrics.groupMatches[groupId] = 0;
    
    // Limpar cache pois novos grupos podem afetar detecções existentes
    this.clearCache();
    
    this.logger.info('Grupo customizado adicionado', { groupId });
  }
  
  /**
   * Remove grupo customizado
   */
  removeCustomGroup(groupId) {
    if (!this.groups[groupId]) {
      throw new Error(`Grupo '${groupId}' não encontrado`);
    }
    
    if (!this.groups[groupId].custom) {
      throw new Error(`Grupo '${groupId}' é um grupo padrão e não pode ser removido`);
    }
    
    delete this.groups[groupId];
    delete this.metrics.groupMatches[groupId];
    
    // Limpar cache
    this.clearCache();
    
    this.logger.info('Grupo customizado removido', { groupId });
  }
  
  /**
   * Atualiza configuração de detecção
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    // Limpar cache se configuração de detecção mudou
    const detectionConfigChanged = 
      oldConfig.caseSensitive !== this.config.caseSensitive ||
      oldConfig.enablePartialMatch !== this.config.enablePartialMatch ||
      oldConfig.minimumMatchLength !== this.config.minimumMatchLength ||
      oldConfig.conflictResolution !== this.config.conflictResolution;
    
    if (detectionConfigChanged) {
      this.clearCache();
      this.logger.info('Cache limpo devido a mudança na configuração de detecção');
    }
    
    this.logger.debug('Configuração atualizada', { newConfig });
  }
  
  /**
   * Testa detecção para um conjunto de equipamentos
   */
  bulkDetect(equipmentNames) {
    const results = new Map();
    
    for (const name of equipmentNames) {
      try {
        const groups = this.detectGroups(name);
        results.set(name, groups);
      } catch (error) {
        this.logger.error('Erro na detecção bulk', { 
          equipment: name, 
          error: error.message 
        });
        results.set(name, []);
      }
    }
    
    return results;
  }
  
  /**
   * Analisa qualidade das detecções
   */
  analyzeDetectionQuality(equipmentNames) {
    const analysis = {
      totalEquipments: equipmentNames.length,
      detected: 0,
      undetected: 0,
      multipleGroups: 0,
      groupDistribution: {},
      confidenceDistribution: {
        high: 0,    // > 0.8
        medium: 0,  // 0.5 - 0.8
        low: 0      // < 0.5
      }
    };
    
    // Inicializar distribuição de grupos
    Object.keys(this.groups).forEach(groupId => {
      analysis.groupDistribution[groupId] = 0;
    });
    
    for (const name of equipmentNames) {
      const groups = this.detectGroups(name);
      
      if (groups.length === 0) {
        analysis.undetected++;
      } else {
        analysis.detected++;
        
        if (groups.length > 1) {
          analysis.multipleGroups++;
        }
        
        groups.forEach(groupId => {
          analysis.groupDistribution[groupId]++;
        });
      }
    }
    
    analysis.detectionRate = analysis.detected / analysis.totalEquipments;
    analysis.multipleGroupRate = analysis.multipleGroups / analysis.detected;
    
    return analysis;
  }
  
  /**
   * Obtém métricas de performance
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.detectionCache.size,
      cacheHitRate: this.metrics.detections > 0 ? 
        this.metrics.cacheHits / this.metrics.detections : 0,
      groupsConfigured: Object.keys(this.groups).length
    };
  }
  
  /**
   * Limpa cache de detecções
   */
  clearCache() {
    this.detectionCache.clear();
    this.logger.debug('Cache de detecções limpo');
  }
  
  /**
   * Obtém todos os grupos configurados
   */
  getConfiguredGroups() {
    return Object.entries(this.groups).map(([id, config]) => ({
      id,
      ...config
    }));
  }
  
  /**
   * Valida configuração de grupo
   */
  validateGroupConfig(groupConfig) {
    const errors = [];
    
    if (!groupConfig.name || groupConfig.name.trim().length === 0) {
      errors.push('Nome do grupo é obrigatório');
    }
    
    if (!groupConfig.patterns || !Array.isArray(groupConfig.patterns)) {
      errors.push('Padrões devem ser um array');
    } else if (groupConfig.patterns.length === 0) {
      errors.push('Pelo menos um padrão é obrigatório');
    }
    
    if (groupConfig.priority !== undefined && 
        (typeof groupConfig.priority !== 'number' || groupConfig.priority < 0)) {
      errors.push('Prioridade deve ser um número não negativo');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default GroupDetector;
