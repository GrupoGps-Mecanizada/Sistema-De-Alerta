/**
 * errorHandler.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Sistema de tratamento centralizado de erros com fallbacks automáticos
 * Usado por todos os módulos para resilência e recuperação automática
 * 
 * Funcionalidades:
 * - Tratamento estruturado de diferentes tipos de erro
 * - Sistema de retry com backoff exponencial
 * - Fallbacks automáticos para operações críticas
 * - Categorização e severidade de erros
 * - Logging estruturado de erros
 * - Notificações de erro para usuário
 * - Métricas de erro e análise de padrões
 * - Circuit breaker para serviços externos
 */

export class ErrorHandler {
    constructor(config = {}) {
        this.config = {
            // Configurações de retry
            maxRetries: config.maxRetries || 3,
            initialDelay: config.initialDelay || 1000,
            maxDelay: config.maxDelay || 30000,
            backoffMultiplier: config.backoffMultiplier || 2,
            enableRetry: config.enableRetry !== false,
            
            // Configurações de circuit breaker
            circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
            circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
            enableCircuitBreaker: config.enableCircuitBreaker !== false,
            
            // Configurações de logging
            enableErrorLogging: config.enableErrorLogging !== false,
            enableStackTrace: config.enableStackTrace !== false,
            enableUserNotifications: config.enableUserNotifications !== false,
            
            // Configurações de fallback
            enableAutoFallback: config.enableAutoFallback !== false,
            enableGracefulDegradation: config.enableGracefulDegradation !== false,
            
            // Configurações de métricas
            enableMetrics: config.enableMetrics !== false,
            maxErrorHistory: config.maxErrorHistory || 1000,
            
            ...config
        };

        // Categorias de erro
        this.errorCategories = {
            NETWORK: 'network',
            VALIDATION: 'validation',
            AUTHENTICATION: 'authentication',
            AUTHORIZATION: 'authorization',
            NOT_FOUND: 'not_found',
            SERVER_ERROR: 'server_error',
            CLIENT_ERROR: 'client_error',
            TIMEOUT: 'timeout',
            RATE_LIMIT: 'rate_limit',
            UNKNOWN: 'unknown'
        };

        // Severidades de erro
        this.errorSeverities = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };

        // Estado interno
        this.errorHistory = [];
        this.circuitBreakers = new Map();
        this.retryAttempts = new Map();
        
        // Métricas
        this.metrics = {
            totalErrors: 0,
            errorsByCategory: {},
            errorsBySeverity: {},
            retriesExecuted: 0,
            fallbacksExecuted: 0,
            circuitBreakersTripped: 0
        };

        // Logger
        this.logger = config.logger || console;

        // Callbacks
        this.onError = config.onError || null;
        this.onFallback = config.onFallback || null;
        this.onRetry = config.onRetry || null;

        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o sistema de tratamento de erros
     */
    initialize() {
        try {
            // Inicializa métricas por categoria
            Object.values(this.errorCategories).forEach(category => {
                this.metrics.errorsByCategory[category] = 0;
            });

            Object.values(this.errorSeverities).forEach(severity => {
                this.metrics.errorsBySeverity[severity] = 0;
            });

            // Configura handler global de erros não capturados (se em browser)
            if (typeof window !== 'undefined') {
                this.setupGlobalErrorHandlers();
            }

            this.logger.info('ErrorHandler: Sistema inicializado', {
                config: this.config,
                categories: Object.keys(this.errorCategories).length,
                severities: Object.keys(this.errorSeverities).length
            });

        } catch (error) {
            console.error('ErrorHandler: Erro na inicialização', error);
        }
    }

