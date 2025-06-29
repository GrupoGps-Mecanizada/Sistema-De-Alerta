/**
 * hash.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Utilitário para geração de hashes únicos e identificação de objetos
 * Usado para deduplicação de alertas, identificação de regras e cache
 * 
 * Funcionalidades:
 * - Geração de hashes SHA-256 e MD5 simples
 * - Hashes específicos para alertas, regras e equipamentos
 * - Identificadores únicos com timestamp
 * - Normalização de dados para hash consistente
 * - Validação de integridade de dados
 */

export class HashGenerator {
    constructor(config = {}) {
        this.config = {
            // Configurações de hash
            defaultAlgorithm: config.defaultAlgorithm || 'simple',
            includeSalt: config.includeSalt !== false,
            saltLength: config.saltLength || 8,
            
            // Configurações de normalização
            normalizeStrings: config.normalizeStrings !== false,
            ignoreCase: config.ignoreCase !== false,
            trimWhitespace: config.trimWhitespace !== false,
            
            // Configurações de performance
            enableCaching: config.enableCaching !== false,
            maxCacheSize: config.maxCacheSize || 1000,
            
            ...config
        };

        // Cache interno para otimização
        this.hashCache = new Map();
        this.saltCache = new Map();
        
        // Contador para IDs únicos
        this.uniqueCounter = 0;
        
        // Logger
        this.logger = config.logger || console;
    }

    /**
     * Gera hash simples baseado em string
     * @param {string} input - String para gerar hash
     * @returns {string} - Hash gerado
     */
    simpleHash(input) {
        if (typeof input !== 'string') {
            input = String(input);
        }

        let hash = 0;
        if (input.length === 0) return hash.toString();

        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converte para 32-bit integer
        }

