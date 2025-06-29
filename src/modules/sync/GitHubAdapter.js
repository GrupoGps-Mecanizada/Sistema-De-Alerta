/**
 * Adaptador GitHub - GitHubAdapter.js
 * Gerencia sincronização bidirecional com repositórios GitHub
 */

import { Logger } from '../../utils/logger.js';
import { ErrorHandler } from '../../utils/errorHandler.js';

export class GitHubAdapter {
  constructor(config = {}) {
    this.config = {
      repo: '',
      token: '',
      branch: 'main',
      files: {
        rules: 'data/alert-rules.json',
        alerts: 'data/alerts-generated.json',
        states: 'data/active-states.json'
      },
      apiUrl: 'https://api.github.com',
      rawUrl: 'https://raw.githubusercontent.com',
      timeout: 30000,
      ...config
    };
    
    this.logger = new Logger('GitHubAdapter');
    this.errorHandler = new ErrorHandler();
    
    // Cache de SHA para evitar conflitos
    this.shaCache = new Map();
    
    // Métricas
    this.metrics = {
      requests: 0,
      successful: 0,
      failed: 0,
      cacheHits: 0,
      rateLimitResets: []
    };
  }
  
  /**
   * Verifica se adapter está configurado adequadamente
   */
  isConfigured() {
    return this.config.repo && this.config.token;
  }
  
