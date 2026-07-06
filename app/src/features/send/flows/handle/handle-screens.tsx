import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { runtimeConfig } from '@/config/runtime';
import { useAppData } from '@/features/app-data';
import { lookupPaayeeHandle } from '@/integrations/supabase';
import {
  fallbackHandleRecipient,
  paayeeHandleRecipients,
  toHandleSendRecipient,
  type SendRecipient,
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

const defaultHandleRecipient = fallbackHandleRecipient;

type HandleLookupState = {
  error: string;
  handle: string;
  loading: boolean;
  recipient: SendRecipient | null;
};

export function SendHandleScreen() {
  const router = useRouter();
  const { data } = useAppData();
  const [query, setQuery] = useState('');
  const recipients = useMemo(
    () =>
      data?.recipients
        .map(toHandleSendRecipient)
        .filter((recipient): recipient is SendRecipient => recipient !== null) ??
      paayeeHandleRecipients,
    [data?.recipients],
  );
  const filteredRecipients = useMemo(() => {
    const normalized = query.trim().replace('@', '').toLowerCase();

    if (!normalized) {
      return recipients;
    }

    return recipients.filter((recipient) =>
      `${recipient.name} ${recipient.handle ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [query, recipients]);

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
  const [lookupState, setLookupState] = useState<HandleLookupState>({
    error: '',
    handle: '',
    loading: false,
    recipient: null,
  });
  const normalizedHandle = handle.trim().replace('@', '').toLowerCase();
  const lookupIsCurrent = lookupState.handle === normalizedHandle;
  const lookupLoading =
    runtimeConfig.realIntegrationsEnabled &&
    normalizedHandle.length >= 3 &&
    (!lookupIsCurrent || lookupState.loading);
  const lookupError = lookupIsCurrent ? lookupState.error : '';
  const liveRecipient = lookupIsCurrent ? lookupState.recipient : null;
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
  const activeRecipient = runtimeConfig.realIntegrationsEnabled ? liveRecipient : resolvedRecipient;

  useEffect(() => {
    if (!runtimeConfig.realIntegrationsEnabled) {
      return;
    }

    if (normalizedHandle.length < 3) {
      return;
    }

    let mounted = true;

    const timer = setTimeout(() => {
      setLookupState({
        error: '',
        handle: normalizedHandle,
        loading: true,
        recipient: null,
      });

      lookupPaayeeHandle(normalizedHandle)
        .then((result) => {
          if (!mounted) {
            return;
          }

          if (!result) {
            setLookupState({
              error: 'No Paayee account found for this handle.',
              handle: normalizedHandle,
              loading: false,
              recipient: null,
            });
            return;
          }

          setLookupState({
            error: '',
            handle: normalizedHandle,
            loading: false,
            recipient: {
              accountNumber: `@${result.handle}`,
              bankName: 'Paayee handle',
              handle: result.handle,
              id: `paayee-${result.handle}`,
              initials: createInitials(result.displayName),
              name: result.displayName,
              walletAddress: result.smartAccountAddress,
            },
          });
        })
        .catch(() => {
          if (mounted) {
            setLookupState({
              error: 'Could not confirm this handle. Please try again.',
              handle: normalizedHandle,
              loading: false,
              recipient: null,
            });
          }
        });
    }, 350);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [normalizedHandle]);

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
            <Text style={[styles.fieldText, !activeRecipient && styles.placeholder]}>
              {activeRecipient?.name ??
                (lookupLoading ? 'Checking handle...' : lookupError || 'Full name')}
            </Text>
          </View>
        </FieldLabel>
      </FadeInView>

      <FooterButton
        disabled={!activeRecipient || lookupLoading}
        label="Continue"
        onPress={() => {
          if (activeRecipient) {
            router.push(createHandleAmountHref(activeRecipient));
          }
        }}
      />
    </ScreenShell>
  );
}

function createInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function PaayeeHandleAmountScreen() {
  return (
    <SharedAmountScreen
      arrivalText="Arrives privately to their Paayee wallet"
      defaultSendAsset={defaultStableAsset}
      fallbackRecipient={defaultHandleRecipient}
      lockReceiveAsset
      reviewPath="/send/handle/review"
      title={(asset, recipient) => `Send ${asset.code} to ${recipient.firstName}`}
    />
  );
}
