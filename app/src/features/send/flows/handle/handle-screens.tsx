import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import {
  paayeeHandleRecipients,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import {
  defaultStableAsset,
  SharedAmountScreen,
} from '../shared/amount-screen';
import { ScreenShell, TopBar } from '../shared/send-layout';
import {
  EmptyRecipients,
  FieldLabel,
  FooterButton,
  RecipientRow,
} from '../shared/send-ui';
import { createHandleAmountHref } from '../shared/send-utils';

const defaultHandleRecipient = paayeeHandleRecipients[0];

export function SendHandleScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().replace('@', '').toLowerCase();

    if (!normalized) {
      return paayeeHandleRecipients;
    }

    return paayeeHandleRecipients.filter((recipient) =>
      `${recipient.name} ${recipient.handle ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send to a Paayee handle</Text>
        <Text style={styles.subtitle}>Send privately to a saved handle or enter a new one.</Text>
      </FadeInView>

      <FadeInView delay={110}>
        <PressableScale
          onPress={() => router.push('/send/handle/new' as Href)}
          style={styles.newRecipientCard}>
          <View style={styles.newRecipientCopy}>
            <Feather name="user-plus" size={22} color="#303747" />
            <Text style={styles.newRecipientText}>Send to a new handle</Text>
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
          autoCapitalize="none"
          placeholder="Search by name or Paayee handle"
          placeholderTextColor="#B7BDC8"
          style={styles.searchInput}
        />
      </FadeInView>

      <FadeInView delay={210} style={styles.recipientList}>
        <Text style={styles.sectionTitle}>Recent recipients</Text>
        {filteredRecipients.length > 0 ? (
          filteredRecipients.map((recipient) => (
            <RecipientRow
              key={recipient.id}
              recipient={recipient}
              onPress={() => router.push(createHandleAmountHref(recipient))}
            />
          ))
        ) : (
          <EmptyRecipients />
        )}
      </FadeInView>
    </ScreenShell>
  );
}

export function NewPaayeeHandleScreen() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const normalizedHandle = handle.trim().replace('@', '').toLowerCase();
  const matchedRecipient = paayeeHandleRecipients.find(
    (recipient) => recipient.handle === normalizedHandle,
  );
  const resolvedRecipient =
    matchedRecipient ??
    (normalizedHandle.length >= 4
      ? {
          ...defaultHandleRecipient,
          accountNumber: `@${normalizedHandle}`,
          handle: normalizedHandle,
        }
      : null);

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send to a Paayee handle</Text>
        <Text style={styles.subtitle}>Enter the recipient Paayee handle.</Text>
      </FadeInView>

      <FadeInView delay={120} style={styles.form}>
        <FieldLabel label="Paayee handle">
          <View style={styles.field}>
            <Feather name="at-sign" size={20} color="#3F4653" />
            <TextInput
              value={handle}
              onChangeText={(value) =>
                setHandle(value.replace(/\s/g, '').replace(/^@+/, '').slice(0, 24))
              }
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter Paayee handle"
              placeholderTextColor="#B7BDC8"
              style={styles.textInput}
            />
          </View>
        </FieldLabel>

        <FieldLabel label="Full name">
          <View style={[styles.field, styles.fieldMuted]}>
            <Text style={[styles.fieldText, !resolvedRecipient && styles.placeholder]}>
              {resolvedRecipient?.name ?? 'Full name'}
            </Text>
          </View>
        </FieldLabel>
      </FadeInView>

      <FooterButton
        disabled={!resolvedRecipient}
        label="Continue"
        onPress={() => {
          if (resolvedRecipient) {
            router.push(createHandleAmountHref(resolvedRecipient));
          }
        }}
      />
    </ScreenShell>
  );
}

export function PaayeeHandleAmountScreen() {
  return (
    <SharedAmountScreen
      defaultSendAsset={defaultStableAsset}
      fallbackRecipient={defaultHandleRecipient}
      reviewPath="/send/handle/review"
    />
  );
}
