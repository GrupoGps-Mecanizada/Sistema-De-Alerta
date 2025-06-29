/**
 * Classificador de Equipamentos - EquipmentClassifier.js
 * Classificação avançada e análise de equipamentos com machine learning básico
 */

import { Logger } from '../../utils/logger.js';

export class EquipmentClassifier {
  constructor(config = {}) {
    this.config = {
      enableMachineLearning: false,
      confidenceThreshold: 0.7,
      enableFuzzyMatching: true,
      enableContextualAnalysis: true,
      enableLearning: false,
      learningRate: 0.1,
      ...config
    };
    
    this.logger = new Logger('EquipmentClassifier');
    
    // Modelo de classificação simples
    this.classificationModel = new Map();
    this.featureWeights = new Map();
    this.trainingData = [];
    
    // Cache de classificações
    this.classificationCache = new Map();
    
    // Métricas de classificação
    this.metrics = {
      classificationsPerformed: 0,
      correctPredictions: 0,
      incorrectPredictions: 0,
      confidenceSum: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Inicializar modelo básico
    this.initializeBasicModel();
    
    this.logger.debug('EquipmentClassifier inicializado', {
      mlEnabled: this.config.enableMachineLearning,
      fuzzyMatching: this.config.enableFuzzyMatching
    });
  }
  
  /**
   * Classifica um equipamento usando múltiplas estratégias
   */
  classify(equipmentName, additionalContext = {}) {
    this.metrics.classificationsPerformed++;
    
    // Verificar cache
    const cacheKey = this.generateCacheKey(equipmentName, additionalContext);
    if (this.classificationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.classificationCache.get(cacheKey);
    }
    
    this.metrics.cacheMisses++;
    
    // Extrair características
    const features = this.extractFeatures(equipmentName, additionalContext);
    
    // Executar classificações
    const classifications = [];
    
    // Classificação baseada em regras
    const ruleBasedResult = this.classifyByRules(features);
    if (ruleBasedResult) {
      classifications.push({
        method: 'rules',
        ...ruleBasedResult
      });
    }
    
    // Classificação fuzzy se habilitada
    if (this.config.enableFuzzyMatching) {
      const fuzzyResult = this.classifyByFuzzyMatching(features);
      if (fuzzyResult) {
        classifications.push({
          method: 'fuzzy',
          ...fuzzyResult
        });
      }
    }
    
    // Classificação contextual se habilitada
    if (this.config.enableContextualAnalysis) {
      const contextualResult = this.classifyByContext(features, additionalContext);
      if (contextualResult) {
        classifications.push({
          method: 'contextual',
          ...contextualResult
        });
      }
    }
    
    // Classificação por ML se habilitada e modelo treinado
    if (this.config.enableMachineLearning && this.classificationModel.size > 0) {
      const mlResult = this.classifyByMachineLearning(features);
      if (mlResult) {
        classifications.push({
          method: 'ml',
          ...mlResult
        });
      }
    }
    
    // Combinar resultados
    const finalResult = this.combineClassifications(classifications, equipmentName);
    
    // Cache resultado
    this.classificationCache.set(cacheKey, finalResult);
    
    // Atualizar métricas
    this.metrics.confidenceSum += finalResult.confidence;
    
    this.logger.debug('Classificação concluída', {
      equipment: equipmentName,
      methods: classifications.length,
      confidence: finalResult.confidence,
      groups: finalResult.groups
    });
    
    return finalResult;
  }
  
  /**
   * Extrai características do nome do equipamento
   */
  extractFeatures(equipmentName, context = {}) {
    const normalized = equipmentName.toLowerCase();
    
    const features = {
      // Características básicas
      length: equipmentName.length,
      wordCount: normalized.split(/\s+/).length,
      hasNumbers: /\d/.test(normalized),
      hasSpecialChars: /[^a-zA-Z0-9\s]/.test(normalized),
      
      // Palavras-chave específicas
      keywords: {
        pressure: /press[aã]o|pressure|alta/i.test(equipmentName),
        vacuum: /v[aá]cuo|vacuum|suc/i.test(equipmentName),
        auto: /auto/i.test(equipmentName),
        hyper: /hiper|hyper|super/i.test(equipmentName),
        truck: /caminh[aã]o|truck|ve[ií]culo/i.test(equipmentName),
        tank: /tanque|tank|reserv/i.test(equipmentName),
        brook: /brook|brk/i.test(equipmentName),
        gps: /gps/i.test(equipmentName)
      },
      
      // Padrões estruturais
      patterns: {
        hasGPS: /gps/i.test(equipmentName),
        hasNumbers: /\d+/.test(equipmentName),
        hasDashes: /-/.test(equipmentName),
        hasParentheses: /[()]/.test(equipmentName),
        endsWithNumber: /\d+$/.test(equipmentName.trim())
      },
      
      // Características contextuais
      context: {
        hasStatusData: !!context.statusData,
        hasApontamentos: !!context.apontamentos,
        operationalHours: context.operationalHours || 0,
        lastActivity: context.lastActivity || null
      },
      
      // N-gramas para análise textual
      bigrams: this.extractNGrams(normalized, 2),
      trigrams: this.extractNGrams(normalized, 3)
    };
    
    return features;
  }
  
  /**
   * Extrai n-gramas de uma string
   */
  extractNGrams(text, n) {
    const words = text.split(/\s+/);
    const ngrams = [];
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }
  
  /**
   * Classificação baseada em regras determinísticas
   */
  classifyByRules(features) {
    const scores = new Map();
    
    // Regras para Alta Pressão
    if (features.keywords.pressure) {
      scores.set('ALTA_PRESSAO', 0.9);
    }
    
    // Regras para Auto Vácuo
    if (features.keywords.vacuum && features.keywords.auto) {
      scores.set('AUTO_VACUO', 0.9);
    } else if (features.keywords.vacuum) {
      scores.set('AUTO_VACUO', 0.6);
    }
    
    // Regras para Hiper Vácuo
    if (features.keywords.vacuum && features.keywords.hyper) {
      scores.set('HIPER_VACUO', 0.9);
    }
    
    // Regras para Brook
    if (features.keywords.brook) {
      scores.set('BROOK', 0.95);
    }
    
    // Regras para Tanque
    if (features.keywords.tank) {
      scores.set('TANQUE', 0.8);
    }
    
    // Regras para Caminhão (genérico)
    if (features.keywords.truck && scores.size === 0) {
      scores.set('CAMINHAO', 0.5);
    }
    
    if (scores.size === 0) {
      return null;
    }
    
    // Retornar grupo com maior score
    const bestMatch = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      groups: [bestMatch[0]],
      confidence: bestMatch[1],
      scores: Object.fromEntries(scores)
    };
  }
  
