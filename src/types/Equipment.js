/**
 * Equipment.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Estrutura e validação de equipamentos
 * Define equipamentos e suas características para o sistema de alertas
 * 
 * Funcionalidades:
 * - Estrutura padronizada de equipamentos
 * - Detecção automática de grupos
 * - Validação e normalização de dados
 * - Classificação inteligente
 * - Histórico e métricas
 * - Relacionamentos entre equipamentos
 * - Estados e status operacionais
 * - Integração com sistema de grupos
 */

import { HashUtils } from '../utils/hash.js';
import { DateUtils } from '../utils/dateParser.js';
import { LogUtils } from '../utils/logger.js';

export class Equipment {
    constructor(data = {}, config = {}) {
        this.config = {
            // Configurações de validação
            strictValidation: config.strictValidation !== false,
            allowPartialData: config.allowPartialData || false,
            autoGenerateIds: config.autoGenerateIds !== false,
            
            // Configurações de classificação
            autoDetectGroups: config.autoDetectGroups !== false,
            enableMachineLearning: config.enableMachineLearning || false,
            
            // Configurações de formato
            normalizeNames: config.normalizeNames !== false,
            trimWhitespace: config.trimWhitespace !== false,
            
            // Configurações de grupos padrão
            equipmentGroups: config.equipmentGroups || {
                'ALTA_PRESSAO': {
                    name: 'Alta Pressão',
                    patterns: ['ALTA PRESSÃO', 'ALTA PRESSAO', 'HIGH PRESSURE'],
                    color: '#e74c3c',
                    icon: '🔴'
                },
                'AUTO_VACUO': {
                    name: 'Auto Vácuo',
                    patterns: ['AUTO VÁCUO', 'AUTO VACUO', 'AUTO VAC'],
                    color: '#3498db',
                    icon: '🔵'
                },
                'HIPER_VACUO': {
                    name: 'Hiper Vácuo',
                    patterns: ['HIPER VÁCUO', 'HIPER VACUO', 'HYPER VAC'],
                    color: '#9b59b6',
                    icon: '🟣'
                },
                'BROOK': {
                    name: 'Brook',
                    patterns: ['BROOK'],
                    color: '#27ae60',
                    icon: '🟢'
                },
                'TANQUE': {
                    name: 'Tanque',
                    patterns: ['TANQUE', 'TANK'],
                    color: '#f39c12',
                    icon: '🟡'
                },
                'CAMINHAO': {
                    name: 'Caminhão',
                    patterns: ['CAMINHÃO', 'CAMINHAO', 'TRUCK'],
                    color: '#95a5a6',
                    icon: '🚛'
                }
            },
            
            ...config
        };

        // Logger
        this.logger = config.logger || LogUtils.createLogger('Equipment');

        // Inicializa equipamento com dados fornecidos
        this.initialize(data);
    }

