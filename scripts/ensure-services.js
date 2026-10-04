const net = require("net");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");

function log(msg) {
  console.log(`\x1b[36m[NEXUS Services]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[NEXUS Services] ✓\x1b[0m ${msg}`);
}

function logWarning(msg) {
  console.log(`\x1b[33m[NEXUS Services] ⚠\x1b[0m ${msg}`);
}

function logError(msg) {
  console.log(`\x1b[31m[NEXUS Services] ✖\x1b[0m ${msg}`);
}

// 1. Extrair configurações do banco do .env
function getDbConfig() {
  let host = "localhost";
  let port = 3306;

  if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, "utf-8");
    const dbUrlMatch = envContent.match(/^DATABASE_URL=["']?(mysql:\/\/[^"'\r\n]+)["']?/m);
    if (dbUrlMatch) {
      try {
        const url = new URL(dbUrlMatch[1]);
        host = url.hostname || "localhost";
        port = parseInt(url.port || "3306", 10);
      } catch {
        // Fallback para localhost:3306
      }
    }
  }

  return { host, port };
}

// 2. Verificar conexão TCP com porta
function checkTcpPort(host, port, timeout = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host === "localhost" ? "127.0.0.1" : host);
  });
}

function isDockerRunning() {
  try {
    execSync("docker info --format {{.ServerVersion}}", {
      stdio: "ignore",
      timeout: 4000,
    });
    return true;
  } catch {
    return false;
  }
}

async function startDockerDaemon() {
  log("Docker Desktop não está em execução. Tentando inicializar...");

  if (process.platform === "win32") {
    const dockerPaths = [
      "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
      path.join(process.env.LOCALAPPDATA || "", "Docker", "Docker Desktop.exe"),
      path.join(process.env.PROGRAMFILES || "", "Docker", "Docker", "Docker Desktop.exe"),
    ];

    const exePath = dockerPaths.find((p) => fs.existsSync(p));
    if (exePath) {
      const child = spawn(exePath, [], { detached: true, stdio: "ignore" });
      child.unref();
      log(`Iniciando processo do Docker Desktop (${exePath})...`);
    } else {
      // Tentar via PowerShell Start-Process caso esteja no PATH
      try {
        execSync('powershell -Command "Start-Process \'Docker Desktop\'"', { stdio: "ignore" });
      } catch {
        logWarning("Executável do Docker Desktop não encontrado nos caminhos padrão.");
      }
    }
  } else if (process.platform === "darwin") {
    try {
      execSync("open -a Docker", { stdio: "ignore" });
    } catch (e) {
      logWarning("Não foi possível abrir o Docker no macOS.");
    }
  } else {
    try {
      execSync("sudo systemctl start docker", { stdio: "ignore" });
    } catch {
      logWarning("Não foi possível iniciar o serviço docker via systemctl.");
    }
  }

  log("Aguardando inicialização do daemon do Docker...");
  const maxWaitMs = 60000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 2500));
    if (isDockerRunning()) {
      logSuccess("Docker Desktop iniciado com sucesso!");
      return true;
    }
  }

  logError("Tempo limite atingido aguardando o Docker iniciar. Inicie o Docker manualmente.");
  return false;
}

function startDatabaseContainer() {
  log("Iniciando container do MySQL...");

  // Verificar se o container wa-akg-db já existe
  try {
    const existing = execSync('docker ps -a --filter name=wa-akg-db --format "{{.Names}}"', {
      encoding: "utf-8",
    }).trim();

    if (existing === "wa-akg-db") {
      log("Container wa-akg-db encontrado. Executando 'docker start wa-akg-db'...");
      execSync("docker start wa-akg-db", { stdio: "inherit" });
      return;
    }
  } catch {
    // Continuar para docker compose
  }

  // Fallback para docker compose
  try {
    log("Executando 'docker compose up -d db'...");
    execSync("docker compose up -d db", { cwd: ROOT_DIR, stdio: "inherit" });
  } catch (err) {
    logWarning("Tentando 'docker start wa-akg-db' caso haja conflito de nome...");
    try {
      execSync("docker start wa-akg-db", { stdio: "inherit" });
    } catch (e) {
      logError("Falha ao subir container do banco: " + (err.message || err));
    }
  }
}

async function waitForDbReady(host, port, maxTimeoutMs = 30000) {
  log(`Aguardando MySQL aceitar conexões em ${host}:${port}...`);
  const start = Date.now();

  while (Date.now() - start < maxTimeoutMs) {
    const ready = await checkTcpPort(host, port, 1000);
    if (ready) {
      logSuccess(`MySQL está pronto e respondendo em ${host}:${port}!`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  logError(`Tempo limite excedido aguardando MySQL na porta ${port}.`);
  return false;
}

async function main() {
  const { host, port } = getDbConfig();

  // 1. Checa se o MySQL já está pronto
  const isAlreadyUp = await checkTcpPort(host, port, 800);
  if (isAlreadyUp) {
    logSuccess(`Serviço MySQL já está em execução na porta ${port}.`);
    return;
  }

  logWarning(`MySQL não está respondendo em ${host}:${port}. Verificando serviços...`);

  // 2. Garante que o Docker está rodando
  if (!isDockerRunning()) {
    const dockerStarted = await startDockerDaemon();
    if (!dockerStarted) {
      logError("Não foi possível inicializar o Docker automaticamente.");
      return;
    }
  }

  // 3. Sobe o container do MySQL
  startDatabaseContainer();

  // 4. Aguarda a porta estar aberta
  await waitForDbReady(host, port);
}

main().catch((err) => {
  logError("Erro inesperado no gerenciador de serviços: " + (err.message || err));
});
