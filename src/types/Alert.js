/**
 * Alert.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Estrutura e validação de alertas
 * Define o tipo de dados central do sistema de alertas
 * 
 * Funcionalidades:
 * - Estrutura padronizada de alertas
 * - Validação de dados e tipos
 * - Serialização e deserialização
 * - Transformações de formato
 * - Comparação e igualdade
 * - Filtros e buscas
 * - Integração com sistema de grupos
 * - Métricas e análises
 */

import { HashUtils } from '../utils/hash.js';
import { DateUtils } from '../utils/dateParser.js';
import { LogUtils } from '../utils/logger.js';

export class Alert {
    constructor(data = {}, config = {}) {
        this.config = {
            // Configurações de validação
            strictValidation: config.strictValidation !== false,
            allowPartialData: config.allowPartialData || false,
            autoGenerateIds: config.autoGenerateIds !== false,
            
            // Configurações de formato
            defaultTimezone: config.defaultTimezone || 'America/Sao_Paulo',
            dateFormat: config.dateFormat || 'DD/MM/YYYY HH:mm:ss',
            
            // Configurações de normalização
            normalizeStrings: config.normalizeStrings !== false,
            trimWhitespace: config.trimWhitespace !== false,
            
            ...config
        };

        // Logger
        this.logger = config.logger || LogUtils.createLogger('Alert');

        // Inicializa alerta com dados fornecidos
        this.initialize(data);
    }

    /**
     * Inicializa alerta com validação
     * @param {Object} data - Dados do alerta
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

            this.logger.debug('Alert: Alerta inicializado', {
                id: this.id,
                equipamento: this.equipamento,
                severity: this.severity
            });

        } catch (error) {
            this.logger.error('Alert: Erro na inicialização', {
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
        this.uniqueId = data.uniqueId || null;
        this.equipamento = data.equipamento || '';
        this.message = data.message || '';
        this.timestamp = data.timestamp || now;
        
        // Campos opcionais com padrões
        this.equipmentGroups = Array.isArray(data.equipmentGroups) ? data.equipmentGroups : [];
        this.ruleId = data.ruleId || null;
        this.ruleName = data.ruleName || '';
        this.severity = data.severity || 'MEDIUM';
        this.eventType = data.eventType || 'UNKNOWN';
        this.duration = typeof data.duration === 'number' ? data.duration : 0;
        this.consolidated = data.consolidated === true;
        this.consolidatedCount = data.consolidatedCount || 1;
        
        // Timestamps especiais
        this.firstOccurrence = data.firstOccurrence || this.timestamp;
        this.lastOccurrence = data.lastOccurrence || this.timestamp;
        
        // Metadados
        this.metadata = typeof data.metadata === 'object' ? { ...data.metadata } : {};
        
        // Status e controle
        this.status = data.status || 'ACTIVE';
        this.acknowledged = data.acknowledged === true;
        this.acknowledgedBy = data.acknowledgedBy || null;
        this.acknowledgedAt = data.acknowledgedAt || null;
        this.resolved = data.resolved === true;
        this.resolvedBy = data.resolvedBy || null;
        this.resolvedAt = data.resolvedAt || null;
        
        // Dados de origem
        this.source = data.source || 'SYSTEM';
        this.sourceData = data.sourceData || null;
        
        // Classificação
        this.category = data.category || 'GENERAL';
        this.subcategory = data.subcategory || null;
        this.tags = Array.isArray(data.tags) ? data.tags : [];
        
        // Prioridade e urgência
        this.priority = data.priority || this.derivePriorityFromSeverity(this.severity);
        this.urgency = data.urgency || 'NORMAL';
        
        // Geo-localização
        this.location = data.location || null;
        this.coordinates = data.coordinates || null;
        
        // Anexos e referências
        this.attachments = Array.isArray(data.attachments) ? data.attachments : [];
        this.relatedAlerts = Array.isArray(data.relatedAlerts) ? data.relatedAlerts : [];
        
        // Auditoria
        this.createdAt = data.createdAt || now;
        this.createdBy = data.createdBy || 'SYSTEM';
        this.updatedAt = data.updatedAt || now;
        this.updatedBy = data.updatedBy || 'SYSTEM';
        this.version = data.version || 1;
    }

    /**
     * Normaliza dados do alerta
     */
    normalize() {
        if (!this.config.normalizeStrings) return;

        // Normaliza strings
        const stringFields = ['equipamento', 'message', 'ruleName', 'eventType', 'source', 'category', 'subcategory'];
        stringFields.forEach(field => {
            if (typeof this[field] === 'string') {
                if (this.config.trimWhitespace) {
                    this[field] = this[field].trim();
                }
                // Remove caracteres especiais extras
                this[field] = this[field].replace(/\s+/g, ' ');
            }
        });

        // Normaliza arrays
        this.equipmentGroups = this.equipmentGroups.map(group => 
            typeof group === 'string' ? group.trim().toUpperCase() : group
        );

        this.tags = this.tags.map(tag => 
            typeof tag === 'string' ? tag.trim().toLowerCase() : tag
        );

        // Normaliza severidade
        this.severity = this.severity.toUpperCase();
        
        // Normaliza status
        this.status = this.status.toUpperCase();
        
        // Normaliza timestamps
        this.timestamp = DateUtils.parse(this.timestamp)?.getTime() || Date.now();
        this.firstOccurrence = DateUtils.parse(this.firstOccurrence)?.getTime() || this.timestamp;
        this.lastOccurrence = DateUtils.parse(this.lastOccurrence)?.getTime() || this.timestamp;
        
        if (this.acknowledgedAt) {
            this.acknowledgedAt = DateUtils.parse(this.acknowledgedAt)?.getTime() || null;
        }
        
        if (this.resolvedAt) {
            this.resolvedAt = DateUtils.parse(this.resolvedAt)?.getTime() || null;
        }
    }

