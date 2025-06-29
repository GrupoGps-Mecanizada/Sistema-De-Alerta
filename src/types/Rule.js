/**
 * Rule.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Estrutura e validação de regras de alertas
 * Define regras simples e avançadas para geração de alertas
 * 
 * Funcionalidades:
 * - Estrutura padronizada de regras
 * - Validação de condições e lógica
 * - Regras simples e avançadas
 * - Serialização e deserialização
 * - Avaliação de condições
 * - Templates e clonagem
 * - Integração com grupos de equipamentos
 * - Versionamento de regras
 */

import { HashUtils } from '../utils/hash.js';
import { DateUtils } from '../utils/dateParser.js';
import { LogUtils } from '../utils/logger.js';

export class Rule {
    constructor(data = {}, config = {}) {
        this.config = {
            // Configurações de validação
            strictValidation: config.strictValidation !== false,
            allowPartialData: config.allowPartialData || false,
            autoGenerateIds: config.autoGenerateIds !== false,
            
            // Configurações de avaliação
            enableCaching: config.enableCaching !== false,
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutos
            
            // Configurações de formato
            defaultSeverity: config.defaultSeverity || 'MEDIUM',
            defaultEnabled: config.defaultEnabled !== false,
            
            ...config
        };

        // Cache de avaliações
        this.evaluationCache = new Map();
        
        // Logger
        this.logger = config.logger || LogUtils.createLogger('Rule');

        // Inicializa regra com dados fornecidos
        this.initialize(data);
    }

    /**
     * Inicializa regra com validação
     * @param {Object} data - Dados da regra
     */
    initialize(data) {
        try {
            // Aplica valores padrão
            this.applyDefaults(data);
            
            // Normaliza dados
            this.normalize();
            
            // Valida estrutura
            if (this.config.strictValidation) {
                this.validate();
            }

            // Gera IDs se necessário
            if (this.config.autoGenerateIds) {
                this.generateMissingIds();
            }

            this.logger.debug('Rule: Regra inicializada', {
                id: this.id,
                name: this.name,
                type: this.type,
                enabled: this.enabled
            });

        } catch (error) {
            this.logger.error('Rule: Erro na inicialização', {
                error: error.message,
                data: data
            });
            
            if (this.config.strictValidation) {
                throw error;
            }
        }
    }

    /**
     * Aplica valores padrão
     * @param {Object} data - Dados fornecidos
     */
    applyDefaults(data) {
        const now = Date.now();
        
        // Campos obrigatórios
        this.id = data.id || null;
        this.name = data.name || '';
        this.description = data.description || '';
        this.type = data.type || 'simple';
        this.enabled = data.enabled !== false;
        
        // Condições
        this.conditions = data.conditions || {};
        this.logic = data.logic || 'AND';
        
        // Configurações de alerta
        this.severity = data.severity || this.config.defaultSeverity;
        this.priority = data.priority || this.derivePriorityFromSeverity(this.severity);
        this.messageTemplate = data.messageTemplate || '';
        this.eventType = data.eventType || 'RULE_TRIGGERED';
        
        // Grupos e aplicabilidade
        this.equipmentGroups = Array.isArray(data.equipmentGroups) ? data.equipmentGroups : [];
        this.equipmentPatterns = Array.isArray(data.equipmentPatterns) ? data.equipmentPatterns : [];
        this.applicableEquipment = Array.isArray(data.applicableEquipment) ? data.applicableEquipment : [];
        
        // Configurações de timing
        this.evaluationFrequency = data.evaluationFrequency || 60000; // 1 minuto
        this.cooldownPeriod = data.cooldownPeriod || 300000; // 5 minutos
        this.maxOccurrences = data.maxOccurrences || null;
        this.timeWindow = data.timeWindow || null;
        
        // Configurações de ação
        this.actions = Array.isArray(data.actions) ? data.actions : [];
        this.suppressionRules = Array.isArray(data.suppressionRules) ? data.suppressionRules : [];
        
        // Tags e categorização
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        this.category = data.category || 'GENERAL';
        this.subcategory = data.subcategory || null;
        
        // Configurações avançadas
        this.aggregationWindow = data.aggregationWindow || null;
        this.consolidationEnabled = data.consolidationEnabled !== false;
        this.deduplicationEnabled = data.deduplicationEnabled !== false;
        
        // Schedule e validade
        this.schedule = data.schedule || null; // Para regras com horário específico
        this.validFrom = data.validFrom || null;
        this.validUntil = data.validUntil || null;
        
        // Metadados
        this.metadata = typeof data.metadata === 'object' ? { ...data.metadata } : {};
        
        // Auditoria
        this.createdAt = data.createdAt || now;
        this.createdBy = data.createdBy || 'SYSTEM';
        this.updatedAt = data.updatedAt || now;
        this.updatedBy = data.updatedBy || 'SYSTEM';
        this.version = data.version || 1;
        
        // Estado de execução
        this.lastEvaluated = data.lastEvaluated || null;
        this.lastTriggered = data.lastTriggered || null;
        this.triggerCount = data.triggerCount || 0;
        this.evaluationCount = data.evaluationCount || 0;
        
        // Configurações de notificação
        this.notificationChannels = Array.isArray(data.notificationChannels) ? data.notificationChannels : [];
        this.escalationRules = Array.isArray(data.escalationRules) ? data.escalationRules : [];
    }

