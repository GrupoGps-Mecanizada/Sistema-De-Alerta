/**
 * Gerenciador de Grupos - GroupManager.js
 * Gerencia grupos de equipamentos e suas operações de alto nível
 */

import { GroupDetector } from './GroupDetector.js';
import { EquipmentClassifier } from './EquipmentClassifier.js';
import { EQUIPMENT_GROUPS } from '../../config/equipmentGroups.js';
import { Logger } from '../../utils/logger.js';

export class GroupManager {
  constructor(config = {}) {
    this.config = {
      autoClassification: true,
      enableCustomGroups: true,
      enableGroupHierarchy: false,
      enableGroupAliases: true,
      ...config
    };
    
    this.logger = new Logger('GroupManager');
    
    // Componentes internos
    this.groupDetector = new GroupDetector(config.detection);
    this.equipmentClassifier = new EquipmentClassifier(config.classification);
    
    // Estado do sistema
    this.customGroups = new Map();
    this.groupAliases = new Map();
    this.groupHierarchy = new Map(); // Para grupos aninhados no futuro
    this.equipmentGroupCache = new Map();
    
    // Métricas
    this.metrics = {
      equipmentsClassified: 0,
      customGroupsCreated: 0,
      groupOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastClassificationTime: null
    };
    
    this.initializeDefaultAliases();
    
    this.logger.debug('GroupManager inicializado', {
      autoClassification: this.config.autoClassification,
      customGroupsEnabled: this.config.enableCustomGroups
    });
  }
  
  /**
   * Detecta grupos para um equipamento
   */
  detectGroups(equipmentName) {
    this.metrics.groupOperations++;
    
    // Verificar cache primeiro
    if (this.equipmentGroupCache.has(equipmentName)) {
      this.metrics.cacheHits++;
      return [...this.equipmentGroupCache.get(equipmentName)];
    }
    
    this.metrics.cacheMisses++;
    
    // Detectar usando detector
    const detectedGroups = this.groupDetector.detectGroups(equipmentName);
    
    // Cache resultado
    this.equipmentGroupCache.set(equipmentName, detectedGroups);
    
    // Atualizar métricas
    if (detectedGroups.length > 0) {
      this.metrics.equipmentsClassified++;
    }
    
    return detectedGroups;
  }
  
  /**
   * Classifica múltiplos equipamentos
   */
  classifyEquipments(equipmentNames) {
    const startTime = Date.now();
    const classifications = new Map();
    
    for (const name of equipmentNames) {
      const groups = this.detectGroups(name);
      classifications.set(name, groups);
    }
    
    this.metrics.lastClassificationTime = Date.now() - startTime;
    
    this.logger.info('Classificação de equipamentos concluída', {
      total: equipmentNames.length,
      classified: classifications.size,
      duration: this.metrics.lastClassificationTime
    });
    
    return classifications;
  }
  
  /**
   * Obtém informações de um grupo específico
   */
  getGroupInfo(groupId) {
    // Verificar grupos padrão
    if (EQUIPMENT_GROUPS[groupId]) {
      return {
        id: groupId,
        type: 'standard',
        ...EQUIPMENT_GROUPS[groupId]
      };
    }
    
    // Verificar grupos customizados
    if (this.customGroups.has(groupId)) {
      return {
        id: groupId,
        type: 'custom',
        ...this.customGroups.get(groupId)
      };
    }
    
    return null;
  }
  
  /**
   * Lista todos os grupos disponíveis
   */
  getAllGroups() {
    const groups = [];
    
    // Grupos padrão
    Object.entries(EQUIPMENT_GROUPS).forEach(([id, config]) => {
      groups.push({
        id,
        type: 'standard',
        ...config
      });
    });
    
    // Grupos customizados
    this.customGroups.forEach((config, id) => {
      groups.push({
        id,
        type: 'custom',
        ...config
      });
    });
    
    return groups.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  }
  