    /**
     * Valida estrutura do alerta
     * @throws {Error} - Se validação falhar
     */
    validate() {
        const errors = [];

        // Validação de campos obrigatórios
        if (!this.equipamento || typeof this.equipamento !== 'string') {
            errors.push('Campo equipamento é obrigatório e deve ser string');
        }

        if (!this.message || typeof this.message !== 'string') {
            errors.push('Campo message é obrigatório e deve ser string');
        }

        if (!this.timestamp || typeof this.timestamp !== 'number') {
            errors.push('Campo timestamp é obrigatório e deve ser number');
        }

        // Validação de severidade
        const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        if (!validSeverities.includes(this.severity)) {
            errors.push(`Severidade deve ser uma de: ${validSeverities.join(', ')}`);
        }

        // Validação de status
        const validStatuses = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED', 'SUPPRESSED'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status deve ser um de: ${validStatuses.join(', ')}`);
        }

        // Validação de arrays
        if (!Array.isArray(this.equipmentGroups)) {
            errors.push('equipmentGroups deve ser um array');
        }

        if (!Array.isArray(this.tags)) {
            errors.push('tags deve ser um array');
        }

        // Validação de timestamps
        if (this.lastOccurrence < this.firstOccurrence) {
            errors.push('lastOccurrence não pode ser anterior a firstOccurrence');
        }

        // Validação de duração
        if (this.duration < 0) {
            errors.push('duration não pode ser negativa');
        }

        // Validação condicional
        if (this.acknowledged && !this.acknowledgedAt) {
            errors.push('acknowledgedAt é obrigatório quando acknowledged é true');
        }

        if (this.resolved && !this.resolvedAt) {
            errors.push('resolvedAt é obrigatório quando resolved é true');
        }