  /**
   * Testa conectividade com GitHub
   */
  async testConnection() {
    if (!this.isConfigured()) {
      throw new Error('GitHub não configurado adequadamente');
    }
    
    try {
      const [owner, repo] = this.config.repo.split('/');
      const url = `${this.config.apiUrl}/repos/${owner}/${repo}`;
      
      const response = await this.makeRequest('GET', url);
      
      if (response.ok) {
        const data = await response.json();
        
        this.logger.info('Conexão GitHub testada com sucesso', {
          repo: data.full_name,
          private: data.private,
          defaultBranch: data.default_branch
        });
        
        return {
          success: true,
          repository: data.full_name,
          permissions: data.permissions
        };
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      this.logger.error('Falha no teste de conexão GitHub', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Sincroniza todos os arquivos do GitHub
   */
  async syncAllFiles() {
    if (!this.isConfigured()) {
      this.logger.warn('GitHub não configurado, ignorando sincronização');
      return {};
    }
    
    try {
      this.logger.debug('Iniciando sincronização de todos os arquivos GitHub');
      
      const syncPromises = [
        this.loadRules(),
        this.loadAlerts(),
        this.loadStates()
      ];
      
      const [rules, alerts, states] = await Promise.allSettled(syncPromises);
      
      const result = {
        rules: rules.status === 'fulfilled' ? rules.value : [],
        alerts: alerts.status === 'fulfilled' ? alerts.value : [],
        states: states.status === 'fulfilled' ? states.value : {}
      };
      
      this.logger.debug('Sincronização GitHub concluída', {
        rulesLoaded: result.rules.length,
        alertsLoaded: result.alerts.length,
        statesKeys: Object.keys(result.states).length
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Erro na sincronização GitHub', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Carrega regras do GitHub
   */
  async loadRules() {
    try {
      const data = await this.loadFile(this.config.files.rules);
      
      if (data && data.rules && Array.isArray(data.rules)) {
        this.logger.debug('Regras carregadas do GitHub', { count: data.rules.length });
        return data.rules;
      }
      
      this.logger.debug('Nenhuma regra encontrada no GitHub');
      return [];
      
    } catch (error) {
      if (error.message.includes('404')) {
        this.logger.info('Arquivo de regras não existe no GitHub, será criado automaticamente');
        return [];
      }
      
      this.logger.warn('Erro ao carregar regras do GitHub', { error: error.message });
      return [];
    }
  }
  
  /**
   * Carrega alertas do GitHub
   */
  async loadAlerts() {
    try {
      const data = await this.loadFile(this.config.files.alerts);
      
      if (data && data.alerts && Array.isArray(data.alerts)) {
        this.logger.debug('Alertas carregados do GitHub', { count: data.alerts.length });
        return data.alerts;
      }
      
      this.logger.debug('Nenhum alerta encontrado no GitHub');
      return [];
      
    } catch (error) {
      if (error.message.includes('404')) {
        this.logger.info('Arquivo de alertas não existe no GitHub');
        return [];
      }
      
      this.logger.warn('Erro ao carregar alertas do GitHub', { error: error.message });
      return [];
    }
  }
  
  /**
   * Carrega estados ativos do GitHub
   */
  async loadStates() {
    try {
      const data = await this.loadFile(this.config.files.states);
      
      if (data && typeof data === 'object') {
        this.logger.debug('Estados carregados do GitHub', { 
          keys: Object.keys(data).length 
        });
        return data;
      }
      
      this.logger.debug('Nenhum estado encontrado no GitHub');
      return {};
      
    } catch (error) {
      if (error.message.includes('404')) {
        this.logger.info('Arquivo de estados não existe no GitHub');
        return {};
      }
      
      this.logger.warn('Erro ao carregar estados do GitHub', { error: error.message });
      return {};
    }
  }
  
  /**
   * Salva regras no GitHub
   */
  async saveRules(rules) {
    if (!this.isConfigured()) {
      return { success: false, error: 'GitHub não configurado' };
    }
    
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem with Equipment Groups",
        totalRules: rules.length,
        rules: rules
      };
      
      const result = await this.saveFile(this.config.files.rules, data, 
        'Atualização das regras de alerta');
      
      if (result.success) {
        this.logger.info('Regras salvas no GitHub', { count: rules.length });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Erro ao salvar regras no GitHub', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Salva alertas no GitHub
   */
  async saveAlerts(alerts) {
    if (!this.isConfigured()) {
      return { success: false, error: 'GitHub não configurado' };
    }
    
    try {
      // Filtrar alertas recentes (últimos 30 dias)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const recentAlerts = alerts.filter(alert => 
        alert.timestamp > thirtyDaysAgo
      );
      
      const data = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem with Equipment Groups",
        totalAlerts: recentAlerts.length,
        consolidatedEvents: recentAlerts.filter(a => a.consolidated).length,
        retentionDays: 30,
        alerts: recentAlerts
      };
      
      const result = await this.saveFile(this.config.files.alerts, data,
        'Atualização dos alertas gerados');
      
      if (result.success) {
        this.logger.info('Alertas salvos no GitHub', { 
          total: alerts.length,
          saved: recentAlerts.length 
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Erro ao salvar alertas no GitHub', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Salva estados ativos no GitHub
   */
  async saveStates(states) {
    if (!this.isConfigured()) {
      return { success: false, error: 'GitHub não configurado' };
    }
    
    try {
      const data = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem Active States",
        stateCount: Object.keys(states).length,
        states: states
      };
      
      const result = await this.saveFile(this.config.files.states, data,
        'Atualização dos estados ativos');
      
      if (result.success) {
        this.logger.info('Estados salvos no GitHub', { 
          count: Object.keys(states).length 
        });
      }
      
      return result;
      
    } catch (error) {
      this.logger.error('Erro ao salvar estados no GitHub', { error: error.message });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Carrega arquivo específico do GitHub
   */
  async loadFile(filePath) {
    const [owner, repo] = this.config.repo.split('/');
    const url = `${this.config.rawUrl}/${owner}/${repo}/${this.config.branch}/${filePath}`;
    
    try {
      const response = await this.makeRequest('GET', url, {}, false);
      
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
      
      if (response.status === 404) {
        throw new Error(`Arquivo não encontrado: ${filePath} (HTTP 404)`);
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      if (error.name === 'SyntaxError') {
        throw new Error(`Arquivo JSON inválido: ${filePath}`);
      }
      throw error;
    }
  }
  
  /**
   * Salva arquivo no GitHub
   */
  async saveFile(filePath, data, commitMessage) {
    const [owner, repo] = this.config.repo.split('/');
    const url = `${this.config.apiUrl}/repos/${owner}/${repo}/contents/${filePath}`;
    
    try {
      // Obter SHA atual do arquivo se existir
      let sha = this.shaCache.get(filePath);
      
      if (!sha) {
        try {
          const getResponse = await this.makeRequest('GET', url);
          if (getResponse.ok) {
            const existing = await getResponse.json();
            sha = existing.sha;
            this.shaCache.set(filePath, sha);
          }
        } catch (error) {
          // Arquivo não existe, será criado
          this.logger.debug(`Arquivo ${filePath} será criado (não existe)`);
        }
      }
      
      // Preparar conteúdo
      const content = btoa(unescape(encodeURIComponent(
        JSON.stringify(data, null, 2)
      )));
      
      const requestData = {
        message: `${commitMessage} - ${new Date().toLocaleString('pt-BR')}`,
        content: content,
        branch: this.config.branch
      };
      
      if (sha) {
        requestData.sha = sha;
      }
      
      // Salvar arquivo
      const response = await this.makeRequest('PUT', url, requestData);
      
      if (response.ok) {
        const result = await response.json();
        
        // Atualizar cache SHA
        this.shaCache.set(filePath, result.content.sha);
        
        return {
          success: true,
          sha: result.content.sha,
          url: result.content.html_url
        };
      }
      
      const errorData = await response.json();
      throw new Error(`GitHub API Error: ${errorData.message || response.statusText}`);
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Faz requisição para GitHub API com autenticação
   */
  async makeRequest(method, url, data = null, useAuth = true) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GrupoGPS-AlertSystem/2.1.0'
    };
    
    if (useAuth && this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    }
    
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    
    const options = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout)
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    this.metrics.requests++;
    
    try {
      const response = await fetch(url, options);
      
      // Verificar rate limit
      this.checkRateLimit(response);
      
      if (response.ok) {
        this.metrics.successful++;
      } else {
        this.metrics.failed++;
      }
      
      return response;
      
    } catch (error) {
      this.metrics.failed++;
      
      if (error.name === 'AbortError') {
        throw new Error('Timeout na requisição GitHub');
      }
      
      throw error;
    }
  }
  
  /**
   * Verifica rate limit do GitHub
   */
  checkRateLimit(response) {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    
    if (remaining !== null) {
      const remainingCount = parseInt(remaining);
      
      if (remainingCount < 100) {
        this.logger.warn('Rate limit GitHub baixo', { 
          remaining: remainingCount,
          resetTime: reset ? new Date(parseInt(reset) * 1000).toISOString() : 'unknown'
        });
      }
      
      if (remainingCount === 0) {
        const resetTime = new Date(parseInt(reset) * 1000);
        this.metrics.rateLimitResets.push(resetTime);
        
        throw new Error(`Rate limit excedido. Reset em: ${resetTime.toLocaleString('pt-BR')}`);
      }
    }
  }
  
  /**
   * Cria estrutura de arquivos padrão no repositório
   */
  async createDefaultStructure() {
    if (!this.isConfigured()) {
      throw new Error('GitHub não configurado');
    }
    
    try {
      this.logger.info('Criando estrutura padrão de arquivos no GitHub');
      
      // Template de regras padrão
      const defaultRules = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem with Equipment Groups",
        totalRules: 3,
        rules: [
          {
            id: 1,
            name: "Refeição com Motor Ligado",
            active: true,
            type: "simple",
            equipmentGroups: [],
            applyToAllGroups: true,
            conditions: {
              apontamento: "Refeição Motorista",
              status: "on",
              operator: "AND",
              timeOperator: ">",
              timeValue: 5
            },
            severity: "high",
            message: "{equipamento} - Refeição há {tempo} com motor ligado"
          },
          {
            id: 2,
            name: "Documentação Prolongada - Alta Pressão",
            active: true,
            type: "simple",
            equipmentGroups: ["ALTA_PRESSAO"],
            applyToAllGroups: false,
            conditions: {
              apontamento: "Documentação",
              status: "",
              operator: "AND",
              timeOperator: ">",
              timeValue: 45
            },
            severity: "medium",
            message: "{equipamento} (Alta Pressão) - Documentação há {tempo}"
          },
          {
            id: 3,
            name: "Condições Complexas - Auto Vácuo",
            active: true,
            type: "advanced",
            equipmentGroups: ["AUTO_VACUO"],
            applyToAllGroups: false,
            conditions: {
              logic: "AND",
              rules: [
                { type: "apontamento", operator: "equals", value: "Documentação" },
                { type: "status", operator: "equals", value: "on" },
                { type: "time", operator: ">", value: 30 }
              ]
            },
            severity: "critical",
            message: "{equipamento} (Auto Vácuo) - Documentação com motor ligado há {tempo}"
          }
        ]
      };
      
      // Template de alertas vazio
      const defaultAlerts = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem with Equipment Groups",
        totalAlerts: 0,
        consolidatedEvents: 0,
        retentionDays: 30,
        alerts: []
      };
      
      // Template de estados vazio
      const defaultStates = {
        lastUpdated: new Date().toISOString(),
        version: "2.1.0",
        system: "AlertSystem Active States",
        stateCount: 0,
        states: {}
      };
      
      // Salvar arquivos
      const results = await Promise.allSettled([
        this.saveFile(this.config.files.rules, defaultRules, 'Criação inicial das regras padrão'),
        this.saveFile(this.config.files.alerts, defaultAlerts, 'Criação inicial do arquivo de alertas'),
        this.saveFile(this.config.files.states, defaultStates, 'Criação inicial dos estados ativos')
      ]);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      this.logger.info('Estrutura padrão criada', {
        filesCreated: successful,
        total: results.length
      });
      
      return {
        success: successful > 0,
        filesCreated: successful,
        results: results
      };
      
    } catch (error) {
      this.logger.error('Erro ao criar estrutura padrão', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Obtém métricas do adapter
   */
  getMetrics() {
    return {
      ...this.metrics,
      configured: this.isConfigured(),
      cacheSize: this.shaCache.size,
      lastReset: this.metrics.rateLimitResets.length > 0 ? 
        this.metrics.rateLimitResets[this.metrics.rateLimitResets.length - 1] : null
    };
  }
  
  /**
   * Limpa cache interno
   */
  clearCache() {
    this.shaCache.clear();
    this.logger.debug('Cache SHA limpo');
  }
  
  /**
   * Atualiza configuração
   */
  updateConfig(newConfig) {
    const oldRepo = this.config.repo;
    
    this.config = { ...this.config, ...newConfig };
    
    // Limpar cache se repositório mudou
    if (oldRepo !== this.config.repo) {
      this.clearCache();
    }
    
    this.logger.debug('Configuração GitHub atualizada', {
      repo: this.config.repo,
      hasToken: !!this.config.token
    });
  }
}

export default GitHubAdapter;