    /**
     * Inicializa equipamento com validação
     * @param {Object} data - Dados do equipamento
     */
    initialize(data) {
        try {
            // Aplica valores padrão
            this.applyDefaults(data);
            
            // Normaliza dados
            this.normalize();
            
            // Detecta grupos automaticamente
            if (this.config.autoDetectGroups) {
                this.detectGroups();
            }
            
            // Classifica equipamento
            if (this.config.enableMachineLearning) {
                this.classifyEquipment();
            }
            
            // Valida estrutura
            if (this.config.strictValidation) {
                this.validate();
            }

            // Gera IDs se necessário
            if (this.config.autoGenerateIds) {
                this.generateMissingIds();
            }

            this.logger.debug('Equipment: Equipamento inicializado', {
                id: this.id,
                name: this.name,
                groups: this.groups
            });

        } catch (error) {
            this.logger.error('Equipment: Erro na inicialização', {
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
        
        // Campos de identificação
        this.id = data.id || null;
        this.name = data.name || data.equipamento || '';
        this.displayName = data.displayName || this.name;
        this.code = data.code || null;
        this.serialNumber = data.serialNumber || null;
        
        // Classificação e grupos
        this.groups = Array.isArray(data.groups) ? [...data.groups] : [];
        this.category = data.category || 'UNKNOWN';
        this.subcategory = data.subcategory || null;
        this.type = data.type || 'GENERIC';
        this.model = data.model || null;
        this.manufacturer = data.manufacturer || null;
        
        // Status operacional
        this.status = data.status || 'UNKNOWN';
        this.operationalStatus = data.operationalStatus || 'UNKNOWN';
        this.healthStatus = data.healthStatus || 'UNKNOWN';
        this.lastActivity = data.lastActivity || null;
        this.isActive = data.isActive !== false;
        this.isOnline = data.isOnline !== false;
        
        // Localização e posicionamento
        this.location = data.location || null;
        this.coordinates = data.coordinates || null;
        this.zone = data.zone || null;
        this.facility = data.facility || null;
        this.department = data.department || null;
        
        // Especificações técnicas
        this.specifications = typeof data.specifications === 'object' ? { ...data.specifications } : {};
        this.capabilities = Array.isArray(data.capabilities) ? [...data.capabilities] : [];
        this.features = Array.isArray(data.features) ? [...data.features] : [];
        
        // Configurações operacionais
        this.settings = typeof data.settings === 'object' ? { ...data.settings } : {};
        this.thresholds = typeof data.thresholds === 'object' ? { ...data.thresholds } : {};
        this.alerts = typeof data.alerts === 'object' ? { ...data.alerts } : {};
        
        // Manutenção e ciclo de vida
        this.installationDate = data.installationDate || null;
        this.warrantyExpiry = data.warrantyExpiry || null;
        this.lastMaintenance = data.lastMaintenance || null;
        this.nextMaintenance = data.nextMaintenance || null;
        this.maintenanceInterval = data.maintenanceInterval || null;
        
        // Relacionamentos
        this.parentEquipment = data.parentEquipment || null;
        this.childEquipments = Array.isArray(data.childEquipments) ? [...data.childEquipments] : [];
        this.relatedEquipments = Array.isArray(data.relatedEquipments) ? [...data.relatedEquipments] : [];
        
        // Tags e metadados
        this.tags = Array.isArray(data.tags) ? [...data.tags] : [];
        this.metadata = typeof data.metadata === 'object' ? { ...data.metadata } : {};
        this.customFields = typeof data.customFields === 'object' ? { ...data.customFields } : {};
        
        // Métricas e histórico
        this.metrics = typeof data.metrics === 'object' ? { ...data.metrics } : {};
        this.performance = typeof data.performance === 'object' ? { ...data.performance } : {};
        this.usage = typeof data.usage === 'object' ? { ...data.usage } : {};
        
        // Auditoria
        this.createdAt = data.createdAt || now;
        this.createdBy = data.createdBy || 'SYSTEM';
        this.updatedAt = data.updatedAt || now;
        this.updatedBy = data.updatedBy || 'SYSTEM';
        this.version = data.version || 1;
        
        // Configurações de alertas
        this.alertsEnabled = data.alertsEnabled !== false;
        this.alertRules = Array.isArray(data.alertRules) ? [...data.alertRules] : [];
        this.suppressedAlerts = Array.isArray(data.suppressedAlerts) ? [...data.suppressedAlerts] : [];
        
        // Estados derivados
        this.confidence = data.confidence || 1.0; // Confiança na classificação
        this.lastSeen = data.lastSeen || now;
        this.firstSeen = data.firstSeen || now;
    }

    /**
     * Normaliza dados do equipamento
     */
    normalize() {
        if (!this.config.normalizeNames) return;

        // Normaliza strings principais
        const stringFields = ['name', 'displayName', 'model', 'manufacturer', 'category', 'subcategory', 'type'];
        stringFields.forEach(field => {
            if (typeof this[field] === 'string') {
                if (this.config.trimWhitespace) {
                    this[field] = this[field].trim();
                }
                // Remove espaços extras
                this[field] = this[field].replace(/\s+/g, ' ');
            }
        });

        // Normaliza grupos
        this.groups = this.groups.map(group => 
            typeof group === 'string' ? group.trim().toUpperCase() : group
        );

        // Normaliza tags
        this.tags = this.tags.map(tag => 
            typeof tag === 'string' ? tag.trim().toLowerCase() : tag
        );

        // Normaliza status
        const statusFields = ['status', 'operationalStatus', 'healthStatus'];
        statusFields.forEach(field => {
            if (typeof this[field] === 'string') {
                this[field] = this[field].toUpperCase();
            }
        });

        // Normaliza timestamps
        const dateFields = ['lastActivity', 'installationDate', 'warrantyExpiry', 'lastMaintenance', 'nextMaintenance'];
        dateFields.forEach(field => {
            if (this[field]) {
                this[field] = DateUtils.parse(this[field])?.getTime() || null;
            }
        });
    }

    /**
     * Detecta grupos automaticamente baseado no nome
     */
    detectGroups() {
        const detectedGroups = [];
        const normalizedName = this.name.toUpperCase();
        
        Object.entries(this.config.equipmentGroups).forEach(([groupKey, groupConfig]) => {
            const patterns = groupConfig.patterns || [];
            
            const hasMatch = patterns.some(pattern => {
                const normalizedPattern = pattern.toUpperCase();
                return normalizedName.includes(normalizedPattern);
            });
            
            if (hasMatch && !detectedGroups.includes(groupKey)) {
                detectedGroups.push(groupKey);
            }
        });

        // Mescla grupos detectados com grupos existentes
        this.groups = [...new Set([...this.groups, ...detectedGroups])];
        
        if (detectedGroups.length > 0) {
            this.logger.debug('Equipment: Grupos detectados automaticamente', {
                equipmentName: this.name,
                detectedGroups: detectedGroups
            });
        }
    }

    /**
     * Classifica equipamento usando características
     */
    classifyEquipment() {
        // Implementação básica de classificação baseada em regras
        // Pode ser expandida com machine learning real
        
        const name = this.name.toUpperCase();
        const features = {
            hasPressure: /PRESSÃO|PRESSURE/i.test(name),
            hasVacuum: /VÁCUO|VACUO|VACUUM/i.test(name),
            hasHyper: /HIPER|HYPER/i.test(name),
            hasAuto: /AUTO/i.test(name),
            hasTank: /TANQUE|TANK/i.test(name),
            hasTruck: /CAMINHÃO|CAMINHAO|TRUCK/i.test(name),
            hasBrook: /BROOK/i.test(name)
        };

        // Determina categoria baseada em características
        if (features.hasPressure) {
            this.category = 'PRESSURE_EQUIPMENT';
            this.type = 'PRESSURE_SYSTEM';
        } else if (features.hasVacuum) {
            this.category = 'VACUUM_EQUIPMENT';
            this.type = features.hasHyper ? 'HYPER_VACUUM' : 'AUTO_VACUUM';
        } else if (features.hasTank) {
            this.category = 'STORAGE_EQUIPMENT';
            this.type = 'TANK';
        } else if (features.hasTruck) {
            this.category = 'MOBILE_EQUIPMENT';
            this.type = 'TRUCK';
        } else if (features.hasBrook) {
            this.category = 'SPECIALIZED_EQUIPMENT';
            this.type = 'BROOK_SYSTEM';
        }

        // Calcula confiança na classificação
        const activeFeatures = Object.values(features).filter(f => f).length;
        this.confidence = Math.min(activeFeatures * 0.3, 1.0);
    }

    /**
     * Valida estrutura do equipamento
     * @throws {Error} - Se validação falhar
     */
    validate() {
        const errors = [];

        // Validação de campos obrigatórios
        if (!this.name || typeof this.name !== 'string') {
            errors.push('Campo name é obrigatório e deve ser string');
        }

        // Validação de arrays
        if (!Array.isArray(this.groups)) {
            errors.push('groups deve ser um array');
        }

        if (!Array.isArray(this.tags)) {
            errors.push('tags deve ser um array');
        }

        if (!Array.isArray(this.capabilities)) {
            errors.push('capabilities deve ser um array');
        }

        // Validação de status
        const validStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE', 'ERROR', 'UNKNOWN'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`status deve ser um de: ${validStatuses.join(', ')}`);
        }

        // Validação de coordenadas
        if (this.coordinates && typeof this.coordinates === 'object') {
            if (typeof this.coordinates.lat !== 'number' || typeof this.coordinates.lng !== 'number') {
                errors.push('coordinates deve ter propriedades lat e lng como números');
            }
        }

        // Validação de confiança
        if (this.confidence < 0 || this.confidence > 1) {
            errors.push('confidence deve estar entre 0 e 1');
        }

        // Validação de datas
        if (this.installationDate && this.warrantyExpiry && this.installationDate > this.warrantyExpiry) {
            errors.push('installationDate não pode ser posterior a warrantyExpiry');
        }

        if (errors.length > 0) {
            throw new Error(`Validação de equipamento falhou: ${errors.join(', ')}`);
        }
    }

    /**
     * Gera IDs ausentes
     */
    generateMissingIds() {
        if (!this.id) {
            this.id = HashUtils.uniqueId('equipment');
        }

        if (!this.code) {
            this.code = this.generateEquipmentCode();
        }
    }

    /**
     * Gera código único para o equipamento
     * @returns {string} - Código gerado
     */
    generateEquipmentCode() {
        const prefix = this.groups.length > 0 ? this.groups[0].substring(0, 3) : 'EQP';
        const timestamp = Date.now().toString(36).toUpperCase();
        const hash = HashUtils.quick(this.name).substring(0, 4).toUpperCase();
        
        return `${prefix}-${hash}-${timestamp}`;
    }

    /**
     * Verifica se equipamento está ativo
     * @returns {boolean} - Se está ativo
     */
    isEquipmentActive() {
        return this.isActive && 
               this.status === 'ACTIVE' && 
               this.operationalStatus !== 'OFFLINE';
    }

    /**
     * Verifica se equipamento precisa de manutenção
     * @returns {boolean} - Se precisa de manutenção
     */
    needsMaintenance() {
        if (!this.nextMaintenance) return false;
        return Date.now() >= this.nextMaintenance;
    }

    /**
     * Verifica se garantia está válida
     * @returns {boolean} - Se garantia está válida
     */
    isUnderWarranty() {
        if (!this.warrantyExpiry) return false;
        return Date.now() < this.warrantyExpiry;
    }

    /**
     * Calcula idade do equipamento
     * @param {string} unit - Unidade (ms, s, m, h, d)
     * @returns {number} - Idade na unidade especificada
     */
    getAge(unit = 'days') {
        if (!this.installationDate) return 0;
        return DateUtils.duration(this.installationDate, Date.now(), unit);
    }

    /**
     * Calcula tempo desde última atividade
     * @param {string} unit - Unidade
     * @returns {number} - Tempo desde última atividade
     */
    getTimeSinceLastActivity(unit = 'minutes') {
        if (!this.lastActivity) return 0;
        return DateUtils.duration(this.lastActivity, Date.now(), unit);
    }

    /**
     * Atualiza status do equipamento
     * @param {string} status - Novo status
     * @param {Object} additionalData - Dados adicionais
     * @param {string} updatedBy - Quem está atualizando
     * @returns {Equipment} - Instância atualizada
     */
    updateStatus(status, additionalData = {}, updatedBy = 'SYSTEM') {
        const previousStatus = this.status;
        
        const updates = {
            status,
            lastActivity: Date.now(),
            ...additionalData
        };

        // Log da mudança de status
        this.logger.info('Equipment: Status atualizado', {
            equipmentId: this.id,
            equipmentName: this.name,
            previousStatus,
            newStatus: status,
            updatedBy
        });

        return this.update(updates, updatedBy);
    }

    /**
     * Registra atividade do equipamento
     * @param {Object} activity - Dados da atividade
     * @param {string} source - Fonte da atividade
     * @returns {Equipment} - Instância atualizada
     */
    recordActivity(activity, source = 'SYSTEM') {
        const now = Date.now();
        
        // Atualiza timestamps
        this.lastActivity = now;
        this.lastSeen = now;
        
        // Atualiza métricas de uso
        if (!this.usage.totalActivities) {
            this.usage.totalActivities = 0;
        }
        this.usage.totalActivities++;
        
        // Armazena atividade no histórico
        if (!this.usage.recentActivities) {
            this.usage.recentActivities = [];
        }
        
        this.usage.recentActivities.push({
            timestamp: now,
            activity,
            source
        });
        
        // Limita histórico de atividades
        if (this.usage.recentActivities.length > 100) {
            this.usage.recentActivities = this.usage.recentActivities.slice(-50);
        }

        return this;
    }

    /**
     * Adiciona tag ao equipamento
     * @param {string} tag - Tag para adicionar
     * @returns {Equipment} - Instância atualizada
     */
    addTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!this.tags.includes(normalizedTag)) {
            this.tags.push(normalizedTag);
        }
        return this;
    }