        if (errors.length > 0) {
            throw new Error(`Validação de alerta falhou: ${errors.join(', ')}`);
        }
    }

    /**
     * Gera IDs ausentes
     */
    generateMissingIds() {
        if (!this.id) {
            this.id = HashUtils.uniqueId('alert');
        }

        if (!this.uniqueId) {
            this.uniqueId = HashUtils.alert(this);
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
     * Atualiza alerta com novos dados
     * @param {Object} updates - Dados para atualizar
     * @param {string} updatedBy - Quem está atualizando
     * @returns {Alert} - Instância atualizada
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
            
            // Renormaliza e revalida
            this.normalize();
            if (this.config.strictValidation) {
                this.validate();
            }

            this.logger.info('Alert: Alerta atualizado', {
                id: this.id,
                version: this.version,
                updatedBy: updatedBy
            });

            return this;

        } catch (error) {
            this.logger.error('Alert: Erro na atualização', {
                id: this.id,
                error: error.message,
                updates: updates
            });
            throw error;
        }
    }

    /**
     * Marca alerta como reconhecido
     * @param {string} acknowledgedBy - Quem reconheceu
     * @param {string} notes - Notas do reconhecimento
     * @returns {Alert} - Instância atualizada
     */
    acknowledge(acknowledgedBy, notes = null) {
        if (this.acknowledged) {
            throw new Error('Alerta já foi reconhecido');
        }

        this.acknowledged = true;
        this.acknowledgedBy = acknowledgedBy;
        this.acknowledgedAt = Date.now();
        this.status = 'ACKNOWLEDGED';

        if (notes) {
            this.metadata.acknowledgmentNotes = notes;
        }

        return this.update({}, acknowledgedBy);
    }

    /**
     * Marca alerta como resolvido
     * @param {string} resolvedBy - Quem resolveu
     * @param {string} resolution - Descrição da resolução
     * @returns {Alert} - Instância atualizada
     */
    resolve(resolvedBy, resolution = null) {
        if (this.resolved) {
            throw new Error('Alerta já foi resolvido');
        }

        this.resolved = true;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = Date.now();
        this.status = 'RESOLVED';

        if (resolution) {
            this.metadata.resolution = resolution;
        }

        return this.update({}, resolvedBy);
    }

    /**
     * Adiciona tag ao alerta
     * @param {string} tag - Tag para adicionar
     * @returns {Alert} - Instância atualizada
     */
    addTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!this.tags.includes(normalizedTag)) {
            this.tags.push(normalizedTag);
        }
        return this;
    }

    /**
     * Remove tag do alerta
     * @param {string} tag - Tag para remover
     * @returns {Alert} - Instância atualizada
     */
    removeTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        this.tags = this.tags.filter(t => t !== normalizedTag);
        return this;
    }

    /**
     * Adiciona alerta relacionado
     * @param {string} alertId - ID do alerta relacionado
     * @param {string} relationship - Tipo de relacionamento
     * @returns {Alert} - Instância atualizada
     */
    addRelatedAlert(alertId, relationship = 'RELATED') {
        const relation = {
            alertId,
            relationship: relationship.toUpperCase(),
            createdAt: Date.now()
        };

        if (!this.relatedAlerts.find(r => r.alertId === alertId)) {
            this.relatedAlerts.push(relation);
        }
        return this;
    }

    /**
     * Verifica se alerta está ativo
     * @returns {boolean} - Se está ativo
     */
    isActive() {
        return this.status === 'ACTIVE' && !this.resolved;
    }

    /**
     * Verifica se alerta está expirado
     * @param {number} expirationTime - Tempo de expiração em ms
     * @returns {boolean} - Se está expirado
     */
    isExpired(expirationTime = 24 * 60 * 60 * 1000) { // 24 horas padrão
        return (Date.now() - this.timestamp) > expirationTime;
    }

    /**
     * Calcula idade do alerta
     * @param {string} unit - Unidade (ms, s, m, h, d)
     * @returns {number} - Idade na unidade especificada
     */
    getAge(unit = 'ms') {
        return DateUtils.duration(this.timestamp, Date.now(), unit);
    }

    /**
     * Formata alerta para exibição
     * @param {string} format - Formato desejado
     * @returns {string} - Alerta formatado
     */
    format(format = 'default') {
        const timestamp = DateUtils.format(new Date(this.timestamp), this.config.dateFormat);
        
        switch (format) {
            case 'short':
                return `[${this.severity}] ${this.equipamento}: ${this.message}`;
                
            case 'detailed':
                return `[${timestamp}] [${this.severity}] ${this.equipamento} (${this.equipmentGroups.join(', ')}): ${this.message}`;
                
            case 'json':
                return JSON.stringify(this.toPlainObject(), null, 2);
                
            case 'csv':
                return [
                    this.id,
                    timestamp,
                    this.equipamento,
                    this.severity,
                    this.message.replace(/,/g, ';'),
                    this.status
                ].join(',');
                
            default:
                return `[${timestamp}] ${this.equipamento}: ${this.message} (${this.severity})`;
        }
    }

    /**
     * Converte alerta para objeto simples
     * @param {Object} options - Opções de serialização
     * @returns {Object} - Objeto simples
     */
    toPlainObject(options = {}) {
        const {
            includeMetadata = true,
            includeAudit = false,
            includeRelated = true,
            dateFormat = 'timestamp'
        } = options;

        const obj = {
            id: this.id,
            uniqueId: this.uniqueId,
            equipamento: this.equipamento,
            equipmentGroups: [...this.equipmentGroups],
            ruleId: this.ruleId,
            ruleName: this.ruleName,
            severity: this.severity,
            message: this.message,
            eventType: this.eventType,
            duration: this.duration,
            consolidated: this.consolidated,
            consolidatedCount: this.consolidatedCount,
            timestamp: dateFormat === 'iso' ? new Date(this.timestamp).toISOString() : this.timestamp,
            firstOccurrence: dateFormat === 'iso' ? new Date(this.firstOccurrence).toISOString() : this.firstOccurrence,
            lastOccurrence: dateFormat === 'iso' ? new Date(this.lastOccurrence).toISOString() : this.lastOccurrence,
            status: this.status,
            acknowledged: this.acknowledged,
            acknowledgedBy: this.acknowledgedBy,
            acknowledgedAt: this.acknowledgedAt,
            resolved: this.resolved,
            resolvedBy: this.resolvedBy,
            resolvedAt: this.resolvedAt,
            source: this.source,
            category: this.category,
            subcategory: this.subcategory,
            priority: this.priority,
            urgency: this.urgency,
            tags: [...this.tags]
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

        if (includeRelated && this.relatedAlerts.length > 0) {
            obj.relatedAlerts = [...this.relatedAlerts];
        }

        if (this.location) {
            obj.location = this.location;
        }

        if (this.coordinates) {
            obj.coordinates = this.coordinates;
        }

        if (this.attachments.length > 0) {
            obj.attachments = [...this.attachments];
        }

        return obj;
    }

    /**
     * Clona alerta
     * @param {Object} overrides - Campos para sobrescrever
     * @returns {Alert} - Nova instância
     */
    clone(overrides = {}) {
        const data = {
            ...this.toPlainObject({ includeAudit: true, includeRelated: true }),
            ...overrides
        };
        
        // Remove IDs para gerar novos
        if (!overrides.id) delete data.id;
        if (!overrides.uniqueId) delete data.uniqueId;
        
        return new Alert(data, this.config);
    }

    /**
     * Compara com outro alerta
     * @param {Alert} other - Outro alerta
     * @param {Array} fields - Campos para comparar
     * @returns {boolean} - Se são iguais
     */
    equals(other, fields = ['uniqueId']) {
        if (!(other instanceof Alert)) {
            return false;
        }

        return fields.every(field => this[field] === other[field]);
    }

    /**
     * Obtém hash único do alerta
     * @returns {string} - Hash único
     */
    getHash() {
        return HashUtils.alert(this);
    }

    /**
     * Converte para string
     * @returns {string} - Representação em string
     */
    toString() {
        return this.format('default');
    }

    /**
     * Converte para JSON
     * @returns {string} - JSON string
     */
    toJSON() {
        return this.toPlainObject();
    }
}

