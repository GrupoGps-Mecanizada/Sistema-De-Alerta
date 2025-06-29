/**
 * dateParser.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Sistema de parsing e manipulação de datas e timestamps
 * Usado para normalização de datas em diferentes formatos do sistema
 * 
 * Funcionalidades:
 * - Parsing de múltiplos formatos de data
 * - Normalização de timestamps
 * - Cálculos de duração e intervalos
 * - Formatação para diferentes contextos
 * - Validação de datas
 * - Operações de timezone
 * - Períodos e ranges de tempo
 */

export class DateParser {
    constructor(config = {}) {
        this.config = {
            // Configurações de timezone
            defaultTimezone: config.defaultTimezone || 'America/Sao_Paulo',
            enableTimezoneHandling: config.enableTimezoneHandling !== false,
            
            // Configurações de formato
            defaultDateFormat: config.defaultDateFormat || 'DD/MM/YYYY HH:mm:ss',
            defaultTimeFormat: config.defaultTimeFormat || 'HH:mm:ss',
            enableStrictParsing: config.enableStrictParsing !== false,
            
            // Configurações de cache
            enableCaching: config.enableCaching !== false,
            maxCacheSize: config.maxCacheSize || 1000,
            
            // Configurações de validação
            allowFutureDates: config.allowFutureDates !== false,
            maxDateRange: config.maxDateRange || 365 * 24 * 60 * 60 * 1000, // 1 ano
            
            ...config
        };

        // Padrões de data comuns no Brasil/GPS
        this.datePatterns = [
            // ISO 8601
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:Z|[+-]\d{2}:\d{2})?$/,
            // DD/MM/YYYY HH:mm:ss
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
            // DD/MM/YYYY HH:mm
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,
            // DD/MM/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // DD-MM-YYYY HH:mm:ss
            /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
            // YYYY-MM-DD HH:mm:ss
            /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/,
            // Timestamp Unix (segundos)
            /^(\d{10})$/,
            // Timestamp Unix (milissegundos)
            /^(\d{13})$/
        ];

        // Cache de parsing
        this.parseCache = new Map();
        this.formatCache = new Map();

        // Logger
        this.logger = config.logger || console;

        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o parser de datas
     */
    initialize() {
        try {
            this.logger.info('DateParser: Sistema inicializado', {
                timezone: this.config.defaultTimezone,
                dateFormat: this.config.defaultDateFormat,
                patternsCount: this.datePatterns.length
            });

            // Testa suporte a Intl.DateTimeFormat
            this.hasIntlSupport = this.checkIntlSupport();
            
        } catch (error) {
            this.logger.error('DateParser: Erro na inicialização', {
                error: error.message
            });
        }
    }

    /**
     * Verifica suporte a Intl.DateTimeFormat
     * @returns {boolean} - Se há suporte
     */
    checkIntlSupport() {
        try {
            new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
            return true;
        } catch (error) {
            this.logger.warn('DateParser: Intl.DateTimeFormat não suportado', {
                error: error.message
            });
            return false;
        }
    }

