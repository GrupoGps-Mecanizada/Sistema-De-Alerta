/**
 * logger.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Sistema de logging estruturado centralizado
 * Usado por todos os módulos do sistema para rastreamento e depuração
 * 
 * Funcionalidades:
 * - Logging estruturado com níveis configuráveis
 * - Múltiplos outputs (console, localStorage, callback)
 * - Filtragem por módulo e nível
 * - Formatação automática de objetos e errors
 * - Buffer circular para histórico
 * - Exportação de logs
 * - Integração com sistema de performance
 */

export class Logger {
    constructor(module = 'System', config = {}) {
        this.module = module;
        this.config = {
            // Configurações de nível
            level: config.level || 'info',
            enableConsole: config.enableConsole !== false,
            enableStorage: config.enableStorage !== false,
            enableBuffer: config.enableBuffer !== false,
            
            // Configurações de buffer
            maxBufferSize: config.maxBufferSize || 1000,
            autoFlush: config.autoFlush !== false,
            flushInterval: config.flushInterval || 30000, // 30 segundos
            
            // Configurações de formato
            includeTimestamp: config.includeTimestamp !== false,
            includeModule: config.includeModule !== false,
            includeLevel: config.includeLevel !== false,
            prettyPrint: config.prettyPrint !== false,
            
            // Configurações de storage
            storageKey: config.storageKey || 'grupogps_logs',
            maxStorageSize: config.maxStorageSize || 10000,
            
            // Callbacks
            onLog: config.onLog || null,
            onError: config.onError || null,
            
            ...config
        };

        // Níveis de log em ordem de prioridade
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4
        };

        // Buffer circular para logs recentes
        this.logBuffer = [];
        this.bufferIndex = 0;
        
        // Estatísticas
        this.stats = {
            totalLogs: 0,
            logsByLevel: {},
            logsByModule: {},
            errors: 0,
            startTime: Date.now()
        };

        // Timer para flush automático
        if (this.config.autoFlush && this.config.enableStorage) {
            this.flushTimer = setInterval(() => {
                this.flushToStorage();
            }, this.config.flushInterval);
        }

        // Inicializa estatísticas
        Object.keys(this.levels).forEach(level => {
            this.stats.logsByLevel[level] = 0;
        });