/**
 * Classe para coleção de alertas com operações em lote
 */
export class AlertCollection {
    constructor(alerts = [], config = {}) {
        this.alerts = [];
        this.config = config;
        this.logger = config.logger || LogUtils.createLogger('AlertCollection');

        // Adiciona alertas iniciais
        this.addMany(alerts);
    }

    /**
     * Adiciona alerta à coleção
     * @param {Alert|Object} alert - Alerta para adicionar
     * @returns {AlertCollection} - Instância para chaining
     */
    add(alert) {
        const alertInstance = alert instanceof Alert ? alert : new Alert(alert, this.config);
        this.alerts.push(alertInstance);
        return this;
    }

    /**
     * Adiciona múltiplos alertas
     * @param {Array} alerts - Array de alertas
     * @returns {AlertCollection} - Instância para chaining
     */
    addMany(alerts) {
        alerts.forEach(alert => this.add(alert));
        return this;
    }

    /**
     * Remove alerta da coleção
     * @param {string} id - ID do alerta
     * @returns {boolean} - Se foi removido
     */
    remove(id) {
        const initialLength = this.alerts.length;
        this.alerts = this.alerts.filter(alert => alert.id !== id);
        return this.alerts.length < initialLength;
    }

    /**
     * Encontra alerta por ID
     * @param {string} id - ID do alerta
     * @returns {Alert|null} - Alerta encontrado
     */
    findById(id) {
        return this.alerts.find(alert => alert.id === id) || null;
    }

