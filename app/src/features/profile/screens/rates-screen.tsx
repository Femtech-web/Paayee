import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import {
  getKlydeRates,
  type KlydeRates,
} from '@/integrations/klyde/client';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { profileStyles as styles } from '../profile-screen.styles';

export function RatesScreen() {
  const [rates, setRates] = useState<KlydeRates>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    getKlydeRates({ baseCurrency: 'NGN', currencies: ['USD', 'USDC', 'USDT'] })
      .then((rateSet) => {
        if (mounted) {
          setRates(rateSet);
        }
      })
      .catch(() => {
        if (mounted) {
          setErrorMessage('Live rates are not available right now.');
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

  const rows = useMemo(() => createRateRows(rates), [rates]);

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Our rates</Text>
        <Text style={styles.subtitle}>Indicative live rates from Klyde. Conversion screens still use a fresh quote before you continue.</Text>
      </FadeInView>
      <FadeInView delay={110} style={styles.ratesGrid}>
        {loading ? (
          <View style={styles.rateRow}>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>Loading live rates</Text>
              <Text style={styles.rateValue}>Fetching current Klyde valuation data.</Text>
            </View>
          </View>
        ) : null}
        {!loading && errorMessage ? (
          <View style={styles.rateRow}>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>Rates unavailable</Text>
              <Text style={styles.rateValue}>{errorMessage}</Text>
            </View>
          </View>
        ) : null}
        {!loading && !errorMessage && rows.length === 0 ? (
          <View style={styles.rateRow}>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>No rates to show yet</Text>
              <Text style={styles.rateValue}>Fund a supported balance and Paayee will show live valuation rates here.</Text>
            </View>
          </View>
        ) : null}
        {rows.map((row) => (
          <View key={row.currency} style={styles.rateRow}>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>{row.currency} → NGN</Text>
              <Text style={styles.rateValue}>{row.forward}</Text>
            </View>
            <View style={styles.rateCol}>
              <Text style={styles.ratePair}>NGN → {row.currency}</Text>
              <Text style={styles.rateValue}>{row.reverse}</Text>
            </View>
          </View>
        ))}
      </FadeInView>
      {rates ? (
        <Text style={styles.noteText}>Updated {formatRateDate(rates.asOf)} · {rates.confidence} rate</Text>
      ) : null}
    </ProfileShell>
  );
}

function createRateRows(rateSet?: KlydeRates): Array<{
  currency: string;
  forward: string;
  reverse: string;
}> {
  if (!rateSet || rateSet.baseCurrency.toUpperCase() !== 'NGN') {
    return [];
  }

  const rows = new Map<string, { currency: string; forward: string; reverse: string }>();

  rateSet.rates.forEach((item) => {
    const currency = item.currency.toUpperCase();
    const rate = Number(item.rate);

    if (currency === 'NGN' || !Number.isFinite(rate) || rate <= 0 || rows.has(currency)) {
      return;
    }

    rows.set(currency, {
      currency,
      forward: `1 ${currency} ≈ ${formatNaira(1 / rate)}`,
      reverse: `₦1 ≈ ${formatToken(rate)} ${currency}`,
    });
  });

  return [...rows.values()];
}

function formatNaira(value: number): string {
  return `₦${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}`;
}

function formatToken(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value < 0.01 ? 6 : 4,
  }).format(value);
}

function formatRateDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}