    /**
     * Remove tag do equipamento
     * @param {string} tag - Tag para remover
     * @returns {Equipment} - Instância atualizada
     */
    removeTag(tag) {
        const normalizedTag = tag.trim().toLowerCase();
        this.tags = this.tags.filter(t => t !== normalizedTag);
        return this;
    }

    /**
     * Adiciona grupo ao equipamento
     * @param {string} group - Grupo para adicionar
     * @returns {Equipment} - Instância atualizada
     */
    addGroup(group) {
        const normalizedGroup = group.trim().toUpperCase();
        if (!this.groups.includes(normalizedGroup)) {
            this.groups.push(normalizedGroup);
        }
        return this;
    }

    /**
     * Remove grupo do equipamento
     * @param {string} group - Grupo para remover
     * @returns {Equipment} - Instância atualizada
     */
    removeGroup(group) {
        const normalizedGroup = group.trim().toUpperCase();
        this.groups = this.groups.filter(g => g !== normalizedGroup);
        return this;
    }

    /**
     * Adiciona equipamento relacionado
     * @param {string} equipmentId - ID do equipamento relacionado
     * @param {string} relationship - Tipo de relacionamento
     * @returns {Equipment} - Instância atualizada
     */
    addRelatedEquipment(equipmentId, relationship = 'RELATED') {
        const relation = {
            equipmentId,
            relationship: relationship.toUpperCase(),
            createdAt: Date.now()
        };

        if (!this.relatedEquipments.find(r => r.equipmentId === equipmentId)) {
            this.relatedEquipments.push(relation);
        }
        return this;
    }

