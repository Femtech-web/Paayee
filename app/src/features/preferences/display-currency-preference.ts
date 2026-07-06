import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

export type DisplayCurrency = 'NGN' | 'USD';

const DISPLAY_CURRENCY_KEY = 'paayee.displayCurrency';
const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'NGN';
const displayCurrencies = new Set<DisplayCurrency>(['NGN', 'USD']);

export async function getDisplayCurrencyPreference(): Promise<DisplayCurrency> {
  const storedCurrency = await SecureStore.getItemAsync(DISPLAY_CURRENCY_KEY);

  return isDisplayCurrency(storedCurrency) ? storedCurrency : DEFAULT_DISPLAY_CURRENCY;
}

export async function setDisplayCurrencyPreference(currency: DisplayCurrency): Promise<void> {
  await SecureStore.setItemAsync(DISPLAY_CURRENCY_KEY, currency);
}

export function useDisplayCurrencyPreference(): {
  currency: DisplayCurrency;
  loading: boolean;
  setCurrency: (currency: DisplayCurrency) => Promise<void>;
} {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(DEFAULT_DISPLAY_CURRENCY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getDisplayCurrencyPreference()
      .then((storedCurrency) => {
        if (mounted) {
          setCurrencyState(storedCurrency);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setCurrency = async (nextCurrency: DisplayCurrency) => {
    await setDisplayCurrencyPreference(nextCurrency);
    setCurrencyState(nextCurrency);
  };

  return { currency, loading, setCurrency };
}

function isDisplayCurrency(value: string | null): value is DisplayCurrency {
  return displayCurrencies.has(value as DisplayCurrency);
}
