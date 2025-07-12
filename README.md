-----

# Sistema de Alertas GrupoGPS v4.2

Um sistema web robusto para monitoramento e gestão de alertas operacionais baseados em dados de telemetria. A aplicação permite a criação de regras customizadas, visualização de histórico, investigação de alertas e geração de relatórios.

## 📋 Visão Geral

O Sistema de Alertas é uma aplicação *client-side* (executada no navegador) que processa dados de telemetria de equipamentos para identificar anomalias e eventos que necessitam de atenção. Ele foi projetado para ser totalmente configurável e integrado a um repositório GitHub para persistência e versionamento de dados e regras.

## ✨ Funcionalidades Principais

  * **Dashboard de Alertas**: Painel principal com estatísticas rápidas sobre o total de alertas, alertas do dia, alertas críticos e pendentes.
  * **Histórico de Alertas**: Visualize, filtre e pesquise todos os alertas gerados. Os filtros incluem equipamento, gravidade, status e período.
  * **Configuração de Regras**: Crie, edite, ative/desative e exclua regras de alerta de forma dinâmica. As regras podem ser baseadas em status da telemetria (ex: motor desligado por mais de X minutos) ou em apontamentos manuais.
  * **Investigação de Alertas**: Uma interface dedicada para investigar cada alerta, permitindo adicionar informações como placa, motorista, supervisor, observações e ações tomadas.
  * **Integração com WhatsApp**: Gere um texto formatado com os detalhes do alerta para compartilhar rapidamente com supervisores e motoristas.
  * **Relatórios e Exportação**: Gere relatórios detalhados com base em filtros de período e status e exporte os dados para Excel (.xlsx).
  * **Sincronização com GitHub**: Configure um token de acesso pessoal do GitHub para salvar e carregar o histórico de alertas e as regras diretamente de um repositório, garantindo persistência e backup dos dados.

## 📂 Estrutura de Diretórios

O projeto utiliza uma estrutura de pastas simples para organizar os dados operacionais e as configurações:

```
/
├── alertas/
│   ├── alertas-atual.json   # Arquivo com os alertas operacionais atuais (NÃO APAGAR)
│   └── backup-YYYY-MM-DD.json # Backups diários que podem ser removidos
├── config/
│   └── README.md            # Instruções sobre os arquivos de configuração
├── regras/
│   └── regras-ativas.json   # Arquivo com todas as regras de alerta ativas e inativas
├── relatorios/
│   └── README.md            # Informações sobre os relatórios gerados
└── index.html               # O arquivo principal da aplicação
```

## 🚀 Como Configurar e Usar

O sistema foi projetado para funcionar diretamente no navegador, sem a necessidade de um servidor back-end.

### 1\. Configuração da Integração com GitHub (Obrigatório para Persistência)

Para que os alertas e regras sejam salvos de forma persistente, é crucial configurar a integração com o GitHub.

1.  **Navegue até a aba "Configurações"** na aplicação.
2.  **Crie um Personal Access Token (Clássico)** no seu GitHub:
      * Acesse `GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)`.
      * Clique em "Generate new token".
      * Dê um nome ao token (ex: `Sistema Alertas GrupoGPS`).
      * Conceda as permissões de `repo` e `read:user`.
      * Copie o token gerado.
3.  **Insira o Token** no campo "Token GitHub (Personal Access Token)" na aplicação.
4.  **Defina o Repositório**: O padrão é `GrupoGps-Mecanizada/Sistema-De-Alerta`, ajuste se necessário.
5.  **Salve as Configurações**. O sistema irá testar a conexão e, se bem-sucedido, começará a sincronizar os dados.

### 2\. Uso da Aplicação

  * **Histórico de Alertas**: Acompanhe os alertas em tempo real. Use os filtros para encontrar eventos específicos e clique em "Investigar" para adicionar detalhes a um alerta.
  * **Configurar Regras**: Vá para a aba "Configurar Regras" para adaptar o sistema às suas necessidades. Crie regras para diferentes status e durações.
      * **Exemplo de Regra**:
          * **Nome**: "Motor Desligado"
          * **Tipo**: "Status de Telemetria"
          * **Status do Motor**: "Motor Desligado"
          * **Condição**: "Maior que"
          * **Duração**: 60 minutos
          * **Gravidade**: "Alto"
          * **Mensagem**: `{equipamento} - há {tempo} com motor Desligado`
  * **Relatórios**: Na aba "Relatórios", selecione o período e os filtros desejados, clique em "Gerar Relatório" para visualizar os dados e em "Exportar Excel" para baixar o arquivo.

## 🛠️ Tecnologias Utilizadas

  * **HTML5**
  * **CSS3**
  * **JavaScript (ES6+)**
  * **SheetJS (xlsx.full.min.js)**: Para exportação de relatórios em formato Excel.

## ✍️ Autor

Desenvolvido por **Warlison Abreu** | © 2025 GrupoGPS.
