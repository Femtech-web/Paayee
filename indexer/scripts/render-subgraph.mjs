import { readFileSync, writeFileSync } from 'node:fs';

try {
  const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
} catch {
  // CI may provide values directly without a local .env file.
}

const required = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const replacements = {
  __NETWORK__: required('PAAYEE_SUBGRAPH_NETWORK', 'sepolia'),
  __USDC_ADDRESS__: required('PAAYEE_USDC_ADDRESS', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'),
  __USDT_ADDRESS__: required('PAAYEE_USDT_ADDRESS', '0x93C5d30a7509E60871B77A3548a5BD913334cd35'),
  __CUSDC_ADDRESS__: required('PAAYEE_CUSDC_ADDRESS'),
  __CUSDT_ADDRESS__: required('PAAYEE_CUSDT_ADDRESS'),
  __USDC_START_BLOCK__: required('PAAYEE_USDC_START_BLOCK', '11571471'),
  __USDT_START_BLOCK__: required('PAAYEE_USDT_START_BLOCK', '11571471'),
  __CUSDC_START_BLOCK__: required('PAAYEE_CUSDC_START_BLOCK', process.env.PAAYEE_USDC_START_BLOCK || '11571471'),
  __CUSDT_START_BLOCK__: required('PAAYEE_CUSDT_START_BLOCK', process.env.PAAYEE_USDT_START_BLOCK || '11571471'),
};

let manifest = readFileSync(new URL('../subgraph.template.yaml', import.meta.url), 'utf8');
for (const [placeholder, value] of Object.entries(replacements)) manifest = manifest.replaceAll(placeholder, value);
writeFileSync(new URL('../subgraph.yaml', import.meta.url), manifest);
