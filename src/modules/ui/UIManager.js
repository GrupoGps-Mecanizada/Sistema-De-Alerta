/**
 * UIManager.js
 * Sistema de Alertas GrupoGPS v2.1
 * 
 * Gerenciador principal da interface de usuário
 * Orquestra todos os componentes visuais e interações do sistema
 * 
 * Funcionalidades:
 * - Inicialização e configuração da UI
 * - Gerenciamento de temas e layouts
 * - Coordenação entre componentes UI
 * - Sistema de eventos e callbacks
 * - Responsividade e adaptação
 * - Estados globais da interface
 * - Integração com sistema de alertas
 * - Acessibilidade e usabilidade
 */

import { LogUtils } from '../../utils/logger.js';
import { DebounceUtils } from '../../utils/debounce.js';
import { ErrorUtils } from '../../utils/errorHandler.js';

export class UIManager {
    constructor(config = {}) {
        this.config = {
            // Configurações de container
            containerId: config.containerId || 'grupogps-alert-system',
            createContainer: config.createContainer !== false,
            
            // Configurações de tema
            theme: config.theme || 'default',
            darkMode: config.darkMode || false,
            customTheme: config.customTheme || {},
            
            // Configurações de layout
            layout: config.layout || 'default',
            responsive: config.responsive !== false,
            compactMode: config.compactMode || false,
            
            // Configurações de componentes
            enableTabManager: config.enableTabManager !== false,
            enableModalManager: config.enableModalManager !== false,
            enableNotificationManager: config.enableNotificationManager !== false,
            enableGroupSelector: config.enableGroupSelector !== false,
            
            // Configurações de atualização
            autoRefresh: config.autoRefresh !== false,
            refreshInterval: config.refreshInterval || 30000, // 30 segundos
            enableRealtime: config.enableRealtime || false,
            
            // Configurações de UX
            enableAnimations: config.enableAnimations !== false,
            enableSounds: config.enableSounds || false,
            enableKeyboardShortcuts: config.enableKeyboardShortcuts !== false,
            
            // Configurações de dados
            maxVisibleAlerts: config.maxVisibleAlerts || 100,
            paginationSize: config.paginationSize || 20,
            enableSearch: config.enableSearch !== false,
            enableFilters: config.enableFilters !== false,
            
            ...config
        };

        // Estado interno
        this.isInitialized = false;
        this.container = null;
        this.components = new Map();
        this.eventListeners = new Map();
        this.state = {
            theme: this.config.theme,
            darkMode: this.config.darkMode,
            layout: this.config.layout,
            loading: false,
            alerts: [],
            filteredAlerts: [],
            selectedGroups: [],
            searchTerm: '',
            currentTab: 'alerts',
            modalsOpen: 0
        };

        // Métricas de UI
        this.metrics = {
            totalInteractions: 0,
            clickEvents: 0,
            keyboardEvents: 0,
            modalOpens: 0,
            searchQueries: 0,
            filterChanges: 0,
            loadTime: 0,
            renderTime: 0
        };

        // Bindings de métodos
        this.handleResize = DebounceUtils.debounce(this.handleResize.bind(this), 250);
        this.handleKeyboard = this.handleKeyboard.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

        // Logger
        this.logger = config.logger || LogUtils.createLogger('UIManager');

        // Callbacks do sistema
        this.onAlertUpdate = config.onAlertUpdate || null;
        this.onFilterChange = config.onFilterChange || null;
        this.onGroupChange = config.onGroupChange || null;
        this.onRefresh = config.onRefresh || null;

        // Templates HTML
        this.templates = this.createTemplates();
    }

