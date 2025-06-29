/**
 * Gerenciador de Estado - StateManager.js
 * Sistema de cache híbrido com localStorage e sincronização opcional
 */

import { Logger } from '../utils/logger.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export class StateManager {
  constructor(config = {}) {
    this.config = {
      mode: 'hybrid', // 'hybrid', 'local', 'memory', 'disabled'
      prefix: 'alertSystem_',
      maxSize: 50 * 1024 * 1024, // 50MB
      compression: false,
      encryption: false,
      ttl: 3600000, // 1 hora
      cleanupInterval: 3600000, // 1 hora
      ...config
    };
    
    this.logger = new Logger('StateManager');
    this.errorHandler = new ErrorHandler();
    
    // Caches em memória
    this.memoryCache = new Map();
    this.metadataCache = new Map();
    
    // Métricas
    this.metrics = {
      reads: 0,
      writes: 0,
      hits: 0,
      misses: 0,
      errors: 0,
      localStorageSize: 0,
      memoryCacheSize: 0
    };
    
    // Inicialização
    this.isAvailable = this.checkAvailability();
    this.startCleanupTask();
    
    this.logger.debug('StateManager inicializado', {
      mode: this.config.mode,
      available: this.isAvailable,
      localStorage: typeof localStorage !== 'undefined',
      memoryCache: true
    });
  }
  
  /**
   * Verifica disponibilidade de recursos de armazenamento
   */
  checkAvailability() {
    const availability = {
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
      memory: true
    };
    
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('_test', 'test');
        localStorage.removeItem('_test');
        availability.localStorage = true;
      }
    } catch (e) {
      this.logger.warn('localStorage não disponível');
    }
    
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('_test', 'test');
        sessionStorage.removeItem('_test');
        availability.sessionStorage = true;
      }
    } catch (e) {
      this.logger.warn('sessionStorage não disponível');
    }
    
    try {
      if (typeof indexedDB !== 'undefined') {
        availability.indexedDB = true;
      }
    } catch (e) {
      this.logger.warn('indexedDB não disponível');
    }
    
    return availability;
  }
  
  /**
   * Salva dados no sistema de cache
   */
  async save(key, data, options = {}) {
    const finalOptions = { ...this.config, ...options };
    const fullKey = this.config.prefix + key;
    
    try {
      this.metrics.writes++;
      
      // Preparar dados para armazenamento
      const payload = this.preparePayload(data, finalOptions);
      
      // Salvar em cache de memória
      if (this.config.mode !== 'disabled') {
        this.memoryCache.set(fullKey, {
          data: payload.data,
          timestamp: Date.now(),
          ttl: finalOptions.ttl,
          size: payload.size
        });
        
        this.updateMemoryCacheSize();
      }
      
      // Salvar em localStorage se disponível e modo apropriado
      if (this.shouldUseLocalStorage() && payload.size < this.config.maxSize) {
        await this.saveToLocalStorage(fullKey, payload);
      }
      
      // Atualizar metadados
      this.updateMetadata(fullKey, payload);
      
      this.logger.debug('Dados salvos', {
        key,
        size: payload.size,
        mode: this.config.mode,
        compressed: payload.compressed
      });
      
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao salvar dados', {
        key,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Carrega dados do sistema de cache
   */
  async load(key, options = {}) {
    const finalOptions = { ...this.config, ...options };
    const fullKey = this.config.prefix + key;
    
    try {
      this.metrics.reads++;
      
      // Tentar carregar do cache de memória primeiro
      const memoryData = this.loadFromMemoryCache(fullKey);
      if (memoryData && !this.isExpired(memoryData)) {
        this.metrics.hits++;
        this.logger.debug('Cache hit (memória)', { key });
        return this.deserializeData(memoryData.data);
      }
      
      // Tentar carregar do localStorage
      if (this.shouldUseLocalStorage()) {
        const localData = await this.loadFromLocalStorage(fullKey);
        if (localData && !this.isExpired(localData)) {
          this.metrics.hits++;
          
          // Repovoar cache de memória
          this.memoryCache.set(fullKey, localData);
          this.updateMemoryCacheSize();
          
          this.logger.debug('Cache hit (localStorage)', { key });
          return this.deserializeData(localData.data);
        }
      }
      
      // Cache miss
      this.metrics.misses++;
      this.logger.debug('Cache miss', { key });
      return null;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao carregar dados', {
        key,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Remove dados do cache
   */
  async remove(key) {
    const fullKey = this.config.prefix + key;
    
    try {
      // Remover do cache de memória
      this.memoryCache.delete(fullKey);
      this.updateMemoryCacheSize();
      
      // Remover do localStorage
      if (this.shouldUseLocalStorage()) {
        localStorage.removeItem(fullKey);
      }
      
      // Remover metadados
      this.metadataCache.delete(fullKey);
      
      this.logger.debug('Dados removidos', { key });
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao remover dados', {
        key,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Limpa todo o cache
   */
  async clear() {
    try {
      // Limpar cache de memória
      this.memoryCache.clear();
      this.metadataCache.clear();
      this.updateMemoryCacheSize();
      
      // Limpar localStorage (apenas itens com nosso prefixo)
      if (this.shouldUseLocalStorage()) {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith(this.config.prefix)) {
            localStorage.removeItem(key);
          }
        }
      }
      
      this.logger.info('Cache completo limpo');
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao limpar cache', { error: error.message });
      return false;
    }
  }
  
  /**
   * Verifica se deve usar localStorage
   */
  shouldUseLocalStorage() {
    return this.isAvailable.localStorage && 
           (this.config.mode === 'hybrid' || this.config.mode === 'local');
  }
  
  /**
   * Prepara payload para armazenamento
   */
  preparePayload(data, options) {
    let serializedData = JSON.stringify(data);
    let compressed = false;
    
    // Aplicar compressão se habilitada
    if (options.compression && serializedData.length > 1024) {
      // Implementação simples de compressão (pode ser melhorada)
      serializedData = this.simpleCompress(serializedData);
      compressed = true;
    }
    
    // Aplicar criptografia se habilitada
    if (options.encryption) {
      serializedData = this.simpleEncrypt(serializedData);
    }
    
    return {
      data: serializedData,
      size: this.calculateSize(serializedData),
      compressed,
      encrypted: options.encryption,
      timestamp: Date.now(),
      version: '1.0'
    };
  }
  
  /**
   * Carrega dados do cache de memória
   */
  loadFromMemoryCache(key) {
    return this.memoryCache.get(key);
  }
  
  /**
   * Salva dados no localStorage
   */
  async saveToLocalStorage(key, payload) {
    try {
      const storageData = {
        ...payload,
        key,
        savedAt: Date.now()
      };
      
      localStorage.setItem(key, JSON.stringify(storageData));
      this.updateLocalStorageSize();
      
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        this.logger.warn('Cota do localStorage excedida, limpando dados antigos');
        await this.cleanupOldData();
        
        // Tentar novamente após limpeza
        try {
          localStorage.setItem(key, JSON.stringify(storageData));
        } catch (secondError) {
          this.logger.error('Falha ao salvar mesmo após limpeza', {
            error: secondError.message
          });
          throw secondError;
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Carrega dados do localStorage
   */
  async loadFromLocalStorage(key) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const storageData = JSON.parse(stored);
      
      return {
        data: storageData.data,
        timestamp: storageData.timestamp || storageData.savedAt,
        ttl: this.config.ttl,
        size: storageData.size || this.calculateSize(storageData.data),
        compressed: storageData.compressed,
        encrypted: storageData.encrypted
      };
      
    } catch (error) {
      this.logger.warn('Erro ao carregar do localStorage', {
        key,
        error: error.message
      });
      
      // Remover item corrompido
      localStorage.removeItem(key);
      return null;
    }
  }
  
  /**
   * Verifica se dados estão expirados
   */
  isExpired(cacheItem) {
    if (!cacheItem.ttl) return false;
    
    const age = Date.now() - cacheItem.timestamp;
    return age > cacheItem.ttl;
  }
  
  /**
   * Deserializa dados baseado no formato
   */
  deserializeData(data) {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        this.logger.warn('Erro ao deserializar dados JSON', { error: error.message });
        return data;
      }
    }
    
    return data;
  }
  
  /**
   * Calcula tamanho aproximado dos dados
   */
  calculateSize(data) {
    if (typeof data === 'string') {
      return new Blob([data]).size;
    }
    
    return new Blob([JSON.stringify(data)]).size;
  }
  
  /**
   * Atualiza metadados do cache
   */
  updateMetadata(key, payload) {
    this.metadataCache.set(key, {
      size: payload.size,
      timestamp: payload.timestamp,
      compressed: payload.compressed,
      encrypted: payload.encrypted
    });
  }
  
  /**
   * Atualiza métricas de tamanho do cache de memória
   */
  updateMemoryCacheSize() {
    let totalSize = 0;
    
    for (const [key, item] of this.memoryCache) {
      totalSize += item.size || 0;
    }
    
    this.metrics.memoryCacheSize = totalSize;
  }
  
  /**
   * Atualiza métricas de tamanho do localStorage
   */
  updateLocalStorageSize() {
    if (!this.shouldUseLocalStorage()) return;
    
    let totalSize = 0;
    
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(this.config.prefix)) {
          totalSize += localStorage.getItem(key).length * 2; // UTF-16
        }
      }
    } catch (error) {
      this.logger.warn('Erro ao calcular tamanho do localStorage');
    }
    
    this.metrics.localStorageSize = totalSize;
  }
  
  /**
   * Limpeza automática de dados expirados
   */
  async cleanupExpiredData() {
    let cleanedCount = 0;
    
    // Limpar cache de memória
    for (const [key, item] of this.memoryCache) {
      if (this.isExpired(item)) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Limpar localStorage
    if (this.shouldUseLocalStorage()) {
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        if (key.startsWith(this.config.prefix)) {
          try {
            const data = await this.loadFromLocalStorage(key);
            if (data && this.isExpired(data)) {
              localStorage.removeItem(key);
              cleanedCount++;
            }
          } catch (error) {
            // Remover item corrompido
            localStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }
    }
    
    if (cleanedCount > 0) {
      this.updateMemoryCacheSize();
      this.updateLocalStorageSize();
      this.logger.debug('Limpeza automática executada', { cleaned: cleanedCount });
    }
    
    return cleanedCount;
  }
  
  /**
   * Limpeza de dados antigos baseada em uso
   */
  async cleanupOldData() {
    if (!this.shouldUseLocalStorage()) return;
    
    const keys = Object.keys(localStorage)
      .filter(key => key.startsWith(this.config.prefix));
    
    // Ordenar por data de criação (mais antigo primeiro)
    const keyData = [];
    
    for (const key of keys) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        keyData.push({
          key,
          timestamp: data.timestamp || data.savedAt || 0,
          size: data.size || 0
        });
      } catch (error) {
        // Remover item corrompido
        localStorage.removeItem(key);
      }
    }
    
    keyData.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remover 20% dos itens mais antigos
    const toRemove = Math.ceil(keyData.length * 0.2);
    
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(keyData[i].key);
      this.memoryCache.delete(keyData[i].key);
    }
    
    this.updateMemoryCacheSize();
    this.updateLocalStorageSize();
    
    this.logger.info('Limpeza de dados antigos executada', { removed: toRemove });
  }
  
  /**
   * Inicia tarefa de limpeza automática
   */
  startCleanupTask() {
    if (this.config.cleanupInterval > 0) {
      setInterval(() => {
        this.cleanupExpiredData().catch(error => {
          this.logger.error('Erro na limpeza automática', { error: error.message });
        });
      }, this.config.cleanupInterval);
    }
  }
  
  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    this.updateMemoryCacheSize();
    this.updateLocalStorageSize();
    
    return {
      metrics: { ...this.metrics },
      memoryCache: {
        items: this.memoryCache.size,
        size: this.metrics.memoryCacheSize
      },
      localStorage: {
        available: this.isAvailable.localStorage,
        size: this.metrics.localStorageSize
      },
      config: {
        mode: this.config.mode,
        maxSize: this.config.maxSize,
        ttl: this.config.ttl
      }
    };
  }
  
  /**
   * Obtém informações de um item específico
   */
  getItemInfo(key) {
    const fullKey = this.config.prefix + key;
    const memoryItem = this.memoryCache.get(fullKey);
    const metadata = this.metadataCache.get(fullKey);
    
    return {
      key,
      exists: memoryItem !== undefined,
      inMemory: memoryItem !== undefined,
      inLocalStorage: this.shouldUseLocalStorage() && localStorage.getItem(fullKey) !== null,
      size: metadata?.size || 0,
      timestamp: metadata?.timestamp || memoryItem?.timestamp,
      expired: memoryItem ? this.isExpired(memoryItem) : false,
      compressed: metadata?.compressed || false,
      encrypted: metadata?.encrypted || false
    };
  }
  
  /**
   * Lista todas as chaves armazenadas
   */
  getAllKeys() {
    const keys = new Set();
    
    // Chaves do cache de memória
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(this.config.prefix)) {
        keys.add(key.substring(this.config.prefix.length));
      }
    }
    
    // Chaves do localStorage
    if (this.shouldUseLocalStorage()) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(this.config.prefix)) {
          keys.add(key.substring(this.config.prefix.length));
        }
      }
    }
    
    return Array.from(keys);
  }
  
  /**
   * Compressão simples (pode ser melhorada com bibliotecas específicas)
   */
  simpleCompress(data) {
    // Implementação básica de compressão
    // Em produção, usar biblioteca como pako ou similar
    return data;
  }
  
  /**
   * Criptografia simples (pode ser melhorada com bibliotecas específicas)
   */
  simpleEncrypt(data) {
    // Implementação básica de criptografia
    // Em produção, usar biblioteca como crypto-js ou similar
    return btoa(data);
  }
  
  /**
   * Descriptografia simples
   */
  simpleDecrypt(data) {
    try {
      return atob(data);
    } catch (error) {
      this.logger.error('Erro na descriptografia', { error: error.message });
      return data;
    }
  }
  
  /**
   * Força sincronização entre caches
   */
  async sync() {
    if (!this.shouldUseLocalStorage()) return;
    
    let syncCount = 0;
    
    // Sincronizar itens do localStorage para memória
    const localKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(this.config.prefix));
    
    for (const key of localKeys) {
      if (!this.memoryCache.has(key)) {
        const data = await this.loadFromLocalStorage(key);
        if (data && !this.isExpired(data)) {
          this.memoryCache.set(key, data);
          syncCount++;
        }
      }
    }
    
    this.updateMemoryCacheSize();
    
    if (syncCount > 0) {
      this.logger.debug('Sincronização executada', { synced: syncCount });
    }
    
    return syncCount;
  }
}

export default StateManager;
