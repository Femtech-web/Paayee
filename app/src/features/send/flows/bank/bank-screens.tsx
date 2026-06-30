import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import {
  bankOptions,
  sendRecipients,
  type BankOption,
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
  RecipientRow,
} from '../shared/send-ui';
import { createBankAmountHref, defaultRecipient } from '../shared/send-utils';

export function SendBankScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return sendRecipients;
    }

    return sendRecipients.filter((recipient) =>
      `${recipient.name} ${recipient.bankName} ${recipient.accountNumber}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

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
        {filteredRecipients.map((recipient) => (
          <RecipientRow
            key={recipient.id}
            recipient={recipient}
            onPress={() => router.push(createBankAmountHref(recipient))}
          />
        ))}
      </FadeInView>
    </ScreenShell>
  );
}

export function NewBankRecipientScreen() {
  const router = useRouter();
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [bankQuery, setBankQuery] = useState('');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const isResolved = Boolean(selectedBank && accountNumber.length === 10);
  const accountName = isResolved ? 'AKOLADE OLUWAFEMI ADEYEMI' : '';
  const filteredBanks = bankOptions.filter((bank) =>
    bank.name.toLowerCase().includes(bankQuery.trim().toLowerCase()),
  );

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
        </FieldLabel>

        <FieldLabel label="Account number">
          <View style={styles.field}>
            <TextInput
              value={accountNumber}
              onChangeText={(value) => setAccountNumber(value.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              placeholder="Enter account number"
              placeholderTextColor="#B7BDC8"
              style={styles.textInput}
            />
          </View>
        </FieldLabel>

        <FieldLabel label="Account name">
          <View style={[styles.field, styles.fieldMuted]}>
            <Text style={[styles.fieldText, !accountName && styles.placeholder]}>
              {accountName || 'Account name'}
            </Text>
          </View>
        </FieldLabel>
      </FadeInView>

      <FooterButton
        disabled={!isResolved}
        label="Continue"
        onPress={() =>
          router.push(
            `/send/bank/amount?name=${encodeURIComponent(accountName)}&bank=${encodeURIComponent(
              selectedBank?.name ?? '',
            )}&account=${accountNumber}&initials=AO` as Href,
          )
        }
      />
      <BankPickerSheet
        banks={filteredBanks}
        onClose={() => setBankPickerOpen(false)}
        onQueryChange={setBankQuery}
        onSelect={(bank) => {
          setSelectedBank(bank);
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
      defaultTenderedAmount="5035"
      fallbackRecipient={defaultRecipient}
      reviewPath="/send/bank/review"
    />
  );
}
