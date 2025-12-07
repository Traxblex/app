user_problem_statement: "L'application doit être fonctionnelle, notamment l'authentification Discord et la lecture vidéo."

backend:
  - task: "Auth: Discord OAuth Flow"
    implemented: true
    working: false
    file: "backend/server.py"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "L'URI de redirection pointait vers le backend au lieu du frontend. Corrigé dans .env."

  - task: "Database: Seed Data"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history: []

frontend:
  - task: "Page: Login"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Login.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "En attente de la vérification du flux OAuth corrigé."

  - task: "Page: Watch (Video Player)"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/Watch.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history: []

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Vérifier que la redirection Discord renvoie bien vers la page /login"
    - "Vérifier que le frontend échange bien le code contre un token"
    - "Tester la lecture d'une vidéo (seed data)"
  stuck_tasks:
    - "Auth: Discord OAuth Flow"
  test_all: false
  test_priority: "stuck_first"

agent_communication:
  - agent: "main"
    message: "J'ai corrigé l'URI de redirection dans backend/.env. Veuillez tester le flux de connexion complet."