    /**
     * Parsa string de data para objeto Date
     * @param {string|number|Date} input - Input para parsing
     * @param {Object} options - Opções de parsing
     * @returns {Date|null} - Date object ou null se inválido
     */
    parse(input, options = {}) {
        if (!input) return null;

        // Se já é um Date object válido
        if (input instanceof Date) {
            return isNaN(input.getTime()) ? null : input;
        }

        // Verifica cache
        const cacheKey = `${input}_${JSON.stringify(options)}`;
        if (this.config.enableCaching && this.parseCache.has(cacheKey)) {
            return this.parseCache.get(cacheKey);
        }

        try {
            let parsedDate = null;
            const inputStr = String(input).trim();

            // Tenta parsing com cada padrão
            for (let i = 0; i < this.datePatterns.length; i++) {
                const pattern = this.datePatterns[i];
                const match = inputStr.match(pattern);
                
                if (match) {
                    parsedDate = this.parseWithPattern(match, i);
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        break;
                    }
                }
            }

            // Fallback para Date constructor
            if (!parsedDate) {
                parsedDate = this.parseFallback(inputStr);
            }

            // Validação final
            if (parsedDate && this.isValidDate(parsedDate, options)) {
                // Aplica timezone se necessário
                if (this.config.enableTimezoneHandling && options.timezone) {
                    parsedDate = this.adjustTimezone(parsedDate, options.timezone);
                }

                // Cache result
                if (this.config.enableCaching) {
                    this.manageCacheSize();
                    this.parseCache.set(cacheKey, parsedDate);
                }

                return parsedDate;
            }

            return null;

        } catch (error) {
            this.logger.warn('DateParser: Erro durante parsing', {
                input,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Parsa data usando padrão específico
     * @param {Array} match - Match do regex
     * @param {number} patternIndex - Índice do padrão
     * @returns {Date|null} - Date object
     */
    parseWithPattern(match, patternIndex) {
        try {
            switch (patternIndex) {
                case 0: // ISO 8601
                    return new Date(match[0]);

                case 1: // DD/MM/YYYY HH:mm:ss
                    return new Date(
                        parseInt(match[3]), // year
                        parseInt(match[2]) - 1, // month (0-based)
                        parseInt(match[1]), // day
                        parseInt(match[4]), // hour
                        parseInt(match[5]), // minute
                        parseInt(match[6]) // second
                    );

                case 2: // DD/MM/YYYY HH:mm
                    return new Date(
                        parseInt(match[3]), // year
                        parseInt(match[2]) - 1, // month
                        parseInt(match[1]), // day
                        parseInt(match[4]), // hour
                        parseInt(match[5]), // minute
                        0 // second
                    );

                case 3: // DD/MM/YYYY
                    return new Date(
                        parseInt(match[3]), // year
                        parseInt(match[2]) - 1, // month
                        parseInt(match[1]), // day
                        0, 0, 0 // midnight
                    );

                case 4: // DD-MM-YYYY HH:mm:ss
                    return new Date(
                        parseInt(match[3]), // year
                        parseInt(match[2]) - 1, // month
                        parseInt(match[1]), // day
                        parseInt(match[4]), // hour
                        parseInt(match[5]), // minute
                        parseInt(match[6]) // second
                    );

                case 5: // YYYY-MM-DD HH:mm:ss
                    return new Date(
                        parseInt(match[1]), // year
                        parseInt(match[2]) - 1, // month
                        parseInt(match[3]), // day
                        parseInt(match[4]), // hour
                        parseInt(match[5]), // minute
                        parseInt(match[6]) // second
                    );

                case 6: // Unix timestamp (segundos)
                    return new Date(parseInt(match[1]) * 1000);

                case 7: // Unix timestamp (milissegundos)
                    return new Date(parseInt(match[1]));

                default:
                    return null;
            }
        } catch (error) {
            return null;
        }
    }

    /**
     * Parsing de fallback usando Date constructor
     * @param {string} inputStr - String de entrada
     * @returns {Date|null} - Date object
     */
    parseFallback(inputStr) {
        try {
            // Tenta parsing direto
            let date = new Date(inputStr);
            if (!isNaN(date.getTime())) {
                return date;
            }

            // Tenta substituir separadores
            const normalized = inputStr
                .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$2-$1') // DD/MM/YYYY -> YYYY-MM-DD
                .replace(/(\d{1,2})-(\d{1,2})-(\d{4})/, '$3-$2-$1'); // DD-MM-YYYY -> YYYY-MM-DD

            date = new Date(normalized);
            if (!isNaN(date.getTime())) {
                return date;
            }

            return null;

        } catch (error) {
            return null;
        }
    }

    /**
     * Valida se a data é válida
     * @param {Date} date - Data para validar
     * @param {Object} options - Opções de validação
     * @returns {boolean} - Se é válida
     */
    isValidDate(date, options = {}) {
        if (!date || isNaN(date.getTime())) {
            return false;
        }

        const now = new Date();

        // Verifica se permite datas futuras
        if (!this.config.allowFutureDates && !options.allowFuture && date > now) {
            return false;
        }

        // Verifica range máximo
        const maxPast = new Date(now.getTime() - this.config.maxDateRange);
        const maxFuture = new Date(now.getTime() + this.config.maxDateRange);
        
        if (date < maxPast || date > maxFuture) {
            return false;
        }

        // Validações personalizadas
        if (options.minDate && date < options.minDate) {
            return false;
        }

        if (options.maxDate && date > options.maxDate) {
            return false;
        }

        return true;
    }

    /**
     * Ajusta timezone da data
     * @param {Date} date - Data para ajustar
     * @param {string} timezone - Timezone desejada
     * @returns {Date} - Data ajustada
     */
    adjustTimezone(date, timezone) {
        if (!this.hasIntlSupport) {
            return date; // Sem ajuste se não há suporte
        }

        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const parts = formatter.formatToParts(date);
            const partsObj = {};
            parts.forEach(part => {
                partsObj[part.type] = part.value;
            });

            return new Date(
                parseInt(partsObj.year),
                parseInt(partsObj.month) - 1,
                parseInt(partsObj.day),
                parseInt(partsObj.hour),
                parseInt(partsObj.minute),
                parseInt(partsObj.second)
            );

        } catch (error) {
            this.logger.warn('DateParser: Erro no ajuste de timezone', {
                error: error.message,
                timezone
            });
            return date;
        }
    }

    /**
     * Formata data para string
     * @param {Date} date - Data para formatar
     * @param {string} format - Formato desejado
     * @param {Object} options - Opções de formatação
     * @returns {string} - Data formatada
     */
    format(date, format = null, options = {}) {
        if (!date || isNaN(date.getTime())) {
            return '';
        }

        format = format || this.config.defaultDateFormat;
        const cacheKey = `${date.getTime()}_${format}_${JSON.stringify(options)}`;

        if (this.config.enableCaching && this.formatCache.has(cacheKey)) {
            return this.formatCache.get(cacheKey);
        }

        try {
            let formatted = '';

            // Usa Intl.DateTimeFormat se disponível e solicitado
            if (this.hasIntlSupport && options.useIntl) {
                formatted = this.formatWithIntl(date, format, options);
            } else {
                formatted = this.formatManual(date, format, options);
            }

            // Cache result
            if (this.config.enableCaching) {
                this.manageCacheSize();
                this.formatCache.set(cacheKey, formatted);
            }

            return formatted;

        } catch (error) {
            this.logger.warn('DateParser: Erro na formatação', {
                error: error.message,
                format
            });
            return date.toString();
        }
    }

    /**
     * Formatação manual de data
     * @param {Date} date - Data para formatar
     * @param {string} format - Formato
     * @param {Object} options - Opções
     * @returns {string} - Data formatada
     */
    formatManual(date, format, options = {}) {
        const pad = (num, size = 2) => num.toString().padStart(size, '0');
        
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        const minute = date.getMinutes();
        const second = date.getSeconds();
        const ms = date.getMilliseconds();

        // Mapeamento de tokens
        const tokens = {
            'YYYY': year,
            'YY': year.toString().slice(-2),
            'MM': pad(month),
            'M': month,
            'DD': pad(day),
            'D': day,
            'HH': pad(hour),
            'H': hour,
            'hh': pad(hour % 12 || 12), // 12-hour format
            'h': hour % 12 || 12,
            'mm': pad(minute),
            'm': minute,
            'ss': pad(second),
            's': second,
            'SSS': pad(ms, 3),
            'A': hour >= 12 ? 'PM' : 'AM',
            'a': hour >= 12 ? 'pm' : 'am'
        };

        let formatted = format;
        for (const [token, value] of Object.entries(tokens)) {
            formatted = formatted.replace(new RegExp(token, 'g'), value);
        }

        return formatted;
    }

    /**
     * Formatação usando Intl.DateTimeFormat
     * @param {Date} date - Data para formatar
     * @param {string} format - Formato
     * @param {Object} options - Opções
     * @returns {string} - Data formatada
     */
    formatWithIntl(date, format, options = {}) {
        const timezone = options.timezone || this.config.defaultTimezone;
        const locale = options.locale || 'pt-BR';

        const formatter = new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        return formatter.format(date);
    }

    /**
     * Calcula duração entre duas datas
     * @param {Date|string} startDate - Data inicial
     * @param {Date|string} endDate - Data final
     * @param {string} unit - Unidade (ms, s, m, h, d)
     * @returns {number} - Duração na unidade especificada
     */
    duration(startDate, endDate, unit = 'ms') {
        const start = this.parse(startDate);
        const end = this.parse(endDate);

        if (!start || !end) {
            return 0;
        }

        const diffMs = end.getTime() - start.getTime();

        switch (unit.toLowerCase()) {
            case 'ms':
                return diffMs;
            case 's':
            case 'seconds':
                return Math.floor(diffMs / 1000);
            case 'm':
            case 'minutes':
                return Math.floor(diffMs / (1000 * 60));
            case 'h':
            case 'hours':
                return Math.floor(diffMs / (1000 * 60 * 60));
            case 'd':
            case 'days':
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
            default:
                return diffMs;
        }
    }

    /**
     * Formata duração para string legível
     * @param {number} milliseconds - Duração em milissegundos
     * @param {Object} options - Opções de formatação
     * @returns {string} - Duração formatada
     */
    formatDuration(milliseconds, options = {}) {
        const {
            showSeconds = true,
            showMilliseconds = false,
            compact = false,
            locale = 'pt-BR'
        } = options;

        if (milliseconds < 0) {
            return compact ? '0s' : '0 segundos';
        }

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const parts = [];

        if (days > 0) {
            parts.push(compact ? `${days}d` : `${days} dia${days > 1 ? 's' : ''}`);
        }

        if (hours % 24 > 0) {
            parts.push(compact ? `${hours % 24}h` : `${hours % 24} hora${hours % 24 > 1 ? 's' : ''}`);
        }

        if (minutes % 60 > 0) {
            parts.push(compact ? `${minutes % 60}m` : `${minutes % 60} minuto${minutes % 60 > 1 ? 's' : ''}`);
        }

        if (showSeconds && (seconds % 60 > 0 || parts.length === 0)) {
            parts.push(compact ? `${seconds % 60}s` : `${seconds % 60} segundo${seconds % 60 > 1 ? 's' : ''}`);
        }

        if (showMilliseconds && milliseconds % 1000 > 0) {
            parts.push(compact ? `${milliseconds % 1000}ms` : `${milliseconds % 1000} milissegundo${milliseconds % 1000 > 1 ? 's' : ''}`);
        }

        return parts.length > 0 ? parts.join(' ') : (compact ? '0s' : '0 segundos');
    }

    /**
     * Cria range de datas
     * @param {string} period - Período (today, yesterday, week, month, year)
     * @param {Date} referenceDate - Data de referência
     * @returns {Object} - {start, end}
     */
    createDateRange(period, referenceDate = null) {
        const ref = referenceDate ? this.parse(referenceDate) : new Date();
        if (!ref) return null;

        const start = new Date(ref);
        const end = new Date(ref);

        switch (period.toLowerCase()) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;

            case 'yesterday':
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() - 1);
                end.setHours(23, 59, 59, 999);
                break;

            case 'week':
                const dayOfWeek = start.getDay();
                start.setDate(start.getDate() - dayOfWeek);
                start.setHours(0, 0, 0, 0);
                end.setDate(end.getDate() + (6 - dayOfWeek));
                end.setHours(23, 59, 59, 999);
                break;

            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(end.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
                break;

            case 'year':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(11, 31);
                end.setHours(23, 59, 59, 999);
                break;

            default:
                return null;
        }

        return { start, end };
    }

    /**
     * Verifica se uma data está dentro de um range
     * @param {Date|string} date - Data para verificar
     * @param {Object} range - {start, end}
     * @returns {boolean} - Se está no range
     */
    isInRange(date, range) {
        const parsedDate = this.parse(date);
        if (!parsedDate || !range || !range.start || !range.end) {
            return false;
        }

        const start = this.parse(range.start);
        const end = this.parse(range.end);

        return parsedDate >= start && parsedDate <= end;
    }

    /**
     * Converte para timestamp Unix
     * @param {Date|string} date - Data para converter
     * @param {boolean} inSeconds - Se deve retornar em segundos
     * @returns {number|null} - Timestamp Unix
     */
    toUnixTimestamp(date, inSeconds = false) {
        const parsed = this.parse(date);
        if (!parsed) return null;

        const timestamp = parsed.getTime();
        return inSeconds ? Math.floor(timestamp / 1000) : timestamp;
    }

    /**
     * Cria data a partir de timestamp Unix
     * @param {number} timestamp - Timestamp Unix
     * @param {boolean} inSeconds - Se o timestamp está em segundos
     * @returns {Date|null} - Date object
     */
    fromUnixTimestamp(timestamp, inSeconds = false) {
        try {
            const ms = inSeconds ? timestamp * 1000 : timestamp;
            return new Date(ms);
        } catch (error) {
            return null;
        }
    }

    /**
     * Gerencia tamanho do cache
     */
    manageCacheSize() {
        if (this.parseCache.size >= this.config.maxCacheSize) {
            // Remove 25% dos itens mais antigos
            const keysToRemove = Array.from(this.parseCache.keys())
                .slice(0, Math.floor(this.config.maxCacheSize * 0.25));
            
            keysToRemove.forEach(key => this.parseCache.delete(key));
        }

        if (this.formatCache.size >= this.config.maxCacheSize) {
            const keysToRemove = Array.from(this.formatCache.keys())
                .slice(0, Math.floor(this.config.maxCacheSize * 0.25));
            
            keysToRemove.forEach(key => this.formatCache.delete(key));
        }
    }

    /**
     * Limpa caches
     */
    clearCache() {
        this.parseCache.clear();
        this.formatCache.clear();
        
        this.logger.info('DateParser: Cache limpo');
    }

    /**
     * Obtém estatísticas do parser
     * @returns {Object} - Estatísticas
     */
    getStats() {
        return {
            parseCacheSize: this.parseCache.size,
            formatCacheSize: this.formatCache.size,
            maxCacheSize: this.config.maxCacheSize,
            patternsCount: this.datePatterns.length,
            hasIntlSupport: this.hasIntlSupport,
            config: {
                defaultTimezone: this.config.defaultTimezone,
                defaultDateFormat: this.config.defaultDateFormat,
                enableCaching: this.config.enableCaching
            }
        };
    }

    /**
     * Destrói o parser e limpa recursos
     */
    destroy() {
        this.clearCache();
        this.logger.info('DateParser: Parser destruído');
    }
}

/**
 * Parser estático global para uso direto
 */
export const GlobalDateParser = new DateParser({
    defaultTimezone: 'America/Sao_Paulo',
    defaultDateFormat: 'DD/MM/YYYY HH:mm:ss',
    enableCaching: true
});

/**
 * Funções utilitárias para manipulação rápida de datas
 */
export const DateUtils = {
    /**
     * Parse rápido de data
     */
    parse: (input, options) => GlobalDateParser.parse(input, options),
    
    /**
     * Formatação rápida
     */
    format: (date, format, options) => GlobalDateParser.format(date, format, options),
    
    /**
     * Cálculo de duração
     */
    duration: (start, end, unit) => GlobalDateParser.duration(start, end, unit),
    
    /**
     * Formatação de duração
     */
    formatDuration: (ms, options) => GlobalDateParser.formatDuration(ms, options),
    
    /**
     * Range de datas
     */
    range: (period, ref) => GlobalDateParser.createDateRange(period, ref),
    
    /**
     * Verifica se está no range
     */
    inRange: (date, range) => GlobalDateParser.isInRange(date, range),
    
    /**
     * Timestamp Unix
     */
    timestamp: (date, seconds) => GlobalDateParser.toUnixTimestamp(date, seconds),
    
    /**
     * De timestamp Unix
     */
    fromTimestamp: (ts, seconds) => GlobalDateParser.fromUnixTimestamp(ts, seconds),
    
    /**
     * Agora
     */
    now: () => new Date(),
    
    /**
     * Hoje
     */
    today: () => GlobalDateParser.createDateRange('today'),
    
    /**
     * Esta semana
     */
    thisWeek: () => GlobalDateParser.createDateRange('week'),
    
    /**
     * Este mês
     */
    thisMonth: () => GlobalDateParser.createDateRange('month'),
    
    /**
     * Cria novo parser
     */
    createParser: (config) => new DateParser(config)
};

export default DateParser;
