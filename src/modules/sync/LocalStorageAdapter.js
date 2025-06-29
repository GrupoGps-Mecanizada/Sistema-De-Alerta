/**
 * Adaptador localStorage - LocalStorageAdapter.js
 * Gerencia persistência local de dados com fallbacks e validação
 */

import { Logger } from '../../utils/logger.js';

export class LocalStorageAdapter {
  constructor(config = {}) {
    this.config = {
      prefix: 'alertSystem_',
      maxItemSize: 5 * 1024 * 1024, // 5MB por item
      maxTotalSize: 50 * 1024 * 1024, // 50MB total
      compression: false,
      encryption: false,
      enableValidation: true,
      ...config
    };
    
    this.logger = new Logger('LocalStorageAdapter');
    
    // Verificar disponibilidade
    this.isAvailable = this.checkAvailability();
    
    // Métricas
    this.metrics = {
      reads: 0,
      writes: 0,
      deletes: 0,
      errors: 0,
      totalSize: 0,
      itemCount: 0
    };
    
    // Atualizar métricas iniciais
    this.updateMetrics();
    
    this.logger.debug('LocalStorageAdapter inicializado', {
      available: this.isAvailable,
      prefix: this.config.prefix,
      maxSize: this.config.maxTotalSize
    });
  }
  
  /**
   * Verifica se localStorage está disponível
   */
  checkAvailability() {
    try {
      const testKey = '_localStorage_test_';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      this.logger.warn('localStorage não disponível', { error: error.message });
      return false;
    }
  }
  
  /**
   * Salva dados no localStorage
   */
  async save(key, data, options = {}) {
    if (!this.isAvailable) {
      throw new Error('localStorage não disponível');
    }
    
    const fullKey = this.config.prefix + key;
    
    try {
      this.metrics.writes++;
      
      // Preparar dados
      const payload = this.prepareData(data, options);
      
      // Verificar tamanho
      if (payload.size > this.config.maxItemSize) {
        throw new Error(`Item muito grande: ${payload.size} bytes (máximo: ${this.config.maxItemSize})`);
      }
      
      // Verificar espaço disponível
      await this.ensureSpaceAvailable(payload.size);
      
      // Salvar
      const storageData = {
        data: payload.data,
        metadata: {
          key,
          size: payload.size,
          timestamp: Date.now(),
          version: '1.0',
          compressed: payload.compressed,
          encrypted: payload.encrypted,
          checksum: payload.checksum
        }
      };
      
      localStorage.setItem(fullKey, JSON.stringify(storageData));
      
      this.updateMetrics();
      
      this.logger.debug('Dados salvos no localStorage', {
        key,
        size: payload.size,
        compressed: payload.compressed
      });
      
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao salvar no localStorage', {
        key,
        error: error.message
      });
      
      // Tentar limpeza em caso de erro de quota
      if (error.name === 'QuotaExceededError') {
        await this.cleanup();
        throw new Error('Cota do localStorage excedida. Execute limpeza e tente novamente.');
      }
      