    /**
     * Normaliza dados da regra
     */
    normalize() {
        // Normaliza strings
        const stringFields = ['name', 'description', 'messageTemplate', 'eventType', 'category', 'subcategory'];
        stringFields.forEach(field => {
            if (typeof this[field] === 'string') {
                this[field] = this[field].trim();
            }
        });

        // Normaliza tipo
        this.type = this.type.toLowerCase();
        
        // Normaliza severidade
        this.severity = this.severity.toUpperCase();
        
        // Normaliza lógica
        this.logic = this.logic.toUpperCase();
        
        // Normaliza arrays
        this.equipmentGroups = this.equipmentGroups.map(group => 
            typeof group === 'string' ? group.trim().toUpperCase() : group
        );

        this.tags = this.tags.map(tag => 
            typeof tag === 'string' ? tag.trim().toLowerCase() : tag
        );

        // Normaliza timestamps de validade
        if (this.validFrom) {
            this.validFrom = DateUtils.parse(this.validFrom)?.getTime() || null;
        }
        
        if (this.validUntil) {
            this.validUntil = DateUtils.parse(this.validUntil)?.getTime() || null;
        }

        // Normaliza condições baseado no tipo
        this.normalizeConditions();
    }

    /**
     * Normaliza condições baseado no tipo de regra
     */
    normalizeConditions() {
        if (this.type === 'simple') {
            this.normalizeSimpleConditions();
        } else if (this.type === 'advanced') {
            this.normalizeAdvancedConditions();
        }
    }

    /**
     * Normaliza condições simples
     */
    normalizeSimpleConditions() {
        const conditions = this.conditions;
        
        // Normaliza operadores de tempo
        if (conditions.timeOperator) {
            conditions.timeOperator = conditions.timeOperator.trim();
        }
        
        // Normaliza valores de apontamento
        if (conditions.apontamento && typeof conditions.apontamento === 'string') {
            conditions.apontamento = conditions.apontamento.trim();
        }
        
        // Normaliza status
        if (conditions.status && typeof conditions.status === 'string') {
            conditions.status = conditions.status.toLowerCase();
        }
    }

    /**
     * Normaliza condições avançadas
     */
    normalizeAdvancedConditions() {
        if (this.conditions.rules && Array.isArray(this.conditions.rules)) {
            this.conditions.rules = this.conditions.rules.map(rule => {
                if (rule.operator && typeof rule.operator === 'string') {
                    rule.operator = rule.operator.trim();
                }
                if (rule.type && typeof rule.type === 'string') {
                    rule.type = rule.type.toLowerCase();
                }
                if (rule.value && typeof rule.value === 'string') {
                    rule.value = rule.value.trim();
                }
                return rule;
            });
        }
    }