    /**
     * Programa próxima manutenção
     * @param {Date|number|string} date - Data da próxima manutenção
     * @param {string} type - Tipo de manutenção
     * @returns {Equipment} - Instância atualizada
     */
    scheduleNextMaintenance(date, type = 'SCHEDULED') {
        this.nextMaintenance = DateUtils.parse(date)?.getTime() || null;
        
        if (!this.metadata.maintenance) {
            this.metadata.maintenance = {};
        }
        
        this.metadata.maintenance.nextType = type;
        this.metadata.maintenance.scheduledAt = Date.now();
        
        return this;
    }

    /**
     * Registra manutenção realizada
     * @param {Object} maintenanceData - Dados da manutenção
     * @param {string} performedBy - Quem realizou
     * @returns {Equipment} - Instância atualizada
     */
    recordMaintenance(maintenanceData, performedBy = 'UNKNOWN') {
        const now = Date.now();
        
        this.lastMaintenance = now;
        
        // Calcula próxima manutenção se intervalo definido
        if (this.maintenanceInterval) {
            this.nextMaintenance = now + this.maintenanceInterval;
        }
        
        // Armazena histórico de manutenção
        if (!this.metadata.maintenanceHistory) {
            this.metadata.maintenanceHistory = [];
        }
        
        this.metadata.maintenanceHistory.push({
            timestamp: now,
            performedBy,
            ...maintenanceData
        });
        
        // Limita histórico
        if (this.metadata.maintenanceHistory.length > 50) {
            this.metadata.maintenanceHistory = this.metadata.maintenanceHistory.slice(-25);
        }

        return this;
    }

