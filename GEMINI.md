# Diretrizes Operacionais do Agente - NEXUS Chat

## 🎯 Regra Fundamental de Execução

1. **Escopo Estrito e Pontual**:
   - Os prompts do usuário são sempre diretos e objetivos.
   - O agente **SÓ PODE ALTERAR O QUE FOR EXPRESSAMENTE FALADO E SOLICITADO NO PROMPT**.
   - É proibido realizar refatorações, limpezas ou alterações em arquivos, funções ou estilos que não foram diretamente requisitados.

2. **Protocolo para Melhorias Não Solicitadas**:
   - Se o agente identificar qualquer oportunidade de melhoria, correção adjacente, refatoração arquitetural ou necessidade de alterar algo que o usuário **não pediu**:
     - **NÃO altere o código diretamente**.
     - **Apresente uma pergunta e/ou relatório explicativo prévio ao usuário**, detalhando:
       1. Qual é o arquivo ou componente.
       2. O que foi observado.
       3. Por que a melhoria é recomendada (benefício técnico ou de usabilidade).
       4. Impactos potenciais.
     - **Aguarde a aprovação explícita do usuário** antes de realizar qualquer alteração fora do escopo do prompt.

3. **Integridade da Aplicação**:
   - Manter a compatibilidade com o ecossistema NEXUS Chat (Next.js 16, React 19, Baileys, Prisma, MySQL, Socket.IO).
   - Preservar regras de privacidade e isolamento multiatendente em vigor.