  /**
   * Cria grupo customizado
   */
  createCustomGroup(groupId, groupConfig) {
    if (!this.config.enableCustomGroups) {
      throw new Error('Grupos customizados não estão habilitados');
    }
    
    // Validar ID
    if (EQUIPMENT_GROUPS[groupId]) {
      throw new Error(`ID '${groupId}' já é usado por um grupo padrão`);
    }
    
    if (this.customGroups.has(groupId)) {
      throw new Error(`Grupo customizado '${groupId}' já existe`);
    }
    
    // Validar configuração
    const validation = this.validateGroupConfig(groupConfig);
    if (!validation.valid) {
      throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
    }
    
    // Criar grupo
    const finalConfig = {
      name: groupConfig.name,
      patterns: [...groupConfig.patterns],
      color: groupConfig.color || '#95a5a6',
      icon: groupConfig.icon || 'CUSTOM',
      priority: groupConfig.priority || 999,
      description: groupConfig.description || 'Grupo criado pelo usuário',
      custom: true,
      createdAt: new Date().toISOString()
    };
    
    this.customGroups.set(groupId, finalConfig);
    
    // Adicionar ao detector
    this.groupDetector.addCustomGroup(groupId, finalConfig);
    
    // Limpar cache pois novo grupo pode afetar classificações
    this.clearCache();
    
    this.metrics.customGroupsCreated++;
    
    this.logger.info('Grupo customizado criado', { 
      groupId, 
      name: finalConfig.name 
    });
    
    return groupId;
  }
  
  /**
   * Atualiza grupo customizado
   */
  updateCustomGroup(groupId, updates) {
    if (!this.customGroups.has(groupId)) {
      throw new Error(`Grupo customizado '${groupId}' não encontrado`);
    }
    
    const currentConfig = this.customGroups.get(groupId);
    const newConfig = { ...currentConfig, ...updates };
    
    // Validar nova configuração
    const validation = this.validateGroupConfig(newConfig);
    if (!validation.valid) {
      throw new Error(`Configuração inválida: ${validation.errors.join(', ')}`);
    }
    
    // Atualizar
    newConfig.updatedAt = new Date().toISOString();
    this.customGroups.set(groupId, newConfig);
    
    // Atualizar no detector
    this.groupDetector.addCustomGroup(groupId, newConfig);
    
    // Limpar cache
    this.clearCache();
    
    this.logger.info('Grupo customizado atualizado', { groupId });
    
    return groupId;
  }
  
  /**
   * Remove grupo customizado
   */
  removeCustomGroup(groupId) {
    if (!this.customGroups.has(groupId)) {
      throw new Error(`Grupo customizado '${groupId}' não encontrado`);
    }
    
    // Remover do mapeamento local
    this.customGroups.delete(groupId);
    
    // Remover do detector
    this.groupDetector.removeCustomGroup(groupId);
    
    // Limpar cache
    this.clearCache();
    
    this.logger.info('Grupo customizado removido', { groupId });
    
    return true;
  }
  
  /**
   * Adiciona alias para grupo
   */
  addGroupAlias(groupId, alias) {
    if (!this.config.enableGroupAliases) {
      throw new Error('Aliases de grupos não estão habilitados');
    }
    
    // Verificar se grupo existe
    if (!this.getGroupInfo(groupId)) {
      throw new Error(`Grupo '${groupId}' não encontrado`);
    }
    
    // Verificar se alias já existe
    if (this.groupAliases.has(alias)) {
      throw new Error(`Alias '${alias}' já está em uso`);
    }
    
    this.groupAliases.set(alias, groupId);
    
    this.logger.debug('Alias de grupo adicionado', { groupId, alias });
    
    return true;
  }
  
  /**
   * Remove alias de grupo
   */
  removeGroupAlias(alias) {
    if (!this.groupAliases.has(alias)) {
      throw new Error(`Alias '${alias}' não encontrado`);
    }
    
    this.groupAliases.delete(alias);
    
    this.logger.debug('Alias de grupo removido', { alias });
    
    return true;
  }
  
  /**
   * Resolve alias para ID de grupo
   */
  resolveGroupId(idOrAlias) {
    // Se é um alias
    if (this.groupAliases.has(idOrAlias)) {
      return this.groupAliases.get(idOrAlias);
    }
    
    // Se é um ID direto
    if (this.getGroupInfo(idOrAlias)) {
      return idOrAlias;
    }
    
    return null;
  }
  