    /**
     * Atualiza equipamento com novos dados
     * @param {Object} updates - Dados para atualizar
     * @param {string} updatedBy - Quem está atualizando
     * @returns {Equipment} - Instância atualizada
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
            
            // Renormaliza dados
            this.normalize();
            
            // Redetecta grupos se nome mudou
            if (updates.name && this.config.autoDetectGroups) {
                this.detectGroups();
            }
            
            // Revalida se necessário
            if (this.config.strictValidation) {
                this.validate();
            }

            this.logger.debug('Equipment: Equipamento atualizado', {
                id: this.id,
                version: this.version,
                updatedBy: updatedBy
            });

            return this;

        } catch (error) {
            this.logger.error('Equipment: Erro na atualização', {
                id: this.id,
                error: error.message,
                updates: updates
            });
            throw error;
        }
    }

    /**
     * Verifica compatibilidade com outro equipamento
     * @param {Equipment} other - Outro equipamento
     * @returns {Object} - Análise de compatibilidade
     */
    checkCompatibility(other) {
        if (!(other instanceof Equipment)) {
            return { compatible: false, reason: 'Invalid equipment object' };
        }

        const compatibility = {
            compatible: true,
            score: 0,
            reasons: [],
            suggestions: []
        };

        // Verifica grupos em comum
        const commonGroups = this.groups.filter(g => other.groups.includes(g));
        if (commonGroups.length > 0) {
            compatibility.score += 0.3;
            compatibility.reasons.push(`Grupos em comum: ${commonGroups.join(', ')}`);
        }

        // Verifica categoria
        if (this.category === other.category) {
            compatibility.score += 0.2;
            compatibility.reasons.push('Mesma categoria');
        }

        // Verifica localização
        if (this.zone === other.zone && this.zone) {
            compatibility.score += 0.2;
            compatibility.reasons.push('Mesma zona');
        }

        // Verifica capacidades complementares
        const commonCapabilities = this.capabilities.filter(c => other.capabilities.includes(c));
        if (commonCapabilities.length > 0) {
            compatibility.score += 0.3;
            compatibility.reasons.push(`Capacidades compatíveis: ${commonCapabilities.join(', ')}`);
        }

        compatibility.compatible = compatibility.score >= 0.5;
        
        if (!compatibility.compatible) {
            compatibility.suggestions.push('Considere verificar configurações de integração');
        }

        return compatibility;
    }

