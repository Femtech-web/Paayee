export type KlydeEnvironment = 'local' | 'sandbox' | 'production';

export type KlydeConfig = {
  apiUrl: string;
  appId: string;
  environment: KlydeEnvironment;
  market: string;
};

const defaultConfig: KlydeConfig = {
  apiUrl: 'http://localhost:4000',
  appId: 'app_paayee_local',
  environment: 'local',
  market: 'NG',
};

export function getKlydeConfig(): KlydeConfig {
  return {
    apiUrl: normalizeApiUrl(process.env.EXPO_PUBLIC_KLYDE_API_URL ?? defaultConfig.apiUrl),
    appId: process.env.EXPO_PUBLIC_KLYDE_APP_ID ?? defaultConfig.appId,
    environment: normalizeEnvironment(
      process.env.EXPO_PUBLIC_KLYDE_ENVIRONMENT ?? defaultConfig.environment,
    ),
    market: process.env.EXPO_PUBLIC_KLYDE_MARKET ?? defaultConfig.market,
  };
}

function normalizeApiUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, '');
}

function normalizeEnvironment(value: string): KlydeEnvironment {
  if (value === 'local' || value === 'sandbox' || value === 'production') {
    return value;
  }

  return defaultConfig.environment;
}