  /**
   * Obtém equipamentos de um grupo específico
   */
  getEquipmentsByGroup(groupId, equipmentList) {
    const resolvedGroupId = this.resolveGroupId(groupId);
    if (!resolvedGroupId) {
      throw new Error(`Grupo '${groupId}' não encontrado`);
    }
    
    const equipments = [];
    
    for (const equipmentName of equipmentList) {
      const groups = this.detectGroups(equipmentName);
      if (groups.includes(resolvedGroupId)) {
        equipments.push(equipmentName);
      }
    }
    
    return equipments;
  }
  
  /**
   * Agrupa equipamentos por seus grupos
   */
  groupEquipments(equipmentList) {
    const grouped = new Map();
    const ungrouped = [];
    
    for (const equipmentName of equipmentList) {
      const groups = this.detectGroups(equipmentName);
      
      if (groups.length === 0) {
        ungrouped.push(equipmentName);
      } else {
        groups.forEach(groupId => {
          if (!grouped.has(groupId)) {
            grouped.set(groupId, []);
          }
          grouped.get(groupId).push(equipmentName);
        });
      }
    }
    
    const result = {};
    
    // Converter Map para object com informações dos grupos
    grouped.forEach((equipments, groupId) => {
      const groupInfo = this.getGroupInfo(groupId);
      result[groupId] = {
        groupInfo,
        equipments,
        count: equipments.length
      };
    });
    
    // Adicionar equipamentos não agrupados
    if (ungrouped.length > 0) {
      result._ungrouped = {
        groupInfo: {
          id: '_ungrouped',
          name: 'Não Classificados',
          color: '#95a5a6',
          icon: '❓'
        },
        equipments: ungrouped,
        count: ungrouped.length
      };
    }
    
    return result;
  }
  
  /**
   * Analisa distribuição de grupos
   */
  analyzeGroupDistribution(equipmentList) {
    const grouped = this.groupEquipments(equipmentList);
    const analysis = {
      totalEquipments: equipmentList.length,
      groupedEquipments: 0,
      ungroupedEquipments: 0,
      groupCount: Object.keys(grouped).length,
      groups: {}
    };
    
    Object.entries(grouped).forEach(([groupId, data]) => {
      if (groupId === '_ungrouped') {
        analysis.ungroupedEquipments = data.count;
      } else {
        analysis.groupedEquipments += data.count;
        analysis.groups[groupId] = {
          name: data.groupInfo.name,
          count: data.count,
          percentage: (data.count / equipmentList.length) * 100
        };
      }
    });
    
    analysis.groupingRate = analysis.groupedEquipments / analysis.totalEquipments;
    
    return analysis;
  }
  