        // Log de inicialização
        this.info('Logger inicializado', {
            module: this.module,
            config: this.config,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Verifica se o nível deve ser logado
     * @param {string} level - Nível do log
     * @returns {boolean} - Se deve logar
     */
    shouldLog(level) {
        const currentLevel = this.levels[this.config.level] || 1;
        const logLevel = this.levels[level] || 1;
        return logLevel >= currentLevel;
    }

    /**
     * Formata uma entrada de log
     * @param {string} level - Nível do log
     * @param {string} message - Mensagem
     * @param {Object} metadata - Dados adicionais
     * @returns {Object} - Entrada formatada
     */
    formatLogEntry(level, message, metadata = {}) {
        const timestamp = new Date();
        const entry = {
            level: level.toUpperCase(),
            message,
            timestamp: timestamp.toISOString(),
            unixTimestamp: timestamp.getTime(),
            module: this.module
        };

        // Adiciona metadados se fornecidos
        if (metadata && Object.keys(metadata).length > 0) {
            entry.metadata = this.sanitizeMetadata(metadata);
        }

        return entry;
    }

    /**
     * Sanitiza metadados para logging
     * @param {any} metadata - Metadados para sanitizar
     * @returns {any} - Metadados sanitizados
     */
    sanitizeMetadata(metadata) {
        try {
            if (metadata === null || metadata === undefined) {
                return null;
            }

            if (typeof metadata === 'string' || typeof metadata === 'number' || typeof metadata === 'boolean') {
                return metadata;
            }

            if (metadata instanceof Error) {
                return {
                    name: metadata.name,
                    message: metadata.message,
                    stack: metadata.stack,
                    _type: 'Error'
                };
            }

            if (metadata instanceof Date) {
                return {
                    iso: metadata.toISOString(),
                    unix: metadata.getTime(),
                    _type: 'Date'
                };
            }

            if (Array.isArray(metadata)) {
                return metadata.map(item => this.sanitizeMetadata(item));
            }

            if (typeof metadata === 'object') {
                const sanitized = {};
                for (const [key, value] of Object.entries(metadata)) {
                    // Evita referências circulares
                    if (key === 'logger' || key === 'parent' || key === 'config') {
                        continue;
                    }
                    
                    sanitized[key] = this.sanitizeMetadata(value);
                }
                return sanitized;
            }

            return String(metadata);

        } catch (error) {
            return { _error: 'Falha na sanitização', _original: String(metadata) };
        }
    }

    /**
     * Adiciona entrada ao buffer
     * @param {Object} entry - Entrada de log
     */
    addToBuffer(entry) {
        if (!this.config.enableBuffer) return;

        if (this.logBuffer.length < this.config.maxBufferSize) {
            this.logBuffer.push(entry);
        } else {
            // Buffer circular - substitui o mais antigo
            this.logBuffer[this.bufferIndex] = entry;
            this.bufferIndex = (this.bufferIndex + 1) % this.config.maxBufferSize;
        }
    }

    /**
     * Envia para console se habilitado
     * @param {string} level - Nível do log
     * @param {Object} entry - Entrada formatada
     */
    logToConsole(level, entry) {
        if (!this.config.enableConsole) return;

        try {
            const consoleMethod = console[level] || console.log;
            
            if (this.config.prettyPrint) {
                // Formato estruturado para desenvolvimento
                const parts = [];
                
                if (this.config.includeTimestamp) {
                    parts.push(`[${new Date(entry.timestamp).toLocaleTimeString()}]`);
                }
                
                if (this.config.includeLevel) {
                    parts.push(`[${entry.level}]`);
                }
                
                if (this.config.includeModule) {
                    parts.push(`[${entry.module}]`);
                }
                
                parts.push(entry.message);
                
                consoleMethod(parts.join(' '), entry.metadata || '');
                
            } else {
                // Formato JSON para produção
                consoleMethod(JSON.stringify(entry));
            }

        } catch (error) {
            // Fallback para console.log básico
            console.log(`[${level.toUpperCase()}] ${this.module}: ${entry.message}`);
        }
    }

    /**
     * Atualiza estatísticas
     * @param {string} level - Nível do log
     */
    updateStats(level) {
        this.stats.totalLogs++;
        this.stats.logsByLevel[level] = (this.stats.logsByLevel[level] || 0) + 1;
        this.stats.logsByModule[this.module] = (this.stats.logsByModule[this.module] || 0) + 1;
        
        if (level === 'error' || level === 'critical') {
            this.stats.errors++;
        }
    }

    /**
     * Executa callback personalizado se configurado
     * @param {string} level - Nível do log
     * @param {Object} entry - Entrada de log
     */
    executeCallback(level, entry) {
        try {
            if (this.config.onLog && typeof this.config.onLog === 'function') {
                this.config.onLog(level, entry, this.module);
            }

            if ((level === 'error' || level === 'critical') && 
                this.config.onError && typeof this.config.onError === 'function') {
                this.config.onError(entry, this.module);
            }

        } catch (error) {
            // Evita loops infinitos em callbacks com erro
            console.error('Logger: Erro em callback personalizado', error);
        }
    }

    /**
     * Método principal de logging
     * @param {string} level - Nível do log
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    log(level, message, metadata = {}) {
        if (!this.shouldLog(level)) return;

        try {
            const entry = this.formatLogEntry(level, message, metadata);
            
            // Adiciona ao buffer
            this.addToBuffer(entry);
            
            // Log para console
            this.logToConsole(level, entry);
            
            // Atualiza estatísticas
            this.updateStats(level);
            
            // Executa callbacks
            this.executeCallback(level, entry);

        } catch (error) {
            // Fallback para erro no sistema de log
            console.error('Logger: Erro interno no sistema de log', {
                error: error.message,
                level,
                message,
                module: this.module
            });
        }
    }

    /**
     * Log nível debug
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    debug(message, metadata = {}) {
        this.log('debug', message, metadata);
    }

    /**
     * Log nível info
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    info(message, metadata = {}) {
        this.log('info', message, metadata);
    }

    /**
     * Log nível warn
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    warn(message, metadata = {}) {
        this.log('warn', message, metadata);
    }

    /**
     * Log nível error
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    error(message, metadata = {}) {
        this.log('error', message, metadata);
    }

    /**
     * Log nível critical
     * @param {string} message - Mensagem
     * @param {Object} metadata - Metadados opcionais
     */
    critical(message, metadata = {}) {
        this.log('critical', message, metadata);
    }

    /**
     * Flush dos logs para localStorage
     */
    flushToStorage() {
        if (!this.config.enableStorage || typeof localStorage === 'undefined') {
            return;
        }

        try {
            const storageKey = this.config.storageKey;
            const existingLogs = this.getStoredLogs();
            const newLogs = [...existingLogs, ...this.logBuffer];
            
            // Limita o tamanho do storage
            const trimmedLogs = newLogs.slice(-this.config.maxStorageSize);
            
            localStorage.setItem(storageKey, JSON.stringify(trimmedLogs));
            
            // Limpa buffer após flush
            this.logBuffer = [];
            this.bufferIndex = 0;

        } catch (error) {
            console.error('Logger: Erro ao fazer flush para storage', error);
        }
    }

    /**
     * Recupera logs armazenados
     * @returns {Array} - Array de logs
     */
    getStoredLogs() {
        if (!this.config.enableStorage || typeof localStorage === 'undefined') {
            return [];
        }

        try {
            const stored = localStorage.getItem(this.config.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Logger: Erro ao recuperar logs do storage', error);
            return [];
        }
    }

    /**
     * Obtém logs recentes do buffer
     * @param {number} count - Número de logs para retornar
     * @returns {Array} - Array de logs recentes
     */
    getRecentLogs(count = 50) {
        const recent = this.logBuffer.slice(-count);
        return recent.sort((a, b) => b.unixTimestamp - a.unixTimestamp);
    }

    /**
     * Filtra logs por critérios
     * @param {Object} filters - Filtros a aplicar
     * @returns {Array} - Logs filtrados
     */
    filterLogs(filters = {}) {
        const allLogs = [...this.getStoredLogs(), ...this.logBuffer];
        
        return allLogs.filter(entry => {
            // Filtro por nível
            if (filters.level && entry.level !== filters.level.toUpperCase()) {
                return false;
            }
            
            // Filtro por módulo
            if (filters.module && entry.module !== filters.module) {
                return false;
            }
            
            // Filtro por período
            if (filters.startTime && entry.unixTimestamp < filters.startTime) {
                return false;
            }
            
            if (filters.endTime && entry.unixTimestamp > filters.endTime) {
                return false;
            }
            
            // Filtro por texto na mensagem
            if (filters.search && !entry.message.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
            }
            
            return true;
        }).sort((a, b) => b.unixTimestamp - a.unixTimestamp);
    }

    /**
     * Exporta logs em formato específico
     * @param {string} format - Formato ('json', 'csv', 'txt')
     * @param {Object} filters - Filtros para aplicar
     * @returns {string} - Logs formatados
     */
    exportLogs(format = 'json', filters = {}) {
        const logs = this.filterLogs(filters);
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(logs, null, 2);
                
            case 'csv':
                if (logs.length === 0) return 'timestamp,level,module,message,metadata\n';
                
                const csvLines = ['timestamp,level,module,message,metadata'];
                logs.forEach(log => {
                    const metadata = log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '';
                    const message = log.message.replace(/"/g, '""');
                    csvLines.push(`"${log.timestamp}","${log.level}","${log.module}","${message}","${metadata}"`);
                });
                return csvLines.join('\n');
                
            case 'txt':
                return logs.map(log => {
                    const timestamp = new Date(log.timestamp).toLocaleString();
                    const metadata = log.metadata ? ` | ${JSON.stringify(log.metadata)}` : '';
                    return `[${timestamp}] [${log.level}] [${log.module}] ${log.message}${metadata}`;
                }).join('\n');
                
            default:
                return JSON.stringify(logs, null, 2);
        }
    }

    /**
     * Limpa logs armazenados
     */
    clearStoredLogs() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.config.storageKey);
        }
        this.logBuffer = [];
        this.bufferIndex = 0;
        
        this.info('Logs armazenados limpos');
    }

