import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { runtimeConfig } from '@/config/runtime';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

export function isSupabaseConfigured() {
  return Boolean(
    runtimeConfig.realIntegrationsEnabled &&
      supabaseUrl?.startsWith('http') &&
      supabaseAnonKey &&
      !supabaseAnonKey.includes('replace-with'),
  );
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Enable real integrations and add Supabase credentials to app/.env.');
  }

  if (!client) {
    client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: secureStoreAdapter,
      },
    });
  }

  return client;
}