    /**
     * Valida estrutura da regra
     * @throws {Error} - Se validação falhar
     */
    validate() {
        const errors = [];

        // Validação de campos obrigatórios
        if (!this.name || typeof this.name !== 'string') {
            errors.push('Campo name é obrigatório e deve ser string');
        }

        if (!this.type || typeof this.type !== 'string') {
            errors.push('Campo type é obrigatório e deve ser string');
        }

        // Validação de tipo
        const validTypes = ['simple', 'advanced', 'composite', 'threshold', 'anomaly'];
        if (!validTypes.includes(this.type)) {
            errors.push(`Tipo deve ser um de: ${validTypes.join(', ')}`);
        }

        // Validação de severidade
        const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (!validSeverities.includes(this.severity)) {
            errors.push(`Severidade deve ser uma de: ${validSeverities.join(', ')}`);
        }

        // Validação de lógica
        const validLogics = ['AND', 'OR', 'NOT', 'XOR'];
        if (!validLogics.includes(this.logic)) {
            errors.push(`Lógica deve ser uma de: ${validLogics.join(', ')}`);
        }

        // Validação de condições
        if (!this.conditions || typeof this.conditions !== 'object') {
            errors.push('Campo conditions é obrigatório e deve ser objeto');
        } else {
            this.validateConditions(errors);
        }

        // Validação de arrays
        if (!Array.isArray(this.equipmentGroups)) {
            errors.push('equipmentGroups deve ser um array');
        }

        if (!Array.isArray(this.tags)) {
            errors.push('tags deve ser um array');
        }

        // Validação de períodos
        if (this.validFrom && this.validUntil && this.validFrom >= this.validUntil) {
            errors.push('validFrom deve ser anterior a validUntil');
        }

        // Validação de valores numéricos
        if (this.evaluationFrequency && this.evaluationFrequency < 1000) {
            errors.push('evaluationFrequency deve ser pelo menos 1000ms');
        }

        if (this.cooldownPeriod && this.cooldownPeriod < 0) {
            errors.push('cooldownPeriod não pode ser negativo');
        }

        if (errors.length > 0) {
            throw new Error(`Validação de regra falhou: ${errors.join(', ')}`);
        }
    }

    /**
     * Valida condições específicas por tipo
     * @param {Array} errors - Array de erros para adicionar
     */
    validateConditions(errors) {
        switch (this.type) {
            case 'simple':
                this.validateSimpleConditions(errors);
                break;
            case 'advanced':
                this.validateAdvancedConditions(errors);
                break;
            case 'threshold':
                this.validateThresholdConditions(errors);
                break;
            case 'anomaly':
                this.validateAnomalyConditions(errors);
                break;
        }
    }

    /**
     * Valida condições simples
     * @param {Array} errors - Array de erros
     */
    validateSimpleConditions(errors) {
        const conditions = this.conditions;
        
        if (conditions.timeOperator && conditions.timeValue === undefined) {
            errors.push('timeValue é obrigatório quando timeOperator é especificado');
        }
        
        if (conditions.timeValue !== undefined && typeof conditions.timeValue !== 'number') {
            errors.push('timeValue deve ser um número');
        }

        const validTimeOperators = ['>', '<', '>=', '<=', '==', '!='];
        if (conditions.timeOperator && !validTimeOperators.includes(conditions.timeOperator)) {
            errors.push(`timeOperator deve ser um de: ${validTimeOperators.join(', ')}`);
        }
    }

    /**
     * Valida condições avançadas
     * @param {Array} errors - Array de erros
     */
    validateAdvancedConditions(errors) {
        const conditions = this.conditions;
        
        if (!conditions.logic) {
            errors.push('logic é obrigatório para regras avançadas');
        }
        
        if (!conditions.rules || !Array.isArray(conditions.rules)) {
            errors.push('rules deve ser um array para regras avançadas');
        } else if (conditions.rules.length === 0) {
            errors.push('rules não pode estar vazio para regras avançadas');
        } else {
            conditions.rules.forEach((rule, index) => {
                if (!rule.type) {
                    errors.push(`rule[${index}].type é obrigatório`);
                }
                if (!rule.operator) {
                    errors.push(`rule[${index}].operator é obrigatório`);
                }
                if (rule.value === undefined) {
                    errors.push(`rule[${index}].value é obrigatório`);
                }
            });
        }
    }

