export const runtimeConfig = {
  realIntegrationsEnabled: process.env.EXPO_PUBLIC_ENABLE_REAL_INTEGRATIONS === 'true',
  showAuthFlow: process.env.EXPO_PUBLIC_SHOW_AUTH_FLOW !== 'false',
  showOnboarding: process.env.EXPO_PUBLIC_SHOW_ONBOARDING !== 'false',
} as const;
