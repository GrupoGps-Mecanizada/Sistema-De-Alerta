/**
 * Construtor de Regras Avançadas - AdvancedRuleBuilder.js
 * Facilita criação de regras complexas com lógica avançada e múltiplas condições
 */

import { RuleValidator } from './RuleValidator.js';
import { Logger } from '../../utils/logger.js';

export class AdvancedRuleBuilder {
  constructor() {
    this.logger = new Logger('AdvancedRuleBuilder');
    this.validator = new RuleValidator();
    
    // Estado da regra sendo construída
    this.ruleData = {
      id: null,
      name: '',
      active: true,
      type: 'advanced',
      equipmentGroups: [],
      applyToAllGroups: true,
      conditions: {
        logic: 'AND',
        rules: []
      },
      severity: 'medium',
      message: ''
    };
    
    // Stack para grupos lógicos aninhados
    this.logicStack = [];
    this.currentGroup = this.ruleData.conditions;
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
   * Define lógica principal (AND, OR, NOT)
   */
  withLogic(logic) {
    const validLogics = ['AND', 'OR', 'NOT'];
    if (!validLogics.includes(logic)) {
      throw new Error(`Lógica deve ser: ${validLogics.join(', ')}`);
    }
    this.currentGroup.logic = logic;
    return this;
  }
  
  /**
   * Define lógica como AND (todas as condições)
   */
  withAND() {
    return this.withLogic('AND');
  }
  
  /**
   * Define lógica como OR (qualquer condição)
   */
  withOR() {
    return this.withLogic('OR');
  }
  
  /**
   * Define lógica como NOT (nenhuma condição)
   */
  withNOT() {
    return this.withLogic('NOT');
  }
  
  /**
   * Adiciona condição de apontamento
   */
  addApontamentoCondition(operator, value) {
    return this.addCondition('apontamento', operator, value);
  }
  
  /**
   * Adiciona condição de status
   */
  addStatusCondition(operator, value) {
    return this.addCondition('status', operator, value);
  }
  
  /**
   * Adiciona condição de tempo
   */
  addTimeCondition(operator, value) {
    if (typeof value !== 'number' || value < 0) {
      throw new Error('Valor de tempo deve ser um número positivo');
    }
    return this.addCondition('time', operator, value);
  }
  
  /**
   * Adiciona condição de equipamento
   */
  addEquipmentCondition(operator, value) {
    return this.addCondition('equipment', operator, value);
  }
  
  /**
   * Adiciona condição de grupo
   */
  addGroupCondition(operator, value) {
    return this.addCondition('group', operator, value);
  }
  
  /**
   * Adiciona condição personalizada
   */
  addCondition(type, operator, value) {
    const validTypes = ['apontamento', 'status', 'time', 'equipment', 'group', 'custom'];
    if (!validTypes.includes(type)) {
      throw new Error(`Tipo de condição deve ser: ${validTypes.join(', ')}`);
    }
    
    const validOperators = [
      'equals', 'not_equals', 'contains', 'not_contains',
      'starts_with', 'ends_with', 'regex',
      '>', '<', '>=', '<=', '=',
      'greater_than', 'less_than', 'greater_equal', 'less_equal'
    ];
    
    if (!validOperators.includes(operator)) {
      throw new Error(`Operador inválido: ${operator}`);
    }
    
    if (value === undefined || value === null) {
      throw new Error('Valor da condição é obrigatório');
    }
    
    const condition = {
      type,
      operator,
      value,
      id: this.generateConditionId()
    };
    
    this.currentGroup.rules.push(condition);
    
    this.logger.debug('Condição adicionada', {
      type,
      operator,
      value: typeof value === 'string' ? value.substring(0, 50) : value
    });
    
    return this;
  }
  
  /**
   * Métodos de conveniência para apontamentos
   */
  
  whenApontamentoEquals(value) {
    return this.addApontamentoCondition('equals', value);
  }
  
  whenApontamentoContains(value) {
    return this.addApontamentoCondition('contains', value);
  }
  
  whenApontamentoNot(value) {
    return this.addApontamentoCondition('not_equals', value);
  }
  
  whenDocumentacao() {
    return this.whenApontamentoEquals('Documentação');
  }
  
  whenRefeicao() {
    return this.whenApontamentoEquals('Refeição Motorista');
  }
  
  whenAbastecimento() {
    return this.whenApontamentoEquals('Abastecimento');
  }
  
  whenPreparacao() {
    return this.whenApontamentoEquals('Preparação');
  }
  
  whenAguardandoArea() {
    return this.whenApontamentoEquals('Aguardando Área');
  }
  
  whenBloqueio() {
    return this.whenApontamentoEquals('Bloqueio');
  }
  
  /**
   * Métodos de conveniência para status
   */
  
  whenStatusEquals(value) {
    return this.addStatusCondition('equals', value);
  }
  
  whenMotorLigado() {
    return this.whenStatusEquals('on');
  }
  
  whenMotorDesligado() {
    return this.whenStatusEquals('off');
  }
  
  whenParadoLigado() {
    return this.whenStatusEquals('stopped');
  }
  
  whenEmManutencao() {
    return this.whenStatusEquals('maintenance');
  }
  
  /**
   * Métodos de conveniência para tempo
   */
  
  whenTimeLongerThan(minutes) {
    return this.addTimeCondition('>', minutes);
  }
  
  whenTimeShorterThan(minutes) {
    return this.addTimeCondition('<', minutes);
  }
  
  whenTimeExactly(minutes) {
    return this.addTimeCondition('=', minutes);
  }
  
  whenTimeAtLeast(minutes) {
    return this.addTimeCondition('>=', minutes);
  }
  
  whenTimeAtMost(minutes) {
    return this.addTimeCondition('<=', minutes);
  }
  
  /**
   * Métodos de conveniência para grupos
   */
  
  whenGroupIs(groupId) {
    return this.addGroupCondition('equals', groupId);
  }
  
  whenGroupContains(text) {
    return this.addGroupCondition('contains', text);
  }
  
  whenAltaPressao() {
    return this.whenGroupIs('ALTA_PRESSAO');
  }
  
  whenAutoVacuo() {
    return this.whenGroupIs('AUTO_VACUO');
  }
  
  whenHiperVacuo() {
    return this.whenGroupIs('HIPER_VACUO');
  }
  
  whenBrook() {
    return this.whenGroupIs('BROOK');
  }
  
  /**
   * Inicia um novo grupo lógico aninhado
   */
  startGroup(logic = 'AND') {
    const validLogics = ['AND', 'OR', 'NOT'];
    if (!validLogics.includes(logic)) {
      throw new Error(`Lógica deve ser: ${validLogics.join(', ')}`);
    }
    
    // Salvar contexto atual
    this.logicStack.push(this.currentGroup);
    
    // Criar novo grupo
    const newGroup = {
      logic,
      rules: [],
      id: this.generateGroupId()
    };
    
    // Adicionar novo grupo ao grupo atual
    this.currentGroup.rules.push({
      type: 'group',
      group: newGroup
    });
    
    // Definir novo grupo como atual
    this.currentGroup = newGroup;
    
    this.logger.debug('Grupo lógico iniciado', { logic, id: newGroup.id });
    
    return this;
  }
  
  /**
   * Finaliza grupo lógico atual e retorna ao anterior
   */
  endGroup() {
    if (this.logicStack.length === 0) {
      throw new Error('Nenhum grupo para finalizar');
    }
    
    const finishedGroup = this.currentGroup;
    this.currentGroup = this.logicStack.pop();
    
    this.logger.debug('Grupo lógico finalizado', { 
      id: finishedGroup.id,
      conditions: finishedGroup.rules.length 
    });
    
    return this;
  }
  
  /**
   * Métodos de conveniência para grupos lógicos
   */
  
  startANDGroup() {
    return this.startGroup('AND');
  }
  
  startORGroup() {
    return this.startGroup('OR');
  }
  
  startNOTGroup() {
    return this.startGroup('NOT');
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
  
  asLowSeverity() {
    return this.withSeverity('low');
  }
  
  asMediumSeverity() {
    return this.withSeverity('medium');
  }
  
  asHighSeverity() {
    return this.withSeverity('high');
  }
  
  asCriticalSeverity() {
    return this.withSeverity('critical');
  }
  
  /**
   * Define mensagem do alerta
   */
  withMessage(message) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new Error('Mensagem é obrigatória');
    }
    this.ruleData.message = message.trim();
    return this;
  }
  
