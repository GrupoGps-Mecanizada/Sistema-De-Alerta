/**
 * Validador de Regras - RuleValidator.js
 * Valida estrutura e lógica de regras simples e avançadas
 */

import { Logger } from '../../utils/logger.js';

export class RuleValidator {
  constructor(config = {}) {
    this.config = {
      strictValidation: false,
      maxConditions: 50,
      maxGroupDepth: 5,
      allowEmptyConditions: false,
      requireMessage: true,
      allowedApontamentos: [
        'Documentação', 'Abastecimento', 'Refeição Motorista', 
        'Preparação', 'Aguardando Área', 'Bloqueio', 
        'Descarregamento', 'Pequenas manutenções'
      ],
      allowedStatuses: [
        'on', 'off', 'stopped', 'maintenance', 'out_of_plant'
      ],
      allowedSeverities: ['low', 'medium', 'high', 'critical'],
      allowedOperators: [
        'equals', 'not_equals', 'contains', 'not_contains',
        'starts_with', 'ends_with', 'regex',
        '>', '<', '>=', '<=', '=',
        'greater_than', 'less_than', 'greater_equal', 'less_equal'
      ],
      allowedLogics: ['AND', 'OR', 'NOT'],
      allowedTimeOperators: ['>', '<', '=', '>=', '<='],
      ...config
    };
    
    this.logger = new Logger('RuleValidator');
  }
  
  /**
   * Valida regra (detecta tipo automaticamente)
   */
  validateRule(rule) {
    if (!rule || typeof rule !== 'object') {
      return {
        valid: false,
        errors: ['Regra deve ser um objeto válido'],
        warnings: []
      };
    }
    
    // Validações básicas primeiro
    const basicValidation = this.validateBasicStructure(rule);
    if (!basicValidation.valid) {
      return basicValidation;
    }
    
    // Validação específica por tipo
    if (rule.type === 'advanced') {
      return this.validateAdvancedRule(rule);
    } else {
      return this.validateSimpleRule(rule);
    }
  }
  
  /**
   * Valida estrutura básica comum a todos os tipos de regra
   */
  validateBasicStructure(rule) {
    const errors = [];
    const warnings = [];
    
    // Validar ID
    if (rule.id !== undefined && rule.id !== null) {
      if (typeof rule.id !== 'number' && typeof rule.id !== 'string') {
        errors.push('ID da regra deve ser um número ou string');
      }
    }
    
    // Validar nome
    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim().length === 0) {
      errors.push('Nome da regra é obrigatório');
    } else if (rule.name.length > 100) {
      warnings.push('Nome da regra é muito longo (máximo 100 caracteres)');
    }
    
    // Validar tipo
    if (rule.type && !['simple', 'advanced'].includes(rule.type)) {
      errors.push('Tipo de regra deve ser "simple" ou "advanced"');
    }
    
    // Validar status ativo
    if (rule.active !== undefined && typeof rule.active !== 'boolean') {
      errors.push('Campo "active" deve ser booleano');
    }
    
    // Validar grupos de equipamentos
    if (rule.equipmentGroups !== undefined) {
      if (!Array.isArray(rule.equipmentGroups)) {
        errors.push('equipmentGroups deve ser um array');
      } else {
        rule.equipmentGroups.forEach((group, index) => {
          if (typeof group !== 'string' || group.trim().length === 0) {
            errors.push(`Grupo de equipamento ${index} deve ser uma string não vazia`);
          }
        });
      }
    }
    
    // Validar applyToAllGroups
    if (rule.applyToAllGroups !== undefined && typeof rule.applyToAllGroups !== 'boolean') {
      errors.push('Campo "applyToAllGroups" deve ser booleano');
    }
    
    // Validar gravidade
    if (!rule.severity) {
      errors.push('Gravidade é obrigatória');
    } else if (!this.config.allowedSeverities.includes(rule.severity)) {
      errors.push(`Gravidade deve ser: ${this.config.allowedSeverities.join(', ')}`);
    }
    
    // Validar mensagem
    if (this.config.requireMessage) {
      if (!rule.message || typeof rule.message !== 'string' || rule.message.trim().length === 0) {
        errors.push('Mensagem é obrigatória');
      }
    }
    