    /**
     * Valida condições de threshold
     * @param {Array} errors - Array de erros
     */
    validateThresholdConditions(errors) {
        const conditions = this.conditions;
        
        if (!conditions.metric) {
            errors.push('metric é obrigatório para regras de threshold');
        }
        
        if (conditions.threshold === undefined) {
            errors.push('threshold é obrigatório para regras de threshold');
        }
        
        if (typeof conditions.threshold !== 'number') {
            errors.push('threshold deve ser um número');
        }
    }

    /**
     * Valida condições de anomalia
     * @param {Array} errors - Array de erros
     */
    validateAnomalyConditions(errors) {
        const conditions = this.conditions;
        
        if (!conditions.algorithm) {
            errors.push('algorithm é obrigatório para regras de anomalia');
        }
        
        const validAlgorithms = ['zscore', 'isolation_forest', 'statistical', 'moving_average'];
        if (!validAlgorithms.includes(conditions.algorithm)) {
            errors.push(`algorithm deve ser um de: ${validAlgorithms.join(', ')}`);
        }
    }

    /**
     * Gera IDs ausentes
     */
    generateMissingIds() {
        if (!this.id) {
            this.id = HashUtils.uniqueId('rule');
        }
    }

    /**
     * Deriva prioridade da severidade
     * @param {string} severity - Severidade
     * @returns {string} - Prioridade
     */
    derivePriorityFromSeverity(severity) {
        const severityToPriority = {
            'LOW': 'LOW',
            'MEDIUM': 'MEDIUM',
            'HIGH': 'HIGH',
            'CRITICAL': 'URGENT'
        };
        
        return severityToPriority[severity] || 'MEDIUM';
    }

