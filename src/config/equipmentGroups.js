/**
 * Configuração de Grupos de Equipamentos
 * Sistema de classificação automática baseado em padrões de nomes
 */

export const EQUIPMENT_GROUPS = {
  'ALTA_PRESSAO': {
    name: 'Alta Pressão',
    patterns: ['ALTA PRESSÃO', 'ALTA PRESSAO', 'HIGH PRESSURE'],
    color: '#e74c3c',
    icon: 'ALTA_P',
    priority: 1,
    description: 'Equipamentos de alta pressão para limpeza e desobstrução'
  },
  
  'AUTO_VACUO': {
    name: 'Auto Vácuo',
    patterns: ['AUTO VÁCUO', 'AUTO VACUO', 'AUTO VAC'],
    color: '#3498db',
    icon: 'AUTO_V',
    priority: 2,
    description: 'Equipamentos de sucção automática'
  },
  
  'HIPER_VACUO': {
    name: 'Hiper Vácuo',
    patterns: ['HIPER VÁCUO', 'HIPER VACUO', 'HYPER VAC'],
    color: '#9b59b6',
    icon: 'HIPER_V',
    priority: 2,
    description: 'Equipamentos de sucção de alta potência'
  },
  
  'BROOK': {
    name: 'Brook',
    patterns: ['BROOK'],
    color: '#27ae60',
    icon: 'BROOK',
    priority: 3,
    description: 'Equipamentos especializados Brook'
  },
  
  'TANQUE': {
    name: 'Tanque',
    patterns: ['TANQUE', 'TANK'],
    color: '#f39c12',
    icon: 'TANQUE',
    priority: 4,
    description: 'Equipamentos de tanque'
  },
  
  'CAMINHAO': {
    name: 'Caminhão',
    patterns: ['CAMINHÃO', 'CAMINHAO', 'TRUCK'],
    color: '#34495e',
    icon: 'TRUCK',
    priority: 5,
    description: 'Caminhões gerais'
  }
};

/**
 * Configuração de detecção de grupos
 */
export const GROUP_DETECTION_CONFIG = {
  caseSensitive: false,
  enablePartialMatch: true,
  minimumMatchLength: 4,
  excludeWords: ['GPS', 'SISTEMA', 'EQUIPAMENTO', 'VEÍCULO'],
  
  // Configurações de prioridade para resolução de conflitos
  conflictResolution: 'priority', // 'priority', 'first', 'all'
  
  // Cache de detecções para performance
  enableCache: true,
  cacheSize: 1000,
  
  // Validação de padrões
  validatePatterns: true,
  allowCustomGroups: true
};

/**
 * Configuração padrão para novos grupos customizados
 */
export const DEFAULT_GROUP_CONFIG = {
  name: 'Grupo Personalizado',
  patterns: [],
  color: '#95a5a6',
  icon: 'CUSTOM',
  priority: 999,
  description: 'Grupo criado pelo usuário',
  custom: true
};

/**
 * Mapeamento de cores por severidade para relatórios
 */
export const GROUP_SEVERITY_COLORS = {
  critical: '#e74c3c',
  high: '#f39c12', 
  medium: '#f1c40f',
  low: '#3498db',
  info: '#95a5a6'
};

/**
 * Configuração de ícones alternativos
 */
export const GROUP_ICONS = {
  'ALTA_PRESSAO': ['🔴', '🔥', 'HP'],
  'AUTO_VACUO': ['🔵', '💨', 'AV'],
  'HIPER_VACUO': ['🟣', '⚡', 'HV'],
  'BROOK': ['🟢', '🏗️', 'BK'],
  'TANQUE': ['🟡', '🛢️', 'TK'],
  'CAMINHAO': ['⚫', '🚛', 'TR']
};

/**
 * Função utilitária para validar configuração de grupo
 */
export function validateGroupConfig(groupConfig) {
  const required = ['name', 'patterns', 'color'];
  
  for (const field of required) {
    if (!groupConfig[field]) {
      throw new Error(`Campo obrigatório '${field}' não encontrado na configuração do grupo`);
    }
  }
  
  if (!Array.isArray(groupConfig.patterns) || groupConfig.patterns.length === 0) {
    throw new Error('Campo "patterns" deve ser um array não vazio');
  }
  
  if (!/^#[0-9a-fA-F]{6}$/.test(groupConfig.color)) {
    throw new Error('Campo "color" deve ser um código hexadecimal válido (#rrggbb)');
  }
  
  return true;
}

/**
 * Função para obter configuração de grupo por ID
 */
export function getGroupConfig(groupId) {
  return EQUIPMENT_GROUPS[groupId] || null;
}

/**
 * Função para obter todos os grupos como array
 */
export function getAllGroups() {
  return Object.entries(EQUIPMENT_GROUPS).map(([id, config]) => ({
    id,
    ...config
  }));
}

/**
 * Função para obter grupos ordenados por prioridade
 */
export function getGroupsByPriority() {
  return getAllGroups().sort((a, b) => a.priority - b.priority);
}
