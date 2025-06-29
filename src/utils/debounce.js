/**
 * debounce.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Sistema de debounce e throttle para otimização de performance
 * Usado para controlar frequência de execução de operações custosas
 * 
 * Funcionalidades:
 * - Debounce clássico com delay configurável
 * - Throttle para controle de taxa de execução
 * - Debounce com cache de resultados
 * - Debounce assíncrono com cancelamento
 * - Agrupamento de operações similares
 * - Métricas de otimização
 * - Gerenciamento automático de timers
 * - Configurações por contexto
 */

export class DebounceManager {
    constructor(config = {}) {
        this.config = {
            // Configurações padrão de debounce
            defaultDelay: config.defaultDelay || 300,
            defaultThrottleDelay: config.defaultThrottleDelay || 100,
            
            // Configurações de cache
            enableCaching: config.enableCaching !== false,
            maxCacheSize: config.maxCacheSize || 1000,
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutos
            
            // Configurações de agrupamento
            enableGrouping: config.enableGrouping !== false,
            groupingWindow: config.groupingWindow || 1000,
            maxGroupSize: config.maxGroupSize || 50,
            
            // Configurações de métricas
            enableMetrics: config.enableMetrics !== false,
            enableDetailedTracking: config.enableDetailedTracking || false,
            
            ...config
        };

        // Estado interno
        this.debouncedFunctions = new Map();
        this.throttledFunctions = new Map();
        this.cache = new Map();
        this.groups = new Map();
        this.timers = new Map();
        
        // Métricas
        this.metrics = {
            debounceCalls: 0,
            debounceExecutions: 0,
            throttleCalls: 0,
            throttleExecutions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            groupedOperations: 0,
            timersCreated: 0,
            timersCancelled: 0
        };

        // Logger
        this.logger = config.logger || console;

        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o gerenciador de debounce
     */
    initialize() {
        try {
            // Configuração de limpeza automática de cache
            if (this.config.enableCaching) {
                this.setupCacheCleanup();
            }

            this.logger.info('DebounceManager: Sistema inicializado', {
                config: this.config,
                timestamp: Date.now()
            });

        } catch (error) {
            this.logger.error('DebounceManager: Erro na inicialização', {
                error: error.message
            });
        }
    }

    /**
     * Configura limpeza automática de cache
     */
    setupCacheCleanup() {
        // Limpa cache expirado a cada minuto
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanExpiredCache();
        }, 60000);
    }

    /**
     * Cria função debounced
     * @param {Function} func - Função para fazer debounce
     * @param {number} delay - Delay em milissegundos
     * @param {Object} options - Opções adicionais
     * @returns {Function} - Função debounced
     */
    debounce(func, delay = null, options = {}) {
        delay = delay || this.config.defaultDelay;
        
        const {
            immediate = false,
            maxWait = null,
            leading = false,
            trailing = true,
            cache = this.config.enableCaching,
            context = 'default'
        } = options;

        const functionKey = this.generateFunctionKey(func, context);
        
        // Reutiliza função debounced existente se parâmetros forem iguais
        if (this.debouncedFunctions.has(functionKey)) {
            const existing = this.debouncedFunctions.get(functionKey);
            if (existing.delay === delay && 
                existing.immediate === immediate && 
                existing.maxWait === maxWait) {
                return existing.debouncedFunction;
            }
        }

        let timerId;
        let lastCallTime;
        let lastInvokeTime = 0;
        let lastArgs;
        let lastThis;
        let result;

        const debouncedFunction = function(...args) {
            const currentTime = Date.now();
            lastArgs = args;
            lastThis = this;
            lastCallTime = currentTime;

            // Incrementa métricas
            this.metrics.debounceCalls++;

            // Verifica cache se habilitado
            if (cache) {
                const cacheKey = this.generateCacheKey(func, args, context);
                const cachedResult = this.getFromCache(cacheKey);
                if (cachedResult !== null) {
                    this.metrics.cacheHits++;
                    return cachedResult;
                }
                this.metrics.cacheMisses++;
            }

            const shouldInvoke = this.shouldInvoke(currentTime, lastInvokeTime, delay, maxWait, leading, trailing);

            if (shouldInvoke) {
                if (timerId) {
                    clearTimeout(timerId);
                    timerId = null;
                    this.metrics.timersCancelled++;
                }

                result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                lastInvokeTime = currentTime;
                this.metrics.debounceExecutions++;
                
                return result;
            }

            if (!timerId) {
                timerId = setTimeout(() => {
                    const time = Date.now();
                    
                    if (this.shouldInvoke(time, lastInvokeTime, delay, maxWait, leading, trailing)) {
                        result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                        lastInvokeTime = time;
                        this.metrics.debounceExecutions++;
                    }
                    
                    timerId = null;
                }, delay);
                
                this.metrics.timersCreated++;
            }

            return result;
        }.bind(this);

        // Adiciona métodos de controle
        debouncedFunction.cancel = () => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
                this.metrics.timersCancelled++;
            }
            lastCallTime = null;
            lastInvokeTime = 0;
        };

        debouncedFunction.flush = () => {
            if (timerId) {
                debouncedFunction.cancel();
                if (lastArgs) {
                    result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                    this.metrics.debounceExecutions++;
                }
            }
            return result;
        };

        debouncedFunction.pending = () => !!timerId;

        // Armazena função debounced para reutilização
        this.debouncedFunctions.set(functionKey, {
            debouncedFunction,
            delay,
            immediate,
            maxWait,
            context
        });

        return debouncedFunction;
    }

    /**
     * Cria função throttled
     * @param {Function} func - Função para fazer throttle
     * @param {number} delay - Delay em milissegundos
     * @param {Object} options - Opções adicionais
     * @returns {Function} - Função throttled
     */
    throttle(func, delay = null, options = {}) {
        delay = delay || this.config.defaultThrottleDelay;
        
        const {
            leading = true,
            trailing = true,
            cache = this.config.enableCaching,
            context = 'default'
        } = options;

        const functionKey = this.generateFunctionKey(func, context);
        
        if (this.throttledFunctions.has(functionKey)) {
            const existing = this.throttledFunctions.get(functionKey);
            if (existing.delay === delay && 
                existing.leading === leading && 
                existing.trailing === trailing) {
                return existing.throttledFunction;
            }
        }

        let lastCallTime;
        let lastInvokeTime = 0;
        let timerId;
        let lastArgs;
        let lastThis;
        let result;

        const throttledFunction = function(...args) {
            const currentTime = Date.now();
            lastArgs = args;
            lastThis = this;
            lastCallTime = currentTime;

            this.metrics.throttleCalls++;

            // Verifica cache se habilitado
            if (cache) {
                const cacheKey = this.generateCacheKey(func, args, context);
                const cachedResult = this.getFromCache(cacheKey);
                if (cachedResult !== null) {
                    this.metrics.cacheHits++;
                    return cachedResult;
                }
                this.metrics.cacheMisses++;
            }

            const isInvoking = this.shouldInvokeThrottle(currentTime, lastInvokeTime, delay, leading, trailing);

            if (isInvoking) {
                result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                lastInvokeTime = currentTime;
                this.metrics.throttleExecutions++;
                
                return result;
            }

            if (!timerId && trailing) {
                timerId = setTimeout(() => {
                    lastInvokeTime = leading ? 0 : Date.now();
                    timerId = null;
                    result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                    this.metrics.throttleExecutions++;
                }, delay - (currentTime - lastInvokeTime));
                
                this.metrics.timersCreated++;
            }

            return result;
        }.bind(this);

        // Adiciona métodos de controle
        throttledFunction.cancel = () => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
                this.metrics.timersCancelled++;
            }
            lastCallTime = null;
            lastInvokeTime = 0;
        };

        throttledFunction.flush = () => {
            if (timerId) {
                throttledFunction.cancel();
                if (lastArgs) {
                    result = this.invokeFunction(func, lastThis, lastArgs, cache, context);
                    this.metrics.throttleExecutions++;
                }
            }
            return result;
        };

        // Armazena função throttled
        this.throttledFunctions.set(functionKey, {
            throttledFunction,
            delay,
            leading,
            trailing,
            context
        });

        return throttledFunction;
    }

    /**
     * Debounce assíncrono com suporte a Promise
     * @param {Function} asyncFunc - Função assíncrona
     * @param {number} delay - Delay em milissegundos
     * @param {Object} options - Opções
     * @returns {Function} - Função debounced assíncrona
     */
    debounceAsync(asyncFunc, delay = null, options = {}) {
        delay = delay || this.config.defaultDelay;
        
        const {
            cache = this.config.enableCaching,
            context = 'async_default',
            cancelPrevious = true
        } = options;

        let currentPromise = null;
        let cancelCurrentPromise = null;

        const debouncedAsyncFunction = this.debounce(async (...args) => {
            // Cancela promise anterior se configurado
            if (cancelPrevious && cancelCurrentPromise) {
                cancelCurrentPromise();
            }

            // Cria nova promise cancelável
            return new Promise(async (resolve, reject) => {
                cancelCurrentPromise = () => {
                    reject(new Error('Operação cancelada por nova chamada'));
                };

                try {
                    const result = await asyncFunc(...args);
                    
                    // Armazena em cache se habilitado
                    if (cache) {
                        const cacheKey = this.generateCacheKey(asyncFunc, args, context);
                        this.setCache(cacheKey, result);
                    }
                    
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    cancelCurrentPromise = null;
                }
            });
        }, delay, { ...options, cache: false }); // Desabilita cache do debounce para controlar manualmente

        return debouncedAsyncFunction;
    }

    /**
     * Agrupa operações similares para execução em lote
     * @param {string} groupKey - Chave do grupo
     * @param {Function} operation - Operação para agrupar
     * @param {any} data - Dados da operação
     * @param {Object} options - Opções de agrupamento
     * @returns {Promise} - Promise que resolve quando o grupo é processado
     */
    group(groupKey, operation, data, options = {}) {
        if (!this.config.enableGrouping) {
            return operation([data]);
        }

        const {
            maxSize = this.config.maxGroupSize,
            window = this.config.groupingWindow,
            context = 'default'
        } = options;

        const fullGroupKey = `${context}_${groupKey}`;

        return new Promise((resolve, reject) => {
            let group = this.groups.get(fullGroupKey);
            
            if (!group) {
                group = {
                    items: [],
                    promises: [],
                    timer: null,
                    operation,
                    options,
                    createdAt: Date.now()
                };
                this.groups.set(fullGroupKey, group);
            }

            // Adiciona item ao grupo
            group.items.push(data);
            group.promises.push({ resolve, reject });

            // Executa grupo se atingiu tamanho máximo
            if (group.items.length >= maxSize) {
                this.executeGroup(fullGroupKey);
                return;
            }

            // Configura timer se não existe
            if (!group.timer) {
                group.timer = setTimeout(() => {
                    this.executeGroup(fullGroupKey);
                }, window);
                
                this.metrics.timersCreated++;
            }
        });
    }

    /**
     * Executa grupo de operações
     * @param {string} groupKey - Chave do grupo
     */
    async executeGroup(groupKey) {
        const group = this.groups.get(groupKey);
        if (!group) return;

        // Remove grupo da lista
        this.groups.delete(groupKey);

        // Cancela timer se existe
        if (group.timer) {
            clearTimeout(group.timer);
            this.metrics.timersCancelled++;
        }

        try {
            const result = await group.operation(group.items);
            this.metrics.groupedOperations++;
            
            // Resolve todas as promises com o resultado
            group.promises.forEach(({ resolve }) => {
                resolve(result);
            });

        } catch (error) {
            // Rejeita todas as promises com o erro
            group.promises.forEach(({ reject }) => {
                reject(error);
            });
        }
    }

    /**
     * Determina se função deve ser invocada (debounce)
     * @param {number} time - Tempo atual
     * @param {number} lastInvokeTime - Último tempo de invocação
     * @param {number} delay - Delay configurado
     * @param {number} maxWait - Tempo máximo de espera
     * @param {boolean} leading - Se deve invocar no início
     * @param {boolean} trailing - Se deve invocar no final
     * @returns {boolean} - Se deve invocar
     */
    shouldInvoke(time, lastInvokeTime, delay, maxWait, leading, trailing) {
        const timeSinceLastCall = time - (lastInvokeTime || 0);
        
        return (
            (leading && lastInvokeTime === 0) ||
            (maxWait && timeSinceLastCall >= maxWait) ||
            (trailing && timeSinceLastCall >= delay)
        );
    }

    /**
     * Determina se função deve ser invocada (throttle)
     * @param {number} time - Tempo atual
     * @param {number} lastInvokeTime - Último tempo de invocação
     * @param {number} delay - Delay configurado
     * @param {boolean} leading - Se deve invocar no início
     * @param {boolean} trailing - Se deve invocar no final
     * @returns {boolean} - Se deve invocar
     */
    shouldInvokeThrottle(time, lastInvokeTime, delay, leading, trailing) {
        const timeSinceLastInvoke = time - lastInvokeTime;
        
        return (
            (leading && lastInvokeTime === 0) ||
            timeSinceLastInvoke >= delay
        );
    }

    /**
     * Invoca função e gerencia cache
     * @param {Function} func - Função para invocar
     * @param {any} context - Contexto (this)
     * @param {Array} args - Argumentos
     * @param {boolean} useCache - Se deve usar cache
     * @param {string} cacheContext - Contexto do cache
     * @returns {any} - Resultado da função
     */
    invokeFunction(func, context, args, useCache, cacheContext) {
        const result = func.apply(context, args);
        
        // Armazena em cache se habilitado
        if (useCache && this.config.enableCaching) {
            const cacheKey = this.generateCacheKey(func, args, cacheContext);
            this.setCache(cacheKey, result);
        }

        return result;
    }

    /**
     * Gera chave única para função
     * @param {Function} func - Função
     * @param {string} context - Contexto
     * @returns {string} - Chave da função
     */
    generateFunctionKey(func, context) {
        const funcStr = func.toString();
        const funcHash = this.simpleHash(funcStr);
        return `${context}_${funcHash}`;
    }

    /**
     * Gera chave de cache
     * @param {Function} func - Função
     * @param {Array} args - Argumentos
     * @param {string} context - Contexto
     * @returns {string} - Chave do cache
     */
    generateCacheKey(func, args, context) {
        const funcKey = this.generateFunctionKey(func, context);
        const argsStr = JSON.stringify(args);
        const argsHash = this.simpleHash(argsStr);
        return `${funcKey}_${argsHash}`;
    }

    /**
     * Hash simples para geração de chaves
     * @param {string} str - String para hash
     * @returns {string} - Hash gerado
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converte para 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Obtém item do cache
     * @param {string} key - Chave do cache
     * @returns {any} - Item do cache ou null
     */
    getFromCache(key) {
        if (!this.config.enableCaching) return null;

        const cached = this.cache.get(key);
        if (!cached) return null;

        // Verifica expiração
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return cached.value;
    }

    /**
     * Define item no cache
     * @param {string} key - Chave do cache
     * @param {any} value - Valor para cachear
     */
    setCache(key, value) {
        if (!this.config.enableCaching) return;

        // Limita tamanho do cache
        if (this.cache.size >= this.config.maxCacheSize) {
            this.cleanOldestCache();
        }

        this.cache.set(key, {
            value,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.cacheTimeout
        });
    }

    /**
     * Limpa cache expirado
     */
    cleanExpiredCache() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiresAt) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        if (this.config.enableDetailedTracking && keysToDelete.length > 0) {
            this.logger.debug('DebounceManager: Cache limpo', {
                expiredItems: keysToDelete.length,
                remainingItems: this.cache.size
            });
        }
    }

    /**
     * Limpa itens mais antigos do cache
     */
    cleanOldestCache() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
        
        const removeCount = Math.floor(this.config.maxCacheSize * 0.25);
        for (let i = 0; i < removeCount && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
        }
    }

    /**
     * Cancela todas as operações pendentes
     */
    cancelAll() {
        // Cancela funções debounced
        for (const [, debounced] of this.debouncedFunctions.entries()) {
            if (debounced.debouncedFunction.cancel) {
                debounced.debouncedFunction.cancel();
            }
        }

        // Cancela funções throttled
        for (const [, throttled] of this.throttledFunctions.entries()) {
            if (throttled.throttledFunction.cancel) {
                throttled.throttledFunction.cancel();
            }
        }

        // Cancela grupos pendentes
        for (const [groupKey] of this.groups.entries()) {
            this.executeGroup(groupKey);
        }

        this.logger.info('DebounceManager: Todas as operações pendentes foram canceladas');
    }

    /**
     * Obtém estatísticas do debounce manager
     * @returns {Object} - Estatísticas
     */
    getStats() {
        const efficiencyRate = this.metrics.debounceCalls > 0 
            ? (1 - (this.metrics.debounceExecutions / this.metrics.debounceCalls)) * 100
            : 0;

        const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
            ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
            : 0;

        return {
            metrics: { ...this.metrics },
            efficiency: {
                debounceEfficiencyRate: `${efficiencyRate.toFixed(2)}%`,
                cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
                activeTimers: this.timers.size,
                activeFunctions: this.debouncedFunctions.size + this.throttledFunctions.size,
                activeGroups: this.groups.size,
                cacheSize: this.cache.size
            },
            config: {
                defaultDelay: this.config.defaultDelay,
                enableCaching: this.config.enableCaching,
                enableGrouping: this.config.enableGrouping,
                maxCacheSize: this.config.maxCacheSize
            }
        };
    }

    /**
     * Limpa cache manualmente
     */
    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        
        this.logger.info('DebounceManager: Cache limpo manualmente', {
            clearedItems: size
        });
    }

    /**
     * Reset de métricas
     */
    resetMetrics() {
        this.metrics = {
            debounceCalls: 0,
            debounceExecutions: 0,
            throttleCalls: 0,
            throttleExecutions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            groupedOperations: 0,
            timersCreated: 0,
            timersCancelled: 0
        };

        this.logger.info('DebounceManager: Métricas resetadas');
    }

    /**
     * Destrói o gerenciador e limpa recursos
     */
    destroy() {
        // Cancela todas as operações
        this.cancelAll();

        // Limpa cache cleanup interval
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
            this.cacheCleanupInterval = null;
        }

        // Limpa dados
        this.debouncedFunctions.clear();
        this.throttledFunctions.clear();
        this.cache.clear();
        this.groups.clear();
        this.timers.clear();

        this.logger.info('DebounceManager: Gerenciador destruído');
    }
}