    /**
     * Filtra alertas por critérios
     * @param {Object} criteria - Critérios de filtro
     * @returns {AlertCollection} - Nova coleção filtrada
     */
    filter(criteria) {
        const filtered = this.alerts.filter(alert => {
            return Object.entries(criteria).every(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.includes(alert[key]);
                }
                if (typeof value === 'function') {
                    return value(alert[key], alert);
                }
                return alert[key] === value;
            });
        });

        return new AlertCollection(filtered, this.config);
    }

    /**
     * Ordena alertas
     * @param {string|Function} sortBy - Campo ou função de ordenação
     * @param {string} direction - 'asc' ou 'desc'
     * @returns {AlertCollection} - Nova coleção ordenada
     */
    sortBy(sortBy, direction = 'asc') {
        const sorted = [...this.alerts].sort((a, b) => {
            let valueA, valueB;
            
            if (typeof sortBy === 'function') {
                valueA = sortBy(a);
                valueB = sortBy(b);
            } else {
                valueA = a[sortBy];
                valueB = b[sortBy];
            }

            if (valueA < valueB) return direction === 'asc' ? -1 : 1;
            if (valueA > valueB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        return new AlertCollection(sorted, this.config);
    }

    /**
     * Agrupa alertas por campo
     * @param {string|Function} groupBy - Campo ou função de agrupamento
     * @returns {Map} - Map com grupos
     */
    groupBy(groupBy) {
        const groups = new Map();

        this.alerts.forEach(alert => {
            const key = typeof groupBy === 'function' ? groupBy(alert) : alert[groupBy];
            
            if (!groups.has(key)) {
                groups.set(key, new AlertCollection([], this.config));
            }
            
            groups.get(key).add(alert);
        });

        return groups;
    }

    /**
     * Obtém estatísticas da coleção
     * @returns {Object} - Estatísticas
     */
    getStats() {
        const total = this.alerts.length;
        if (total === 0) {
            return {
                total: 0,
                bySeverity: {},
                byStatus: {},
                byEquipmentGroup: {},
                active: 0,
                acknowledged: 0,
                resolved: 0
            };
        }

        const stats = {
            total,
            bySeverity: {},
            byStatus: {},
            byEquipmentGroup: {},
            active: 0,
            acknowledged: 0,
            resolved: 0,
            averageAge: 0,
            oldestAlert: null,
            newestAlert: null
        };

        let totalAge = 0;
        let oldest = this.alerts[0];
        let newest = this.alerts[0];

        this.alerts.forEach(alert => {
            // Severidade
            stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
            
            // Status
            stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
            
            // Grupos de equipamento
            alert.equipmentGroups.forEach(group => {
                stats.byEquipmentGroup[group] = (stats.byEquipmentGroup[group] || 0) + 1;
            });
            
            // Estados
            if (alert.isActive()) stats.active++;
            if (alert.acknowledged) stats.acknowledged++;
            if (alert.resolved) stats.resolved++;
            
            // Idade
            const age = alert.getAge('ms');
            totalAge += age;
            
            if (alert.timestamp < oldest.timestamp) oldest = alert;
            if (alert.timestamp > newest.timestamp) newest = alert;
        });

        stats.averageAge = totalAge / total;
        stats.oldestAlert = oldest.id;
        stats.newestAlert = newest.id;

        return stats;
    }

    /**
     * Converte para array simples
     * @param {Object} options - Opções de serialização
     * @returns {Array} - Array de objetos
     */
    toArray(options = {}) {
        return this.alerts.map(alert => alert.toPlainObject(options));
    }

    /**
     * Obtém tamanho da coleção
     * @returns {number} - Número de alertas
     */
    size() {
        return this.alerts.length;
    }

    /**
     * Verifica se coleção está vazia
     * @returns {boolean} - Se está vazia
     */
    isEmpty() {
        return this.alerts.length === 0;
    }

    /**
     * Limpa todos os alertas
     * @returns {AlertCollection} - Instância para chaining
     */
    clear() {
        this.alerts = [];
        return this;
    }
}

/**
 * Factory para criação de alertas
 */
export class AlertFactory {
    static createFromData(data, config = {}) {
        return new Alert(data, config);
    }

    static createCollection(alerts = [], config = {}) {
        return new AlertCollection(alerts, config);
    }

    static createFromTemplate(template, overrides = {}, config = {}) {
        const data = { ...template, ...overrides };
        return new Alert(data, config);
    }
}

/**
 * Utilitários para trabalhar com alertas
 */
export const AlertUtils = {
    /**
     * Cria alerta simples
     */
    create: (data, config) => new Alert(data, config),
    
    /**
     * Cria coleção de alertas
     */
    createCollection: (alerts, config) => new AlertCollection(alerts, config),
    
    /**
     * Valida dados de alerta
     */
    validate: (data) => {
        try {
            new Alert(data, { strictValidation: true });
            return { valid: true, errors: [] };
        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    },
    
    /**
     * Compara dois alertas
     */
    compare: (alert1, alert2, fields) => {
        const a1 = alert1 instanceof Alert ? alert1 : new Alert(alert1);
        const a2 = alert2 instanceof Alert ? alert2 : new Alert(alert2);
        return a1.equals(a2, fields);
    },
    
    /**
     * Mescla alertas
     */
    merge: (baseAlert, updates, config) => {
        const base = baseAlert instanceof Alert ? baseAlert : new Alert(baseAlert, config);
        return base.update(updates);
    }
};

export default Alert;