    /**
     * Obtém estatísticas do logger
     * @returns {Object} - Estatísticas
     */
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        
        return {
            ...this.stats,
            uptime,
            uptimeFormatted: this.formatUptime(uptime),
            bufferSize: this.logBuffer.length,
            maxBufferSize: this.config.maxBufferSize,
            storageSize: this.getStoredLogs().length,
            logsPerMinute: this.stats.totalLogs / (uptime / 60000)
        };
    }

    /**
     * Formata tempo de atividade
     * @param {number} uptime - Tempo em milissegundos
     * @returns {string} - Tempo formatado
     */
    formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Altera nível de log em runtime
     * @param {string} level - Novo nível
     */
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.config.level = level;
            this.info(`Nível de log alterado para: ${level}`);
        } else {
            this.warn(`Nível de log inválido: ${level}`, {
                validLevels: Object.keys(this.levels)
            });
        }
    }

    /**
     * Cria logger filho com prefixo
     * @param {string} childModule - Nome do módulo filho
     * @returns {Logger} - Nova instância de logger
     */
    child(childModule) {
        const fullModule = `${this.module}.${childModule}`;
        return new Logger(fullModule, this.config);
    }

    /**
     * Destrói o logger e limpa recursos
     */
    destroy() {
        // Para timer de flush automático
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        
        // Flush final
        if (this.config.enableStorage) {
            this.flushToStorage();
        }
        
        // Limpa buffers
        this.logBuffer = [];
        this.bufferIndex = 0;
        
        this.info('Logger destruído');
    }
}

/**
 * Logger estático global para uso direto
 */
export const GlobalLogger = new Logger('Global', {
    level: 'info',
    enableConsole: true,
    enableStorage: true,
    enableBuffer: true,
    prettyPrint: true
});

/**
 * Funções utilitárias para logging rápido
 */
export const LogUtils = {
    /**
     * Log de debug global
     */
    debug: (message, metadata) => GlobalLogger.debug(message, metadata),
    
    /**
     * Log de info global
     */
    info: (message, metadata) => GlobalLogger.info(message, metadata),
    
    /**
     * Log de warning global
     */
    warn: (message, metadata) => GlobalLogger.warn(message, metadata),
    
    /**
     * Log de error global
     */
    error: (message, metadata) => GlobalLogger.error(message, metadata),
    
    /**
     * Log de critical global
     */
    critical: (message, metadata) => GlobalLogger.critical(message, metadata),
    
    /**
     * Cria novo logger para módulo específico
     */
    createLogger: (module, config) => new Logger(module, config),
    
    /**
     * Obtém estatísticas globais
     */
    getGlobalStats: () => GlobalLogger.getStats(),
    
    /**
     * Exporta logs globais
     */
    exportGlobalLogs: (format, filters) => GlobalLogger.exportLogs(format, filters)
};

export default Logger;