    /**
     * Configura handlers globais para erros não capturados
     */
    setupGlobalErrorHandlers() {
        // Handler para erros JavaScript não capturados
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message), {
                source: 'global',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // Handler para promises rejeitadas não capturadas
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                source: 'unhandled_promise_rejection',
                promise: event.promise
            });
        });
    }

    /**
     * Categoriza um erro baseado em suas características
     * @param {Error} error - Erro para categorizar
     * @returns {string} - Categoria do erro
     */
    categorizeError(error) {
        if (!error) return this.errorCategories.UNKNOWN;

        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';

        // Network errors
        if (message.includes('network') || 
            message.includes('fetch') || 
            message.includes('connection') ||
            name.includes('networkerror')) {
            return this.errorCategories.NETWORK;
        }

        // Timeout errors
        if (message.includes('timeout') || 
            message.includes('aborted') ||
            name.includes('timeouterror')) {
            return this.errorCategories.TIMEOUT;
        }

        // HTTP status-based categorization
        if (error.status || error.statusCode) {
            const status = error.status || error.statusCode;
            
            if (status === 401) return this.errorCategories.AUTHENTICATION;
            if (status === 403) return this.errorCategories.AUTHORIZATION;
            if (status === 404) return this.errorCategories.NOT_FOUND;
            if (status === 429) return this.errorCategories.RATE_LIMIT;
            if (status >= 400 && status < 500) return this.errorCategories.CLIENT_ERROR;
            if (status >= 500) return this.errorCategories.SERVER_ERROR;
        }

        // Validation errors
        if (message.includes('validation') || 
            message.includes('invalid') ||
            message.includes('required') ||
            name.includes('validationerror')) {
            return this.errorCategories.VALIDATION;
        }

        return this.errorCategories.UNKNOWN;
    }

    /**
     * Determina severidade do erro
     * @param {Error} error - Erro para avaliar
     * @param {string} category - Categoria do erro
     * @returns {string} - Severidade do erro
     */
    determineSeverity(error, category) {
        // Severidade crítica
        if (category === this.errorCategories.SERVER_ERROR ||
            error.name === 'SecurityError' ||
            error.message?.includes('critical')) {
            return this.errorSeverities.CRITICAL;
        }

        // Severidade alta
        if (category === this.errorCategories.AUTHENTICATION ||
            category === this.errorCategories.AUTHORIZATION ||
            category === this.errorCategories.NETWORK) {
            return this.errorSeverities.HIGH;
        }

        // Severidade média
        if (category === this.errorCategories.TIMEOUT ||
            category === this.errorCategories.RATE_LIMIT ||
            category === this.errorCategories.CLIENT_ERROR) {
            return this.errorSeverities.MEDIUM;
        }

        // Severidade baixa (padrão)
        return this.errorSeverities.LOW;
    }

    /**
     * Trata um erro de forma estruturada
     * @param {Error} error - Erro para tratar
     * @param {Object} context - Contexto adicional
     * @returns {Object} - Resultado do tratamento
     */
    handleError(error, context = {}) {
        try {
            // Normaliza erro
            const normalizedError = this.normalizeError(error);
            
            // Categoriza e determina severidade
            const category = this.categorizeError(normalizedError);
            const severity = this.determineSeverity(normalizedError, category);
            
            // Cria entrada de erro estruturada
            const errorEntry = {
                id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                error: normalizedError,
                category,
                severity,
                context: { ...context },
                handled: false,
                retryCount: 0,
                fallbackUsed: false
            };

            // Adiciona ao histórico
            this.addToHistory(errorEntry);
            
            // Atualiza métricas
            this.updateMetrics(category, severity);
            
            // Log estruturado
            if (this.config.enableErrorLogging) {
                this.logError(errorEntry);
            }
            
            // Executa callback personalizado
            if (this.onError && typeof this.onError === 'function') {
                try {
                    this.onError(errorEntry);
                } catch (callbackError) {
                    console.error('ErrorHandler: Erro no callback onError', callbackError);
                }
            }

            // Marca como tratado
            errorEntry.handled = true;
            
            return errorEntry;

        } catch (handlingError) {
            // Fallback para erro no próprio handler
            console.error('ErrorHandler: Erro no tratamento de erro', {
                originalError: error,
                handlingError: handlingError.message
            });
            
            return {
                id: `fallback_${Date.now()}`,
                timestamp: Date.now(),
                error: error,
                category: this.errorCategories.UNKNOWN,
                severity: this.errorSeverities.HIGH,
                handled: true,
                fallbackUsed: true
            };
        }
    }

    /**
     * Normaliza erro para formato consistente
     * @param {any} error - Erro ou valor para normalizar
     * @returns {Error} - Erro normalizado
     */
    normalizeError(error) {
        if (error instanceof Error) {
            return error;
        }

        if (typeof error === 'string') {
            return new Error(error);
        }

        if (error && typeof error === 'object') {
            const err = new Error(error.message || 'Erro desconhecido');
            err.name = error.name || 'UnknownError';
            err.status = error.status || error.statusCode;
            err.code = error.code;
            Object.assign(err, error);
            return err;
        }

        return new Error('Erro desconhecido');
    }

    /**
     * Executa operação com retry automático
     * @param {Function} operation - Operação para executar
     * @param {Object} options - Opções de retry
     * @returns {Promise} - Resultado da operação
     */
    async withRetry(operation, options = {}) {
        const {
            maxRetries = this.config.maxRetries,
            initialDelay = this.config.initialDelay,
            backoffMultiplier = this.config.backoffMultiplier,
            maxDelay = this.config.maxDelay,
            retryCondition = this.defaultRetryCondition.bind(this),
            context = {}
        } = options;

        let lastError;
        let currentDelay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                
                // Sucesso - limpa contador de tentativas
                if (context.operationId) {
                    this.retryAttempts.delete(context.operationId);
                }
                
                return result;

            } catch (error) {
                lastError = error;
                const errorEntry = this.handleError(error, {
                    ...context,
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1
                });

                // Verifica se deve tentar novamente
                if (attempt < maxRetries && retryCondition(error, attempt + 1)) {
                    // Atualiza métricas
                    this.metrics.retriesExecuted++;
                    
                    // Callback de retry
                    if (this.onRetry && typeof this.onRetry === 'function') {
                        try {
                            this.onRetry(errorEntry, attempt + 1, currentDelay);
                        } catch (callbackError) {
                            console.error('ErrorHandler: Erro no callback onRetry', callbackError);
                        }
                    }

                    // Registra tentativa
                    if (context.operationId) {
                        this.retryAttempts.set(context.operationId, attempt + 1);
                    }

                    // Aguarda antes da próxima tentativa
                    await this.delay(currentDelay);
                    
                    // Aumenta delay para próxima tentativa (backoff exponencial)
                    currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
                } else {
                    break;
                }
            }
        }

        throw lastError;
    }

    /**
     * Condição padrão para retry
     * @param {Error} error - Erro ocorrido
     * @param {number} attempt - Número da tentativa
     * @returns {boolean} - Se deve tentar novamente
     */
    defaultRetryCondition(error, attempt) {
        const category = this.categorizeError(error);
        
        // Não tenta novamente para alguns tipos de erro
        const nonRetryableCategories = [
            this.errorCategories.AUTHENTICATION,
            this.errorCategories.AUTHORIZATION,
            this.errorCategories.VALIDATION,
            this.errorCategories.NOT_FOUND
        ];

        if (nonRetryableCategories.includes(category)) {
            return false;
        }

        // Verifica circuit breaker
        if (this.config.enableCircuitBreaker) {
            const circuitBreakerKey = error.url || error.endpoint || 'default';
            if (this.isCircuitBreakerOpen(circuitBreakerKey)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Executa operação com fallback automático
     * @param {Function} primaryOperation - Operação principal
     * @param {Function} fallbackOperation - Operação de fallback
     * @param {Object} options - Opções
     * @returns {Promise} - Resultado da operação
     */
    async withFallback(primaryOperation, fallbackOperation, options = {}) {
        const { context = {}, enableRetry = true } = options;

        try {
            // Tenta operação principal com retry se habilitado
            if (enableRetry && this.config.enableRetry) {
                return await this.withRetry(primaryOperation, { context });
            } else {
                return await primaryOperation();
            }

        } catch (primaryError) {
            this.handleError(primaryError, {
                ...context,
                phase: 'primary_operation'
            });

            // Executa fallback se habilitado
            if (this.config.enableAutoFallback && fallbackOperation) {
                try {
                    this.metrics.fallbacksExecuted++;
                    
                    // Callback de fallback
                    if (this.onFallback && typeof this.onFallback === 'function') {
                        try {
                            this.onFallback(primaryError, context);
                        } catch (callbackError) {
                            console.error('ErrorHandler: Erro no callback onFallback', callbackError);
                        }
                    }

                    const fallbackResult = await fallbackOperation();
                    
                    this.logger.info('ErrorHandler: Fallback executado com sucesso', {
                        primaryError: primaryError.message,
                        context
                    });
                    
                    return fallbackResult;

                } catch (fallbackError) {
                    this.handleError(fallbackError, {
                        ...context,
                        phase: 'fallback_operation',
                        primaryError: primaryError.message
                    });

                    throw new Error(`Operação principal e fallback falharam. Principal: ${primaryError.message}, Fallback: ${fallbackError.message}`);
                }
            } else {
                throw primaryError;
            }
        }
    }

    /**
     * Verifica se circuit breaker está aberto
     * @param {string} key - Chave do circuit breaker
     * @returns {boolean} - Se está aberto
     */
    isCircuitBreakerOpen(key) {
        if (!this.config.enableCircuitBreaker) return false;

        const breaker = this.circuitBreakers.get(key);
        if (!breaker) return false;

        // Verifica se ainda está no timeout
        if (breaker.state === 'open' && Date.now() < breaker.openUntil) {
            return true;
        }

        // Reset se timeout expirou
        if (breaker.state === 'open' && Date.now() >= breaker.openUntil) {
            breaker.state = 'half-open';
            breaker.failureCount = 0;
        }

        return false;
    }

    /**
     * Registra falha no circuit breaker
     * @param {string} key - Chave do circuit breaker
     */
    recordCircuitBreakerFailure(key) {
        if (!this.config.enableCircuitBreaker) return;

        let breaker = this.circuitBreakers.get(key);
        if (!breaker) {
            breaker = {
                failureCount: 0,
                state: 'closed',
                openUntil: null
            };
            this.circuitBreakers.set(key, breaker);
        }

        breaker.failureCount++;

        if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
            breaker.state = 'open';
            breaker.openUntil = Date.now() + this.config.circuitBreakerTimeout;
            this.metrics.circuitBreakersTripped++;
            
            this.logger.warn('ErrorHandler: Circuit breaker aberto', {
                key,
                failureCount: breaker.failureCount,
                threshold: this.config.circuitBreakerThreshold
            });
        }
    }

    /**
     * Adiciona erro ao histórico
     * @param {Object} errorEntry - Entrada de erro
     */
    addToHistory(errorEntry) {
        this.errorHistory.push(errorEntry);

        // Limita tamanho do histórico
        if (this.errorHistory.length > this.config.maxErrorHistory) {
            const removeCount = Math.floor(this.config.maxErrorHistory * 0.25);
            this.errorHistory.splice(0, removeCount);
        }
    }

    /**
     * Atualiza métricas de erro
     * @param {string} category - Categoria do erro
     * @param {string} severity - Severidade do erro
     */
    updateMetrics(category, severity) {
        if (!this.config.enableMetrics) return;

        this.metrics.totalErrors++;
        this.metrics.errorsByCategory[category] = (this.metrics.errorsByCategory[category] || 0) + 1;
        this.metrics.errorsBySeverity[severity] = (this.metrics.errorsBySeverity[severity] || 0) + 1;
    }

    /**
     * Log estruturado de erro
     * @param {Object} errorEntry - Entrada de erro
     */
    logError(errorEntry) {
        const logMethod = this.getLogMethod(errorEntry.severity);
        const logData = {
            id: errorEntry.id,
            timestamp: errorEntry.timestamp,
            category: errorEntry.category,
            severity: errorEntry.severity,
            message: errorEntry.error.message,
            name: errorEntry.error.name,
            context: errorEntry.context
        };

        if (this.config.enableStackTrace && errorEntry.error.stack) {
            logData.stack = errorEntry.error.stack;
        }

        this.logger[logMethod]('ErrorHandler: Erro registrado', logData);
    }

    /**
     * Determina método de log baseado na severidade
     * @param {string} severity - Severidade do erro
     * @returns {string} - Método de log
     */
    getLogMethod(severity) {
        switch (severity) {
            case this.errorSeverities.CRITICAL:
                return 'error';
            case this.errorSeverities.HIGH:
                return 'error';
            case this.errorSeverities.MEDIUM:
                return 'warn';
            case this.errorSeverities.LOW:
                return 'info';
            default:
                return 'warn';
        }
    }

    /**
     * Função de delay para retry
     * @param {number} ms - Milissegundos para aguardar
     * @returns {Promise} - Promise que resolve após delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtém estatísticas de erro
     * @param {Object} options - Opções de filtro
     * @returns {Object} - Estatísticas
     */
    getErrorStats(options = {}) {
        const { timeRange = null, category = null, severity = null } = options;
        
        let filteredErrors = this.errorHistory;

        // Filtra por tempo
        if (timeRange) {
            const cutoff = Date.now() - timeRange;
            filteredErrors = filteredErrors.filter(err => err.timestamp >= cutoff);
        }

        // Filtra por categoria
        if (category) {
            filteredErrors = filteredErrors.filter(err => err.category === category);
        }

        // Filtra por severidade
        if (severity) {
            filteredErrors = filteredErrors.filter(err => err.severity === severity);
        }

        return {
            totalErrors: filteredErrors.length,
            globalMetrics: { ...this.metrics },
            filteredMetrics: this.calculateFilteredMetrics(filteredErrors),
            recentErrors: filteredErrors.slice(-10),
            circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([key, breaker]) => ({
                key,
                ...breaker
            }))
        };
    }

    /**
     * Calcula métricas para erros filtrados
     * @param {Array} errors - Erros filtrados
     * @returns {Object} - Métricas calculadas
     */
    calculateFilteredMetrics(errors) {
        const metrics = {
            errorsByCategory: {},
            errorsBySeverity: {},
            errorRate: 0,
            mostCommonError: null
        };

        // Contagem por categoria e severidade
        errors.forEach(error => {
            metrics.errorsByCategory[error.category] = (metrics.errorsByCategory[error.category] || 0) + 1;
            metrics.errorsBySeverity[error.severity] = (metrics.errorsBySeverity[error.severity] || 0) + 1;
        });

        // Erro mais comum
        const errorMessages = errors.reduce((acc, error) => {
            const message = error.error.message;
            acc[message] = (acc[message] || 0) + 1;
            return acc;
        }, {});

        const mostCommon = Object.entries(errorMessages).sort((a, b) => b[1] - a[1])[0];
        if (mostCommon) {
            metrics.mostCommonError = {
                message: mostCommon[0],
                count: mostCommon[1]
            };
        }

        return metrics;
    }

    /**
     * Limpa histórico de erros
     */
    clearHistory() {
        const count = this.errorHistory.length;
        this.errorHistory = [];
        
        this.logger.info('ErrorHandler: Histórico de erros limpo', {
            clearedErrors: count
        });
    }

    /**
     * Reset de métricas
     */
    resetMetrics() {
        this.metrics = {
            totalErrors: 0,
            errorsByCategory: {},
            errorsBySeverity: {},
            retriesExecuted: 0,
            fallbacksExecuted: 0,
            circuitBreakersTripped: 0
        };

        // Reinicializa contadores por categoria/severidade
        Object.values(this.errorCategories).forEach(category => {
            this.metrics.errorsByCategory[category] = 0;
        });

        Object.values(this.errorSeverities).forEach(severity => {
            this.metrics.errorsBySeverity[severity] = 0;
        });

        this.logger.info('ErrorHandler: Métricas resetadas');
    }

    /**
     * Reset de circuit breakers
     */
    resetCircuitBreakers() {
        const count = this.circuitBreakers.size;
        this.circuitBreakers.clear();
        
        this.logger.info('ErrorHandler: Circuit breakers resetados', {
            resetCount: count
        });
    }

    /**
     * Destrói o handler e limpa recursos
     */
    destroy() {
        this.clearHistory();
        this.resetCircuitBreakers();
        this.retryAttempts.clear();
        
        this.logger.info('ErrorHandler: Handler destruído');
    }
}

/**
 * Handler estático global para uso direto
 */
export const GlobalErrorHandler = new ErrorHandler({
    maxRetries: 3,
    enableCircuitBreaker: true,
    enableAutoFallback: true,
    enableMetrics: true
});

/**
 * Funções utilitárias para tratamento rápido de erros
 */
export const ErrorUtils = {
    /**
     * Trata erro global
     */
    handle: (error, context) => GlobalErrorHandler.handleError(error, context),
    
    /**
     * Executa com retry
     */
    withRetry: (operation, options) => GlobalErrorHandler.withRetry(operation, options),
    
    /**
     * Executa com fallback
     */
    withFallback: (primary, fallback, options) => GlobalErrorHandler.withFallback(primary, fallback, options),
    
    /**
     * Obtém estatísticas globais
     */
    getStats: (options) => GlobalErrorHandler.getErrorStats(options),
    
    /**
     * Cria novo handler
     */
    createHandler: (config) => new ErrorHandler(config),
    
    /**
     * Categorias de erro
     */
    categories: GlobalErrorHandler.errorCategories,
    
    /**
     * Severidades de erro
     */
    severities: GlobalErrorHandler.errorSeverities
};

export default ErrorHandler;