      throw error;
    }
  }
  
  /**
   * Carrega dados do localStorage
   */
  async load(key, options = {}) {
    if (!this.isAvailable) {
      return null;
    }
    
    const fullKey = this.config.prefix + key;
    
    try {
      this.metrics.reads++;
      
      const stored = localStorage.getItem(fullKey);
      if (!stored) {
        return null;
      }
      
      const storageData = JSON.parse(stored);
      
      // Validar estrutura
      if (!storageData.data || !storageData.metadata) {
        this.logger.warn('Dados corrompidos encontrados', { key });
        await this.remove(key);
        return null;
      }
      
      const metadata = storageData.metadata;
      
      // Verificar expiração se configurada
      if (options.ttl && this.isExpired(metadata.timestamp, options.ttl)) {
        this.logger.debug('Dados expirados removidos', { key });
        await this.remove(key);
        return null;
      }
      
      // Validar integridade se habilitada
      if (this.config.enableValidation && metadata.checksum) {
        const currentChecksum = this.calculateChecksum(storageData.data);
        if (currentChecksum !== metadata.checksum) {
          this.logger.warn('Checksum inválido, dados podem estar corrompidos', { key });
          await this.remove(key);
          return null;
        }
      }
      
      // Deserializar dados
      const data = this.deserializeData(storageData.data, {
        compressed: metadata.compressed,
        encrypted: metadata.encrypted
      });
      
      this.logger.debug('Dados carregados do localStorage', {
        key,
        size: metadata.size,
        age: Date.now() - metadata.timestamp
      });
      
      return data;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao carregar do localStorage', {
        key,
        error: error.message
      });
      
      // Remover item corrompido
      try {
        localStorage.removeItem(fullKey);
      } catch (removeError) {
        // Ignorar erro de remoção
      }
      
      return null;
    }
  }
  
  /**
   * Remove dados do localStorage
   */
  async remove(key) {
    if (!this.isAvailable) {
      return false;
    }
    
    const fullKey = this.config.prefix + key;
    
    try {
      this.metrics.deletes++;
      localStorage.removeItem(fullKey);
      this.updateMetrics();
      
      this.logger.debug('Dados removidos do localStorage', { key });
      return true;
      
    } catch (error) {
      this.metrics.errors++;
      this.logger.error('Erro ao remover do localStorage', {
        key,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * Lista todas as chaves armazenadas
   */
  getAllKeys() {
    if (!this.isAvailable) {
      return [];
    }
    
    const keys = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.config.prefix)) {
          keys.push(key.substring(this.config.prefix.length));
        }
      }
    } catch (error) {
      this.logger.error('Erro ao listar chaves', { error: error.message });
    }
    
    return keys;
  }
  
  /**
   * Obtém informações de um item
   */
  async getItemInfo(key) {
    const fullKey = this.config.prefix + key;
    
    try {
      const stored = localStorage.getItem(fullKey);
      if (!stored) {
        return null;
      }
      
      const storageData = JSON.parse(stored);
      const metadata = storageData.metadata;
      
      return {
        key,
        size: metadata.size,
        timestamp: metadata.timestamp,
        age: Date.now() - metadata.timestamp,
        compressed: metadata.compressed,
        encrypted: metadata.encrypted,
        version: metadata.version,
        checksum: metadata.checksum
      };
      
    } catch (error) {
      this.logger.error('Erro ao obter informações do item', {
        key,
        error: error.message
      });
      return null;
    }
  }
  
  /**
   * Limpa dados expirados
   */
  async cleanup(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 dias
    if (!this.isAvailable) {
      return 0;
    }
    
    const cutoffTime = Date.now() - maxAge;
    let removedCount = 0;
    
    try {
      const keys = this.getAllKeys();
      
      for (const key of keys) {
        const info = await this.getItemInfo(key);
        if (info && info.timestamp < cutoffTime) {
          await this.remove(key);
          removedCount++;
        }
      }
      
      this.logger.info('Limpeza do localStorage concluída', {
        removed: removedCount,
        maxAge: maxAge
      });
      
    } catch (error) {
      this.logger.error('Erro na limpeza do localStorage', { error: error.message });
    }
    
    return removedCount;
  }
  
  /**
   * Limpa todos os dados do sistema
   */
  async clear() {
    if (!this.isAvailable) {
      return 0;
    }
    
    let removedCount = 0;
    
    try {
      const keys = this.getAllKeys();
      
      for (const key of keys) {
        await this.remove(key);
        removedCount++;
      }
      
      this.updateMetrics();
      
      this.logger.info('localStorage completamente limpo', {
        removed: removedCount
      });
      
    } catch (error) {
      this.logger.error('Erro ao limpar localStorage', { error: error.message });
    }
    
    return removedCount;
  }
  
  /**
   * Garante que há espaço disponível
   */
  async ensureSpaceAvailable(requiredSize) {
    this.updateMetrics();
    
    const availableSpace = this.config.maxTotalSize - this.metrics.totalSize;
    
    if (availableSpace >= requiredSize) {
      return true;
    }
    
    this.logger.warn('Espaço insuficiente, executando limpeza automática', {
      required: requiredSize,
      available: availableSpace,
      total: this.metrics.totalSize
    });
    
    // Remover itens mais antigos até ter espaço
    const keys = this.getAllKeys();
    const items = [];
    
    for (const key of keys) {
      const info = await this.getItemInfo(key);
      if (info) {
        items.push(info);
      }
    }
    
    // Ordenar por idade (mais antigo primeiro)
    items.sort((a, b) => a.timestamp - b.timestamp);
    
    let freedSpace = 0;
    let removedCount = 0;
    
    for (const item of items) {
      if (freedSpace >= requiredSize) {
        break;
      }
      
      await this.remove(item.key);
      freedSpace += item.size;
      removedCount++;
    }
    
    this.logger.info('Limpeza automática concluída', {
      removed: removedCount,
      freedSpace: freedSpace
    });
    
    return freedSpace >= requiredSize;
  }
  
  /**
   * Prepara dados para armazenamento
   */
  prepareData(data, options) {
    let serializedData = JSON.stringify(data);
    let compressed = false;
    let encrypted = false;
    
    // Compressão básica se habilitada
    if (this.config.compression || options.compress) {
      serializedData = this.compressData(serializedData);
      compressed = true;
    }
    
    // Criptografia básica se habilitada
    if (this.config.encryption || options.encrypt) {
      serializedData = this.encryptData(serializedData);
      encrypted = true;
    }
    
    const size = new Blob([serializedData]).size;
    const checksum = this.calculateChecksum(serializedData);
    
    return {
      data: serializedData,
      size,
      compressed,
      encrypted,
      checksum
    };
  }
  
  /**
   * Deserializa dados
   */
  deserializeData(data, options = {}) {
    let processedData = data;
    
    // Descriptografar se necessário
    if (options.encrypted) {
      processedData = this.decryptData(processedData);
    }
    
    // Descomprimir se necessário
    if (options.compressed) {
      processedData = this.decompressData(processedData);
    }
    
    // Parse JSON
    return JSON.parse(processedData);
  }
  
  /**
   * Verifica se dados estão expirados
   */
  isExpired(timestamp, ttl) {
    return (Date.now() - timestamp) > ttl;
  }
  
  /**
   * Calcula checksum simples
   */
  calculateChecksum(data) {
    let hash = 0;
    
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Compressão básica de dados
   */
  compressData(data) {
    // Implementação básica - em produção usar biblioteca específica
    try {
      return btoa(data);
    } catch (error) {
      this.logger.warn('Erro na compressão, usando dados originais');
      return data;
    }
  }
  
  /**
   * Descompressão de dados
   */
  decompressData(data) {
    try {
      return atob(data);
    } catch (error) {
      this.logger.warn('Erro na descompressão, usando dados como estão');
      return data;
    }
  }
  
  /**
   * Criptografia básica
   */
  encryptData(data) {
    // Implementação básica - em produção usar biblioteca robusta
    try {
      return btoa(unescape(encodeURIComponent(data)));
    } catch (error) {
      this.logger.warn('Erro na criptografia, salvando sem criptografia');
      return data;
    }
  }
  
  /**
   * Descriptografia básica
   */
  decryptData(data) {
    try {
      return decodeURIComponent(escape(atob(data)));
    } catch (error) {
      this.logger.warn('Erro na descriptografia, usando dados como estão');
      return data;
    }
  }
  
  /**
   * Atualiza métricas internas
   */
  updateMetrics() {
    if (!this.isAvailable) {
      return;
    }
    
    let totalSize = 0;
    let itemCount = 0;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.config.prefix)) {
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += new Blob([item]).size;
            itemCount++;
          }
        }
      }
    } catch (error) {
      this.logger.warn('Erro ao calcular métricas', { error: error.message });
    }
    
    this.metrics.totalSize = totalSize;
    this.metrics.itemCount = itemCount;
  }
  
  /**
   * Obtém estatísticas do adapter
   */
  getStats() {
    this.updateMetrics();
    
    return {
      available: this.isAvailable,
      metrics: { ...this.metrics },
      config: {
        prefix: this.config.prefix,
        maxItemSize: this.config.maxItemSize,
        maxTotalSize: this.config.maxTotalSize,
        compression: this.config.compression,
        encryption: this.config.encryption
      },
      usage: {
        percentage: (this.metrics.totalSize / this.config.maxTotalSize) * 100,
        freeSpace: this.config.maxTotalSize - this.metrics.totalSize
      }
    };
  }
  
  /**
   * Executa diagnóstico do localStorage
   */
  async diagnose() {
    const diagnosis = {
      available: this.isAvailable,
      errors: [],
      warnings: [],
      items: []
    };
    
    if (!this.isAvailable) {
      diagnosis.errors.push('localStorage não disponível');
      return diagnosis;
    }
    
    try {
      const keys = this.getAllKeys();
      
      for (const key of keys) {
        const info = await this.getItemInfo(key);
        if (info) {
          diagnosis.items.push(info);
          
          // Verificar idade
          const ageDays = info.age / (1000 * 60 * 60 * 24);
          if (ageDays > 30) {
            diagnosis.warnings.push(`Item '${key}' é muito antigo (${Math.round(ageDays)} dias)`);
          }
          
          // Verificar tamanho
          if (info.size > this.config.maxItemSize * 0.8) {
            diagnosis.warnings.push(`Item '${key}' é muito grande (${info.size} bytes)`);
          }
        } else {
          diagnosis.errors.push(`Não foi possível carregar informações do item '${key}'`);
        }
      }
      
      // Verificar uso total
      this.updateMetrics();
      const usagePercentage = (this.metrics.totalSize / this.config.maxTotalSize) * 100;
      
      if (usagePercentage > 80) {
        diagnosis.warnings.push(`Uso do localStorage alto: ${usagePercentage.toFixed(1)}%`);
      }
      
    } catch (error) {
      diagnosis.errors.push(`Erro no diagnóstico: ${error.message}`);
    }
    
    return diagnosis;
  }
  
  /**
   * Migra dados de versão anterior
   */
  async migrate(fromVersion, toVersion) {
    this.logger.info('Iniciando migração de dados', { fromVersion, toVersion });
    
    const keys = this.getAllKeys();
    let migratedCount = 0;
    
    for (const key of keys) {
      try {
        const data = await this.load(key);
        if (data) {
          // Aplicar migração específica baseada na versão
          const migratedData = this.applyMigration(data, fromVersion, toVersion);
          
          if (migratedData !== data) {
            await this.save(key, migratedData);
            migratedCount++;
          }
        }
      } catch (error) {
        this.logger.error('Erro na migração do item', { key, error: error.message });
      }
    }
    
    this.logger.info('Migração concluída', { migrated: migratedCount });
    return migratedCount;
  }
  
  /**
   * Aplica migração específica nos dados
   */
  applyMigration(data, fromVersion, toVersion) {
    // Implementar lógica específica de migração baseada nas versões
    // Por enquanto, retorna dados inalterados
    return data;
  }
}

export default LocalStorageAdapter;