    /**
     * Verifica se regra é aplicável a um equipamento
     * @param {string} equipmentName - Nome do equipamento
     * @param {Array} equipmentGroups - Grupos do equipamento
     * @returns {boolean} - Se é aplicável
     */
    isApplicableToEquipment(equipmentName, equipmentGroups = []) {
        // Verifica grupos específicos
        if (this.equipmentGroups.length > 0) {
            const hasMatchingGroup = this.equipmentGroups.some(group => 
                equipmentGroups.includes(group)
            );
            if (!hasMatchingGroup) {
                return false;
            }
        }

        // Verifica padrões de nome
        if (this.equipmentPatterns.length > 0) {
            const hasMatchingPattern = this.equipmentPatterns.some(pattern => {
                try {
                    const regex = new RegExp(pattern, 'i');
                    return regex.test(equipmentName);
                } catch (error) {
                    // Se padrão regex é inválido, tenta match simples
                    return equipmentName.toLowerCase().includes(pattern.toLowerCase());
                }
            });
            if (!hasMatchingPattern) {
                return false;
            }
        }

        // Verifica lista específica de equipamentos
        if (this.applicableEquipment.length > 0) {
            if (!this.applicableEquipment.includes(equipmentName)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Verifica se regra está dentro do período de validade
     * @param {number} timestamp - Timestamp para verificar
     * @returns {boolean} - Se está válida
     */
    isValidAt(timestamp = Date.now()) {
        if (this.validFrom && timestamp < this.validFrom) {
            return false;
        }
        
        if (this.validUntil && timestamp > this.validUntil) {
            return false;
        }
        
        return true;
    }

    /**
     * Verifica se regra está em cooldown
     * @param {number} timestamp - Timestamp para verificar
     * @returns {boolean} - Se está em cooldown
     */
    isInCooldown(timestamp = Date.now()) {
        if (!this.lastTriggered || !this.cooldownPeriod) {
            return false;
        }
        
        return (timestamp - this.lastTriggered) < this.cooldownPeriod;
    }

    /**
     * Avalia condições da regra contra dados
     * @param {Object} data - Dados para avaliar
     * @param {Object} context - Contexto adicional
     * @returns {boolean} - Se condições são atendidas
     */
    evaluate(data, context = {}) {
        try {
            // Verifica se regra está habilitada
            if (!this.enabled) {
                return false;
            }

            // Verifica validade temporal
            if (!this.isValidAt(context.timestamp)) {
                return false;
            }

            // Verifica cooldown
            if (this.isInCooldown(context.timestamp)) {
                return false;
            }

            // Verifica aplicabilidade ao equipamento
            if (context.equipmentName || context.equipmentGroups) {
                if (!this.isApplicableToEquipment(context.equipmentName, context.equipmentGroups)) {
                    return false;
                }
            }

            // Verifica cache se habilitado
            if (this.config.enableCaching) {
                const cacheKey = this.generateCacheKey(data, context);
                const cached = this.getFromCache(cacheKey);
                if (cached !== null) {
                    return cached;
                }
            }

            // Avalia condições específicas por tipo
            let result = false;
            switch (this.type) {
                case 'simple':
                    result = this.evaluateSimpleConditions(data, context);
                    break;
                case 'advanced':
                    result = this.evaluateAdvancedConditions(data, context);
                    break;
                case 'threshold':
                    result = this.evaluateThresholdConditions(data, context);
                    break;
                case 'anomaly':
                    result = this.evaluateAnomalyConditions(data, context);
                    break;
                default:
                    this.logger.warn('Rule: Tipo de regra não suportado', {
                        id: this.id,
                        type: this.type
                    });
                    result = false;
            }

            // Atualiza estatísticas
            this.evaluationCount++;
            this.lastEvaluated = context.timestamp || Date.now();

            if (result) {
                this.triggerCount++;
                this.lastTriggered = this.lastEvaluated;
            }

            // Armazena em cache se habilitado
            if (this.config.enableCaching) {
                const cacheKey = this.generateCacheKey(data, context);
                this.setCache(cacheKey, result);
            }

            return result;

        } catch (error) {
            this.logger.error('Rule: Erro na avaliação', {
                id: this.id,
                error: error.message,
                data: data,
                context: context
            });
            return false;
        }
    }

    /**
     * Avalia condições simples
     * @param {Object} data - Dados para avaliar
     * @param {Object} context - Contexto
     * @returns {boolean} - Resultado da avaliação
     */
    evaluateSimpleConditions(data, context) {
        const conditions = this.conditions;
        let result = true;

        // Avalia apontamento
        if (conditions.apontamento) {
            if (data.apontamento !== conditions.apontamento) {
                result = false;
            }
        }

        // Avalia status
        if (conditions.status) {
            if (data.status !== conditions.status) {
                result = false;
            }
        }

        // Avalia tempo
        if (conditions.timeOperator && conditions.timeValue !== undefined) {
            const timeValue = data.time || data.duration || 0;
            const threshold = conditions.timeValue;
            
            switch (conditions.timeOperator) {
                case '>':
                    if (!(timeValue > threshold)) result = false;
                    break;
                case '<':
                    if (!(timeValue < threshold)) result = false;
                    break;
                case '>=':
                    if (!(timeValue >= threshold)) result = false;
                    break;
                case '<=':
                    if (!(timeValue <= threshold)) result = false;
                    break;
                case '==':
                    if (!(timeValue === threshold)) result = false;
                    break;
                case '!=':
                    if (!(timeValue !== threshold)) result = false;
                    break;
                default:
                    result = false;
            }
        }

        return result;
    }

    /**
     * Avalia condições avançadas
     * @param {Object} data - Dados para avaliar
     * @param {Object} context - Contexto
     * @returns {boolean} - Resultado da avaliação
     */
    evaluateAdvancedConditions(data, context) {
        const conditions = this.conditions;
        const logic = conditions.logic || 'AND';
        const rules = conditions.rules || [];

        if (rules.length === 0) {
            return false;
        }

        const results = rules.map(rule => this.evaluateConditionRule(rule, data, context));

        switch (logic) {
            case 'AND':
                return results.every(r => r);
            case 'OR':
                return results.some(r => r);
            case 'NOT':
                return !results[0]; // Nega o primeiro resultado
            case 'XOR':
                return results.filter(r => r).length === 1;
            default:
                return false;
        }
    }

    /**
     * Avalia uma regra individual de condições avançadas
     * @param {Object} rule - Regra para avaliar
     * @param {Object} data - Dados
     * @param {Object} context - Contexto
     * @returns {boolean} - Resultado
     */
    evaluateConditionRule(rule, data, context) {
        const { type, operator, value } = rule;
        const dataValue = data[type];

        switch (operator) {
            case 'equals':
                return dataValue === value;
            case 'not_equals':
                return dataValue !== value;
            case 'contains':
                return typeof dataValue === 'string' && dataValue.includes(value);
            case 'starts_with':
                return typeof dataValue === 'string' && dataValue.startsWith(value);
            case 'ends_with':
                return typeof dataValue === 'string' && dataValue.endsWith(value);
            case '>':
                return Number(dataValue) > Number(value);
            case '<':
                return Number(dataValue) < Number(value);
            case '>=':
                return Number(dataValue) >= Number(value);
            case '<=':
                return Number(dataValue) <= Number(value);
            case 'in':
                return Array.isArray(value) && value.includes(dataValue);
            case 'not_in':
                return Array.isArray(value) && !value.includes(dataValue);
            case 'regex':
                try {
                    const regex = new RegExp(value, 'i');
                    return regex.test(String(dataValue));
                } catch (error) {
                    return false;
                }
            default:
                return false;
        }
    }

    /**
     * Avalia condições de threshold
     * @param {Object} data - Dados para avaliar
     * @param {Object} context - Contexto
     * @returns {boolean} - Resultado da avaliação
     */
    evaluateThresholdConditions(data, context) {
        const conditions = this.conditions;
        const metric = data[conditions.metric];
        const threshold = conditions.threshold;
        const operator = conditions.operator || '>';

        if (metric === undefined || metric === null) {
            return false;
        }

        const numericMetric = Number(metric);
        const numericThreshold = Number(threshold);

        switch (operator) {
            case '>':
                return numericMetric > numericThreshold;
            case '<':
                return numericMetric < numericThreshold;
            case '>=':
                return numericMetric >= numericThreshold;
            case '<=':
                return numericMetric <= numericThreshold;
            case '==':
                return numericMetric === numericThreshold;
            case '!=':
                return numericMetric !== numericThreshold;
            default:
                return false;
        }
    }

    /**
     * Avalia condições de anomalia (implementação básica)
     * @param {Object} data - Dados para avaliar
     * @param {Object} context - Contexto
     * @returns {boolean} - Resultado da avaliação
     */
    evaluateAnomalyConditions(data, context) {
        const conditions = this.conditions;
        const algorithm = conditions.algorithm;
        const metric = data[conditions.metric];

        if (metric === undefined || metric === null) {
            return false;
        }

        // Implementação básica - pode ser expandida com algoritmos mais sofisticados
        switch (algorithm) {
            case 'zscore':
                return this.evaluateZScore(metric, conditions);
            case 'statistical':
                return this.evaluateStatisticalAnomaly(metric, conditions);
            default:
                this.logger.warn('Rule: Algoritmo de anomalia não implementado', {
                    algorithm: algorithm
                });
                return false;
        }
    }

    /**
     * Avalia anomalia usando Z-Score
     * @param {number} value - Valor atual
     * @param {Object} conditions - Condições
     * @returns {boolean} - Se é anomalia
     */
    evaluateZScore(value, conditions) {
        const mean = conditions.mean || 0;
        const stdDev = conditions.stdDev || 1;
        const threshold = conditions.zThreshold || 3;

        const zScore = Math.abs((value - mean) / stdDev);
        return zScore > threshold;
    }

    /**
     * Avalia anomalia estatística básica
     * @param {number} value - Valor atual
     * @param {Object} conditions - Condições
     * @returns {boolean} - Se é anomalia
     */
    evaluateStatisticalAnomaly(value, conditions) {
        const min = conditions.min || 0;
        const max = conditions.max || 100;
        const tolerance = conditions.tolerance || 0.1;

        const range = max - min;
        const lowerBound = min - (range * tolerance);
        const upperBound = max + (range * tolerance);

        return value < lowerBound || value > upperBound;
    }

    /**
     * Gera chave de cache para avaliação
     * @param {Object} data - Dados
     * @param {Object} context - Contexto
     * @returns {string} - Chave de cache
     */
    generateCacheKey(data, context) {
        const keyData = {
            ruleId: this.id,
            data: data,
            context: context,
            timestamp: Math.floor((context.timestamp || Date.now()) / this.config.cacheTimeout)
        };
        return HashUtils.quick(JSON.stringify(keyData));
    }

    /**
     * Obtém valor do cache
     * @param {string} key - Chave
     * @returns {boolean|null} - Valor ou null
     */
    getFromCache(key) {
        const cached = this.evaluationCache.get(key);
        if (!cached) return null;

        if (Date.now() > cached.expiresAt) {
            this.evaluationCache.delete(key);
            return null;
        }

        return cached.value;
    }

    /**
     * Define valor no cache
     * @param {string} key - Chave
     * @param {boolean} value - Valor
     */
    setCache(key, value) {
        this.evaluationCache.set(key, {
            value,
            expiresAt: Date.now() + this.config.cacheTimeout
        });

        // Limita tamanho do cache
        if (this.evaluationCache.size > 100) {
            const firstKey = this.evaluationCache.keys().next().value;
            this.evaluationCache.delete(firstKey);
        }
    }

    /**
     * Gera mensagem de alerta usando template
     * @param {Object} data - Dados para substituição
     * @param {Object} context - Contexto adicional
     * @returns {string} - Mensagem gerada
     */
    generateMessage(data, context = {}) {
        let message = this.messageTemplate || `Regra ${this.name} foi acionada`;

        // Substitui placeholders simples
        const replacements = {
            '{rule_name}': this.name,
            '{equipment}': context.equipmentName || data.equipamento || 'N/A',
            '{severity}': this.severity,
            '{timestamp}': DateUtils.format(new Date(context.timestamp || Date.now())),
            ...data
        };

        Object.entries(replacements).forEach(([key, value]) => {
            const placeholder = key.startsWith('{') ? key : `{${key}}`;
            message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
        });

        return message;
    }

    /**
     * Atualiza regra com novos dados
     * @param {Object} updates - Dados para atualizar
     * @param {string} updatedBy - Quem está atualizando
     * @returns {Rule} - Instância atualizada
     */
    update(updates, updatedBy = 'SYSTEM') {
        try {
            const oldVersion = this.version;
            
            // Aplica atualizações
            Object.assign(this, updates);
            
            // Atualiza metadados de auditoria
            this.updatedAt = Date.now();
            this.updatedBy = updatedBy;
            this.version = oldVersion + 1;
            
            // Limpa cache de avaliações
            this.evaluationCache.clear();
            
            // Renormaliza e revalida
            this.normalize();
            if (this.config.strictValidation) {
                this.validate();
            }

            this.logger.info('Rule: Regra atualizada', {
                id: this.id,
                version: this.version,
                updatedBy: updatedBy
            });

            return this;

        } catch (error) {
            this.logger.error('Rule: Erro na atualização', {
                id: this.id,
                error: error.message,
                updates: updates
            });
            throw error;
        }
    }

    /**
     * Habilita/desabilita regra
     * @param {boolean} enabled - Se deve estar habilitada
     * @param {string} updatedBy - Quem está alterando
     * @returns {Rule} - Instância atualizada
     */
    setEnabled(enabled, updatedBy = 'SYSTEM') {
        return this.update({ enabled }, updatedBy);
    }

    /**
     * Adiciona tag à regra
     * @param {string} tag - Tag para adicionar
     * @returns {Rule} - Instância atualizada
     */
    addTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!this.tags.includes(normalizedTag)) {
            this.tags.push(normalizedTag);
        }
        return this;
    }

    /**
     * Remove tag da regra
     * @param {string} tag - Tag para remover
     * @returns {Rule} - Instância atualizada
     */
    removeTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        this.tags = this.tags.filter(t => t !== normalizedTag);
        return this;
    }