  withDefaultMessage() {
    this.ruleData.message = '{equipamento} - Condições complexas atendidas há {tempo}';
    return this;
  }
  
  /**
   * Remove condição por ID
   */
  removeCondition(conditionId) {
    this.removeConditionFromGroup(this.ruleData.conditions, conditionId);
    return this;
  }
  
  /**
   * Remove condição recursivamente de grupos
   */
  removeConditionFromGroup(group, conditionId) {
    group.rules = group.rules.filter(rule => {
      if (rule.id === conditionId) {
        return false;
      }
      
      if (rule.type === 'group') {
        this.removeConditionFromGroup(rule.group, conditionId);
      }
      
      return true;
    });
  }
  
  /**
   * Atualiza condição existente
   */
  updateCondition(conditionId, updates) {
    const condition = this.findCondition(conditionId);
    if (!condition) {
      throw new Error(`Condição com ID ${conditionId} não encontrada`);
    }
    
    Object.assign(condition, updates);
    return this;
  }
  
  /**
   * Encontra condição por ID
   */
  findCondition(conditionId) {
    return this.findConditionInGroup(this.ruleData.conditions, conditionId);
  }
  
  /**
   * Encontra condição recursivamente em grupos
   */
  findConditionInGroup(group, conditionId) {
    for (const rule of group.rules) {
      if (rule.id === conditionId) {
        return rule;
      }
      
      if (rule.type === 'group') {
        const found = this.findConditionInGroup(rule.group, conditionId);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  /**
   * Conta total de condições
   */
  countConditions() {
    return this.countConditionsInGroup(this.ruleData.conditions);
  }
  
  /**
   * Conta condições recursivamente
   */
  countConditionsInGroup(group) {
    let count = 0;
    
    for (const rule of group.rules) {
      if (rule.type === 'group') {
        count += this.countConditionsInGroup(rule.group);
      } else {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Valida estrutura atual
   */
  validate() {
    return this.validator.validateAdvancedRule(this.ruleData);
  }
  
  /**
   * Constrói regra final
   */
  build() {
    // Verificar se há grupos não finalizados
    if (this.logicStack.length > 0) {
      throw new Error('Há grupos lógicos não finalizados. Use endGroup() para finalizar.');
    }
    
    // Gerar ID se não fornecido
    if (!this.ruleData.id) {
      this.ruleData.id = Date.now();
    }
    
    // Usar mensagem padrão se não fornecida
    if (!this.ruleData.message) {
      this.withDefaultMessage();
    }
    
    // Validar regra construída
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Regra inválida: ${validation.errors.join(', ')}`);
    }
    
    const rule = JSON.parse(JSON.stringify(this.ruleData));
    
    this.logger.info('Regra avançada construída', {
      id: rule.id,
      name: rule.name,
      conditions: this.countConditions(),
      groups: rule.equipmentGroups.length || 'todos',
      severity: rule.severity
    });
    
    return rule;
  }
  
  /**
   * Obtém preview da regra
   */
  preview() {
    const validation = this.validate();
    
    return {
      ...this.ruleData,
      isValid: validation.valid,
      errors: validation.errors,
      conditionCount: this.countConditions(),
      estimatedMessage: this.generatePreviewMessage(),
      complexity: this.calculateComplexity()
    };
  }
  
  /**
   * Gera preview da mensagem
   */
  generatePreviewMessage() {
    let message = this.ruleData.message || '{equipamento} - Condições complexas atendidas há {tempo}';
    
    message = message
      .replace(/{equipamento}/g, 'CAMINHÃO EXEMPLO - GPS - 01')
      .replace(/{tempo}/g, '45min')
      .replace(/{duracao}/g, '45min')
      .replace(/{grupos}/g, this.ruleData.equipmentGroups.join(', ') || 'Todos');
    
    return message;
  }
  
  /**
   * Calcula complexidade da regra
   */
  calculateComplexity() {
    const conditionCount = this.countConditions();
    const groupDepth = this.calculateMaxDepth(this.ruleData.conditions);
    const logicVariety = this.countLogicTypes();
    
    let complexity = 'simple';
    
    if (conditionCount > 5 || groupDepth > 2 || logicVariety > 1) {
      complexity = 'complex';
    } else if (conditionCount > 2 || groupDepth > 1) {
      complexity = 'medium';
    }
    
    return {
      level: complexity,
      conditionCount,
      groupDepth,
      logicVariety
    };
  }
  
  /**
   * Calcula profundidade máxima de grupos aninhados
   */
  calculateMaxDepth(group, currentDepth = 0) {
    let maxDepth = currentDepth;
    
    for (const rule of group.rules) {
      if (rule.type === 'group') {
        const depth = this.calculateMaxDepth(rule.group, currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Conta tipos de lógica diferentes usados
   */
  countLogicTypes() {
    const logicTypes = new Set();
    this.collectLogicTypes(this.ruleData.conditions, logicTypes);
    return logicTypes.size;
  }
  
  /**
   * Coleta tipos de lógica recursivamente
   */
  collectLogicTypes(group, logicTypes) {
    logicTypes.add(group.logic);
    
    for (const rule of group.rules) {
      if (rule.type === 'group') {
        this.collectLogicTypes(rule.group, logicTypes);
      }
    }
  }
  
  /**
   * Clona builder atual
   */
  clone() {
    const cloned = new AdvancedRuleBuilder();
    cloned.ruleData = JSON.parse(JSON.stringify(this.ruleData));
    cloned.logicStack = JSON.parse(JSON.stringify(this.logicStack));
    cloned.currentGroup = cloned.findGroupById(cloned.ruleData.conditions, this.currentGroup.id);
    return cloned;
  }
  
  /**
   * Encontra grupo por ID na estrutura
   */
  findGroupById(group, id) {
    if (group.id === id) return group;
    
    for (const rule of group.rules) {
      if (rule.type === 'group') {
        const found = this.findGroupById(rule.group, id);
        if (found) return found;
      }
    }
    
    return group; // Fallback para grupo raiz
  }
  
  /**
   * Carrega regra existente para edição
   */
  fromRule(rule) {
    if (!rule || typeof rule !== 'object') {
      throw new Error('Regra deve ser um objeto válido');
    }
    
    if (rule.type !== 'advanced') {
      throw new Error('Apenas regras avançadas podem ser carregadas');
    }
    
    this.ruleData = JSON.parse(JSON.stringify(rule));
    this.logicStack = [];
    this.currentGroup = this.ruleData.conditions;
    
    // Garantir que grupos tenham IDs
    this.ensureGroupIds(this.ruleData.conditions);
    
    return this;
  }
  
  /**
   * Garante que todos os grupos e condições tenham IDs
   */
  ensureGroupIds(group) {
    if (!group.id) {
      group.id = this.generateGroupId();
    }
    
    group.rules.forEach(rule => {
      if (!rule.id) {
        rule.id = this.generateConditionId();
      }
      
      if (rule.type === 'group') {
        this.ensureGroupIds(rule.group);
      }
    });
  }
  
  /**
   * Gera ID único para condição
   */
  generateConditionId() {
    return `condition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Gera ID único para grupo
   */
  generateGroupId() {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Converte para JSON
   */
  toJSON() {
    return JSON.stringify(this.build(), null, 2);
  }
  
  /**
   * Métodos estáticos para criação rápida
   */
  
  /**
   * Cria regra complexa para documentação com motor ligado
   */
  static documentacaoComMotor(groups = [], minutes = 30) {
    return new AdvancedRuleBuilder()
      .withName('Documentação + Motor Ligado (Complexa)')
      .withAND()
      .whenDocumentacao()
      .whenMotorLigado()
      .whenTimeLongerThan(minutes)
      .asCriticalSeverity()
      .withMessage('{equipamento} - Documentação com motor ligado há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra com condições alternativas
   */
  static refeicaoOuAbastecimentoComMotor(groups = []) {
    return new AdvancedRuleBuilder()
      .withName('Refeição ou Abastecimento com Motor')
      .withAND()
      .startORGroup()
        .whenRefeicao()
        .whenAbastecimento()
      .endGroup()
      .whenMotorLigado()
      .whenTimeLongerThan(10)
      .asHighSeverity()
      .withMessage('{equipamento} - Atividade com motor ligado há {tempo}')
      .forGroups(...groups);
  }
  
  /**
   * Cria regra com negação
   */
  static semApontamentoComMotor(groups = [], minutes = 60) {
    return new AdvancedRuleBuilder()
      .withName('Sem Apontamento + Motor Ligado')
      .withAND()
      .startNOTGroup()
        .whenDocumentacao()
        .whenRefeicao()
        .whenAbastecimento()
      .endGroup()
      .whenMotorLigado()
      .whenTimeLongerThan(minutes)
      .asMediumSeverity()
      .withMessage('{equipamento} - Motor ligado sem apontamento há {tempo}')
      .forGroups(...groups);
  }
}

export default AdvancedRuleBuilder;
