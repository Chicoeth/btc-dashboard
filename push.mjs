/**
 * push.mjs
 * Envia arquivos gerados pelo Claude direto para o GitHub via API REST.
 *
 * Configuração (uma vez só):
 *   1. Crie um arquivo .env.push na raiz do projeto com:
 *      GITHUB_TOKEN=seu_token_aqui
 *
 *   2. Coloque os arquivos que quer enviar na lista FILES abaixo.
 *
 * Uso:
 *   node push.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// CONFIGURAÇÃO — edite aqui antes de rodar
// ============================================================

const REPO_OWNER = 'Chicoeth';
const REPO_NAME  = 'btc-dashboard';
const BRANCH     = 'main'; // ou 'master', confira no seu repo

/**
 * Lista de arquivos para enviar.
 * Cada entrada tem:
 *   localPath  → caminho do arquivo no seu computador (relativo a este script)
 *   remotePath → caminho no repositório GitHub
 */
const FILES = [
  {
    localPath:  'push.mjs',
    remotePath: 'push.mjs',
  },
];

// ============================================================
// LÓGICA — não precisa editar abaixo
// ============================================================

// Lê o token do arquivo .env.push
function loadToken() {
  const envFile = path.join(__dirname, '.env.push');
  if (!fs.existsSync(envFile)) {
    console.error('❌ Arquivo .env.push não encontrado.');
    console.error('   Crie o arquivo com o conteúdo:');
    console.error('   GITHUB_TOKEN=seu_token_aqui');
    process.exit(1);
  }
  const content = fs.readFileSync(envFile, 'utf-8');
  const match = content.match(/GITHUB_TOKEN\s*=\s*(.+)/);
  if (!match) {
    console.error('❌ GITHUB_TOKEN não encontrado no .env.push');
    process.exit(1);
  }
  return match[1].trim();
}

// Pega o SHA atual do arquivo no GitHub (necessário para update)
async function getFileSHA(token, remotePath) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${remotePath}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return null; // arquivo novo
  if (!res.ok) throw new Error(`Erro ao buscar SHA de ${remotePath}: ${res.status}`);
  const data = await res.json();
  return data.sha;
}

// Envia um arquivo para o GitHub
async function pushFile(token, localPath, remotePath) {
  const fullLocalPath = path.resolve(__dirname, localPath);

  if (!fs.existsSync(fullLocalPath)) {
    console.error(`  ❌ Arquivo local não encontrado: ${fullLocalPath}`);
    return false;
  }

  const content = fs.readFileSync(fullLocalPath);
  const base64  = content.toString('base64');
  const sha     = await getFileSHA(token, remotePath);

  const body = {
    message: `chore: update ${path.basename(remotePath)}`,
    content: base64,
    branch:  BRANCH,
    ...(sha ? { sha } : {}),
  };

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${remotePath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Falha ao enviar ${remotePath}: ${res.status} — ${err}`);
    return false;
  }

  console.log(`  ✅ ${remotePath}`);
  return true;
}

// Main
async function main() {
  if (FILES.length === 0) {
    console.log('⚠️  Nenhum arquivo na lista FILES. Edite o push.mjs e adicione os arquivos.');
    process.exit(0);
  }

  const token = loadToken();
  console.log(`\n🚀 Enviando ${FILES.length} arquivo(s) para ${REPO_OWNER}/${REPO_NAME} [${BRANCH}]\n`);

  let ok = 0;
  let fail = 0;

  for (const { localPath, remotePath } of FILES) {
    const success = await pushFile(token, localPath, remotePath);
    success ? ok++ : fail++;
  }

  console.log(`\n${ok} enviado(s) com sucesso${fail > 0 ? `, ${fail} com erro` : ''}.`);
  if (ok > 0) {
    console.log('🔁 Vercel vai redeployar automaticamente em ~30s.');
  }
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
