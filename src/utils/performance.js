/**
 * performance.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Sistema de métricas de performance e monitoramento
 * Usado para otimização e análise de componentes críticos
 * 
 * Funcionalidades:
 * - Medição de tempo de execução de operações
 * - Monitoramento de uso de memória
 * - Análise de throughput e latência
 * - Profiling de funções críticas
 * - Alertas de performance
 * - Relatórios de otimização
 * - Benchmark comparativo
 */

export class PerformanceTimer {
    constructor(name = 'Timer', config = {}) {
        this.name = name;
        this.config = {
            // Configurações de measurement
            enableMemoryTracking: config.enableMemoryTracking !== false,
            enableDetailedMetrics: config.enableDetailedMetrics !== false,
            enableHistoryTracking: config.enableHistoryTracking !== false,
            
            // Configurações de alertas
            slowOperationThreshold: config.slowOperationThreshold || 1000, // 1 segundo
            memoryLeakThreshold: config.memoryLeakThreshold || 50, // 50MB
            enableAlerts: config.enableAlerts !== false,
            
            // Configurações de histórico
            maxHistorySize: config.maxHistorySize || 1000,
            enableAggregation: config.enableAggregation !== false,
            
            // Configurações de sampling
            samplingRate: config.samplingRate || 1.0, // 100% por padrão
            enableSampling: config.enableSampling || false,
            
            ...config
        };

        // Estado interno
        this.activeTimers = new Map();
        this.completedTimers = [];
        this.aggregatedMetrics = new Map();
        this.memoryBaseline = null;
        
        // Estatísticas
        this.stats = {
            totalMeasurements: 0,
            slowOperations: 0,
            averageExecutionTime: 0,
            peakMemoryUsage: 0,
            startTime: performance.now()
        };

        // Logger
        this.logger = config.logger || console;

        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o sistema de performance
     */
    initialize() {
        try {
            // Estabelece baseline de memória
            if (this.config.enableMemoryTracking) {
                this.memoryBaseline = this.getMemoryUsage();
            }

            // Configura interceptação de Performance API se disponível
            if (typeof PerformanceObserver !== 'undefined') {
                this.setupPerformanceObserver();
            }

            this.logger.info('PerformanceTimer: Sistema inicializado', {
                name: this.name,
                config: this.config,
                memoryBaseline: this.memoryBaseline
            });

        } catch (error) {
            this.logger.error('PerformanceTimer: Erro na inicialização', {
                error: error.message,
                name: this.name
            });
        }
    }

    /**
     * Configura Performance Observer para métricas avançadas
     */
    setupPerformanceObserver() {
        try {
            if (!this.config.enableDetailedMetrics) return;

            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.processPerformanceEntry(entry);
                }
            });

