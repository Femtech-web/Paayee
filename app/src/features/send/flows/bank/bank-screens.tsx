import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { runtimeConfig } from '@/config/runtime';
import { useAppData } from '@/features/app-data';
import { listKlydeBanks, resolveKlydeBankAccount } from '@/integrations/klyde';
import {
  bankOptions,
  fallbackBankRecipient,
  toBankSendRecipient,
  type BankOption,
  type SendRecipient,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import {
  defaultNgnAsset,
  SharedAmountScreen,
} from '../shared/amount-screen';
import { ScreenShell, TopBar } from '../shared/send-layout';
import { BankPickerSheet } from '../shared/send-sheets';
import {
  FieldLabel,
  FilterChip,
  FooterButton,
  EmptyRecipients,
  RecipientRow,
} from '../shared/send-ui';
import { createBankAmountHref } from '../shared/send-utils';

export function SendBankScreen() {
  const router = useRouter();
  const { data } = useAppData();
  const [query, setQuery] = useState('');
  const recipients = useMemo(
    () =>
      data?.recipients
        .map(toBankSendRecipient)
        .filter((recipient): recipient is SendRecipient => recipient !== null) ??
      [],
    [data?.recipients],
  );
  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return recipients;
    }

    return recipients.filter((recipient) =>
      `${recipient.name} ${recipient.bankName} ${recipient.accountNumber}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query, recipients]);

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send to a bank account</Text>
        <Text style={styles.subtitle}>Pick a saved recipient or add a new NGN account.</Text>
      </FadeInView>

      <FadeInView delay={110}>
        <PressableScale
          onPress={() => router.push('/send/bank/new' as Href)}
          style={styles.newRecipientCard}>
          <View style={styles.newRecipientCopy}>
            <Feather name="user-plus" size={22} color="#303747" />
            <Text style={styles.newRecipientText}>Send to a new recipient</Text>
          </View>
          <Feather name="arrow-right" size={22} color="#303747" />
        </PressableScale>
      </FadeInView>

      <View style={styles.divider} />

      <FadeInView delay={150} style={styles.searchBox}>
        <Feather name="search" size={22} color="#8F96A3" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or account details"
          placeholderTextColor="#B7BDC8"
          style={styles.searchInput}
        />
      </FadeInView>

      <FadeInView delay={190} style={styles.chipRow}>
        <FilterChip label="All" active />
        <FilterChip label="NGN" />
        <FilterChip label="More..." />
      </FadeInView>

      <FadeInView delay={230} style={styles.recipientList}>
        <Text style={styles.sectionTitle}>Recent recipients</Text>
        {filteredRecipients.length > 0 ? (
          filteredRecipients.map((recipient) => (
            <RecipientRow
              key={recipient.id}
              recipient={recipient}
              onPress={() => router.push(createBankAmountHref(recipient))}
            />
          ))
        ) : (
          <EmptyRecipients />
        )}
      </FadeInView>
    </ScreenShell>
  );
}

export function NewBankRecipientScreen() {
  const router = useRouter();
  const [banks, setBanks] = useState<BankOption[]>(bankOptions);
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankLoadError, setBankLoadError] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const fallbackAccountName =
    !runtimeConfig.realIntegrationsEnabled && selectedBank && accountNumber.length === 10
      ? 'Bank recipient'
      : '';
  const resolvedAccountName = accountName || fallbackAccountName;
  const missingBankCodeError =
    runtimeConfig.realIntegrationsEnabled &&
    selectedBank &&
    accountNumber.length === 10 &&
    !selectedBank.code
      ? 'This bank cannot be verified right now. Please select another bank.'
      : '';
  const isResolved = Boolean(selectedBank && resolvedAccountName && accountNumber.length === 10);
  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(bankQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled) {
      return;
    }

    let mounted = true;

    listKlydeBanks({ country: 'NG', currency: 'NGN' })
      .then((result) => {
        if (!mounted) {
          return;
        }

        setBanks(
          result.map((bank) => ({
            code: bank.code,
            id: bank.id || bank.code,
            name: bank.name,
            provider: bank.provider,
          })),
        );
        setBankLoadError('');
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        setBankLoadError(error instanceof Error ? error.message : 'Could not load live bank list.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedBank || accountNumber.length !== 10) {
      return;
    }

    if (!runtimeConfig.realIntegrationsEnabled) {
      return;
    }

    if (!selectedBank.code) {
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      setResolvingAccount(true);

      resolveKlydeBankAccount({
        accountNumber,
        bankCode: selectedBank.code ?? '',
        bankName: selectedBank.name,
        country: 'NG',
      })
        .then((result) => {
          if (!mounted) {
            return;
          }

          setAccountName(result.accountName);
          setResolveError('');
        })
        .catch((error) => {
          if (!mounted) {
            return;
          }

          setResolveError(
            error instanceof Error ? error.message : 'Could not confirm this account name.',
          );
        })
        .finally(() => {
          if (mounted) {
            setResolvingAccount(false);
          }
        });
    }, 450);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [accountNumber, selectedBank]);

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send to a new recipient</Text>
        <Text style={styles.subtitle}>Enter the account details and Paayee will confirm the name.</Text>
      </FadeInView>

      <FadeInView delay={120} style={styles.form}>
        <FieldLabel label="Recipient country">
          <View style={[styles.field, styles.fieldMuted]}>
            <Text style={styles.fieldText}>Nigeria</Text>
            <Feather name="chevron-down" size={20} color="#3F4653" />
          </View>
        </FieldLabel>

        <FieldLabel label="Bank name">
          <Pressable onPress={() => setBankPickerOpen((open) => !open)} style={styles.field}>
            <Text style={[styles.fieldText, !selectedBank && styles.placeholder]}>
              {selectedBank?.name ?? 'Select bank'}
            </Text>
            <Feather name="chevron-down" size={20} color="#3F4653" />
          </Pressable>
          {bankLoadError ? <Text style={styles.errorText}>{bankLoadError}</Text> : null}
        </FieldLabel>

        <FieldLabel label="Account number">
          <View style={styles.field}>
            <TextInput
              value={accountNumber}
              onChangeText={(value) => {
                setAccountNumber(value.replace(/\D/g, '').slice(0, 10));
                setAccountName('');
                setResolveError('');
                setResolvingAccount(false);
              }}
              keyboardType="number-pad"
              placeholder="Enter account number"
              placeholderTextColor="#B7BDC8"
              style={styles.textInput}
            />
          </View>
        </FieldLabel>

        <FieldLabel label="Account name">
          <View style={[styles.field, styles.fieldMuted]}>
            <Text style={[styles.fieldText, !resolvedAccountName && styles.placeholder]}>
              {resolvedAccountName || (resolvingAccount ? 'Confirming account...' : 'Account name')}
            </Text>
          </View>
          {resolveError || missingBankCodeError ? (
            <Text style={styles.errorText}>{resolveError || missingBankCodeError}</Text>
          ) : null}
        </FieldLabel>
      </FadeInView>

      <FooterButton
        disabled={!isResolved}
        label="Continue"
        onPress={() =>
          router.push(
            `/send/bank/amount?name=${encodeURIComponent(resolvedAccountName)}&bank=${encodeURIComponent(
              selectedBank?.name ?? '',
            )}&account=${accountNumber}&initials=${encodeURIComponent(
              createInitials(resolvedAccountName),
            )}&bankCode=${encodeURIComponent(selectedBank?.code ?? '')}` as Href,
          )
        }
      />
      <BankPickerSheet
        banks={filteredBanks}
        onClose={() => setBankPickerOpen(false)}
        onQueryChange={setBankQuery}
        onSelect={(bank) => {
          setSelectedBank(bank);
          setAccountName('');
          setResolveError('');
          setBankPickerOpen(false);
        }}
        open={bankPickerOpen}
        query={bankQuery}
        selectedBank={selectedBank}
      />
    </ScreenShell>
  );
}

export function SendAmountScreen() {
  return (
    <SharedAmountScreen
      defaultSendAsset={defaultNgnAsset}
      fallbackRecipient={fallbackBankRecipient}
      reviewPath="/send/bank/review"
    />
  );
}

function createInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? 'B'}${parts[1]?.[0] ?? parts[0]?.[1] ?? 'R'}`.toUpperCase();
}
