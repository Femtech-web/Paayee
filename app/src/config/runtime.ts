export const runtimeConfig = {
  realIntegrationsEnabled: process.env.EXPO_PUBLIC_ENABLE_REAL_INTEGRATIONS === 'true',
  showAuthFlow: process.env.EXPO_PUBLIC_SHOW_AUTH_FLOW !== 'false',
  showOnboarding: process.env.EXPO_PUBLIC_SHOW_ONBOARDING !== 'false',
  paayeeAutoShieldPolicyEnabled: process.env.EXPO_PUBLIC_PAAYEE_AUTO_SHIELD_POLICY_ENABLED !== 'false',
  zamaMobileRuntimeEnabled: process.env.EXPO_PUBLIC_ZAMA_MOBILE_RUNTIME_ENABLED === 'true',
} as const;