    /**
     * Converte regra para objeto simples
     * @param {Object} options - Opções de serialização
     * @returns {Object} - Objeto simples
     */
    toPlainObject(options = {}) {
        const {
            includeMetadata = true,
            includeAudit = false,
            includeStats = false,
            dateFormat = 'timestamp'
        } = options;

        const obj = {
            id: this.id,
            name: this.name,
            description: this.description,
            type: this.type,
            enabled: this.enabled,
            conditions: { ...this.conditions },
            logic: this.logic,
            severity: this.severity,
            priority: this.priority,
            messageTemplate: this.messageTemplate,
            eventType: this.eventType,
            equipmentGroups: [...this.equipmentGroups],
            equipmentPatterns: [...this.equipmentPatterns],
            applicableEquipment: [...this.applicableEquipment],
            evaluationFrequency: this.evaluationFrequency,
            cooldownPeriod: this.cooldownPeriod,
            maxOccurrences: this.maxOccurrences,
            timeWindow: this.timeWindow,
            actions: [...this.actions],
            suppressionRules: [...this.suppressionRules],
            tags: [...this.tags],
            category: this.category,
            subcategory: this.subcategory,
            aggregationWindow: this.aggregationWindow,
            consolidationEnabled: this.consolidationEnabled,
            deduplicationEnabled: this.deduplicationEnabled,
            schedule: this.schedule,
            validFrom: this.validFrom,
            validUntil: this.validUntil,
            notificationChannels: [...this.notificationChannels],
            escalationRules: [...this.escalationRules]
        };

        if (includeMetadata) {
            obj.metadata = { ...this.metadata };
        }

        if (includeAudit) {
            obj.createdAt = dateFormat === 'iso' ? new Date(this.createdAt).toISOString() : this.createdAt;
            obj.createdBy = this.createdBy;
            obj.updatedAt = dateFormat === 'iso' ? new Date(this.updatedAt).toISOString() : this.updatedAt;
            obj.updatedBy = this.updatedBy;
            obj.version = this.version;
        }

        if (includeStats) {
            obj.lastEvaluated = this.lastEvaluated;
            obj.lastTriggered = this.lastTriggered;
            obj.triggerCount = this.triggerCount;
            obj.evaluationCount = this.evaluationCount;
        }

        return obj;
    }

