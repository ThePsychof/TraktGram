import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secretsPath = path.join(projectRoot, '.traktgram-secrets.json');
const credentialsPath = path.join(projectRoot, '.tgcloud', 'credentials');
const apiBase = process.env.TG_CLOUD_API_URL || 'https://cloud.telegram.org';
const baseUrl = process.env.TGCLOUD_BETA === '1'
  ? `${apiBase.replace(/\/+$/, '')}/beta`
  : apiBase;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

async function readSecrets() {
  let content;
  try {
    content = await readFile(secretsPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Create .traktgram-secrets.json using the example in README.md.');
    }
    throw error;
  }

  let secrets;
  try {
    secrets = JSON.parse(content);
  } catch {
    throw new Error('.traktgram-secrets.json must contain valid JSON.');
  }

  if (!secrets || typeof secrets !== 'object' || Array.isArray(secrets)) {
    throw new Error('.traktgram-secrets.json must contain a JSON object.');
  }

  for (const key of [
    'TRAKT_CLIENT_ID',
    'TRAKT_CLIENT_SECRET',
    'TRAKT_API_KEY',
    'OAUTH_REDIRECT_URI',
  ]) {
    if (typeof secrets[key] !== 'string' || !secrets[key].trim()) {
      throw new Error(`.traktgram-secrets.json must include a non-empty ${key}.`);
    }
  }

  return secrets;
}

async function readToken() {
  const token = process.env.TGCLOUD_TOKEN;
  if (token) return token;

  let credentials;
  try {
    credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Link this project first with npx tgcloud login.');
    }
    if (error instanceof SyntaxError) {
      throw new Error('The saved tgcloud credentials file is invalid; run npx tgcloud login again.');
    }
    throw error;
  }

  if (typeof credentials?.token !== 'string' || !credentials.token) {
    throw new Error('No saved CLI token found; run npx tgcloud login.');
  }
  return credentials.token;
}

async function collectSources() {
  const sources = {};

  async function addDirectory(relativeDirectory) {
    const absoluteDirectory = path.join(projectRoot, relativeDirectory);
    let entries;
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }

    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await addDirectory(relativePath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const moduleName = relativePath
          .slice('tgcloud'.length + 1)
          .replaceAll(path.sep, '/')
          .replace(/\.js$/, '');
        sources[moduleName] = await readFile(path.join(projectRoot, relativePath), 'utf8');
      }
    }
  }

  const schemaPath = path.join(projectRoot, 'tgcloud', 'schema.js');
  sources.schema = await readFile(schemaPath, 'utf8');
  for (const directory of ['tgcloud/lib', 'tgcloud/handlers', 'tgcloud/endpoints']) {
    await addDirectory(directory);
  }

  if (!sources['endpoints/configure']) {
    throw new Error('Could not find tgcloud/endpoints/configure.js.');
  }
  return sources;
}

async function main() {
  const secrets = await readSecrets();
  const token = await readToken();
  const match = /^(app\d+):[A-Za-z0-9_-]+$/.exec(token);
  if (!match) throw new Error('The saved CLI token has an invalid format; run npx tgcloud login again.');

  const sources = await collectSources();
  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, '')}/${match[1]}/manage/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        module: 'endpoints/configure',
        sources,
        args: secrets,
        ctx: {},
      }),
    });
  } catch {
    throw new Error(`Could not reach the Telegram Serverless API at ${baseUrl}.`);
  }

  let envelope;
  try {
    envelope = await response.json();
  } catch {
    throw new Error(`Telegram Serverless returned an invalid response (HTTP ${response.status}).`);
  }

  if (!envelope?.ok) {
    let description = envelope?.description || `Telegram Serverless request failed (HTTP ${response.status}).`;
    for (const key of ['TRAKT_CLIENT_ID', 'TRAKT_CLIENT_SECRET', 'TRAKT_API_KEY']) {
      if (secrets[key]) description = description.replaceAll(secrets[key], '[redacted]');
    }
    throw new Error(description);
  }
  if (envelope.result?.result?.configured !== true) {
    throw new Error('Telegram Serverless did not confirm that Trakt configuration was saved.');
  }

  console.log('Trakt credentials configured successfully.');
}

main().catch((error) => fail(error.message || 'Could not configure Trakt credentials.'));
