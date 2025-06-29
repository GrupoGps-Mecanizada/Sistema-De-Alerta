/**
 * AlertConsolidator.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Módulo responsável pela consolidação inteligente de alertas
 * Integra com AlertGenerator e AlertDeduplicator para otimizar alertas
 * 
 * Funcionalidades:
 * - Consolidação temporal de alertas similares
 * - Agrupamento por equipamento e tipo de evento
 * - Redução de ruído em alertas repetitivos
 * - Geração de alertas consolidados com resumos
 * - Integração com sistema de grupos de equipamentos
 */

export class AlertConsolidator {
    constructor(config = {}) {
        this.config = {
            // Configurações de consolidação temporal
            consolidationWindow: config.consolidationWindow || 300000, // 5 minutos
            maxConsolidatedAlerts: config.maxConsolidatedAlerts || 50,
            
            // Configurações de agrupamento
            groupByEquipment: config.groupByEquipment !== false,
            groupByEventType: config.groupByEventType !== false,
            groupByEquipmentGroup: config.groupByEquipmentGroup !== false,
            
            // Configurações de threshold
            minAlertsToConsolidate: config.minAlertsToConsolidate || 3,
            maxConsolidationAge: config.maxConsolidationAge || 3600000, // 1 hora
            
            // Configurações de performance
            enablePerformanceMetrics: config.enablePerformanceMetrics !== false,
            enableDetailedLogging: config.enableDetailedLogging || false,
            
            ...config
        };

        // Estado interno
        this.activeConsolidations = new Map();
        this.consolidationHistory = [];
        this.metrics = {
            totalConsolidations: 0,
            totalAlertsConsolidated: 0,
            averageConsolidationSize: 0,
            consolidationTime: 0
        };

        // Logger estruturado
        this.logger = config.logger || console;
        
        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o consolidador
     */
    initialize() {
        const startTime = performance.now();
        
        try {
            this.logger.info('AlertConsolidator: Iniciando sistema de consolidação', {
                config: this.config,
                timestamp: new Date().toISOString()
            });

            // Limpa consolidações antigas ao iniciar
            this.cleanupOldConsolidations();

            const initTime = performance.now() - startTime;
            this.logger.info('AlertConsolidator: Sistema inicializado com sucesso', {
                initTime: `${initTime.toFixed(2)}ms`
            });

        } catch (error) {
            this.logger.error('AlertConsolidator: Erro na inicialização', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Processa alertas para consolidação
     * @param {Array} alerts - Array de alertas para processar
     * @returns {Array} - Array de alertas processados (consolidados ou originais)
     */
    processAlerts(alerts) {
        const startTime = performance.now();
        
        try {
            if (!Array.isArray(alerts) || alerts.length === 0) {
                this.logger.warn('AlertConsolidator: Array de alertas inválido ou vazio');
                return [];
            }

            this.logger.info('AlertConsolidator: Processando alertas para consolidação', {
                totalAlerts: alerts.length,
                timestamp: new Date().toISOString()
            });

            // Agrupa alertas por critérios de consolidação
            const groupedAlerts = this.groupAlertsForConsolidation(alerts);
            
            // Processa cada grupo
            const processedAlerts = [];
            for (const [groupKey, groupAlerts] of groupedAlerts.entries()) {
                const consolidatedGroup = this.processAlertGroup(groupKey, groupAlerts);
                processedAlerts.push(...consolidatedGroup);
            }

            // Limpa consolidações antigas
            this.cleanupOldConsolidations();

            const processTime = performance.now() - startTime;
            this.updateMetrics(processedAlerts.length, processTime);

            this.logger.info('AlertConsolidator: Processamento concluído', {
                originalAlerts: alerts.length,
                processedAlerts: processedAlerts.length,
                consolidationReduction: alerts.length - processedAlerts.length,
                processTime: `${processTime.toFixed(2)}ms`
            });

            return processedAlerts;

        } catch (error) {
            this.logger.error('AlertConsolidator: Erro no processamento de alertas', {
                error: error.message,
                stack: error.stack,
                alertsCount: alerts?.length || 0
            });
            
            // Fallback: retorna alertas originais em caso de erro
            return alerts || [];
        }
    }

    /**
     * Agrupa alertas por critérios de consolidação
     * @param {Array} alerts - Array de alertas
     * @returns {Map} - Map com alertas agrupados
     */
    groupAlertsForConsolidation(alerts) {
        const groups = new Map();

        for (const alert of alerts) {
            const groupKey = this.generateGroupKey(alert);
            
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            
            groups.get(groupKey).push(alert);
        }

        if (this.config.enableDetailedLogging) {
            this.logger.debug('AlertConsolidator: Alertas agrupados', {
                totalGroups: groups.size,
                groupSizes: Array.from(groups.values()).map(g => g.length)
            });
        }

        return groups;
    }

    /**
     * Gera chave de agrupamento para um alerta
     * @param {Object} alert - Alerta
     * @returns {string} - Chave de agrupamento
     */
    generateGroupKey(alert) {
        const keyParts = [];

        if (this.config.groupByEquipment && alert.equipamento) {
            keyParts.push(`eq:${alert.equipamento}`);
        }

        if (this.config.groupByEventType && alert.eventType) {
            keyParts.push(`et:${alert.eventType}`);
        }

        if (this.config.groupByEquipmentGroup && alert.equipmentGroups?.length > 0) {
            keyParts.push(`eg:${alert.equipmentGroups.join(',')}`);
        }

        if (alert.ruleId) {
            keyParts.push(`r:${alert.ruleId}`);
        }

        if (alert.severity) {
            keyParts.push(`s:${alert.severity}`);
        }

        return keyParts.join('|') || 'default';
    }

    /**
     * Processa um grupo de alertas para consolidação
     * @param {string} groupKey - Chave do grupo
     * @param {Array} alerts - Alertas do grupo
     * @returns {Array} - Alertas processados
     */
    processAlertGroup(groupKey, alerts) {
        if (alerts.length < this.config.minAlertsToConsolidate) {
            // Não consolida grupos pequenos
            return alerts;
        }

        // Verifica se já existe consolidação ativa para este grupo
        const existingConsolidation = this.activeConsolidations.get(groupKey);
        
        if (existingConsolidation && this.isConsolidationValid(existingConsolidation)) {
            // Adiciona alertas à consolidação existente
            return this.updateExistingConsolidation(existingConsolidation, alerts);
        } else {
            // Cria nova consolidação
            return this.createNewConsolidation(groupKey, alerts);
        }
    }

    /**
     * Verifica se uma consolidação ainda é válida
     * @param {Object} consolidation - Consolidação
     * @returns {boolean} - Se a consolidação é válida
     */
    isConsolidationValid(consolidation) {
        const now = Date.now();
        const age = now - consolidation.createdAt;
        
        return age < this.config.maxConsolidationAge && 
               consolidation.alerts.length < this.config.maxConsolidatedAlerts;
    }

    /**
     * Atualiza consolidação existente com novos alertas
     * @param {Object} consolidation - Consolidação existente
     * @param {Array} newAlerts - Novos alertas
     * @returns {Array} - Array com alerta consolidado atualizado
     */
    updateExistingConsolidation(consolidation, newAlerts) {
        // Adiciona novos alertas à consolidação
        consolidation.alerts.push(...newAlerts);
        consolidation.lastUpdated = Date.now();
        consolidation.count = consolidation.alerts.length;

        // Atualiza o alerta consolidado
        const updatedAlert = this.generateConsolidatedAlert(consolidation);
        
        if (this.config.enableDetailedLogging) {
            this.logger.debug('AlertConsolidator: Consolidação atualizada', {
                groupKey: consolidation.groupKey,
                newAlertsCount: newAlerts.length,
                totalCount: consolidation.count
            });
        }

        return [updatedAlert];
    }

    /**
     * Cria nova consolidação
     * @param {string} groupKey - Chave do grupo
     * @param {Array} alerts - Alertas para consolidar
     * @returns {Array} - Array com alerta consolidado
     */
    createNewConsolidation(groupKey, alerts) {
        const now = Date.now();
        
        const consolidation = {
            id: `cons_${groupKey}_${now}`,
            groupKey,
            alerts: [...alerts],
            createdAt: now,
            lastUpdated: now,
            count: alerts.length
        };

        // Registra consolidação ativa
        this.activeConsolidations.set(groupKey, consolidation);
        
        // Adiciona ao histórico
        this.consolidationHistory.push({
            groupKey,
            timestamp: now,
            alertCount: alerts.length
        });

        // Gera alerta consolidado
        const consolidatedAlert = this.generateConsolidatedAlert(consolidation);

        this.metrics.totalConsolidations++;
        this.metrics.totalAlertsConsolidated += alerts.length;

        this.logger.info('AlertConsolidator: Nova consolidação criada', {
            groupKey,
            alertCount: alerts.length,
            consolidationId: consolidation.id
        });

        return [consolidatedAlert];
    }

    /**
     * Gera alerta consolidado a partir de uma consolidação
     * @param {Object} consolidation - Dados da consolidação
     * @returns {Object} - Alerta consolidado
     */
    generateConsolidatedAlert(consolidation) {
        const firstAlert = consolidation.alerts[0];
        const lastAlert = consolidation.alerts[consolidation.alerts.length - 1];

        return {
            id: consolidation.id,
            uniqueId: `consolidated_${consolidation.groupKey}_${consolidation.lastUpdated}`,
            equipamento: firstAlert.equipamento,
            equipmentGroups: firstAlert.equipmentGroups || [],
            ruleId: firstAlert.ruleId,
            ruleName: firstAlert.ruleName,
            severity: this.calculateConsolidatedSeverity(consolidation.alerts),
            message: this.generateConsolidatedMessage(consolidation),
            eventType: firstAlert.eventType,
            duration: lastAlert.timestamp - firstAlert.timestamp,
            consolidated: true,
            consolidatedCount: consolidation.count,
            firstOccurrence: firstAlert.timestamp,
            lastOccurrence: lastAlert.timestamp,
            timestamp: consolidation.lastUpdated,
            metadata: {
                consolidation: {
                    groupKey: consolidation.groupKey,
                    alertCount: consolidation.count,
                    timeSpan: lastAlert.timestamp - firstAlert.timestamp,
                    consolidationType: this.getConsolidationType(consolidation.alerts)
                },
                originalAlerts: consolidation.alerts.map(a => ({
                    id: a.id,
                    timestamp: a.timestamp,
                    message: a.message
                }))
            }
        };
    }

    /**
     * Calcula severidade consolidada
     * @param {Array} alerts - Array de alertas
     * @returns {string} - Severidade consolidada
     */
    calculateConsolidatedSeverity(alerts) {
        const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
        let maxSeverity = 'LOW';

        for (const alert of alerts) {
            const alertSeverity = alert.severity || 'LOW';
            if (severityOrder.indexOf(alertSeverity) > severityOrder.indexOf(maxSeverity)) {
                maxSeverity = alertSeverity;
            }
        }

        return maxSeverity;
    }

    /**
     * Gera mensagem consolidada
     * @param {Object} consolidation - Dados da consolidação
     * @returns {string} - Mensagem consolidada
     */
    generateConsolidatedMessage(consolidation) {
        const { alerts, count } = consolidation;
        const firstAlert = alerts[0];
        const timeSpan = consolidation.lastUpdated - consolidation.createdAt;
        const timeSpanMinutes = Math.round(timeSpan / 60000);

        let message = `[CONSOLIDADO] ${count} alertas similares`;
        
        if (firstAlert.equipamento) {
            message += ` para ${firstAlert.equipamento}`;
        }

        if (firstAlert.eventType) {
            message += ` (${firstAlert.eventType})`;
        }

        if (timeSpanMinutes > 0) {
            message += ` em ${timeSpanMinutes} minutos`;
        }

        // Adiciona sample da mensagem original
        if (firstAlert.message) {
            const sampleMessage = firstAlert.message.length > 50 
                ? firstAlert.message.substring(0, 50) + '...'
                : firstAlert.message;
            message += `. Exemplo: "${sampleMessage}"`;
        }

        return message;
    }

    /**
     * Determina tipo de consolidação
     * @param {Array} alerts - Array de alertas
     * @returns {string} - Tipo de consolidação
     */
    getConsolidationType(alerts) {
        if (alerts.length <= 5) return 'SMALL_BURST';
        if (alerts.length <= 20) return 'MEDIUM_BURST';
        return 'LARGE_BURST';
    }

    /**
     * Limpa consolidações antigas
     */
    cleanupOldConsolidations() {
        const now = Date.now();
        const cutoff = now - this.config.maxConsolidationAge;

        for (const [groupKey, consolidation] of this.activeConsolidations.entries()) {
            if (consolidation.createdAt < cutoff) {
                this.activeConsolidations.delete(groupKey);
                
                if (this.config.enableDetailedLogging) {
                    this.logger.debug('AlertConsolidator: Consolidação antiga removida', {
                        groupKey,
                        age: now - consolidation.createdAt
                    });
                }
            }
        }

        // Limita histórico de consolidações
        if (this.consolidationHistory.length > 1000) {
            this.consolidationHistory = this.consolidationHistory.slice(-500);
        }
    }

    /**
     * Atualiza métricas de performance
     * @param {number} processedCount - Número de alertas processados
     * @param {number} processTime - Tempo de processamento em ms
     */
    updateMetrics(processedCount, processTime) {
        if (!this.config.enablePerformanceMetrics) return;

        this.metrics.consolidationTime = 
            (this.metrics.consolidationTime + processTime) / 2;

        if (this.metrics.totalConsolidations > 0) {
            this.metrics.averageConsolidationSize = 
                this.metrics.totalAlertsConsolidated / this.metrics.totalConsolidations;
        }
    }

    /**
     * Retorna estatísticas de consolidação
     * @returns {Object} - Estatísticas
     */
    getConsolidationStats() {
        return {
            metrics: { ...this.metrics },
            activeConsolidations: this.activeConsolidations.size,
            recentHistory: this.consolidationHistory.slice(-10),
            config: {
                consolidationWindow: this.config.consolidationWindow,
                minAlertsToConsolidate: this.config.minAlertsToConsolidate,
                maxConsolidatedAlerts: this.config.maxConsolidatedAlerts
            }
        };
    }

    /**
     * Força consolidação de alertas específicos
     * @param {Array} alerts - Alertas para forçar consolidação
     * @param {Object} options - Opções de consolidação
     * @returns {Object} - Alerta consolidado
     */
    forceConsolidation(alerts, options = {}) {
        if (!Array.isArray(alerts) || alerts.length === 0) {
            throw new Error('AlertConsolidator: Array de alertas inválido para consolidação forçada');
        }

        const groupKey = options.groupKey || `forced_${Date.now()}`;
        const consolidation = {
            id: `forced_cons_${Date.now()}`,
            groupKey,
            alerts: [...alerts],
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            count: alerts.length,
            forced: true
        };

        const consolidatedAlert = this.generateConsolidatedAlert(consolidation);
        
        this.logger.info('AlertConsolidator: Consolidação forçada criada', {
            groupKey,
            alertCount: alerts.length,
            options
        });

        return consolidatedAlert;
    }

    /**
     * Reseta todas as consolidações ativas
     */
    resetConsolidations() {
        const count = this.activeConsolidations.size;
        this.activeConsolidations.clear();
        this.consolidationHistory = [];
        
        this.logger.info('AlertConsolidator: Consolidações resetadas', {
            clearedConsolidations: count
        });
    }

    /**
     * Destrói o consolidador e limpa recursos
     */
    destroy() {
        this.resetConsolidations();
        this.metrics = {
            totalConsolidations: 0,
            totalAlertsConsolidated: 0,
            averageConsolidationSize: 0,
            consolidationTime: 0
        };
        
        this.logger.info('AlertConsolidator: Sistema de consolidação destruído');
    }
}