            // Observa diferentes tipos de métricas
            const entryTypes = ['measure', 'navigation', 'resource'];
            for (const type of entryTypes) {
                try {
                    observer.observe({ entryTypes: [type] });
                } catch (e) {
                    // Ignora tipos não suportados
                }
            }

        } catch (error) {
            this.logger.warn('PerformanceTimer: Performance Observer não disponível', {
                error: error.message
            });
        }
    }

    /**
     * Processa entradas do Performance Observer
     * @param {PerformanceEntry} entry - Entrada de performance
     */
    processPerformanceEntry(entry) {
        if (this.config.enableDetailedMetrics) {
            this.logger.debug('PerformanceTimer: Entrada de performance detectada', {
                name: entry.name,
                type: entry.entryType,
                duration: entry.duration,
                startTime: entry.startTime
            });
        }
    }

    /**
     * Inicia cronômetro para uma operação
     * @param {string} operationName - Nome da operação
     * @param {Object} metadata - Metadados adicionais
     * @returns {string} - ID do timer
     */
    start(operationName, metadata = {}) {
        // Verifica sampling
        if (this.config.enableSampling && Math.random() > this.config.samplingRate) {
            return null; // Skip this measurement
        }

        const timerId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const timer = {
            id: timerId,
            name: operationName,
            startTime: performance.now(),
            startTimestamp: Date.now(),
            metadata: { ...metadata },
            memoryStart: this.config.enableMemoryTracking ? this.getMemoryUsage() : null
        };

        this.activeTimers.set(timerId, timer);

        if (this.config.enableDetailedMetrics) {
            this.logger.debug('PerformanceTimer: Timer iniciado', {
                id: timerId,
                name: operationName,
                metadata
            });
        }

        return timerId;
    }

    /**
     * Para cronômetro e calcula métricas
     * @param {string} timerId - ID do timer
     * @param {Object} additionalMetadata - Metadados adicionais
     * @returns {Object} - Métricas da operação
     */
    end(timerId, additionalMetadata = {}) {
        if (!timerId || !this.activeTimers.has(timerId)) {
            this.logger.warn('PerformanceTimer: Timer não encontrado', { timerId });
            return null;
        }

        const timer = this.activeTimers.get(timerId);
        const endTime = performance.now();
        const duration = endTime - timer.startTime;

        const metrics = {
            id: timerId,
            name: timer.name,
            duration,
            startTime: timer.startTime,
            endTime,
            timestamp: timer.startTimestamp,
            metadata: { ...timer.metadata, ...additionalMetadata }
        };

        // Adiciona métricas de memória se habilitado
        if (this.config.enableMemoryTracking && timer.memoryStart) {
            const memoryEnd = this.getMemoryUsage();
            metrics.memory = {
                start: timer.memoryStart,
                end: memoryEnd,
                delta: memoryEnd.used - timer.memoryStart.used,
                peak: memoryEnd.used
            };
        }

        // Remove timer ativo
        this.activeTimers.delete(timerId);

        // Adiciona ao histórico
        if (this.config.enableHistoryTracking) {
            this.addToHistory(metrics);
        }

        // Atualiza agregações
        if (this.config.enableAggregation) {
            this.updateAggregatedMetrics(metrics);
        }

        // Atualiza estatísticas
        this.updateStats(metrics);

        // Verifica alertas
        if (this.config.enableAlerts) {
            this.checkPerformanceAlerts(metrics);
        }

        if (this.config.enableDetailedMetrics) {
            this.logger.debug('PerformanceTimer: Timer finalizado', metrics);
        }

        return metrics;
    }

    /**
     * Mede tempo de execução de uma função
     * @param {string} name - Nome da operação
     * @param {Function} fn - Função para medir
     * @param {...any} args - Argumentos da função
     * @returns {Object} - {result, metrics}
     */
    async measure(name, fn, ...args) {
        const timerId = this.start(name);
        let result;
        let error = null;

        try {
            if (typeof fn === 'function') {
                result = await fn(...args);
            } else {
                throw new Error('Segundo parâmetro deve ser uma função');
            }
        } catch (err) {
            error = err;
            this.logger.error('PerformanceTimer: Erro durante medição', {
                name,
                error: err.message
            });
        }

        const metrics = this.end(timerId, { error: error ? error.message : null });

        return { result, metrics, error };
    }

    /**
     * Obtém uso atual de memória
     * @returns {Object} - Informações de memória
     */
    getMemoryUsage() {
        try {
            if (typeof performance !== 'undefined' && performance.memory) {
                // Chrome/Edge
                return {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                };
            } else if (typeof process !== 'undefined' && process.memoryUsage) {
                // Node.js
                const memUsage = process.memoryUsage();
                return {
                    used: memUsage.heapUsed,
                    total: memUsage.heapTotal,
                    limit: memUsage.rss,
                    external: memUsage.external,
                    timestamp: Date.now()
                };
            } else {
                // Fallback básico
                return {
                    used: 0,
                    total: 0,
                    limit: 0,
                    timestamp: Date.now(),
                    available: false
                };
            }
        } catch (error) {
            this.logger.warn('PerformanceTimer: Erro ao obter uso de memória', {
                error: error.message
            });
            return {
                used: 0,
                total: 0,
                limit: 0,
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * Adiciona métrica ao histórico
     * @param {Object} metrics - Métricas para adicionar
     */
    addToHistory(metrics) {
        this.completedTimers.push(metrics);

        // Limita tamanho do histórico
        if (this.completedTimers.length > this.config.maxHistorySize) {
            const removeCount = Math.floor(this.config.maxHistorySize * 0.25);
            this.completedTimers.splice(0, removeCount);
        }
    }

    /**
     * Atualiza métricas agregadas
     * @param {Object} metrics - Métricas da operação
     */
    updateAggregatedMetrics(metrics) {
        const { name, duration } = metrics;
        
        if (!this.aggregatedMetrics.has(name)) {
            this.aggregatedMetrics.set(name, {
                count: 0,
                totalDuration: 0,
                minDuration: Infinity,
                maxDuration: -Infinity,
                avgDuration: 0,
                p95Duration: 0,
                recentDurations: []
            });
        }

        const agg = this.aggregatedMetrics.get(name);
        agg.count++;
        agg.totalDuration += duration;
        agg.minDuration = Math.min(agg.minDuration, duration);
        agg.maxDuration = Math.max(agg.maxDuration, duration);
        agg.avgDuration = agg.totalDuration / agg.count;

        // Mantém últimas 100 durações para cálculo de percentis
        agg.recentDurations.push(duration);
        if (agg.recentDurations.length > 100) {
            agg.recentDurations.shift();
        }

        // Calcula P95
        if (agg.recentDurations.length >= 5) {
            const sorted = [...agg.recentDurations].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            agg.p95Duration = sorted[p95Index];
        }
    }

    /**
     * Atualiza estatísticas gerais
     * @param {Object} metrics - Métricas da operação
     */
    updateStats(metrics) {
        this.stats.totalMeasurements++;
        
        // Operações lentas
        if (metrics.duration > this.config.slowOperationThreshold) {
            this.stats.slowOperations++;
        }

        // Média de tempo de execução
        const totalDuration = this.completedTimers.reduce((sum, m) => sum + m.duration, 0);
        this.stats.averageExecutionTime = totalDuration / this.completedTimers.length;

        // Pico de uso de memória
        if (metrics.memory && metrics.memory.end.used > this.stats.peakMemoryUsage) {
            this.stats.peakMemoryUsage = metrics.memory.end.used;
        }
    }

    /**
     * Verifica alertas de performance
     * @param {Object} metrics - Métricas para verificar
     */
    checkPerformanceAlerts(metrics) {
        const alerts = [];

        // Alerta de operação lenta
        if (metrics.duration > this.config.slowOperationThreshold) {
            alerts.push({
                type: 'SLOW_OPERATION',
                message: `Operação lenta detectada: ${metrics.name}`,
                duration: metrics.duration,
                threshold: this.config.slowOperationThreshold,
                severity: 'WARNING'
            });
        }

        // Alerta de uso de memória
        if (metrics.memory && this.memoryBaseline) {
            const memoryIncrease = metrics.memory.end.used - this.memoryBaseline.used;
            const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
            
            if (memoryIncreaseMB > this.config.memoryLeakThreshold) {
                alerts.push({
                    type: 'MEMORY_LEAK',
                    message: `Possível vazamento de memória detectado`,
                    memoryIncrease: memoryIncreaseMB,
                    threshold: this.config.memoryLeakThreshold,
                    severity: 'CRITICAL'
                });
            }
        }

        // Log de alertas
        alerts.forEach(alert => {
            if (alert.severity === 'CRITICAL') {
                this.logger.error('PerformanceTimer: Alerta crítico de performance', alert);
            } else {
                this.logger.warn('PerformanceTimer: Alerta de performance', alert);
            }
        });
    }

    /**
     * Executa benchmark de uma função
     * @param {string} name - Nome do benchmark
     * @param {Function} fn - Função para benchmarkar
     * @param {Object} options - Opções do benchmark
     * @returns {Object} - Resultados do benchmark
     */
    async benchmark(name, fn, options = {}) {
        const {
            iterations = 100,
            warmupIterations = 10,
            args = []
        } = options;

        this.logger.info('PerformanceTimer: Iniciando benchmark', {
            name,
            iterations,
            warmupIterations
        });

        // Warmup
        for (let i = 0; i < warmupIterations; i++) {
            try {
                await fn(...args);
            } catch (error) {
                // Ignora erros durante warmup
            }
        }

        // Coleta baseline de memória
        const memoryBefore = this.getMemoryUsage();

        // Execução do benchmark
        const durations = [];
        for (let i = 0; i < iterations; i++) {
            const timerId = this.start(`${name}_bench_${i}`);
            try {
                await fn(...args);
            } catch (error) {
                this.logger.warn('PerformanceTimer: Erro durante benchmark', {
                    iteration: i,
                    error: error.message
                });
            }
            const metrics = this.end(timerId);
            if (metrics) {
                durations.push(metrics.duration);
            }
        }

        const memoryAfter = this.getMemoryUsage();

        // Calcula estatísticas
        durations.sort((a, b) => a - b);
        const results = {
            name,
            iterations: durations.length,
            durations: {
                min: durations[0],
                max: durations[durations.length - 1],
                avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
                median: durations[Math.floor(durations.length / 2)],
                p95: durations[Math.floor(durations.length * 0.95)],
                p99: durations[Math.floor(durations.length * 0.99)]
            },
            memory: {
                before: memoryBefore,
                after: memoryAfter,
                delta: memoryAfter.used - memoryBefore.used
            },
            opsPerSecond: 1000 / (durations.reduce((sum, d) => sum + d, 0) / durations.length)
        };

        this.logger.info('PerformanceTimer: Benchmark concluído', results);
        return results;
    }

    /**
     * Obtém relatório de performance
     * @param {Object} options - Opções do relatório
     * @returns {Object} - Relatório completo
     */
    getPerformanceReport(options = {}) {
        const {
            includeHistory = true,
            includeAggregated = true,
            includeStats = true,
            timeRange = null
        } = options;

        const report = {
            timestamp: Date.now(),
            uptime: performance.now() - this.stats.startTime,
            activeTimers: this.activeTimers.size
        };

        if (includeStats) {
            report.stats = { ...this.stats };
        }

        if (includeAggregated) {
            report.aggregatedMetrics = Object.fromEntries(this.aggregatedMetrics);
        }

        if (includeHistory) {
            let history = this.completedTimers;
            
            // Filtra por período se especificado
            if (timeRange) {
                const now = Date.now();
                const cutoff = now - timeRange;
                history = history.filter(m => m.timestamp >= cutoff);
            }

            report.history = history;
            report.historySize = history.length;
        }

        // Adiciona informações de memória atual
        if (this.config.enableMemoryTracking) {
            report.currentMemory = this.getMemoryUsage();
        }

        return report;
    }

    /**
     * Obtém top operações mais lentas
     * @param {number} limit - Número de operações para retornar
     * @returns {Array} - Array das operações mais lentas
     */
    getTopSlowOperations(limit = 10) {
        return this.completedTimers
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit)
            .map(metrics => ({
                name: metrics.name,
                duration: metrics.duration,
                timestamp: metrics.timestamp,
                metadata: metrics.metadata
            }));
    }

    /**
     * Limpa histórico de métricas
     */
    clearHistory() {
        const historySize = this.completedTimers.length;
        this.completedTimers = [];
        this.aggregatedMetrics.clear();
        
        this.logger.info('PerformanceTimer: Histórico limpo', {
            clearedEntries: historySize
        });
    }

    /**
     * Força finalização de todos os timers ativos
     */
    forceEndAllTimers() {
        const activeTimerIds = Array.from(this.activeTimers.keys());
        const results = [];

        for (const timerId of activeTimerIds) {
            const metrics = this.end(timerId, { forcedEnd: true });
            if (metrics) {
                results.push(metrics);
            }
        }

        this.logger.warn('PerformanceTimer: Todos os timers ativos foram forçados a finalizar', {
            count: results.length
        });

        return results;
    }

    /**
     * Destrói o timer e limpa recursos
     */
    destroy() {
        // Finaliza timers ativos
        this.forceEndAllTimers();

        // Limpa dados
        this.activeTimers.clear();
        this.completedTimers = [];
        this.aggregatedMetrics.clear();

        // Reset estatísticas
        this.stats = {
            totalMeasurements: 0,
            slowOperations: 0,
            averageExecutionTime: 0,
            peakMemoryUsage: 0,
            startTime: performance.now()
        };

        this.logger.info('PerformanceTimer: Timer destruído', {
            name: this.name
        });
    }
}

/**
 * Timer estático global para uso direto
 */
export const GlobalTimer = new PerformanceTimer('Global', {
    enableMemoryTracking: true,
    enableDetailedMetrics: false,
    enableHistoryTracking: true,
    enableAlerts: true
});

/**
 * Funções utilitárias para medição rápida
 */
export const PerfUtils = {
    /**
     * Inicia timer global
     */
    start: (name, metadata) => GlobalTimer.start(name, metadata),
    
    /**
     * Finaliza timer global
     */
    end: (timerId, metadata) => GlobalTimer.end(timerId, metadata),
    
    /**
     * Mede execução de função
     */
    measure: (name, fn, ...args) => GlobalTimer.measure(name, fn, ...args),
    
    /**
     * Executa benchmark
     */
    benchmark: (name, fn, options) => GlobalTimer.benchmark(name, fn, options),
    
    /**
     * Obtém relatório global
     */
    getReport: (options) => GlobalTimer.getPerformanceReport(options),
    
    /**
     * Obtém uso de memória
     */
    getMemory: () => GlobalTimer.getMemoryUsage(),
    
    /**
     * Cria novo timer
     */
    createTimer: (name, config) => new PerformanceTimer(name, config)
};

export default PerformanceTimer;
