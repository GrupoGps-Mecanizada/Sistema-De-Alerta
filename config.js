window.SISTEMA_ALERTAS_CONFIG = {
    // ==============================================
    // ⭐ CONFIGURAÇÃO OBRIGATÓRIA - EDITE AQUI ⭐
    // ==============================================
    
    // SEU TOKEN GITHUB (substitua a linha abaixo)
    GITHUB_TOKEN: "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", // ← SUBSTITUA por seu token real
    
    // ==============================================
    // CONFIGURAÇÕES DOS REPOSITÓRIOS
    // ==============================================
    
    // Repositório do sistema (geralmente não precisa alterar)
    REPO_SISTEMA: "GrupoGps-Mecanizada/Sistema-De-Alerta",
    
    // Repositório dos dados (geralmente não precisa alterar)
    REPO_DADOS: "GrupoGps-Mecanizada/Banco-De-Dados",
    
    // ==============================================
    // URLs DOS DADOS (múltiplas opções para robustez)
    // ==============================================
    
    // URLs onde o sistema tentará buscar os apontamentos
    // No seu config.js existente, altere para:
    APONTAMENTOS_URLS: [
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/Apontamentos/apontamentos-atuais.csv",
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/csv/apontamentos.csv",
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/data/apontamentos.csv",
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/apontamentos.csv"
    ],
    
    // URLs onde o sistema tentará buscar a telemetria
    TELEMETRIA_URLS: [
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/Timeline/latest-fleet-data.json",
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/telemetria/dados-frota.json",
        "https://raw.githubusercontent.com/GrupoGps-Mecanizada/Banco-De-Dados/main/data/telemetria.json"
    ],
    
    // ==============================================
    // CONFIGURAÇÕES DE CORRELAÇÃO DE APONTAMENTOS
    // ==============================================
    
    APONTAMENTOS_CONFIG: {
        // Quantas horas antes do alerta buscar apontamentos relacionados
        JANELA_BUSCA_HORAS: 3,
        
        // Máximo de apontamentos relacionados a exibir
        MAX_APONTAMENTOS: 5,
        
        // Mínimo de minutos de sobreposição para considerar relacionado
        MIN_SOBREPOSICAO_MINUTOS: 15
    },
    
    // ==============================================
    // OUTRAS CONFIGURAÇÕES
    // ==============================================
    
    // Intervalo de sincronização em minutos
    SYNC_INTERVAL_MINUTES: 5,
    
    // Duração do cache em minutos
    CACHE_DURACAO_MINUTOS: 30,
    
    // ==============================================
    // VALIDAÇÃO AUTOMÁTICA (NÃO ALTERAR)
    // ==============================================
    
    validate: function() {
        const issues = [];
        
        if (!this.GITHUB_TOKEN || this.GITHUB_TOKEN === "SEU_TOKEN_GITHUB_AQUI") {
            issues.push("❌ GITHUB_TOKEN não configurado - substitua 'SEU_TOKEN_GITHUB_AQUI' pelo seu token real");
        }
        
        if (this.GITHUB_TOKEN && this.GITHUB_TOKEN.length < 20) {
            issues.push("⚠️ GITHUB_TOKEN parece inválido - tokens GitHub têm pelo menos 20 caracteres");
        }
        
        if (!this.REPO_SISTEMA) {
            issues.push("❌ REPO_SISTEMA não configurado");
        }
        
        if (!this.REPO_DADOS) {
            issues.push("❌ REPO_DADOS não configurado");
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
};
