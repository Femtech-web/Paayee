export const runtimeConfig = {
  realIntegrationsEnabled: process.env.EXPO_PUBLIC_ENABLE_REAL_INTEGRATIONS === 'true',
  legacyMoneyRailEnabled: process.env.EXPO_PUBLIC_ENABLE_LEGACY_MONEY_RAIL === 'true',
  showAuthFlow: process.env.EXPO_PUBLIC_SHOW_AUTH_FLOW !== 'false',
  showOnboarding: process.env.EXPO_PUBLIC_SHOW_ONBOARDING !== 'false',
  paayeeConversionSettlementEnabled: process.env.EXPO_PUBLIC_PAAYEE_CONVERSION_SETTLEMENT_ENABLED === 'true',
  paayeeApiUrl: process.env.EXPO_PUBLIC_PAAYEE_API_URL?.replace(/\/$/, '') ?? '',
  paayeeCusdcAddress: process.env.EXPO_PUBLIC_PAAYEE_CUSDC_ADDRESS ?? '',
  paayeeCusdtAddress: process.env.EXPO_PUBLIC_PAAYEE_CUSDT_ADDRESS ?? '',
  privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '',
  privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '',
  privyConfigured: Boolean(
    process.env.EXPO_PUBLIC_PRIVY_APP_ID?.trim() && process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID?.trim(),
  ),
  zamaMobileRuntimeEnabled: process.env.EXPO_PUBLIC_ZAMA_MOBILE_RUNTIME_ENABLED === 'true',
  zamaChainId: readPositiveInteger(process.env.EXPO_PUBLIC_ZAMA_CHAIN_ID, 31337),
} as const;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? Number(value) : fallback;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