    /**
     * Inicializa o gerenciador de UI
     * @returns {Promise<void>}
     */
    async initialize() {
        const startTime = performance.now();

        try {
            this.logger.info('UIManager: Iniciando sistema de UI', {
                config: this.config
            });

            // Prepara container
            await this.setupContainer();

            // Carrega tema e estilos
            await this.loadTheme();

            // Cria estrutura base
            await this.createBaseStructure();

            // Inicializa componentes
            await this.initializeComponents();

            // Configura event listeners
            this.setupEventListeners();

            // Configura responsividade
            if (this.config.responsive) {
                this.setupResponsiveness();
            }

            // Configura atalhos de teclado
            if (this.config.enableKeyboardShortcuts) {
                this.setupKeyboardShortcuts();
            }

            // Configura auto-refresh
            if (this.config.autoRefresh) {
                this.setupAutoRefresh();
            }

            this.isInitialized = true;
            const loadTime = performance.now() - startTime;
            this.metrics.loadTime = loadTime;

            this.logger.info('UIManager: Sistema de UI inicializado com sucesso', {
                loadTime: `${loadTime.toFixed(2)}ms`,
                components: this.components.size,
                theme: this.state.theme
            });

            // Dispara evento de inicialização
            this.dispatchEvent('ui:initialized', {
                loadTime,
                config: this.config
            });

        } catch (error) {
            this.logger.error('UIManager: Erro na inicialização', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Configura container principal
     * @returns {Promise<void>}
     */
    async setupContainer() {
        let container = document.getElementById(this.config.containerId);

        if (!container && this.config.createContainer) {
            container = document.createElement('div');
            container.id = this.config.containerId;
            container.className = 'grupogps-alert-system';
            document.body.appendChild(container);

            this.logger.debug('UIManager: Container criado automaticamente', {
                containerId: this.config.containerId
            });
        }

        if (!container) {
            throw new Error(`Container com ID '${this.config.containerId}' não encontrado`);
        }

        this.container = container;
        
        // Adiciona classes base
        this.container.className = [
            'grupogps-alert-system',
            `theme-${this.state.theme}`,
            `layout-${this.state.layout}`,
            this.state.darkMode ? 'dark-mode' : 'light-mode',
            this.config.compactMode ? 'compact-mode' : 'normal-mode'
        ].join(' ');

        // Define atributos de acessibilidade
        this.container.setAttribute('role', 'application');
        this.container.setAttribute('aria-label', 'Sistema de Alertas GrupoGPS');
    }

    /**
     * Carrega tema e estilos CSS
     * @returns {Promise<void>}
     */
    async loadTheme() {
        try {
            // Remove folhas de estilo anteriores
            const existingStyles = document.querySelectorAll('style[data-grupogps-theme]');
            existingStyles.forEach(style => style.remove());

            // Cria folha de estilo principal
            const styleSheet = document.createElement('style');
            styleSheet.setAttribute('data-grupogps-theme', this.state.theme);
            styleSheet.textContent = this.generateCSS();
            document.head.appendChild(styleSheet);

            // Aplica tema customizado se definido
            if (Object.keys(this.config.customTheme).length > 0) {
                const customStyle = document.createElement('style');
                customStyle.setAttribute('data-grupogps-custom', 'true');
                customStyle.textContent = this.generateCustomCSS(this.config.customTheme);
                document.head.appendChild(customStyle);
            }

            this.logger.debug('UIManager: Tema carregado', {
                theme: this.state.theme,
                darkMode: this.state.darkMode,
                customTheme: Object.keys(this.config.customTheme).length > 0
            });

        } catch (error) {
            this.logger.error('UIManager: Erro ao carregar tema', {
                error: error.message
            });
        }
    }

    /**
     * Cria estrutura HTML base
     * @returns {Promise<void>}
     */
    async createBaseStructure() {
        const renderStart = performance.now();

        const html = `
            <div class="ui-header">
                <div class="header-left">
                    <h1 class="system-title">
                        <span class="title-icon">🚨</span>
                        Sistema de Alertas GrupoGPS
                    </h1>
                    <div class="system-status">
                        <span class="status-indicator" data-status="active"></span>
                        <span class="status-text">Sistema Ativo</span>
                    </div>
                </div>
                <div class="header-right">
                    <div class="header-controls">
                        <button class="btn btn-icon" id="refresh-button" title="Atualizar (F5)">
                            <span class="icon">🔄</span>
                        </button>
                        <button class="btn btn-icon" id="settings-button" title="Configurações">
                            <span class="icon">⚙️</span>
                        </button>
                        <button class="btn btn-icon" id="theme-toggle" title="Alternar Tema">
                            <span class="icon">${this.state.darkMode ? '☀️' : '🌙'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <div class="ui-main">
                <div class="sidebar" id="sidebar">
                    <div class="sidebar-section">
                        <h3 class="sidebar-title">Filtros</h3>
                        <div id="group-selector-container"></div>
                    </div>
                    
                    <div class="sidebar-section">
                        <h3 class="sidebar-title">Busca</h3>
                        <div class="search-container">
                            <input type="text" id="search-input" class="search-input" 
                                   placeholder="Buscar alertas..." autocomplete="off">
                            <button class="search-clear" id="search-clear" title="Limpar busca">
                                <span class="icon">✕</span>
                            </button>
                        </div>
                    </div>

                    <div class="sidebar-section">
                        <h3 class="sidebar-title">Estatísticas</h3>
                        <div id="stats-container" class="stats-container">
                            <div class="stat-item">
                                <span class="stat-label">Total:</span>
                                <span class="stat-value" id="total-alerts">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Ativos:</span>
                                <span class="stat-value" id="active-alerts">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Críticos:</span>
                                <span class="stat-value critical" id="critical-alerts">0</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="content-area">
                    <div class="tabs-container" id="tabs-container"></div>
                    <div class="content-body" id="content-body">
                        <div class="alerts-container" id="alerts-container">
                            <div class="loading-indicator" id="loading-indicator">
                                <div class="spinner"></div>
                                <span>Carregando alertas...</span>
                            </div>
                            <div class="alerts-list" id="alerts-list"></div>
                            <div class="alerts-pagination" id="alerts-pagination"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ui-footer">
                <div class="footer-left">
                    <span class="version-info">v2.1.0</span>
                    <span class="separator">|</span>
                    <span class="last-update">Última atualização: <span id="last-update-time">--</span></span>
                </div>
                <div class="footer-right">
                    <span class="performance-info">
                        Carregamento: <span id="load-time">${this.metrics.loadTime.toFixed(0)}ms</span>
                    </span>
                </div>
            </div>

            <!-- Overlay para modais -->
            <div class="modal-overlay" id="modal-overlay"></div>
            
            <!-- Container para notificações -->
            <div class="notifications-container" id="notifications-container"></div>
        `;

        this.container.innerHTML = html;

        const renderTime = performance.now() - renderStart;
        this.metrics.renderTime = renderTime;

        this.logger.debug('UIManager: Estrutura base criada', {
            renderTime: `${renderTime.toFixed(2)}ms`
        });
    }

    /**
     * Inicializa todos os componentes de UI
     * @returns {Promise<void>}
     */
    async initializeComponents() {
        try {
            // Importa e inicializa componentes dinamicamente
            const componentConfigs = [
                {
                    name: 'TabManager',
                    enabled: this.config.enableTabManager,
                    module: './TabManager.js',
                    container: '#tabs-container'
                },
                {
                    name: 'ModalManager',
                    enabled: this.config.enableModalManager,
                    module: './ModalManager.js',
                    container: '#modal-overlay'
                },
                {
                    name: 'NotificationManager',
                    enabled: this.config.enableNotificationManager,
                    module: './NotificationManager.js',
                    container: '#notifications-container'
                },
                {
                    name: 'GroupSelector',
                    enabled: this.config.enableGroupSelector,
                    module: './GroupSelector.js',
                    container: '#group-selector-container'
                }
            ];

            for (const componentConfig of componentConfigs) {
                if (componentConfig.enabled) {
                    await this.initializeComponent(componentConfig);
                }
            }

            this.logger.info('UIManager: Componentes inicializados', {
                componentsCount: this.components.size,
                components: Array.from(this.components.keys())
            });

        } catch (error) {
            this.logger.error('UIManager: Erro na inicialização de componentes', {
                error: error.message
            });
        }
    }

    /**
     * Inicializa um componente específico
     * @param {Object} componentConfig - Configuração do componente
     * @returns {Promise<void>}
     */
    async initializeComponent(componentConfig) {
        try {
            // Import dinâmico (seria feito de forma diferente em produção)
            const container = document.querySelector(componentConfig.container);
            if (!container) {
                this.logger.warn('UIManager: Container não encontrado para componente', {
                    component: componentConfig.name,
                    container: componentConfig.container
                });
                return;
            }

            // Cria instância básica do componente (simulado)
            const component = this.createComponentInstance(componentConfig.name, container);
            
            if (component && typeof component.initialize === 'function') {
                await component.initialize();
                this.components.set(componentConfig.name, component);
                
                this.logger.debug('UIManager: Componente inicializado', {
                    component: componentConfig.name
                });
            }

        } catch (error) {
            this.logger.error('UIManager: Erro ao inicializar componente', {
                component: componentConfig.name,
                error: error.message
            });
        }
    }

    /**
     * Cria instância de componente (simulação para exemplo)
     * @param {string} componentName - Nome do componente
     * @param {HTMLElement} container - Container do componente
     * @returns {Object} - Instância do componente
     */
    createComponentInstance(componentName, container) {
        // Esta é uma implementação simplificada para demonstração
        // Em um sistema real, seria feito import dinâmico das classes
        
        const baseComponent = {
            name: componentName,
            container: container,
            uiManager: this,
            
            initialize: async function() {
                this.render();
                this.setupEvents();
            },
            
            render: function() {
                // Implementação base de renderização
                this.container.innerHTML = `<div class="${componentName.toLowerCase()}-content">
                    ${componentName} Component Loaded
                </div>`;
            },
            
            setupEvents: function() {
                // Configuração base de eventos
            },
            
            destroy: function() {
                this.container.innerHTML = '';
            }
        };

        return baseComponent;
    }

    /**
     * Configura event listeners globais
     */
    setupEventListeners() {
        // Eventos do cabeçalho
        this.setupHeaderEvents();
        
        // Eventos de busca
        this.setupSearchEvents();
        
        // Eventos de estatísticas
        this.setupStatsEvents();
        
        // Eventos de sistema
        this.setupSystemEvents();

        this.logger.debug('UIManager: Event listeners configurados');
    }

    /**
     * Configura eventos do cabeçalho
     */
    setupHeaderEvents() {
        // Botão de refresh
        const refreshBtn = document.getElementById('refresh-button');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                this.handleRefresh(e);
            });
        }

        // Botão de configurações
        const settingsBtn = document.getElementById('settings-button');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                this.handleSettings(e);
            });
        }

        // Toggle de tema
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', (e) => {
                this.toggleTheme(e);
            });
        }
    }

    /**
     * Configura eventos de busca
     */
    setupSearchEvents() {
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');

        if (searchInput) {
            // Debounce na busca
            const debouncedSearch = DebounceUtils.debounce((value) => {
                this.handleSearch(value);
            }, 300);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }

        if (searchClear) {
            searchClear.addEventListener('click', () => {
                this.clearSearch();
            });
        }
    }

    /**
     * Configura eventos de estatísticas
     */
    setupStatsEvents() {
        // Clique nas estatísticas para filtrar
        const statsContainer = document.getElementById('stats-container');
        if (statsContainer) {
            statsContainer.addEventListener('click', (e) => {
                const statItem = e.target.closest('.stat-item');
                if (statItem) {
                    this.handleStatsClick(statItem, e);
                }
            });
        }
    }

    /**
     * Configura eventos de sistema
     */
    setupSystemEvents() {
        // Visibilidade da página
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Eventos globais de clique
        document.addEventListener('click', (e) => {
            this.trackInteraction('click', e);
        });

        // Eventos globais de teclado
        document.addEventListener('keydown', (e) => {
            this.trackInteraction('keyboard', e);
        });
    }

    /**
     * Configura responsividade
     */
    setupResponsiveness() {
        window.addEventListener('resize', this.handleResize);
        
        // Configuração inicial de responsividade
        this.handleResize();
    }

    /**
     * Configura atalhos de teclado
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', this.handleKeyboard);
    }

    /**
     * Configura auto-refresh
     */
    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (!document.hidden && this.isInitialized) {
                this.refresh();
            }
        }, this.config.refreshInterval);
    }

    /**
     * Manipula eventos de redimensionamento
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Aplica classes responsivas
        this.container.classList.toggle('mobile', width < 768);
        this.container.classList.toggle('tablet', width >= 768 && width < 1024);
        this.container.classList.toggle('desktop', width >= 1024);

        // Ajusta sidebar em dispositivos móveis
        const sidebar = document.getElementById('sidebar');
        if (sidebar && width < 768) {
            sidebar.classList.add('collapsed');
        }

        this.logger.debug('UIManager: Redimensionamento detectado', {
            width,
            height,
            device: width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop'
        });

        // Notifica componentes
        this.dispatchEvent('ui:resize', { width, height });
    }

    /**
     * Manipula atalhos de teclado
     * @param {KeyboardEvent} e - Evento de teclado
     */
    handleKeyboard(e) {
        const shortcuts = {
            'F5': () => this.refresh(),
            'Escape': () => this.closeModals(),
            'Control+f': () => this.focusSearch(),
            'Control+r': () => this.refresh(),
            'Control+Shift+d': () => this.toggleTheme()
        };

        const key = e.key;
        const shortcut = [
            e.ctrlKey ? 'Control' : '',
            e.shiftKey ? 'Shift' : '',
            e.altKey ? 'Alt' : '',
            key
        ].filter(Boolean).join('+');

        if (shortcuts[shortcut]) {
            e.preventDefault();
            shortcuts[shortcut]();
        }
    }

    /**
     * Manipula mudança de visibilidade da página
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // Página ficou oculta - pausa auto-refresh
            this.logger.debug('UIManager: Página oculta, pausando auto-refresh');
        } else {
            // Página ficou visível - força refresh
            this.logger.debug('UIManager: Página visível, forçando refresh');
            this.refresh();
        }
    }

    /**
     * Manipula clique no botão de refresh
     * @param {Event} e - Evento de clique
     */
    handleRefresh(e) {
        e.preventDefault();
        this.refresh();
    }

    /**
     * Manipula clique no botão de configurações
     * @param {Event} e - Evento de clique
     */
    handleSettings(e) {
        e.preventDefault();
        this.showSettings();
    }

    /**
     * Manipula busca
     * @param {string} searchTerm - Termo de busca
     */
    handleSearch(searchTerm) {
        this.state.searchTerm = searchTerm;
        this.metrics.searchQueries++;
        
        this.filterAlerts();
        
        this.logger.debug('UIManager: Busca realizada', {
            searchTerm,
            totalQueries: this.metrics.searchQueries
        });

        // Callback de mudança de filtro
        if (this.onFilterChange) {
            this.onFilterChange({
                type: 'search',
                value: searchTerm
            });
        }
    }

    /**
     * Manipula clique em estatísticas
     * @param {HTMLElement} statItem - Item de estatística clicado
     * @param {Event} e - Evento de clique
     */
    handleStatsClick(statItem, e) {
        const statId = statItem.querySelector('.stat-value').id;
        let filterType = null;

        switch (statId) {
            case 'active-alerts':
                filterType = 'status:ACTIVE';
                break;
            case 'critical-alerts':
                filterType = 'severity:CRITICAL';
                break;
        }

        if (filterType) {
            this.applyQuickFilter(filterType);
        }
    }

    /**
     * Atualiza dados do sistema
     * @returns {Promise<void>}
     */
    async refresh() {
        try {
            this.setLoading(true);
            
            const refreshBtn = document.getElementById('refresh-button');
            if (refreshBtn) {
                refreshBtn.classList.add('spinning');
            }

            // Callback de refresh
            if (this.onRefresh) {
                await this.onRefresh();
            }

            // Atualiza timestamp
            this.updateLastUpdateTime();

            this.logger.debug('UIManager: Sistema atualizado');

        } catch (error) {
            this.logger.error('UIManager: Erro na atualização', {
                error: error.message
            });
            this.showError('Erro ao atualizar dados');
        } finally {
            this.setLoading(false);
            
            const refreshBtn = document.getElementById('refresh-button');
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
            }
        }
    }

    /**
     * Alterna tema escuro/claro
     * @param {Event} e - Evento (opcional)
     */
    toggleTheme(e) {
        if (e) e.preventDefault();
        
        this.state.darkMode = !this.state.darkMode;
        
        // Atualiza classes do container
        this.container.classList.toggle('dark-mode', this.state.darkMode);
        this.container.classList.toggle('light-mode', !this.state.darkMode);
        
        // Atualiza ícone do botão
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('.icon');
            if (icon) {
                icon.textContent = this.state.darkMode ? '☀️' : '🌙';
            }
        }

        // Recarrega CSS se necessário
        this.loadTheme();

        this.logger.debug('UIManager: Tema alternado', {
            darkMode: this.state.darkMode
        });

        this.dispatchEvent('ui:theme-changed', {
            darkMode: this.state.darkMode
        });
    }

    /**
     * Aplica filtro rápido
     * @param {string} filter - Filtro a aplicar
     */
    applyQuickFilter(filter) {
        this.metrics.filterChanges++;
        
        // Lógica de filtro seria implementada aqui
        this.logger.debug('UIManager: Filtro rápido aplicado', {
            filter,
            totalFilterChanges: this.metrics.filterChanges
        });

        if (this.onFilterChange) {
            this.onFilterChange({
                type: 'quick',
                value: filter
            });
        }
    }

    /**
     * Limpa busca
     */
    clearSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        this.handleSearch('');
    }

    /**
     * Foca no campo de busca
     */
    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    /**
     * Fecha todos os modais
     */
    closeModals() {
        const modalManager = this.components.get('ModalManager');
        if (modalManager && typeof modalManager.closeAll === 'function') {
            modalManager.closeAll();
        }
    }

    /**
     * Mostra modal de configurações
     */
    showSettings() {
        const modalManager = this.components.get('ModalManager');
        if (modalManager && typeof modalManager.show === 'function') {
            modalManager.show('settings', {
                title: 'Configurações do Sistema',
                content: this.generateSettingsContent()
            });
        }
    }

    /**
     * Filtra alertas baseado no estado atual
     */
    filterAlerts() {
        let filtered = [...this.state.alerts];

        // Filtro por busca
        if (this.state.searchTerm) {
            const searchTerm = this.state.searchTerm.toLowerCase();
            filtered = filtered.filter(alert => 
                alert.message?.toLowerCase().includes(searchTerm) ||
                alert.equipamento?.toLowerCase().includes(searchTerm)
            );
        }

        // Filtro por grupos selecionados
        if (this.state.selectedGroups.length > 0) {
            filtered = filtered.filter(alert =>
                alert.equipmentGroups?.some(group => 
                    this.state.selectedGroups.includes(group)
                )
            );
        }

        this.state.filteredAlerts = filtered;
        this.updateAlertsDisplay();
        this.updateStatistics();
    }

    /**
     * Atualiza exibição de alertas
     */
    updateAlertsDisplay() {
        const alertsList = document.getElementById('alerts-list');
        if (!alertsList) return;

        const alerts = this.state.filteredAlerts.slice(0, this.config.maxVisibleAlerts);
        
        if (alerts.length === 0) {
            alertsList.innerHTML = `
                <div class="no-alerts">
                    <div class="no-alerts-icon">📭</div>
                    <div class="no-alerts-message">Nenhum alerta encontrado</div>
                </div>
            `;
            return;
        }

        const html = alerts.map(alert => this.renderAlertItem(alert)).join('');
        alertsList.innerHTML = html;
    }

    /**
     * Renderiza item de alerta
     * @param {Object} alert - Alerta para renderizar
     * @returns {string} - HTML do item
     */
    renderAlertItem(alert) {
        const severityClass = alert.severity?.toLowerCase() || 'medium';
        const timeAgo = this.formatTimeAgo(alert.timestamp);
        
        return `
            <div class="alert-item severity-${severityClass}" data-alert-id="${alert.id}">
                <div class="alert-header">
                    <div class="alert-severity">
                        <span class="severity-indicator severity-${severityClass}"></span>
                        <span class="severity-text">${alert.severity || 'MEDIUM'}</span>
                    </div>
                    <div class="alert-time">${timeAgo}</div>
                </div>
                <div class="alert-body">
                    <div class="alert-equipment">${alert.equipamento || 'N/A'}</div>
                    <div class="alert-message">${alert.message || 'Sem mensagem'}</div>
                    ${alert.equipmentGroups?.length ? 
                        `<div class="alert-groups">${alert.equipmentGroups.join(', ')}</div>` : 
                        ''
                    }
                </div>
                <div class="alert-actions">
                    <button class="btn btn-sm" onclick="this.acknowledgeAlert('${alert.id}')">
                        Reconhecer
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="this.viewAlertDetails('${alert.id}')">
                        Detalhes
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Atualiza estatísticas
     */
    updateStatistics() {
        const stats = this.calculateStatistics();
        
        // Atualiza elementos de estatística
        this.updateStatElement('total-alerts', stats.total);
        this.updateStatElement('active-alerts', stats.active);
        this.updateStatElement('critical-alerts', stats.critical);
    }

    /**
     * Calcula estatísticas dos alertas
     * @returns {Object} - Estatísticas calculadas
     */
    calculateStatistics() {
        const alerts = this.state.filteredAlerts;
        
        return {
            total: alerts.length,
            active: alerts.filter(a => a.status === 'ACTIVE').length,
            critical: alerts.filter(a => a.severity === 'CRITICAL').length,
            acknowledged: alerts.filter(a => a.acknowledged).length,
            resolved: alerts.filter(a => a.resolved).length
        };
    }

    /**
     * Atualiza elemento de estatística
     * @param {string} elementId - ID do elemento
     * @param {number} value - Valor para exibir
     */
    updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value.toLocaleString();
        }
    }

    /**
     * Atualiza alertas do sistema
     * @param {Array} alerts - Array de alertas
     */
    updateAlerts(alerts) {
        this.state.alerts = alerts || [];
        this.filterAlerts();

        if (this.onAlertUpdate) {
            this.onAlertUpdate(this.state.alerts);
        }
    }

    /**
     * Define estado de carregamento
     * @param {boolean} loading - Se está carregando
     */
    setLoading(loading) {
        this.state.loading = loading;
        
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = loading ? 'flex' : 'none';
        }

        const alertsList = document.getElementById('alerts-list');
        if (alertsList) {
            alertsList.style.opacity = loading ? '0.5' : '1';
        }
    }

    /**
     * Mostra erro para o usuário
     * @param {string} message - Mensagem de erro
     */
    showError(message) {
        const notificationManager = this.components.get('NotificationManager');
        if (notificationManager && typeof notificationManager.show === 'function') {
            notificationManager.show('error', message);
        } else {
            // Fallback para alert
            alert(`Erro: ${message}`);
        }
    }

    /**
     * Atualiza tempo da última atualização
     */
    updateLastUpdateTime() {
        const element = document.getElementById('last-update-time');
        if (element) {
            element.textContent = new Date().toLocaleTimeString();
        }
    }

    /**
     * Formata tempo relativo
     * @param {number} timestamp - Timestamp
     * @returns {string} - Tempo formatado
     */
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d atrás`;
        if (hours > 0) return `${hours}h atrás`;
        if (minutes > 0) return `${minutes}m atrás`;
        return 'Agora';
    }

    /**
     * Rastreia interação do usuário
     * @param {string} type - Tipo de interação
     * @param {Event} event - Evento
     */
    trackInteraction(type, event) {
        this.metrics.totalInteractions++;
        
        if (type === 'click') {
            this.metrics.clickEvents++;
        } else if (type === 'keyboard') {
            this.metrics.keyboardEvents++;
        }
    }

    /**
     * Gera CSS base do sistema
     * @returns {string} - CSS gerado
     */
    generateCSS() {
        return `
            .grupogps-alert-system {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                line-height: 1.5;
                color: var(--text-color, #333);
                background: var(--bg-color, #fff);
                height: 100vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .grupogps-alert-system.dark-mode {
                --text-color: #e0e0e0;
                --bg-color: #1a1a1a;
                --border-color: #333;
                --header-bg: #2a2a2a;
                --sidebar-bg: #252525;
                --card-bg: #2a2a2a;
            }

            .grupogps-alert-system.light-mode {
                --text-color: #333;
                --bg-color: #fff;
                --border-color: #ddd;
                --header-bg: #f8f9fa;
                --sidebar-bg: #f5f5f5;
                --card-bg: #fff;
            }

            .ui-header {
                background: var(--header-bg);
                border-bottom: 1px solid var(--border-color);
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }

            .system-title {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }

            .ui-main {
                display: flex;
                flex: 1;
                overflow: hidden;
            }

            .sidebar {
                width: 280px;
                background: var(--sidebar-bg);
                border-right: 1px solid var(--border-color);
                padding: 1rem;
                overflow-y: auto;
                flex-shrink: 0;
            }

            .content-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .btn {
                padding: 0.5rem 1rem;
                border: 1px solid var(--border-color);
                background: var(--card-bg);
                color: var(--text-color);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .btn:hover {
                opacity: 0.8;
                transform: translateY(-1px);
            }

            .btn-icon {
                padding: 0.5rem;
                width: 2.5rem;
                height: 2.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .alert-item {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 1rem;
                margin-bottom: 0.5rem;
                transition: all 0.2s;
            }

            .alert-item:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .severity-critical { border-left: 4px solid #e74c3c; }
            .severity-high { border-left: 4px solid #f39c12; }
            .severity-medium { border-left: 4px solid #3498db; }
            .severity-low { border-left: 4px solid #27ae60; }

            .loading-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 1rem;
                padding: 2rem;
                flex-direction: column;
            }

            .spinner {
                width: 2rem;
                height: 2rem;
                border: 2px solid var(--border-color);
                border-top-color: #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .no-alerts {
                text-align: center;
                padding: 3rem;
                color: #666;
            }

            .no-alerts-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
            }

            @media (max-width: 768px) {
                .ui-main {
                    flex-direction: column;
                }
                
                .sidebar {
                    width: 100%;
                    height: auto;
                    max-height: 200px;
                }
                
                .sidebar.collapsed {
                    height: 0;
                    overflow: hidden;
                    padding: 0 1rem;
                }
            }
        `;
    }

    /**
     * Gera CSS customizado
     * @param {Object} customTheme - Tema customizado
     * @returns {string} - CSS customizado
     */
    generateCustomCSS(customTheme) {
        let css = '';
        
        Object.entries(customTheme).forEach(([property, value]) => {
            css += `.grupogps-alert-system { --${property}: ${value}; }\n`;
        });
        
        return css;
    }

    /**
     * Gera conteúdo do modal de configurações
     * @returns {string} - HTML das configurações
     */
    generateSettingsContent() {
        return `
            <div class="settings-content">
                <div class="settings-section">
                    <h4>Aparência</h4>
                    <label>
                        <input type="checkbox" ${this.state.darkMode ? 'checked' : ''}> 
                        Modo escuro
                    </label>
                </div>
                
                <div class="settings-section">
                    <h4>Atualizações</h4>
                    <label>
                        <input type="checkbox" ${this.config.autoRefresh ? 'checked' : ''}> 
                        Atualização automática
                    </label>
                    <label>
                        Intervalo: 
                        <select>
                            <option value="10000">10 segundos</option>
                            <option value="30000" selected>30 segundos</option>
                            <option value="60000">1 minuto</option>
                        </select>
                    </label>
                </div>
            </div>
        `;
    }

    /**
     * Cria templates HTML reutilizáveis
     * @returns {Object} - Templates organizados
     */
    createTemplates() {
        return {
            alertItem: (alert) => this.renderAlertItem(alert),
            loadingSpinner: () => '<div class="spinner"></div>',
            errorMessage: (message) => `<div class="error-message">${message}</div>`
        };
    }

    /**
     * Dispara evento customizado
     * @param {string} eventName - Nome do evento
     * @param {any} data - Dados do evento
     */
    dispatchEvent(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.container.dispatchEvent(event);
        
        this.logger.debug('UIManager: Evento disparado', {
            eventName,
            data
        });
    }

    /**
     * Obtém métricas da UI
     * @returns {Object} - Métricas
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - (this.initTime || Date.now()),
            componentsLoaded: this.components.size,
            eventListeners: this.eventListeners.size
        };
    }

    /**
     * Destrói o gerenciador e limpa recursos
     */
    destroy() {
        try {
            // Para auto-refresh
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }

            // Remove event listeners
            window.removeEventListener('resize', this.handleResize);
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
            document.removeEventListener('keydown', this.handleKeyboard);

            // Destrói componentes
            this.components.forEach(component => {
                if (component.destroy) {
                    component.destroy();
                }
            });
            this.components.clear();

            // Limpa container
            if (this.container) {
                this.container.innerHTML = '';
            }

            // Remove folhas de estilo
            const styles = document.querySelectorAll('style[data-grupogps-theme], style[data-grupogps-custom]');
            styles.forEach(style => style.remove());

            this.isInitialized = false;

            this.logger.info('UIManager: Sistema de UI destruído');

        } catch (error) {
            this.logger.error('UIManager: Erro ao destruir sistema', {
                error: error.message
            });
        }
    }
}

export default UIManager;
