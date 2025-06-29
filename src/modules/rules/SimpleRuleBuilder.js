/**
 * Construtor de Regras Simples - SimpleRuleBuilder.js
 * Facilita a criação de regras simples com interface fluente
 */

import { RuleValidator } from './RuleValidator.js';
import { Logger } from '../../utils/logger.js';

export class SimpleRuleBuilder {
  constructor() {
    this.logger = new Logger('SimpleRuleBuilder');
    this.validator = new RuleValidator();
    
    // Estado da regra sendo construída
    this.ruleData = {
      id: null,
      name: '',
      active: true,
      type: 'simple',
      equipmentGroups: [],
      applyToAllGroups: true,
      conditions: {
        apontamento: '',
        status: '',
        operator: 'AND',
        timeOperator: '>',
        timeValue: 0
      },
      severity: 'medium',
      message: ''
    };
  }
  
  /**
   * Define ID da regra
   */
  withId(id) {
    this.ruleData.id = id;
    return this;
  }
  
  /**
   * Define nome da regra
   */
  withName(name) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Nome da regra é obrigatório');
    }
    this.ruleData.name = name.trim();
    return this;
  }
  
  /**
   * Define se regra está ativa
   */
  setActive(active = true) {
    this.ruleData.active = Boolean(active);
    return this;
  }
  
  /**
   * Define se regra está inativa
   */
  setInactive() {
    return this.setActive(false);
  }
  
  /**
   * Define grupos de equipamentos específicos
   */
  forGroups(...groups) {
    if (groups.length === 0) {
      throw new Error('Pelo menos um grupo deve ser especificado');
    }
    
    this.ruleData.equipmentGroups = groups.flat();
    this.ruleData.applyToAllGroups = false;
    return this;
  }
  
  /**
   * Define que regra se aplica a todos os grupos
   */
  forAllGroups() {
    this.ruleData.equipmentGroups = [];
    this.ruleData.applyToAllGroups = true;
    return this;
  }
  
  /**
   * Define condição de apontamento
   */
  whenApontamento(apontamento) {
    if (apontamento && typeof apontamento !== 'string') {
      throw new Error('Apontamento deve ser uma string');
    }
    this.ruleData.conditions.apontamento = apontamento || '';
    return this;
  }
  
  /**
   * Define condição de status do motor
   */
  whenStatus(status) {
    const validStatuses = ['', 'on', 'off', 'stopped', 'maintenance', 'out_of_plant'];
    if (status && !validStatuses.includes(status)) {
      throw new Error(`Status deve ser um dos valores: ${validStatuses.join(', ')}`);
    }
    this.ruleData.conditions.status = status || '';
    return this;
  }
  
  /**
   * Define condição específica: motor ligado
   */
  whenMotorLigado() {
    return this.whenStatus('on');
  }
  
  /**
   * Define condição específica: motor desligado
   */
  whenMotorDesligado() {
    return this.whenStatus('off');
  }
  
  /**
   * Define condição específica: parado com motor ligado
   */
  whenParadoLigado() {
    return this.whenStatus('stopped');
  }
  
  /**
   * Define condição específica: em manutenção
   */
  whenEmManutencao() {
    return this.whenStatus('maintenance');
  }
  
  /**
   * Define condição específica: fora da planta
   */
  whenForaDaPlanta() {
    return this.whenStatus('out_of_plant');
  }
  
  /**
   * Define operador lógico entre condições
   */
  withOperator(operator) {
    const validOperators = ['AND', 'OR'];
    if (!validOperators.includes(operator)) {
      throw new Error(`Operador deve ser: ${validOperators.join(' ou ')}`);
    }
    this.ruleData.conditions.operator = operator;
    return this;
  }
  
  /**
   * Define que todas as condições devem ser atendidas (AND)
   */
  withAND() {
    return this.withOperator('AND');
  }
  
  /**
   * Define que qualquer condição pode ser atendida (OR)
   */
  withOR() {
    return this.withOperator('OR');
  }
  
  /**
   * Define condição de tempo
   */
  withTime(operator, value) {
    const validOperators = ['>', '<', '=', '>=', '<='];
    if (!validOperators.includes(operator)) {
      throw new Error(`Operador de tempo deve ser: ${validOperators.join(', ')}`);
    }
    
    if (typeof value !== 'number' || value < 0) {
      throw new Error('Valor de tempo deve ser um número positivo');
    }
    
    this.ruleData.conditions.timeOperator = operator;
    this.ruleData.conditions.timeValue = value;
    return this;
  }
  
  /**
   * Define condição: tempo maior que valor
   */
  longerThan(minutes) {
    return this.withTime('>', minutes);
  }
  
  /**
   * Define condição: tempo menor que valor
   */
  shorterThan(minutes) {
    return this.withTime('<', minutes);
  }
  
  /**
   * Define condição: tempo igual a valor
   */
  exactly(minutes) {
    return this.withTime('=', minutes);
  }
  
  /**
   * Define condição: tempo maior ou igual a valor
   */
  atLeast(minutes) {
    return this.withTime('>=', minutes);
  }
  
  /**
   * Define condição: tempo menor ou igual a valor
   */
  atMost(minutes) {
    return this.withTime('<=', minutes);
  }
  
  /**
   * Define gravidade da regra
   */
  withSeverity(severity) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      throw new Error(`Gravidade deve ser: ${validSeverities.join(', ')}`);
    }
    this.ruleData.severity = severity;
    return this;
  }
  
  /**
   * Define gravidade como baixa
   */
  asLowSeverity() {
    return this.withSeverity('low');
  }
  
  /**
   * Define gravidade como média
   */
  asMediumSeverity() {
    return this.withSeverity('medium');
  }
  
  /**
   * Define gravidade como alta
   */
  asHighSeverity() {
    return this.withSeverity('high');
  }
  
  /**
   * Define gravidade como crítica
   */
  asCriticalSeverity() {
    return this.withSeverity('critical');
  }
  
  /**
   * Define mensagem personalizada do alerta
   */
  withMessage(message) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Mensagem é obrigatória');
    }
    this.ruleData.message = message.trim();
    return this;
  }
  
  /**
   * Define mensagem usando template padrão
   */
  withDefaultMessage() {
    this.ruleData.message = '{equipamento} - {apontamento} há {tempo}';
    return this;
  }
  
  /**
   * Define mensagem específica para motor ligado
   */
  withMotorLigadoMessage() {
    this.ruleData.message = '{equipamento} - {apontamento} há {tempo} com motor ligado';
    return this;
  }
  
  /**
   * Define mensagem específica para tempo prolongado
   */
  withTempoMessage() {
    this.ruleData.message = '{equipamento} - {apontamento} prolongado há {tempo}';
    return this;
  }
  
  /**
   * Constrói a regra e valida
   */
  build() {
    // Gerar ID se não fornecido
    if (!this.ruleData.id) {
      this.ruleData.id = Date.now();
    }
    
    // Usar mensagem padrão se não fornecida
    if (!this.ruleData.message) {
      this.withDefaultMessage();
    }
    
    // Validar regra construída
    const validation = this.validator.validateSimpleRule(this.ruleData);
    if (!validation.valid) {
      throw new Error(`Regra inválida: ${validation.errors.join(', ')}`);
    }
    
    const rule = { ...this.ruleData };
    
    this.logger.info('Regra simples construída', {
      id: rule.id,
      name: rule.name,
      groups: rule.equipmentGroups.length || 'todos',
      severity: rule.severity
    });
    
    return rule;
  }
  
  /**
   * Constrói e retorna JSON da regra
   */
  toJSON() {
    return JSON.stringify(this.build(), null, 2);
  }
  
  /**
   * Cria uma cópia do builder para modificações
   */
  clone() {
    const cloned = new SimpleRuleBuilder();
    cloned.ruleData = JSON.parse(JSON.stringify(this.ruleData));
    return cloned;
  }
  
  /**
   * Reseta o builder para estado inicial
   */
  reset() {
    this.ruleData = {
      id: null,
      name: '',
      active: true,
      type: 'simple',
      equipmentGroups: [],
      applyToAllGroups: true,
      conditions: {
        apontamento: '',
        status: '',
        operator: 'AND',
        timeOperator: '>',
        timeValue: 0
      },
      severity: 'medium',
      message: ''
    };
    return this;
  }
  
  /**
   * Carrega dados de regra existente para edição
   */
  fromRule(rule) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Regra deve ser um objeto válido');
    }
    
    if (rule.type !== 'simple') {
      throw new Error('Apenas regras simples podem ser carregadas');
    }
    
    this.ruleData = {
      id: rule.id || null,
      name: rule.name || '',
      active: rule.active !== false,
      type: 'simple',
      equipmentGroups: rule.equipmentGroups || [],
      applyToAllGroups: rule.applyToAllGroups !== false,
      conditions: {
        apontamento: rule.conditions?.apontamento || '',
        status: rule.conditions?.status || '',
        operator: rule.conditions?.operator || 'AND',
        timeOperator: rule.conditions?.timeOperator || '>',
        timeValue: rule.conditions?.timeValue || 0
      },
      severity: rule.severity || 'medium',
      message: rule.message || ''
    };
    
    return this;
  }
  
  /**
   * Valida regra atual sem construir
   */
  validate() {
    return this.validator.validateSimpleRule(this.ruleData);
  }
  
  /**
   * Obtém preview da regra atual
   */
  preview() {
    return {
      ...this.ruleData,
      isValid: this.validate().valid,
      estimatedMessage: this.generatePreviewMessage()
    };
  }
  
  /**
   * Gera preview da mensagem com placeholders
   */
  generatePreviewMessage() {
    let message = this.ruleData.message || '{equipamento} - {apontamento} há {tempo}';
    
    // Substituir placeholders por exemplos
    message = message
      .replace(/{equipamento}/g, 'CAMINHÃO EXEMPLO - GPS - 01')
      .replace(/{apontamento}/g, this.ruleData.conditions.apontamento || 'Evento')
      .replace(/{tempo}/g, '45min')
      .replace(/{status}/g, this.ruleData.conditions.status || 'status')
      .replace(/{duracao}/g, '45min')
      .replace(/{grupos}/g, this.ruleData.equipmentGroups.join(', ') || 'Todos');
    
    return message;
  }
  
  /**
   * Métodos estáticos para criação rápida
   */
  
  /**
   * Cria regra para refeição com motor ligado
   */
  static refeicaoComMotorLigado(groups = []) {
    return new SimpleRuleBuilder()
      .withName('Refeição com Motor Ligado')
      .whenApontamento('Refeição Motorista')
      .whenMotorLigado()
      .withAND()
      .longerThan(5)
      .asHighSeverity()
      .withMotorLigadoMessage()
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para documentação prolongada
   */
  static documentacaoProlongada(groups = [], minutes = 45) {
    return new SimpleRuleBuilder()
      .withName('Documentação Prolongada')
      .whenApontamento('Documentação')
      .longerThan(minutes)
      .asMediumSeverity()
      .withTempoMessage()
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para abastecimento com motor ligado
   */
  static abastecimentoComMotor(groups = []) {
    return new SimpleRuleBuilder()
      .withName('Abastecimento com Motor Ligado')
      .whenApontamento('Abastecimento')
      .whenMotorLigado()
      .withAND()
      .longerThan(10)
      .asHighSeverity()
      .withMessage('{equipamento} - Abastecimento há {tempo} com motor ligado')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para preparação prolongada
   */
  static preparacaoProlongada(groups = [], minutes = 60) {
    return new SimpleRuleBuilder()
      .withName('Preparação Prolongada')
      .whenApontamento('Preparação')
      .longerThan(minutes)
      .asMediumSeverity()
      .withMessage('{equipamento} - Preparação há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para aguardando área
   */
  static aguardandoArea(groups = [], minutes = 30) {
    return new SimpleRuleBuilder()
      .withName('Aguardando Área')
      .whenApontamento('Aguardando Área')
      .longerThan(minutes)
      .asMediumSeverity()
      .withMessage('{equipamento} - Aguardando área há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para bloqueio prolongado
   */
  static bloqueioProlongado(groups = [], minutes = 15) {
    return new SimpleRuleBuilder()
      .withName('Bloqueio Prolongado')
      .whenApontamento('Bloqueio')
      .longerThan(minutes)
      .asCriticalSeverity()
      .withMessage('{equipamento} - Bloqueado há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra para equipamento parado muito tempo
   */
  static equipamentoParado(groups = [], minutes = 120) {
    return new SimpleRuleBuilder()
      .withName('Equipamento Parado')
      .whenMotorDesligado()
      .longerThan(minutes)
      .asLowSeverity()
      .withMessage('{equipamento} - Parado há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra genérica customizável
   */
  static custom(name, apontamento, status, timeOperator, timeValue, severity, groups = []) {
    const builder = new SimpleRuleBuilder()
      .withName(name)
      .withTime(timeOperator, timeValue)
      .withSeverity(severity);
    
    if (apontamento) {
      builder.whenApontamento(apontamento);
    }
    
    if (status) {
      builder.whenStatus(status);
    }
    
    if (groups.length > 0) {
      builder.forGroups(...groups);
    } else {
      builder.forAllGroups();
    }
    
    return builder.withDefaultMessage();
  }
}

export default SimpleRuleBuilder;