        return Math.abs(hash).toString(16);
    }

    /**
     * Gera hash mais complexo usando algoritmo djb2
     * @param {string} input - String para gerar hash
     * @returns {string} - Hash gerado
     */
    djb2Hash(input) {
        if (typeof input !== 'string') {
            input = String(input);
        }

        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) + input.charCodeAt(i);
        }

        return Math.abs(hash).toString(16);
    }

    /**
     * Gera hash usando Web Crypto API (mais seguro)
     * @param {string} input - String para gerar hash
     * @returns {Promise<string>} - Hash SHA-256
     */
    async cryptoHash(input) {
        if (typeof input !== 'string') {
            input = String(input);
        }

        if (typeof crypto === 'undefined' || !crypto.subtle) {
            // Fallback para ambientes sem Web Crypto API
            return this.djb2Hash(input);
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            this.logger.warn('HashGenerator: Crypto API falhou, usando fallback', {
                error: error.message
            });
            return this.djb2Hash(input);
        }
    }

    /**
     * Normaliza dados para hash consistente
     * @param {any} data - Dados para normalizar
     * @returns {string} - String normalizada
     */
    normalizeData(data) {
        if (data === null || data === undefined) {
            return '';
        }

        if (typeof data === 'string') {
            let normalized = data;
            
            if (this.config.trimWhitespace) {
                normalized = normalized.trim();
            }
            
            if (this.config.ignoreCase) {
                normalized = normalized.toLowerCase();
            }
            
            if (this.config.normalizeStrings) {
                // Remove acentos e caracteres especiais
                normalized = normalized
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^\w\s-]/gi, '');
            }
            
            return normalized;
        }

        if (typeof data === 'object') {
            if (Array.isArray(data)) {
                return data
                    .map(item => this.normalizeData(item))
                    .sort()
                    .join('|');
            } else {
                const keys = Object.keys(data).sort();
                return keys
                    .map(key => `${key}:${this.normalizeData(data[key])}`)
                    .join('|');
            }
        }

        return String(data);
    }

    /**
     * Gera hash específico para alertas
     * @param {Object} alert - Objeto de alerta
     * @returns {string} - Hash único do alerta
     */
    alertHash(alert) {
        const cacheKey = `alert_${JSON.stringify(alert)}`;
        
        if (this.config.enableCaching && this.hashCache.has(cacheKey)) {
            return this.hashCache.get(cacheKey);
        }

        try {
            const keyData = {
                equipamento: this.normalizeData(alert.equipamento),
                eventType: this.normalizeData(alert.eventType),
                message: this.normalizeData(alert.message),
                ruleId: this.normalizeData(alert.ruleId),
                severity: this.normalizeData(alert.severity),
                // Inclui timestamp truncado para evitar duplicações próximas
                timeWindow: alert.timestamp ? Math.floor(alert.timestamp / 60000) : 0
            };

            const normalized = this.normalizeData(keyData);
            const hash = this.djb2Hash(normalized);

            if (this.config.enableCaching) {
                this.manageCacheSize();
                this.hashCache.set(cacheKey, hash);
            }

            return hash;

        } catch (error) {
            this.logger.error('HashGenerator: Erro ao gerar hash de alerta', {
                error: error.message,
                alert: alert
            });
            
            // Fallback simples
            return this.simpleHash(`${alert.equipamento || 'unknown'}_${Date.now()}`);
        }
    }

    /**
     * Gera hash específico para regras
     * @param {Object} rule - Objeto de regra
     * @returns {string} - Hash único da regra
     */
    ruleHash(rule) {
        const cacheKey = `rule_${JSON.stringify(rule)}`;
        
        if (this.config.enableCaching && this.hashCache.has(cacheKey)) {
            return this.hashCache.get(cacheKey);
        }

        try {
            const keyData = {
                name: this.normalizeData(rule.name),
                conditions: this.normalizeData(rule.conditions),
                equipmentGroups: Array.isArray(rule.equipmentGroups) 
                    ? rule.equipmentGroups.sort().join(',')
                    : this.normalizeData(rule.equipmentGroups),
                severity: this.normalizeData(rule.severity),
                type: this.normalizeData(rule.type || 'simple')
            };

            const normalized = this.normalizeData(keyData);
            const hash = this.djb2Hash(normalized);

            if (this.config.enableCaching) {
                this.manageCacheSize();
                this.hashCache.set(cacheKey, hash);
            }

            return hash;

        } catch (error) {
            this.logger.error('HashGenerator: Erro ao gerar hash de regra', {
                error: error.message,
                rule: rule
            });
            
            // Fallback simples
            return this.simpleHash(`${rule.name || 'unknown'}_${Date.now()}`);
        }
    }

    /**
     * Gera hash específico para equipamentos
     * @param {Object} equipment - Objeto de equipamento
     * @returns {string} - Hash único do equipamento
     */
    equipmentHash(equipment) {
        const cacheKey = `equipment_${JSON.stringify(equipment)}`;
        
        if (this.config.enableCaching && this.hashCache.has(cacheKey)) {
            return this.hashCache.get(cacheKey);
        }

        try {
            const keyData = {
                name: this.normalizeData(equipment.name || equipment.equipamento),
                groups: Array.isArray(equipment.groups) 
                    ? equipment.groups.sort().join(',')
                    : this.normalizeData(equipment.groups),
                type: this.normalizeData(equipment.type),
                id: this.normalizeData(equipment.id)
            };

            const normalized = this.normalizeData(keyData);
            const hash = this.djb2Hash(normalized);

            if (this.config.enableCaching) {
                this.manageCacheSize();
                this.hashCache.set(cacheKey, hash);
            }

            return hash;

        } catch (error) {
            this.logger.error('HashGenerator: Erro ao gerar hash de equipamento', {
                error: error.message,
                equipment: equipment
            });
            
            // Fallback simples
            const name = equipment.name || equipment.equipamento || 'unknown';
            return this.simpleHash(`${name}_${Date.now()}`);
        }
    }

    /**
     * Gera ID único com timestamp
     * @param {string} prefix - Prefixo para o ID
     * @returns {string} - ID único
     */
    uniqueId(prefix = 'id') {
        const timestamp = Date.now();
        const counter = ++this.uniqueCounter;
        const random = Math.random().toString(36).substr(2, 5);
        
        return `${prefix}_${timestamp}_${counter}_${random}`;
    }

    /**
     * Gera hash de integridade para conjunto de dados
     * @param {Array|Object} data - Dados para verificar integridade
     * @returns {string} - Hash de integridade
     */
    integrityHash(data) {
        try {
            let normalized;
            
            if (Array.isArray(data)) {
                // Para arrays, ordena por hash individual
                normalized = data
                    .map(item => this.normalizeData(item))
                    .sort()
                    .join('||');
            } else {
                normalized = this.normalizeData(data);
            }

            return this.djb2Hash(normalized);

        } catch (error) {
            this.logger.error('HashGenerator: Erro ao gerar hash de integridade', {
                error: error.message
            });
            
            return this.simpleHash(String(Date.now()));
        }
    }

    /**
     * Verifica integridade de dados usando hash
     * @param {any} data - Dados para verificar
     * @param {string} expectedHash - Hash esperado
     * @returns {boolean} - Se os dados são íntegros
     */
    verifyIntegrity(data, expectedHash) {
        try {
            const currentHash = this.integrityHash(data);
            return currentHash === expectedHash;
        } catch (error) {
            this.logger.error('HashGenerator: Erro na verificação de integridade', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Gera salt aleatório
     * @param {number} length - Comprimento do salt
     * @returns {string} - Salt gerado
     */
    generateSalt(length = null) {
        length = length || this.config.saltLength;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    }

    /**
     * Gera hash com salt
     * @param {string} input - String para hash
     * @param {string} salt - Salt (opcional, gera automaticamente se não fornecido)
     * @returns {Object} - {hash, salt}
     */
    saltedHash(input, salt = null) {
        if (!salt) {
            salt = this.generateSalt();
        }

        const saltedInput = `${salt}${input}${salt}`;
        const hash = this.djb2Hash(saltedInput);

        return { hash, salt };
    }

    /**
     * Verifica hash com salt
     * @param {string} input - String original
     * @param {string} hash - Hash para verificar
     * @param {string} salt - Salt usado
     * @returns {boolean} - Se o hash é válido
     */
    verifySaltedHash(input, hash, salt) {
        try {
            const { hash: newHash } = this.saltedHash(input, salt);
            return newHash === hash;
        } catch (error) {
            this.logger.error('HashGenerator: Erro na verificação de hash com salt', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Gerencia tamanho do cache
     */
    manageCacheSize() {
        if (this.hashCache.size >= this.config.maxCacheSize) {
            // Remove 25% dos itens mais antigos
            const keysToRemove = Array.from(this.hashCache.keys())
                .slice(0, Math.floor(this.config.maxCacheSize * 0.25));
            
            keysToRemove.forEach(key => this.hashCache.delete(key));
            
            this.logger.debug('HashGenerator: Cache limpo', {
                removedItems: keysToRemove.length,
                remainingItems: this.hashCache.size
            });
        }
    }

    /**
     * Limpa cache de hashes
     */
    clearCache() {
        const size = this.hashCache.size;
        this.hashCache.clear();
        this.saltCache.clear();
        
        this.logger.info('HashGenerator: Cache limpo completamente', {
            clearedItems: size
        });
    }

    /**
     * Retorna estatísticas do gerador de hash
     * @returns {Object} - Estatísticas
     */
    getStats() {
        return {
            cacheSize: this.hashCache.size,
            maxCacheSize: this.config.maxCacheSize,
            uniqueCounter: this.uniqueCounter,
            algorithm: this.config.defaultAlgorithm,
            config: {
                enableCaching: this.config.enableCaching,
                normalizeStrings: this.config.normalizeStrings,
                ignoreCase: this.config.ignoreCase
            }
        };
    }

    /**
     * Destrói o gerador e limpa recursos
     */
    destroy() {
        this.clearCache();
        this.uniqueCounter = 0;
        
        this.logger.info('HashGenerator: Recursos destruídos');
    }
}

/**
 * Funções utilitárias estáticas para uso direto
 */
export const HashUtils = {
    /**
     * Gera hash simples de uma string
     * @param {string} input - String para hash
     * @returns {string} - Hash gerado
     */
    quick(input) {
        const generator = new HashGenerator({ enableCaching: false });
        return generator.simpleHash(input);
    },

    /**
     * Gera hash de alerta
     * @param {Object} alert - Alerta
     * @returns {string} - Hash do alerta
     */
    alert(alert) {
        const generator = new HashGenerator({ enableCaching: false });
        return generator.alertHash(alert);
    },

    /**
     * Gera hash de regra
     * @param {Object} rule - Regra
     * @returns {string} - Hash da regra
     */
    rule(rule) {
        const generator = new HashGenerator({ enableCaching: false });
        return generator.ruleHash(rule);
    },

    /**
     * Gera ID único
     * @param {string} prefix - Prefixo
     * @returns {string} - ID único
     */
    uniqueId(prefix = 'id') {
        const generator = new HashGenerator({ enableCaching: false });
        return generator.uniqueId(prefix);
    },

    /**
     * Verifica integridade de dados
     * @param {any} data - Dados
     * @param {string} expectedHash - Hash esperado
     * @returns {boolean} - Se é íntegro
     */
    verify(data, expectedHash) {
        const generator = new HashGenerator({ enableCaching: false });
        return generator.verifyIntegrity(data, expectedHash);
    }
};

export default HashGenerator;