    /**
     * Gera relatório de status do equipamento
     * @returns {Object} - Relatório de status
     */
    generateStatusReport() {
        const now = Date.now();
        
        return {
            basic: {
                id: this.id,
                name: this.name,
                code: this.code,
                groups: this.groups,
                category: this.category,
                type: this.type
            },
            status: {
                operational: this.operationalStatus,
                health: this.healthStatus,
                isActive: this.isActive,
                isOnline: this.isOnline,
                lastActivity: this.lastActivity,
                timeSinceLastActivity: this.getTimeSinceLastActivity('minutes')
            },
            lifecycle: {
                age: this.getAge('days'),
                installationDate: this.installationDate,
                isUnderWarranty: this.isUnderWarranty(),
                warrantyExpiry: this.warrantyExpiry
            },
            maintenance: {
                lastMaintenance: this.lastMaintenance,
                nextMaintenance: this.nextMaintenance,
                needsMaintenance: this.needsMaintenance(),
                daysUntilMaintenance: this.nextMaintenance ? 
                    DateUtils.duration(now, this.nextMaintenance, 'days') : null
            },
            metrics: {
                totalActivities: this.usage.totalActivities || 0,
                confidence: this.confidence,
                version: this.version
            },
            relationships: {
                parentEquipment: this.parentEquipment,
                childEquipments: this.childEquipments.length,
                relatedEquipments: this.relatedEquipments.length
            }
        };
    }

    /**
     * Converte equipamento para objeto simples
     * @param {Object} options - Opções de serialização
     * @returns {Object} - Objeto simples
     */
    toPlainObject(options = {}) {
        const {
            includeMetadata = true,
            includeAudit = false,
            includeRelationships = true,
            includeMetrics = true,
            dateFormat = 'timestamp'
        } = options;

        const obj = {
            id: this.id,
            name: this.name,
            displayName: this.displayName,
            code: this.code,
            serialNumber: this.serialNumber,
            groups: [...this.groups],
            category: this.category,
            subcategory: this.subcategory,
            type: this.type,
            model: this.model,
            manufacturer: this.manufacturer,
            status: this.status,
            operationalStatus: this.operationalStatus,
            healthStatus: this.healthStatus,
            lastActivity: this.lastActivity,
            isActive: this.isActive,
            isOnline: this.isOnline,
            location: this.location,
            coordinates: this.coordinates,
            zone: this.zone,
            facility: this.facility,
            department: this.department,
            specifications: { ...this.specifications },
            capabilities: [...this.capabilities],
            features: [...this.features],
            settings: { ...this.settings },
            thresholds: { ...this.thresholds },
            alerts: { ...this.alerts },
            installationDate: this.installationDate,
            warrantyExpiry: this.warrantyExpiry,
            lastMaintenance: this.lastMaintenance,
            nextMaintenance: this.nextMaintenance,
            maintenanceInterval: this.maintenanceInterval,
            tags: [...this.tags],
            alertsEnabled: this.alertsEnabled,
            alertRules: [...this.alertRules],
            suppressedAlerts: [...this.suppressedAlerts],
            confidence: this.confidence,
            lastSeen: this.lastSeen,
            firstSeen: this.firstSeen
        };

        if (includeMetadata) {
            obj.metadata = { ...this.metadata };
            obj.customFields = { ...this.customFields };
        }

        if (includeAudit) {
            obj.createdAt = dateFormat === 'iso' ? new Date(this.createdAt).toISOString() : this.createdAt;
            obj.createdBy = this.createdBy;
            obj.updatedAt = dateFormat === 'iso' ? new Date(this.updatedAt).toISOString() : this.updatedAt;
            obj.updatedBy = this.updatedBy;
            obj.version = this.version;
        }

        if (includeRelationships) {
            obj.parentEquipment = this.parentEquipment;
            obj.childEquipments = [...this.childEquipments];
            obj.relatedEquipments = [...this.relatedEquipments];
        }

        if (includeMetrics) {
            obj.metrics = { ...this.metrics };
            obj.performance = { ...this.performance };
            obj.usage = { ...this.usage };
        }

        return obj;
    }

    /**
     * Clona equipamento
     * @param {Object} overrides - Campos para sobrescrever
     * @returns {Equipment} - Nova instância
     */
    clone(overrides = {}) {
        const data = {
            ...this.toPlainObject({ includeAudit: true, includeRelationships: true, includeMetrics: true }),
            ...overrides
        };
        
        // Remove IDs para gerar novos
        if (!overrides.id) delete data.id;
        if (!overrides.code) delete data.code;
        
        return new Equipment(data, this.config);
    }

    /**
     * Compara com outro equipamento
     * @param {Equipment} other - Outro equipamento
     * @param {Array} fields - Campos para comparar
     * @returns {boolean} - Se são iguais
     */
    equals(other, fields = ['id']) {
        if (!(other instanceof Equipment)) {
            return false;
        }

        return fields.every(field => this[field] === other[field]);
    }

    /**
     * Obtém hash único do equipamento
     * @returns {string} - Hash único
     */
    getHash() {
        return HashUtils.equipment(this);
    }

