# 🚀 NEXUS Chat — Enterprise WhatsApp Gateway & Multi-Attendant Customer Service Platform

<div align="center">

![NEXUS Chat](public/nexus-icon.png)

**Plataforma corporativa de atendimento WhatsApp multiatendente, gateway de automação e gestão centralizada de conversas em tempo real.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black?style=for-the-badge&logo=socket.io)](https://socket.io/)

</div>

---

## 📋 Sumário
- [Sobre o NEXUS Chat](#-sobre-o-nexus-chat)
- [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
- [Principais Funcionalidades](#-principais-funcionalidades)
- [Estrutura de Diretórios](#-estrutura-de-diretórios)
- [Guia de Instalação e Execução](#-guia-de-instalação-e-execução)
- [Configuração de Ambiente (.env)](#-configuração-de-ambiente-env)
- [Módulos em Detalhes](#-módulos-em-detalhes)
- [Webhooks e Integração n8n](#-webhooks-e-integração-n8n)
- [Documentação OpenAPI / Swagger](#-documentação-openapi--swagger)
- [Diretrizes de Manutenção](#-diretrizes-de-manutenção)

---

## 🌟 Sobre o NEXUS Chat

O **NEXUS Chat** é uma solução completa para empresas que necessitam profissionalizar o atendimento via WhatsApp com múltiplos atendentes operando simultaneamente, sem risco de conflito ou vazamento de mensagens entre operadores.

Além de fornecer um **Live Chat** moderno e reativo inspirado no WhatsApp Web, o NEXUS Chat atua como um **Gateway RESTful de alta performance**, permitindo envio e recebimento de mensagens, automações via n8n, disparos em massa com proteção anti-banimento e integração com CRMs externos via Webhooks.

---

## 🏗️ Arquitetura e Tecnologias

```mermaid
graph TD
    Client([WhatsApp App - Celular / Cliente]) <-->|WhatsApp WebSocket| Baileys[Baileys Engine @whiskeysockets]
    Baileys <--> Store[Store & Event Sync - src/modules/whatsapp]
    Store <--> Prisma[(Prisma ORM - MySQL 8.0)]
    Store <--> SocketIO[Socket.IO Server - src/server/index.ts]
    SocketIO <--> DashboardUI[Frontend Reativo - Next.js 16 + React 19]
    DashboardUI <--> NextAPI[Next.js App Router API]
    NextAPI <--> Prisma
    Store -.->|Disparo de Eventos| WebhookService[Webhooks Corporativos / n8n]
```

### Stack Tecnológica:
- **Core Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Biblioteca de UI**: [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/)
- **Componentes**: [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/)
- **WhatsApp Engine**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) (v7 RC)
- **Persistência de Dados**: [Prisma ORM](https://www.prisma.io/) com banco de dados **MySQL 8.0**
- **Comunicação em Tempo Real**: [Socket.IO](https://socket.io/) (comunicação bidirecional imediata para mensagens, presença e eventos de atendimento)
- **Agendamento de Tarefas**: [node-cron](https://www.npmjs.com/package/node-cron)
- **Autenticação**: [NextAuth.js](https://next-auth.js.org/) (v5 beta) com papéis `SUPERADMIN`, `ADMIN` e `ATTENDANT`
- **Áudio e Mídia**: Gravação de áudio nativa no navegador com conversão e streaming Opus/OGG

---

## 🔥 Principais Funcionalidades

### 1. 👥 Atendimento Multiatendente com Isolamento de Privacidade
- **Fila de Espera Automática**: Novas conversas de clientes entram na fila de espera com alertas visuais e sonoros para toda a equipe.
- **Atendimento Exclusivo**: Ao clicar em **"Aceitar Atendimento"**, o cliente fica vinculado exclusivamente ao operador. Outros atendentes comuns não visualizam o conteúdo nem podem interferir, garantindo conformidade e privacidade.
- **Transferência Ágil**: Permite transferir a conversa para outro atendente ou redistribuir por setor (*Comercial, Suporte, Financeiro, Pessoal*) com mensagem explicativa opcional para o cliente.
- **Encerramento Profissional**: Finalização do atendimento com adição automática da etiqueta `#Finalizado` e envio opcional de mensagem formal de conclusão.

### 2. 📇 Gestão Inteligente de Contatos
- **Detecção de Contato Não Salvo**: Alerta visual no cabeçalho e botão de ação rápida para salvar contatos não cadastrados na agenda do sistema em 1 clique.
- **Foto de Perfil em Alta Resolução**: Carregamento em segundo plano da foto pública do WhatsApp e possibilidade de upload de foto customizada.
- **Cadastro Completo**: Suporte a Nome, Empresa, Setor/Tag e Observações internas por cliente.

### 3. 💬 Experiência de Chat Rica e Moderna
- **Gravação de Áudio PTT**: Gravador de voz integrado com contagem de tempo e envio imediato no formato oficial de nota de voz do WhatsApp.
- **Mídias Diversificadas**: Envio e pré-visualização de Imagens, Vídeos, Documentos (PDF, DOCX, XLSX, etc.) e Figurinhas (Stickers).
- **Citação de Mensagens (Reply)**: Responder a mensagens específicas com contexto visual destacado.
- **Status de Mensagens**: Indicadores de status em tempo real (Relógio = Pendente, 1 Check = Enviado, 2 Checks = Entregue, 2 Checks Azuis = Lido).
- **Anti-Delete de Mensagens**: Mensagens apagadas pelo remetente são preservadas no banco com o selo de proteção `🛡️ [Deleted by sender — preserved]`.

### 4. 🏷️ Etiquetas (Labels) e Respostas Rápidas (Quick Replies)
- **Etiquetas Coloridas**: Categorização ágil de chats para organização comercial e de suporte.
- **Quick Replies**: Envio de mensagens frequentes digitando `/` no campo de texto ou selecionando no menu rápido.

### 5. 📢 Broadcast e Disparos em Massa
- Envio em massa com intervalo aleatório inteligente (10 a 30 segundos) para prevenir bloqueios de conta pela Meta.
- Filtro por etiquetas e status de atendimento.

### 6. ⏰ Agendamento de Mensagens (Scheduler)
- Agendamento de envios com data e horário futuros, incluindo suporte a arquivos de mídia.

---

## 📁 Estrutura de Diretórios

```
NexusChat/
├── .agents/                      # Configurações e regras do agente Antigravity
│   └── rules/                    # Regras operacionais específicas
├── AGENTS.md                     # Regras fundamentais do projeto para agentes
├── GEMINI.md                     # Diretrizes operacionais para IAs
├── prisma/                       # Modelagem do banco de dados
│   └── schema.prisma             # Schemas Prisma (Session, Contact, Message, Attendance, etc.)
├── public/                       # Arquivos estáticos e ícones
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Rotas de login e autenticação
│   │   ├── api/                  # Endpoints REST (chat, messages, contacts, attendance, etc.)
│   │   ├── dashboard/            # Páginas do painel administrativo e live chat
│   │   └── docs/                 # Documentação Swagger / OpenAPI interativa
│   ├── components/               # Componentes reutilizáveis
│   │   ├── chat/                 # ChatWindow, ChatList, ContactInfoDialog, EmojiPicker, etc.
│   │   ├── dashboard/            # Sidebar, Navbar, MobileNav, Métricas
│   │   └── ui/                   # Primitivos Radix UI estilizados
│   ├── lib/                      # Utilitários compartilhados
│   │   ├── api-auth.ts           # Validação de permissões e sessões de API
│   │   ├── jid-utils.ts          # Normalização de JIDs brasileiros (+55, 9º dígito, LID)
│   │   ├── prisma.ts             # Instância singleton do Prisma Client
│   │   ├── socket.ts             # Cliente Socket.IO para o frontend
│   │   └── webhook.ts            # Despachador de webhooks corporativos
│   ├── modules/whatsapp/         # Camada de integração com Baileys
│   │   ├── attendance.service.ts # Lógica de filas, aceitação e isolamento
│   │   ├── chat.service.ts       # Envio de mensagens e mídias
│   │   ├── instance.ts           # Gerenciamento de instâncias e sockets Baileys
│   │   └── store/                # Sincronização de contatos, chats e mensagens
│   └── server/                   # Servidor customizado Express + Socket.IO + Next.js
│       └── index.ts              # Entrypoint principal do sistema
└── package.json                  # Dependências e scripts do projeto
```

---

## ⚙️ Guia de Instalação e Execução

### 1. Pré-requisitos
- **Node.js**: Versão 20.x ou superior (v22/v24 recomendada)
- **MySQL**: 8.0 ou superior (rodando localmente ou via container Docker na porta `3306`)

### 2. Clonar e Instalar Dependências
```bash
# Entrar no diretório do projeto
cd d:/NexusChat

# Instalar pacotes
npm install
```

### 3. Configurar o Banco de Dados
Certifique-se de que o MySQL está em execução e sincronize as tabelas:
```bash
# Cria e atualiza as tabelas no MySQL conforme o schema.prisma
npx prisma db push

# Gera o cliente tipado do Prisma
npx prisma generate
```

### 4. Executar em Modo de Desenvolvimento
```bash
npm run dev
```
O servidor inicializará o backend Express com Socket.IO e o Next.js na porta **3000**:
- **Painel do NEXUS Chat**: [http://localhost:3000](http://localhost:3000)
- **Documentação da API**: [http://localhost:3000/docs](http://localhost:3000/docs)

### 5. Compilação para Produção
```bash
# Compilar projeto Next.js
npm run build

# Iniciar servidor em ambiente de produção
npm start
```

---

## 🔐 Configuração de Ambiente (.env)

Exemplo de configuração essencial do arquivo `.env`:

```env
# Servidor e Banco de Dados
PORT=3000
DATABASE_URL="mysql://root:SUA_SENHA@localhost:3306/wa_akg"
NODE_ENV=development
HOSTNAME="localhost"

# NextAuth & Segurança
AUTH_SECRET="sua_chave_secreta_jwt_de_pelo_menos_32_caracteres"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

# URLs Públicas
BASE_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"

# Credenciais de Administrador Padrão
ADMIN_EMAIL="admin@nexuschat.com"
ADMIN_PASSWORD="sua_senha_superadmin"

# Documentação Swagger
NEXT_PUBLIC_SWAGGER_ENABLED=true
NEXT_PUBLIC_SWAGGER_USERNAME=admin
NEXT_PUBLIC_SWAGGER_PASSWORD=admin_docs_pass
```

---

## 🧩 Webhooks e Integração n8n

O NEXUS Chat suporta envio de webhooks em tempo real para automações externas.

### Principais Eventos Emitidos:
- `message.received`: Disparado imediatamente quando uma mensagem é recebida de um cliente.
- `message.sent`: Disparado quando uma mensagem é enviada pelo atendente ou bot.
- `message.deleted`: Disparado quando um usuário apaga uma mensagem.
- `attendance.update`: Disparado quando um atendimento é aceito, transferido ou encerrado.
- `connection.update`: Mudanças no status de conexão da sessão do WhatsApp (conectado, desconectado, QR code).

---

## 📘 Documentação OpenAPI / Swagger

O sistema inclui documentação interativa completa de todas as rotas da API em `/docs`.
- **Acesso**: Navegue até [http://localhost:3000/docs](http://localhost:3000/docs)
- **Autenticação da API**: As rotas protegidas utilizam cabeçalho `Authorization: Bearer <API_KEY>` ou sessão autenticada.

---

## 🛡️ Diretrizes de Manutenção

Para qualquer modificação ou expansão no código:
- Respeitar rigorosamente o arquivo [AGENTS.md](file:///d:/NexusChat/AGENTS.md) e [GEMINI.md](file:///d:/NexusChat/GEMINI.md).
- O agente só pode alterar o que for solicitado diretamente no prompt.
- Quaisquer sugestões ou melhorias não solicitadas devem ser apresentadas antecipadamente via relatório/pergunta para aprovação do usuário.
