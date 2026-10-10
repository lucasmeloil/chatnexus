# Diretrizes Operacionais do Agente - NEXUS Chat

## 🎯 Regras Fundamentais de Execução

1. **Escopo Estrito e Pontual**:
   - Os prompts do usuário são sempre diretos e objetivos.
   - O agente **SÓ PODE ALTERAR O QUE FOR EXPRESSAMENTE FALADO E SOLICITADO NO PROMPT**.
   - É proibido realizar refatorações, limpezas ou alterações em arquivos, funções ou estilos que não foram diretamente requisitados.

2. **Protocolo para Erros Encontrados no Caminho**:
   - Se durante a execução da tarefa o agente encontrar qualquer erro, bug, falha ou aviso que **o usuário não pediu para corrigir no prompt**:
     - **NÃO altere o código diretamente**.
     - **Informe o usuário imediatamente sobre o erro encontrado**.
     - **Pergunte explicitamente se o usuário deseja que esse erro seja corrigido**.
     - **Aguarde a aprovação explícita do usuário** antes de mexer em qualquer linha ou arquivo relacionado a esse erro.

3. **Protocolo para Melhorias Não Solicitadas**:
   - Se o agente identificar qualquer oportunidade de melhoria, refatoração arquitetural ou necessidade de alterar algo que o usuário **não pediu**:
     - **NÃO altere o código diretamente**.
     - **Apresente uma pergunta e/ou relatório explicativo prévio ao usuário**, detalhando:
       1. Qual é o arquivo ou componente.
       2. O que foi observado.
       3. Por que a melhoria é recomendada (benefício técnico ou de usabilidade).
       4. Impactos potenciais.
     - **Aguarde a aprovação explícita do usuário** antes de realizar qualquer alteração fora do escopo do prompt.

4. **Integridade da Aplicação**:
   - Manter a compatibilidade com o ecossistema NEXUS Chat (Next.js 16, React 19, Baileys, Prisma, MySQL, Socket.IO).
   - Preservar regras de privacidade e isolamento multiatendente em vigor.