    /**
     * Converte para string
     * @returns {string} - Representação em string
     */
    toString() {
        return `Equipment[${this.id}]: ${this.name} (${this.groups.join(', ')})`;
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
 * Classe para coleção de equipamentos
 */
export class EquipmentCollection {
    constructor(equipments = [], config = {}) {
        this.equipments = [];
        this.config = config;
        this.logger = config.logger || LogUtils.createLogger('EquipmentCollection');

        // Adiciona equipamentos iniciais
        this.addMany(equipments);
    }

    /**
     * Adiciona equipamento à coleção
     * @param {Equipment|Object} equipment - Equipamento para adicionar
     * @returns {EquipmentCollection} - Instância para chaining
     */
    add(equipment) {
        const equipmentInstance = equipment instanceof Equipment ? equipment : new Equipment(equipment, this.config);
        this.equipments.push(equipmentInstance);
        return this;
    }

    /**
     * Adiciona múltiplos equipamentos
     * @param {Array} equipments - Array de equipamentos
     * @returns {EquipmentCollection} - Instância para chaining
     */
    addMany(equipments) {
        equipments.forEach(equipment => this.add(equipment));
        return this;
    }

    /**
     * Remove equipamento da coleção
     * @param {string} id - ID do equipamento
     * @returns {boolean} - Se foi removido
     */
    remove(id) {
        const initialLength = this.equipments.length;
        this.equipments = this.equipments.filter(equipment => equipment.id !== id);
        return this.equipments.length < initialLength;
    }

    /**
     * Encontra equipamento por ID
     * @param {string} id - ID do equipamento
     * @returns {Equipment|null} - Equipamento encontrado
     */
    findById(id) {
        return this.equipments.find(equipment => equipment.id === id) || null;
    }

    /**
     * Encontra equipamentos por nome
     * @param {string} name - Nome para buscar
     * @param {boolean} exactMatch - Se deve ser match exato
     * @returns {Array} - Equipamentos encontrados
     */
    findByName(name, exactMatch = false) {
        if (exactMatch) {
            return this.equipments.filter(equipment => equipment.name === name);
        } else {
            const searchTerm = name.toLowerCase();
            return this.equipments.filter(equipment => 
                equipment.name.toLowerCase().includes(searchTerm)
            );
        }
    }

    /**
     * Filtra equipamentos por grupo
     * @param {string|Array} groups - Grupo(s) para filtrar
     * @returns {EquipmentCollection} - Nova coleção filtrada
     */
    filterByGroup(groups) {
        const targetGroups = Array.isArray(groups) ? groups : [groups];
        
        const filtered = this.equipments.filter(equipment => 
            targetGroups.some(group => equipment.groups.includes(group))
        );

        return new EquipmentCollection(filtered, this.config);
    }

    /**
     * Filtra equipamentos por status
     * @param {string|Array} statuses - Status para filtrar
     * @returns {EquipmentCollection} - Nova coleção filtrada
     */
    filterByStatus(statuses) {
        const targetStatuses = Array.isArray(statuses) ? statuses : [statuses];
        
        const filtered = this.equipments.filter(equipment => 
            targetStatuses.includes(equipment.status)
        );

        return new EquipmentCollection(filtered, this.config);
    }

    /**
     * Obtém equipamentos ativos
     * @returns {EquipmentCollection} - Equipamentos ativos
     */
    getActive() {
        const active = this.equipments.filter(equipment => equipment.isEquipmentActive());
        return new EquipmentCollection(active, this.config);
    }

    /**
     * Obtém equipamentos que precisam de manutenção
     * @returns {EquipmentCollection} - Equipamentos que precisam de manutenção
     */
    getNeedingMaintenance() {
        const needingMaintenance = this.equipments.filter(equipment => equipment.needsMaintenance());
        return new EquipmentCollection(needingMaintenance, this.config);
    }

    /**
     * Agrupa equipamentos por campo
     * @param {string|Function} groupBy - Campo ou função de agrupamento
     * @returns {Map} - Map com grupos
     */
    groupBy(groupBy) {
        const groups = new Map();

        this.equipments.forEach(equipment => {
            let key;
            
            if (typeof groupBy === 'function') {
                key = groupBy(equipment);
            } else if (groupBy === 'groups') {
                // Agrupamento especial para groups (pode ter múltiplos)
                equipment.groups.forEach(group => {
                    if (!groups.has(group)) {
                        groups.set(group, new EquipmentCollection([], this.config));
                    }
                    groups.get(group).add(equipment);
                });
                return;
            } else {
                key = equipment[groupBy];
            }
            
            if (!groups.has(key)) {
                groups.set(key, new EquipmentCollection([], this.config));
            }
            
            groups.get(key).add(equipment);
        });

        return groups;
    }

    /**
     * Ordena equipamentos
     * @param {string|Function} sortBy - Campo ou função de ordenação
     * @param {string} direction - 'asc' ou 'desc'
     * @returns {EquipmentCollection} - Nova coleção ordenada
     */
    sortBy(sortBy, direction = 'asc') {
        const sorted = [...this.equipments].sort((a, b) => {
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

        return new EquipmentCollection(sorted, this.config);
    }

    /**
     * Obtém estatísticas da coleção
     * @returns {Object} - Estatísticas
     */
    getStats() {
        const total = this.equipments.length;
        if (total === 0) {
            return {
                total: 0,
                byGroup: {},
                byStatus: {},
                byCategory: {},
                active: 0,
                needingMaintenance: 0,
                underWarranty: 0
            };
        }

        const stats = {
            total,
            byGroup: {},
            byStatus: {},
            byCategory: {},
            active: 0,
            needingMaintenance: 0,
            underWarranty: 0,
            averageAge: 0,
            oldestEquipment: null,
            newestEquipment: null
        };

        let totalAge = 0;
        let ageCount = 0;
        let oldest = null;
        let newest = null;

        this.equipments.forEach(equipment => {
            // Grupos
            equipment.groups.forEach(group => {
                stats.byGroup[group] = (stats.byGroup[group] || 0) + 1;
            });
            
            // Status
            stats.byStatus[equipment.status] = (stats.byStatus[equipment.status] || 0) + 1;
            
            // Categoria
            stats.byCategory[equipment.category] = (stats.byCategory[equipment.category] || 0) + 1;
            
            // Estados
            if (equipment.isEquipmentActive()) stats.active++;
            if (equipment.needsMaintenance()) stats.needingMaintenance++;
            if (equipment.isUnderWarranty()) stats.underWarranty++;
            
            // Idade
            if (equipment.installationDate) {
                const age = equipment.getAge('days');
                totalAge += age;
                ageCount++;
                
                if (!oldest || equipment.installationDate < oldest.installationDate) {
                    oldest = equipment;
                }
                if (!newest || equipment.installationDate > newest.installationDate) {
                    newest = equipment;
                }
            }
        });

        if (ageCount > 0) {
            stats.averageAge = totalAge / ageCount;
        }
        
        stats.oldestEquipment = oldest?.id || null;
        stats.newestEquipment = newest?.id || null;

        return stats;
    }

    /**
     * Converte para array simples
     * @param {Object} options - Opções de serialização
     * @returns {Array} - Array de objetos
     */
    toArray(options = {}) {
        return this.equipments.map(equipment => equipment.toPlainObject(options));
    }

    /**
     * Obtém tamanho da coleção
     * @returns {number} - Número de equipamentos
     */
    size() {
        return this.equipments.length;
    }

    /**
     * Verifica se coleção está vazia
     * @returns {boolean} - Se está vazia
     */
    isEmpty() {
        return this.equipments.length === 0;
    }

    /**
     * Limpa todos os equipamentos
     * @returns {EquipmentCollection} - Instância para chaining
     */
    clear() {
        this.equipments = [];
        return this;
    }
}

/**
 * Factory para criação de equipamentos
 */
export class EquipmentFactory {
    static createFromData(data, config = {}) {
        return new Equipment(data, config);
    }

    static createCollection(equipments = [], config = {}) {
        return new EquipmentCollection(equipments, config);
    }

    static createFromTemplate(template, overrides = {}, config = {}) {
        const data = { ...template, ...overrides };
        return new Equipment(data, config);
    }
}

/**
 * Utilitários para trabalhar com equipamentos
 */
export const EquipmentUtils = {
    /**
     * Cria equipamento
     */
    create: (data, config) => new Equipment(data, config),
    
    /**
     * Cria coleção de equipamentos
     */
    createCollection: (equipments, config) => new EquipmentCollection(equipments, config),
    
    /**
     * Valida dados de equipamento
     */
    validate: (data) => {
        try {
            new Equipment(data, { strictValidation: true });
            return { valid: true, errors: [] };
        } catch (error) {
            return { valid: false, errors: [error.message] };
        }
    },
    
    /**
     * Compara dois equipamentos
     */
    compare: (equipment1, equipment2, fields) => {
        const e1 = equipment1 instanceof Equipment ? equipment1 : new Equipment(equipment1);
        const e2 = equipment2 instanceof Equipment ? equipment2 : new Equipment(equipment2);
        return e1.equals(e2, fields);
    },
    
    /**
     * Verifica compatibilidade entre equipamentos
     */
    checkCompatibility: (equipment1, equipment2) => {
        const e1 = equipment1 instanceof Equipment ? equipment1 : new Equipment(equipment1);
        const e2 = equipment2 instanceof Equipment ? equipment2 : new Equipment(equipment2);
        return e1.checkCompatibility(e2);
    }
};

export default Equipment;
