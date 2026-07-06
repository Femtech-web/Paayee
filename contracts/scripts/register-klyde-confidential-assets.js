#!/usr/bin/env node

require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_API_URL = "http://localhost:4000";
const DEFAULT_APP_ID = "app_paayee_local";

async function main() {
  const apiUrl = normalizeApiUrl(process.env.KLYDE_API_URL || DEFAULT_API_URL);
  const appId = process.env.KLYDE_APP_ID || DEFAULT_APP_ID;
  const apiKey = process.env.KLYDE_API_KEY;
  const adminToken = process.env.KLYDE_ADMIN_TOKEN;
  const deployment = readDeploymentOutput();
  const dryRun = process.env.KLYDE_REGISTER_DRY_RUN === "true";

  if (!apiKey && !dryRun) {
    throw new Error("KLYDE_API_KEY is required to register Paayee confidential assets");
  }

  const payloads = deployment.klydeRegistrationPayloads;
  if (!Array.isArray(payloads) || payloads.length === 0) {
    throw new Error("Deployment output does not include klydeRegistrationPayloads");
  }

  const activeRail = resolveActiveRail(deployment);

  console.log(`Paayee privacy mode: ${deployment.privacyMode}`);
  console.log(`Klyde active rail: ${activeRail}`);
  console.log(`Klyde app: ${appId}`);
  console.log(`Klyde API: ${apiUrl}`);

  for (const payload of payloads) {
    const body = normalizeRegistrationPayload(payload, deployment);
    if (dryRun) {
      console.log(`[dry-run] POST /v1/confidential-assets ${JSON.stringify(body)}`);
      continue;
    }

    const asset = await request(`${apiUrl}/v1/confidential-assets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-klyde-api-key": apiKey,
        "x-klyde-app-id": appId,
      },
      body: JSON.stringify(body),
    });
    console.log(
      `Registered ${asset.underlyingSymbol || body.underlyingSymbol} -> ${asset.symbol} at ${asset.tokenAddress} (${asset.mode}${asset.isDefault ? ", default" : ", non-default"})`,
    );
  }

  if (activeRail === "klyde_managed") {
    console.log(
      "Klyde-managed USDC/USDT and cUSDC/cUSDT remain the active funding, subgraph, auto-shield, balance, and conversion rail.",
    );
  }

  const privacyConfig = normalizePrivacyConfig(deployment.klydePrivacyConfig, deployment, activeRail);
  if (dryRun) {
    console.log(`[dry-run] PATCH /v1/developer/apps/${appId}/privacy-config ${JSON.stringify(privacyConfig)}`);
    return;
  }

  if (!adminToken) {
    console.log("KLYDE_ADMIN_TOKEN not set; skipping app privacy-config update.");
    console.log("Set this privacy config through Klyde dashboard/admin API:");
    console.log(JSON.stringify(privacyConfig, null, 2));
    return;
  }

  await request(`${apiUrl}/v1/developer/apps/${encodeURIComponent(appId)}/privacy-config`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(privacyConfig),
  });
  console.log("Updated Klyde app privacy config for Paayee app-managed assets.");
}

function readDeploymentOutput() {
  const filePath =
    process.env.PAAYEE_CONFIDENTIAL_ASSETS_FILE ||
    path.join(process.cwd(), `paayee-confidential-assets.${process.env.PAAYEE_CONTRACTS_NETWORK || "localhost"}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Paayee confidential asset deployment output not found: ${filePath}`);
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveActiveRail(deployment) {
  const configured =
    process.env.KLYDE_ACTIVE_RAIL ||
    deployment.activeRail ||
    deployment.klydePrivacyConfig?.mode ||
    "klyde_managed";

  return configured === "app_managed" ? "app_managed" : "klyde_managed";
}

function normalizeRegistrationPayload(payload, deployment) {
  return {
    chainId: requirePositiveInteger(payload.chainId, "chainId"),
    tokenAddress: requireAddress(payload.tokenAddress, "tokenAddress"),
    symbol: requireString(payload.symbol, "symbol"),
    mode: payload.mode || "app_managed",
    underlyingSymbol: requireString(payload.underlyingSymbol, "underlyingSymbol"),
    underlyingTokenAddress: requireAddress(payload.underlyingTokenAddress, "underlyingTokenAddress"),
    erc7984: payload.erc7984 !== false,
    isDefault: payload.isDefault === true,
    registryAddress: requireAddress(payload.registryAddress || deployment.registry, "registryAddress"),
  };
}

function normalizePrivacyConfig(config, deployment, activeRail) {
  const defaultAssets = config && config.defaultAssets ? config.defaultAssets : {};
  const normalizedDefaultAssets = {};

  for (const [underlyingSymbol, selector] of Object.entries(defaultAssets)) {
    normalizedDefaultAssets[underlyingSymbol.toUpperCase()] = {
      chainId: requirePositiveInteger(selector.chainId || deployment.chainId, `${underlyingSymbol}.chainId`),
      tokenAddress: selector.tokenAddress,
      underlyingTokenAddress: requireAddress(selector.underlyingTokenAddress, `${underlyingSymbol}.underlyingTokenAddress`),
      symbol: requireString(selector.symbol, `${underlyingSymbol}.symbol`),
      registryAddress: selector.registryAddress || deployment.registry,
    };
  }

  return {
    mode: activeRail,
    allowAppManagedAssets: config?.allowAppManagedAssets !== false,
    defaultAssets: normalizedDefaultAssets,
  };
}

async function request(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? Array.isArray(payload.message)
          ? payload.message.join(". ")
          : payload.message
        : `HTTP ${response.status}`;
    throw new Error(`Klyde request failed: ${message}`);
  }

  return payload;
}

function normalizeApiUrl(value) {
  return value.replace(/\/+$/, "");
}

function requirePositiveInteger(value, name) {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return numberValue;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function requireAddress(value, name) {
  const address = requireString(value, name);
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error(`${name} must be an EVM address`);
  }
  return address.toLowerCase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
