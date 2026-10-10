---
name: nexus-chat-governance
description: Governança estrita para o NEXUS Chat. Exige alteração exclusiva do que foi solicitado no prompt e notificação/pergunta obrigatória ao usuário sobre qualquer erro encontrado no caminho antes de corrigir.
---

# Governança e Escopo Estrito — NEXUS Chat

Esta skill define as regras inegociáveis de operação no projeto **NEXUS Chat**.

## 🎯 Regras Fundamentais de Execução

1. **Escopo Estrito e Pontual**:
   - Os prompts do usuário são sempre diretos e objetivos.
   - O agente **SÓ PODE ALTERAR O QUE FOR EXPRESSAMENTE FALADO E SOLICITADO NO PROMPT**.
   - É terminantemente proibido realizar refatorações, limpezas, renomeações ou alterações em arquivos, funções ou estilos que não foram diretamente requisitados.

2. **Protocolo Obrigatório para Erros Encontrados no Caminho**:
   - Se durante o desenvolvimento ou execução o agente encontrar qualquer erro, bug, falha ou aviso que **o usuário não pediu para corrigir no prompt**:
     - **NÃO alterar o código diretamente.**
     - **O agente DEVE informar o usuário imediatamente sobre o erro encontrado.**
     - **O agente DEVE perguntar expressamente se o usuário deseja que esse erro seja corrigido.**
     - **Aguardar autorização explícita do usuário** antes de mexer em qualquer linha ou arquivo relacionado a esse erro.

3. **Protocolo para Melhorias Não Solicitadas**:
   - Se o agente identificar qualquer oportunidade de melhoria arquitetural ou técnica:
     - **NÃO altere o código diretamente.**
     - **Apresente uma pergunta e relatório prévio ao usuário** detalhando arquivo, situação, benefício e impacto.
     - **Aguarde a aprovação explícita do usuário**.

4. **Integridade da Aplicação**:
   - Manter compatibilidade com Next.js 16, React 19, Baileys, Prisma, MySQL e Socket.IO.
   - Preservar regras de privacidade e isolamento multiatendente.