  /**
   * Classificação usando correspondência fuzzy
   */
  classifyByFuzzyMatching(features) {
    // Padrões fuzzy conhecidos
    const fuzzyPatterns = {
      'ALTA_PRESSAO': [
        'alta pressao', 'high pressure', 'pressao', 'pressure'
      ],
      'AUTO_VACUO': [
        'auto vacuo', 'auto vac', 'vacuum auto', 'suc auto'
      ],
      'HIPER_VACUO': [
        'hiper vacuo', 'hyper vac', 'super vacuo', 'hiper'
      ],
      'BROOK': [
        'brook', 'brk'
      ],
      'TANQUE': [
        'tanque', 'tank', 'reservatorio'
      ]
    };
    
    const scores = new Map();
    
    // Texto para comparação (bigrams e trigrams)
    const textToMatch = [...features.bigrams, ...features.trigrams].join(' ');
    
    Object.entries(fuzzyPatterns).forEach(([groupId, patterns]) => {
      let maxSimilarity = 0;
      
      patterns.forEach(pattern => {
        const similarity = this.calculateStringSimilarity(textToMatch, pattern);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      });
      
      if (maxSimilarity > this.config.confidenceThreshold * 0.8) {
        scores.set(groupId, maxSimilarity * 0.8); // Reduzir confiança para fuzzy
      }
    });
    
    if (scores.size === 0) {
      return null;
    }
    
    const bestMatch = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      groups: [bestMatch[0]],
      confidence: bestMatch[1],
      scores: Object.fromEntries(scores)
    };
  }
  
  /**
   * Classificação baseada em contexto operacional
   */
  classifyByContext(features, context) {
    if (!context || Object.keys(context).length === 0) {
      return null;
    }
    
    const scores = new Map();
    
    // Análise de padrões operacionais
    if (context.operationalHours) {
      if (context.operationalHours > 16) {
        // Equipamentos de alta utilização podem ser críticos
        scores.set('ALTA_PRESSAO', 0.3);
      }
    }
    
    // Análise de apontamentos
    if (context.apontamentos && Array.isArray(context.apontamentos)) {
      const categories = context.apontamentos.map(a => a.categoria);
      
      if (categories.includes('Documentação')) {
        // Equipamentos com muita documentação podem ser especializados
        scores.set('BROOK', 0.2);
      }
      
      if (categories.includes('Abastecimento')) {
        // Equipamentos que abastecem muito podem ser caminhões
        scores.set('CAMINHAO', 0.3);
      }
    }
    
    // Análise de status
    if (context.statusData && Array.isArray(context.statusData)) {
      const statuses = context.statusData.map(s => s.status);
      
      const onTime = statuses.filter(s => s === 'on').length;
      const totalTime = statuses.length;
      
      if (totalTime > 0) {
        const utilizationRate = onTime / totalTime;
        
        if (utilizationRate > 0.8) {
          // Alta utilização pode indicar equipamento crítico
          scores.set('ALTA_PRESSAO', 0.2);
        }
      }
    }
    
    if (scores.size === 0) {
      return null;
    }
    
    const bestMatch = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      groups: [bestMatch[0]],
      confidence: bestMatch[1],
      scores: Object.fromEntries(scores)
    };
  }
  
  /**
   * Classificação usando modelo de machine learning simples
   */
  classifyByMachineLearning(features) {
    if (this.classificationModel.size === 0) {
      return null;
    }
    
    const scores = new Map();
    
    // Calcular score para cada grupo baseado no modelo
    this.classificationModel.forEach((weights, groupId) => {
      let score = 0;
      
      // Score baseado em características binárias
      Object.entries(features.keywords).forEach(([keyword, present]) => {
        const weight = weights.get(`keyword_${keyword}`) || 0;
        score += present ? weight : -weight * 0.1;
      });
      
      // Score baseado em padrões
      Object.entries(features.patterns).forEach(([pattern, present]) => {
        const weight = weights.get(`pattern_${pattern}`) || 0;
        score += present ? weight : -weight * 0.1;
      });
      
      // Normalizar score
      score = Math.max(0, Math.min(1, score));
      
      if (score > this.config.confidenceThreshold * 0.6) {
        scores.set(groupId, score);
      }
    });
    
    if (scores.size === 0) {
      return null;
    }
    
    const bestMatch = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      groups: [bestMatch[0]],
      confidence: bestMatch[1],
      scores: Object.fromEntries(scores)
    };
  }
  
  /**
   * Combina resultados de múltiplas classificações
   */
  combineClassifications(classifications, equipmentName) {
    if (classifications.length === 0) {
      return {
        groups: [],
        confidence: 0,
        methods: [],
        equipment: equipmentName
      };
    }
    
    if (classifications.length === 1) {
      return {
        groups: classifications[0].groups,
        confidence: classifications[0].confidence,
        methods: [classifications[0].method],
        equipment: equipmentName
      };
    }
    
    // Combinar scores de múltiplos métodos
    const combinedScores = new Map();
    const methodWeights = {
      rules: 0.4,
      fuzzy: 0.3,
      contextual: 0.2,
      ml: 0.1
    };
    
    classifications.forEach(classification => {
      const weight = methodWeights[classification.method] || 0.1;
      
      classification.groups.forEach(groupId => {
        const currentScore = combinedScores.get(groupId) || 0;
        const newScore = classification.confidence * weight;
        combinedScores.set(groupId, currentScore + newScore);
      });
    });
    
    // Encontrar melhor resultado
    if (combinedScores.size === 0) {
      return {
        groups: [],
        confidence: 0,
        methods: classifications.map(c => c.method),
        equipment: equipmentName
      };
    }
    
    const bestMatch = Array.from(combinedScores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      groups: [bestMatch[0]],
      confidence: Math.min(1, bestMatch[1]),
      methods: classifications.map(c => c.method),
      equipment: equipmentName,
      allScores: Object.fromEntries(combinedScores)
    };
  }
  
  /**
   * Treina o modelo com dados de exemplo
   */
  train(trainingData) {
    if (!this.config.enableLearning) {
      this.logger.warn('Aprendizado está desabilitado');
      return;
    }
    
    this.trainingData = [...this.trainingData, ...trainingData];
    
    this.logger.info('Iniciando treinamento do modelo', {
      samples: this.trainingData.length
    });
    
    // Resetar modelo
    this.classificationModel.clear();
    this.featureWeights.clear();
    
    // Agrupar dados por classe
    const groupedData = new Map();
    
    this.trainingData.forEach(sample => {
      sample.expectedGroups.forEach(groupId => {
        if (!groupedData.has(groupId)) {
          groupedData.set(groupId, []);
        }
        groupedData.get(groupId).push(sample);
      });
    });
    
    // Treinar para cada grupo
    groupedData.forEach((samples, groupId) => {
      const weights = this.trainGroupModel(samples, groupId);
      this.classificationModel.set(groupId, weights);
    });
    
    this.logger.info('Treinamento concluído', {
      groups: this.classificationModel.size
    });
  }
  
  /**
   * Treina modelo para um grupo específico
   */
  trainGroupModel(samples, groupId) {
    const weights = new Map();
    
    // Inicializar pesos
    const allFeatures = new Set();
    
    samples.forEach(sample => {
      const features = this.extractFeatures(sample.equipmentName, sample.context);
      
      Object.keys(features.keywords).forEach(k => allFeatures.add(`keyword_${k}`));
      Object.keys(features.patterns).forEach(k => allFeatures.add(`pattern_${k}`));
    });
    
    allFeatures.forEach(feature => {
      weights.set(feature, Math.random() * 0.1); // Inicializar com valores pequenos
    });
    
    // Treinamento simples usando gradiente
    const epochs = 100;
    const learningRate = this.config.learningRate;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      samples.forEach(sample => {
        const features = this.extractFeatures(sample.equipmentName, sample.context);
        const target = sample.expectedGroups.includes(groupId) ? 1 : 0;
        
        // Forward pass
        let prediction = 0;
        Object.entries(features.keywords).forEach(([keyword, present]) => {
          const weight = weights.get(`keyword_${keyword}`) || 0;
          prediction += present ? weight : 0;
        });
        
        Object.entries(features.patterns).forEach(([pattern, present]) => {
          const weight = weights.get(`pattern_${pattern}`) || 0;
          prediction += present ? weight : 0;
        });
        
        prediction = Math.max(0, Math.min(1, prediction)); // Sigmoid simplificado
        
        // Backward pass
        const error = target - prediction;
        
        Object.entries(features.keywords).forEach(([keyword, present]) => {
          if (present) {
            const featureKey = `keyword_${keyword}`;
            const currentWeight = weights.get(featureKey) || 0;
            weights.set(featureKey, currentWeight + learningRate * error);
          }
        });
        
        Object.entries(features.patterns).forEach(([pattern, present]) => {
          if (present) {
            const featureKey = `pattern_${pattern}`;
            const currentWeight = weights.get(featureKey) || 0;
            weights.set(featureKey, currentWeight + learningRate * error);
          }
        });
      });
    }
    
    return weights;
  }
  
  /**
   * Avalia performance do classificador
   */
  evaluate(testData) {
    const results = {
      accuracy: 0,
      precision: new Map(),
      recall: new Map(),
      f1Score: new Map(),
      confusionMatrix: new Map(),
      totalTests: testData.length,
      correctPredictions: 0
    };
    
    // Contadores para métricas
    const truePositives = new Map();
    const falsePositives = new Map();
    const falseNegatives = new Map();
    
    testData.forEach(sample => {
      const prediction = this.classify(sample.equipmentName, sample.context);
      const expected = sample.expectedGroups;
      
      // Verificar se predição está correta
      const isCorrect = expected.length > 0 && 
        expected.some(group => prediction.groups.includes(group));
      
      if (isCorrect) {
        results.correctPredictions++;
      }
      
      // Atualizar contadores para cada grupo
      expected.forEach(expectedGroup => {
        // Inicializar contadores se necessário
        if (!truePositives.has(expectedGroup)) {
          truePositives.set(expectedGroup, 0);
          falsePositives.set(expectedGroup, 0);
          falseNegatives.set(expectedGroup, 0);
        }
        
        if (prediction.groups.includes(expectedGroup)) {
          truePositives.set(expectedGroup, truePositives.get(expectedGroup) + 1);
        } else {
          falseNegatives.set(expectedGroup, falseNegatives.get(expectedGroup) + 1);
        }
      });
      
      prediction.groups.forEach(predictedGroup => {
        if (!expected.includes(predictedGroup)) {
          if (!falsePositives.has(predictedGroup)) {
            falsePositives.set(predictedGroup, 0);
          }
          falsePositives.set(predictedGroup, falsePositives.get(predictedGroup) + 1);
        }
      });
    });
    
    // Calcular métricas
    results.accuracy = results.correctPredictions / results.totalTests;
    
    truePositives.forEach((tp, group) => {
      const fp = falsePositives.get(group) || 0;
      const fn = falseNegatives.get(group) || 0;
      
      const precision = tp / (tp + fp) || 0;
      const recall = tp / (tp + fn) || 0;
      const f1 = (2 * precision * recall) / (precision + recall) || 0;
      
      results.precision.set(group, precision);
      results.recall.set(group, recall);
      results.f1Score.set(group, f1);
    });
    
    return results;
  }
  
  /**
   * Calcula similaridade entre strings usando algoritmo de Jaro-Winkler simplificado
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.calculateEditDistance(str1, str2);
    return (longer.length - editDistance) / longer.length;
  }
  
  /**
   * Calcula distância de edição (Levenshtein)
   */
  calculateEditDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null)
      .map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1,
            matrix[j][i - 1] + 1,
            matrix[j - 1][i - 1] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Gera chave de cache para classificação
   */
  generateCacheKey(equipmentName, context) {
    const contextKey = JSON.stringify(context);
    return `${equipmentName}|${contextKey}`;
  }
  
  /**
   * Inicializa modelo básico com conhecimento pré-definido
   */
  initializeBasicModel() {
    // Pesos iniciais baseados em conhecimento do domínio
    const basicWeights = {
      'ALTA_PRESSAO': new Map([
        ['keyword_pressure', 0.8],
        ['pattern_hasNumbers', 0.2],
        ['pattern_hasGPS', 0.1]
      ]),
      'AUTO_VACUO': new Map([
        ['keyword_vacuum', 0.7],
        ['keyword_auto', 0.6],
        ['pattern_hasNumbers', 0.2]
      ]),
      'HIPER_VACUO': new Map([
        ['keyword_vacuum', 0.7],
        ['keyword_hyper', 0.8],
        ['pattern_hasNumbers', 0.2]
      ]),
      'BROOK': new Map([
        ['keyword_brook', 0.9],
        ['pattern_hasNumbers', 0.1]
      ])
    };
    
    basicWeights.forEach((weights, groupId) => {
      this.classificationModel.set(groupId, weights);
    });
  }
  
  /**
   * Limpa cache de classificações
   */
  clearCache() {
    this.classificationCache.clear();
    this.logger.debug('Cache de classificações limpo');
  }
  
  /**
   * Obtém métricas do classificador
   */
  getMetrics() {
    const accuracy = this.metrics.classificationsPerformed > 0 ?
      this.metrics.correctPredictions / this.metrics.classificationsPerformed : 0;
    
    const averageConfidence = this.metrics.classificationsPerformed > 0 ?
      this.metrics.confidenceSum / this.metrics.classificationsPerformed : 0;
    
    return {
      ...this.metrics,
      accuracy,
      averageConfidence,
      cacheHitRate: this.metrics.classificationsPerformed > 0 ?
        this.metrics.cacheHits / this.metrics.classificationsPerformed : 0,
      modelSize: this.classificationModel.size,
      trainingDataSize: this.trainingData.length
    };
  }
}

export default EquipmentClassifier;