    // Validar placeholders na mensagem
    if (rule.message) {
      const placeholderValidation = this.validateMessagePlaceholders(rule.message);
      warnings.push(...placeholderValidation.warnings);
      if (this.config.strictValidation) {
        errors.push(...placeholderValidation.errors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Valida regra simples
   */
  validateSimpleRule(rule) {
    const basicValidation = this.validateBasicStructure(rule);
    if (!basicValidation.valid) {
      return basicValidation;
    }
    
    const errors = [...basicValidation.errors];
    const warnings = [...basicValidation.warnings];
    
    // Validar existência de condições
    if (!rule.conditions) {
      errors.push('Condições são obrigatórias para regras simples');
      return { valid: false, errors, warnings };
    }
    
    const conditions = rule.conditions;
    
    // Validar operador lógico
    if (conditions.operator && !['AND', 'OR'].includes(conditions.operator)) {
      errors.push('Operador lógico deve ser AND ou OR');
    }
    
    // Validar apontamento
    if (conditions.apontamento) {
      if (typeof conditions.apontamento !== 'string') {
        errors.push('Apontamento deve ser uma string');
      } else if (this.config.strictValidation && 
                 !this.config.allowedApontamentos.includes(conditions.apontamento)) {
        warnings.push(`Apontamento "${conditions.apontamento}" não está na lista padrão`);
      }
    }
    
    // Validar status
    if (conditions.status) {
      if (typeof conditions.status !== 'string') {
        errors.push('Status deve ser uma string');
      } else if (!this.config.allowedStatuses.includes(conditions.status)) {
        errors.push(`Status deve ser: ${this.config.allowedStatuses.join(', ')}`);
      }
    }
    
    // Validar condições de tempo
    if (conditions.timeOperator || conditions.timeValue !== undefined) {
      if (!conditions.timeOperator) {
        errors.push('Operador de tempo é obrigatório quando valor de tempo é especificado');
      } else if (!this.config.allowedTimeOperators.includes(conditions.timeOperator)) {
        errors.push(`Operador de tempo deve ser: ${this.config.allowedTimeOperators.join(', ')}`);
      }
      
      if (conditions.timeValue === undefined || conditions.timeValue === null) {
        errors.push('Valor de tempo é obrigatório quando operador de tempo é especificado');
      } else if (typeof conditions.timeValue !== 'number') {
        errors.push('Valor de tempo deve ser um número');
      } else if (conditions.timeValue < 0) {
        errors.push('Valor de tempo deve ser positivo');
      } else if (conditions.timeValue > 1440) { // 24 horas
        warnings.push('Valor de tempo muito alto (> 24 horas)');
      }
    }
    
    // Verificar se há pelo menos uma condição significativa
    if (!this.config.allowEmptyConditions) {
      const hasApontamento = conditions.apontamento && conditions.apontamento.trim().length > 0;
      const hasStatus = conditions.status && conditions.status.trim().length > 0;
      const hasTime = conditions.timeOperator && conditions.timeValue !== undefined;
      
      if (!hasApontamento && !hasStatus && !hasTime) {
        errors.push('Pelo menos uma condição (apontamento, status ou tempo) é obrigatória');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Valida regra avançada
   */
  validateAdvancedRule(rule) {
    const basicValidation = this.validateBasicStructure(rule);
    if (!basicValidation.valid) {
      return basicValidation;
    }
    
    const errors = [...basicValidation.errors];
    const warnings = [...basicValidation.warnings];
    
    // Validar existência de condições
    if (!rule.conditions) {
      errors.push('Condições são obrigatórias para regras avançadas');
      return { valid: false, errors, warnings };
    }
    
    // Validar estrutura de condições complexas
    const conditionsValidation = this.validateConditionsGroup(rule.conditions, 0);
    errors.push(...conditionsValidation.errors);
    warnings.push(...conditionsValidation.warnings);
    
    // Verificar número total de condições
    const totalConditions = this.countConditionsInGroup(rule.conditions);
    if (totalConditions > this.config.maxConditions) {
      errors.push(`Muitas condições (${totalConditions}). Máximo permitido: ${this.config.maxConditions}`);
    }
    
    if (totalConditions === 0 && !this.config.allowEmptyConditions) {
      errors.push('Pelo menos uma condição é obrigatória');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Valida grupo de condições recursivamente
   */
  validateConditionsGroup(group, depth = 0) {
    const errors = [];
    const warnings = [];
    
    // Verificar profundidade máxima
    if (depth > this.config.maxGroupDepth) {
      errors.push(`Profundidade de grupos muito alta (${depth}). Máximo: ${this.config.maxGroupDepth}`);
      return { errors, warnings };
    }
    
    // Validar lógica do grupo
    if (!group.logic) {
      errors.push('Lógica do grupo é obrigatória');
    } else if (!this.config.allowedLogics.includes(group.logic)) {
      errors.push(`Lógica deve ser: ${this.config.allowedLogics.join(', ')}`);
    }
    
    // Validar array de regras
    if (!group.rules || !Array.isArray(group.rules)) {
      errors.push('Grupo deve ter array de regras');
      return { errors, warnings };
    }
    
    if (group.rules.length === 0) {
      warnings.push('Grupo vazio encontrado');
    }
    
    // Validar cada regra no grupo
    group.rules.forEach((rule, index) => {
      if (rule.type === 'group') {
        // Validar grupo aninhado
        if (!rule.group) {
          errors.push(`Regra ${index}: grupo aninhado deve ter propriedade "group"`);
        } else {
          const nestedValidation = this.validateConditionsGroup(rule.group, depth + 1);
          errors.push(...nestedValidation.errors.map(e => `Grupo ${index}: ${e}`));
          warnings.push(...nestedValidation.warnings.map(w => `Grupo ${index}: ${w}`));
        }
      } else {
        // Validar condição individual
        const conditionValidation = this.validateIndividualCondition(rule);
        errors.push(...conditionValidation.errors.map(e => `Condição ${index}: ${e}`));
        warnings.push(...conditionValidation.warnings.map(w => `Condição ${index}: ${w}`));
      }
    });
    
    // Validações específicas por lógica
    if (group.logic === 'NOT' && group.rules.length > 1) {
      warnings.push('Lógica NOT com múltiplas condições pode ser confusa');
    }
    
    return { errors, warnings };
  }
  
  /**
   * Valida condição individual
   */
  validateIndividualCondition(condition) {
    const errors = [];
    const warnings = [];
    
    // Validar tipo de condição
    if (!condition.type) {
      errors.push('Tipo de condição é obrigatório');
    } else {
      const validTypes = ['apontamento', 'status', 'time', 'equipment', 'group', 'custom'];
      if (!validTypes.includes(condition.type)) {
        errors.push(`Tipo de condição deve ser: ${validTypes.join(', ')}`);
      }
    }
    
    // Validar operador
    if (!condition.operator) {
      errors.push('Operador é obrigatório');
    } else if (!this.config.allowedOperators.includes(condition.operator)) {
      errors.push(`Operador "${condition.operator}" não é válido`);
    }
    
    // Validar valor
    if (condition.value === undefined || condition.value === null) {
      errors.push('Valor da condição é obrigatório');
    } else {
      // Validações específicas por tipo
      switch (condition.type) {
        case 'time':
          if (typeof condition.value !== 'number') {
            errors.push('Valor de tempo deve ser um número');
          } else if (condition.value < 0) {
            errors.push('Valor de tempo deve ser positivo');
          }
          break;
          
        case 'apontamento':
          if (typeof condition.value !== 'string') {
            errors.push('Valor de apontamento deve ser uma string');
          } else if (this.config.strictValidation && 
                     !this.config.allowedApontamentos.includes(condition.value)) {
            warnings.push(`Apontamento "${condition.value}" não está na lista padrão`);
          }
          break;
          
        case 'status':
          if (typeof condition.value !== 'string') {
            errors.push('Valor de status deve ser uma string');
          } else if (!this.config.allowedStatuses.includes(condition.value)) {
            warnings.push(`Status "${condition.value}" não está na lista padrão`);
          }
          break;
          
        case 'equipment':
        case 'group':
          if (typeof condition.value !== 'string') {
            errors.push(`Valor de ${condition.type} deve ser uma string`);
          }
          break;
      }
    }
    
    // Validar combinações operador-tipo
    const timeOperators = ['>', '<', '>=', '<=', '='];
    const stringOperators = ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex'];
    
    if (condition.type === 'time' && !timeOperators.includes(condition.operator)) {
      errors.push('Operadores de tempo devem ser: >, <, >=, <=, =');
    }
    
    if (['apontamento', 'status', 'equipment', 'group'].includes(condition.type) && 
        timeOperators.includes(condition.operator)) {
      warnings.push('Operadores numéricos com campos de texto podem causar comportamento inesperado');
    }
    
    return { errors, warnings };
  }
  
  /**
   * Valida placeholders na mensagem
   */
  validateMessagePlaceholders(message) {
    const errors = [];
    const warnings = [];
    
    // Placeholders válidos
    const validPlaceholders = [
      '{equipamento}', '{apontamento}', '{status}', '{tempo}', 
      '{duracao}', '{grupos}', '{periodo}', '{tipo}'
    ];
    
    // Encontrar todos os placeholders
    const placeholderRegex = /\{([^}]+)\}/g;
    const foundPlaceholders = [];
    let match;
    
    while ((match = placeholderRegex.exec(message)) !== null) {
      foundPlaceholders.push(match[0]);
    }
    
    // Verificar placeholders inválidos
    foundPlaceholders.forEach(placeholder => {
      if (!validPlaceholders.includes(placeholder)) {
        warnings.push(`Placeholder "${placeholder}" pode não ser reconhecido`);
      }
    });
    
    // Verificar se há placeholders
    if (foundPlaceholders.length === 0) {
      warnings.push('Mensagem não contém placeholders dinâmicos');
    }
    
    // Verificar sintaxe de placeholders
    const unmatchedBraces = (message.match(/\{/g) || []).length !== (message.match(/\}/g) || []).length;
    if (unmatchedBraces) {
      errors.push('Chaves de placeholders não balanceadas na mensagem');
    }
    
    return { errors, warnings };
  }
  
  /**
   * Conta condições em um grupo recursivamente
   */
  countConditionsInGroup(group) {
    let count = 0;
    
    if (group.rules) {
      group.rules.forEach(rule => {
        if (rule.type === 'group') {
          count += this.countConditionsInGroup(rule.group);
        } else {
          count++;
        }
      });
    }
    
    return count;
  }
  
  /**
   * Valida compatibilidade entre regras
   */
  validateRuleCompatibility(rules) {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(rules)) {
      return {
        valid: false,
        errors: ['Lista de regras deve ser um array'],
        warnings: []
      };
    }
    
    // Verificar IDs únicos
    const ids = new Set();
    const duplicatedIds = [];
    
    rules.forEach((rule, index) => {
      if (rule.id !== undefined && rule.id !== null) {
        if (ids.has(rule.id)) {
          duplicatedIds.push(rule.id);
        } else {
          ids.add(rule.id);
        }
      }
    });
    
    if (duplicatedIds.length > 0) {
      errors.push(`IDs duplicados encontrados: ${duplicatedIds.join(', ')}`);
    }
    
    // Verificar nomes únicos
    const names = new Set();
    const duplicatedNames = [];
    
    rules.forEach(rule => {
      if (rule.name) {
        const normalizedName = rule.name.toLowerCase().trim();
        if (names.has(normalizedName)) {
          duplicatedNames.push(rule.name);
        } else {
          names.add(normalizedName);
        }
      }
    });
    
    if (duplicatedNames.length > 0) {
      warnings.push(`Nomes similares encontrados: ${duplicatedNames.join(', ')}`);
    }
    
    // Verificar conflitos potenciais
    const conflicts = this.detectRuleConflicts(rules);
    warnings.push(...conflicts);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Detecta conflitos potenciais entre regras
   */
  detectRuleConflicts(rules) {
    const conflicts = [];
    
    // Verificar regras muito similares
    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];
        
        if (this.areRulesSimilar(rule1, rule2)) {
          conflicts.push(`Regras "${rule1.name}" e "${rule2.name}" são muito similares`);
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * Verifica se duas regras são similares
   */
  areRulesSimilar(rule1, rule2) {
    // Comparação simples baseada em condições principais
    if (rule1.type === 'simple' && rule2.type === 'simple') {
      const cond1 = rule1.conditions;
      const cond2 = rule2.conditions;
      
      return (
        cond1.apontamento === cond2.apontamento &&
        cond1.status === cond2.status &&
        Math.abs((cond1.timeValue || 0) - (cond2.timeValue || 0)) < 5
      );
    }
    
    return false;
  }
  
  /**
   * Gera relatório de validação detalhado
   */
  generateValidationReport(rules) {
    const report = {
      summary: {
        totalRules: rules.length,
        validRules: 0,
        invalidRules: 0,
        rulesWithWarnings: 0
      },
      rules: [],
      compatibility: null
    };
    
    // Validar cada regra individualmente
    rules.forEach((rule, index) => {
      const validation = this.validateRule(rule);
      
      const ruleReport = {
        index,
        name: rule.name || `Regra ${index + 1}`,
        type: rule.type || 'simple',
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings
      };
      
      if (validation.valid) {
        report.summary.validRules++;
      } else {
        report.summary.invalidRules++;
      }
      
      if (validation.warnings.length > 0) {
        report.summary.rulesWithWarnings++;
      }
      
      report.rules.push(ruleReport);
    });
    
    // Validar compatibilidade entre regras
    report.compatibility = this.validateRuleCompatibility(rules);
    
    return report;
  }
  
  /**
   * Atualiza configuração do validador
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.debug('Configuração do validador atualizada', newConfig);
  }
  
  /**
   * Obtém configuração atual
   */
  getConfig() {
    return { ...this.config };
  }
}

export default RuleValidator;