  /**
   * Sugere grupos para equipamentos não classificados
   */
  suggestGroupsForUnclassified(equipmentList) {
    const suggestions = [];
    
    for (const equipmentName of equipmentList) {
      const groups = this.detectGroups(equipmentName);
      
      if (groups.length === 0) {
        // Analisar nome para sugerir possível grupo
        const suggestion = this.analyzeEquipmentName(equipmentName);
        if (suggestion) {
          suggestions.push({
            equipment: equipmentName,
            suggestedGroup: suggestion.groupId,
            confidence: suggestion.confidence,
            reason: suggestion.reason
          });
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * Analisa nome de equipamento para sugestões
   */
  analyzeEquipmentName(equipmentName) {
    const normalizedName = equipmentName.toLowerCase();
    
    // Palavras-chave que podem indicar grupos
    const keywords = {
      'ALTA_PRESSAO': ['pressao', 'pressure', 'alta', 'high'],
      'AUTO_VACUO': ['vacuo', 'vacuum', 'auto', 'suc'],
      'HIPER_VACUO': ['hiper', 'hyper', 'super'],
      'BROOK': ['brook', 'brk'],
      'TANQUE': ['tanque', 'tank', 'reserv'],
      'CAMINHAO': ['caminhao', 'truck', 'veiculo']
    };
    
    for (const [groupId, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (normalizedName.includes(word)) {
          return {
            groupId,
            confidence: 0.6, // Confiança moderada para sugestões
            reason: `Contém palavra-chave: ${word}`
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Valida regra de grupo contra equipamentos
   */
  validateGroupRule(groupConfig, testEquipments) {
    const validation = {
      valid: true,
      matches: 0,
      falsePositives: [],
      falseNegatives: [],
      confidence: 0
    };
    
    for (const equipment of testEquipments) {
      const shouldMatch = equipment.expectedGroups?.includes(groupConfig.id) || false;
      const actualMatches = this.groupDetector.matchesGroup(
        this.groupDetector.normalizeEquipmentName(equipment.name), 
        groupConfig
      );
      
      if (shouldMatch && actualMatches) {
        validation.matches++;
      } else if (!shouldMatch && actualMatches) {
        validation.falsePositives.push(equipment.name);
      } else if (shouldMatch && !actualMatches) {
        validation.falseNegatives.push(equipment.name);
      }
    }
    
    // Calcular confiança baseada em precisão e recall
    const precision = validation.matches / (validation.matches + validation.falsePositives.length);
    const recall = validation.matches / (validation.matches + validation.falseNegatives.length);
    
    validation.confidence = (precision + recall) / 2;
    validation.valid = validation.confidence > 0.7; // Threshold de 70%
    
    return validation;
  }
  
  /**
   * Inicializa aliases padrão
   */
  initializeDefaultAliases() {
    if (!this.config.enableGroupAliases) return;
    
    const defaultAliases = {
      'AP': 'ALTA_PRESSAO',
      'AV': 'AUTO_VACUO',
      'HV': 'HIPER_VACUO',
      'BK': 'BROOK',
      'TK': 'TANQUE',
      'TR': 'CAMINHAO'
    };
    
    Object.entries(defaultAliases).forEach(([alias, groupId]) => {
      this.groupAliases.set(alias, groupId);
    });
  }
  
  /**
   * Valida configuração de grupo
   */
  validateGroupConfig(config) {
    return this.groupDetector.validateGroupConfig(config);
  }
  
  /**
   * Obtém estatísticas dos grupos
   */
  getGroupStats(equipmentList = []) {
    const stats = {
      totalGroups: this.getAllGroups().length,
      standardGroups: Object.keys(EQUIPMENT_GROUPS).length,
      customGroups: this.customGroups.size,
      aliases: this.groupAliases.size,
      metrics: { ...this.metrics }
    };
    
    if (equipmentList.length > 0) {
      const distribution = this.analyzeGroupDistribution(equipmentList);
      stats.distribution = distribution;
    }
    
    return stats;
  }
  
  /**
   * Limpa todos os caches
   */
  clearCache() {
    this.equipmentGroupCache.clear();
    this.groupDetector.clearCache();
    this.logger.debug('Caches de grupos limpos');
  }
  
  /**
   * Exporta configuração de grupos customizados
   */
  exportCustomGroups() {
    const exported = {};
    
    this.customGroups.forEach((config, id) => {
      exported[id] = { ...config };
    });
    
    return {
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      customGroups: exported,
      aliases: Object.fromEntries(this.groupAliases)
    };
  }
  
  /**
   * Importa configuração de grupos customizados
   */
  importCustomGroups(importData) {
    if (!importData.customGroups) {
      throw new Error('Dados de importação inválidos');
    }
    
    let imported = 0;
    let errors = [];
    
    // Importar grupos customizados
    Object.entries(importData.customGroups).forEach(([id, config]) => {
      try {
        this.createCustomGroup(id, config);
        imported++;
      } catch (error) {
        errors.push(`Grupo ${id}: ${error.message}`);
      }
    });
    
    // Importar aliases se disponíveis
    if (importData.aliases) {
      Object.entries(importData.aliases).forEach(([alias, groupId]) => {
        try {
          this.addGroupAlias(groupId, alias);
        } catch (error) {
          errors.push(`Alias ${alias}: ${error.message}`);
        }
      });
    }
    
    this.logger.info('Importação de grupos concluída', {
      imported,
      errors: errors.length
    });
    
    return {
      imported,
      errors
    };
  }
}

export default GroupManager;