/**
 * Gerenciador estático global para uso direto
 */
export const GlobalDebounceManager = new DebounceManager({
    defaultDelay: 300,
    defaultThrottleDelay: 100,
    enableCaching: true,
    enableGrouping: true
});

/**
 * Funções utilitárias para debounce/throttle rápido
 */
export const DebounceUtils = {
    /**
     * Debounce simples
     */
    debounce: (func, delay, options) => GlobalDebounceManager.debounce(func, delay, options),
    
    /**
     * Throttle simples
     */
    throttle: (func, delay, options) => GlobalDebounceManager.throttle(func, delay, options),
    
    /**
     * Debounce assíncrono
     */
    debounceAsync: (func, delay, options) => GlobalDebounceManager.debounceAsync(func, delay, options),
    
    /**
     * Agrupamento de operações
     */
    group: (key, operation, data, options) => GlobalDebounceManager.group(key, operation, data, options),
    
    /**
     * Cancela todas as operações
     */
    cancelAll: () => GlobalDebounceManager.cancelAll(),
    
    /**
     * Obtém estatísticas globais
     */
    getStats: () => GlobalDebounceManager.getStats(),
    
    /**
     * Cria novo gerenciador
     */
    createManager: (config) => new DebounceManager(config)
};

/**
 * Decorador para debounce automático
 * @param {number} delay - Delay em milissegundos
 * @param {Object} options - Opções de debounce
 * @returns {Function} - Decorador
 */
export function debounced(delay = 300, options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = GlobalDebounceManager.debounce(originalMethod, delay, options);
        return descriptor;
    };
}

/**
 * Decorador para throttle automático
 * @param {number} delay - Delay em milissegundos
 * @param {Object} options - Opções de throttle
 * @returns {Function} - Decorador
 */
export function throttled(delay = 100, options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = GlobalDebounceManager.throttle(originalMethod, delay, options);
        return descriptor;
    };
}

export default DebounceManager;