    /**
     * Clona regra
     * @param {Object} overrides - Campos para sobrescrever
     * @returns {Rule} - Nova instância
     */
    clone(overrides = {}) {
        const data = {
            ...this.toPlainObject({ includeAudit: true, includeStats: false }),
            ...overrides
        };
        
        // Remove ID para gerar novo
        if (!overrides.id) delete data.id;
        
        return new Rule(data, this.config);
    }

    /**
     * Obtém hash único da regra
     * @returns {string} - Hash único
     */
    getHash() {
        return HashUtils.rule(this);
    }

    /**
     * Converte para string
     * @returns {string} - Representação em string
     */
    toString() {
        return `Rule[${this.id}]: ${this.name} (${this.type}, ${this.severity})`;
    }

    /**
     * Converte para JSON
     * @returns {Object} - Objeto para JSON
     */
    toJSON() {
        return this.toPlainObject();
    }
}

/**
 * Factory para criação de regras
 */
export class RuleFactory {
    static createSimpleRule(data, config = {}) {
        return new Rule({ ...data, type: 'simple' }, config);
    }

    static createAdvancedRule(data, config = {}) {
        return new Rule({ ...data, type: 'advanced' }, config);
    }

    static createThresholdRule(data, config = {}) {
        return new Rule({ ...data, type: 'threshold' }, config);
    }

    static createAnomalyRule(data, config = {}) {
        return new Rule({ ...data, type: 'anomaly' }, config);
    }

    static createFromTemplate(template, overrides = {}, config = {}) {
        const data = { ...template, ...overrides };
        return new Rule(data, config);
    }
}

/**
 * Utilitários para trabalhar com regras
 */
export const RuleUtils = {
    /**
     * Cria regra
     */
    create: (data, config) => new Rule(data, config),
    
    /**
     * Cria regra simples
     */
    createSimple: (data, config) => RuleFactory.createSimpleRule(data, config),
    
    /**
     * Cria regra avançada
     */
    createAdvanced: (data, config) => RuleFactory.createAdvancedRule(data, config),
    
    /**
     * Valida dados de regra
     */
    validate: (data) => {
        try {
            new Rule(data, { strictValidation: true });
            return { valid: true, errors: [] };
        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    },
    
    /**
     * Compara duas regras
     */
    compare: (rule1, rule2) => {
        const r1 = rule1 instanceof Rule ? rule1 : new Rule(rule1);
        const r2 = rule2 instanceof Rule ? rule2 : new Rule(rule2);
        return r1.getHash() === r2.getHash();
    }
};

export default Rule;
