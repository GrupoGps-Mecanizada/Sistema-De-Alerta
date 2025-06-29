grupogps-alert-system/
├── README.md
├── package.json
├── .gitignore
├── rollup.config.js
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.js
│   ├── core/
│   │   ├── AlertSystem.js
│   │   ├── ConsolidationEngine.js
│   │   ├── RuleEngine.js
│   │   └── StateManager.js
│   ├── modules/
│   │   ├── sync/
│   │   │   ├── GitHubAdapter.js
│   │   │   ├── LocalStorageAdapter.js
│   │   │   └── SyncManager.js
│   │   ├── equipment/
│   │   │   ├── GroupDetector.js
│   │   │   ├── GroupManager.js
│   │   │   └── EquipmentClassifier.js
│   │   ├── rules/
│   │   │   ├── SimpleRuleBuilder.js
│   │   │   ├── AdvancedRuleBuilder.js
│   │   │   └── RuleValidator.js
│   │   ├── alerts/
│   │   │   ├── AlertGenerator.js
│   │   │   ├── AlertDeduplicator.js
│   │   │   └── AlertConsolidator.js
│   │   ├── ui/
│   │   │   ├── UIManager.js
│   │   │   ├── TabManager.js
│   │   │   ├── ModalManager.js
│   │   │   ├── NotificationManager.js
│   │   │   └── GroupSelector.js
│   │   └── reports/
│   │       ├── ReportGenerator.js
│   │       ├── ExcelExporter.js
│   │       └── AnalyticsEngine.js
│   ├── utils/
│   │   ├── hash.js
│   │   ├── debounce.js
│   │   ├── dateParser.js
│   │   ├── performance.js
│   │   ├── logger.js
│   │   └── errorHandler.js
│   ├── config/
│   │   ├── default.js
│   │   ├── endpoints.js
│   │   └── equipmentGroups.js
│   └── types/
│       ├── Alert.js
│       ├── Rule.js
│       └── Equipment.js
├── dist/
│   ├── grupogps-alert-system.min.js
│   └── standalone/
│       ├── index.html
│       └── style.css
├── public/
│   ├── index.html
│   └── assets/
├── data-templates/
│   ├── active-states.json
│   ├── alert-rules.json
│   └── alerts-generated.json
└── docs/
    ├── installation.md
    ├── configuration.md
    ├── equipment-groups.md
    └── api-reference.md
