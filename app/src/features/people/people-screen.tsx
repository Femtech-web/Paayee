import { Feather } from '@react-native-vector-icons/feather';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import { useAppData, type AppRecipient } from '@/features/app-data';
import { stablecoinNetworks } from '@/features/send/send-data';
import { saveCurrentBeneficiary } from '@/integrations/supabase';
import { styles } from './people-screen.styles';

const filters = ['All', 'NGN', 'USDC', 'USDT', 'Recent'] as const;
const INITIAL_VISIBLE_RECIPIENTS = 10;
const railOptions = [
  { label: 'NGN bank', value: 'NGN' },
  { label: 'USDC wallet', value: 'USDC' },
  { label: 'USDT wallet', value: 'USDT' },
  { label: 'Paayee handle', value: 'HANDLE' },
] as const;

type BeneficiaryRail = (typeof railOptions)[number]['value'];

export function PeopleScreen() {
  const { data, loading, refresh } = useAppData();
  const beneficiaries = data?.recipients ?? [];
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_RECIPIENTS);
  const visibleBeneficiaries = beneficiaries.slice(0, visibleCount);
  const canLoadMore = beneficiaries.length > visibleBeneficiaries.length;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProgress] = useState(() => new Animated.Value(0));
  const [selectedRail, setSelectedRail] = useState<BeneficiaryRail>('NGN');
  const [selectedNetworkId, setSelectedNetworkId] = useState(stablecoinNetworks[0]?.id ?? '');
  const [displayName, setDisplayName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetSuccess, setSheetSuccess] = useState('');
  const selectedNetwork = useMemo(
    () => stablecoinNetworks.find((network) => network.id === selectedNetworkId) ?? stablecoinNetworks[0],
    [selectedNetworkId],
  );

  useEffect(() => {
    if (!sheetError && !sheetSuccess) {
      return;
    }

    const timeout = setTimeout(() => {
      setSheetError('');
      setSheetSuccess('');
    }, 3800);

    return () => clearTimeout(timeout);
  }, [sheetError, sheetSuccess]);

  const openSheet = () => {
    setSheetOpen(true);
    Animated.timing(sheetProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSheetOpen(false);
        resetForm();
      }
    });
  };

  const resetForm = () => {
    setDisplayName('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setWalletAddress('');
    setHandle('');
    setSelectedNetworkId(stablecoinNetworks[0]?.id ?? '');
    setSheetError('');
    setSheetSuccess('');
  };

  const saveBeneficiary = async () => {
    if (saving || !canSaveBeneficiary(selectedRail, displayName, {
      accountName,
      accountNumber,
      bankName,
      handle,
      networkId: selectedNetwork?.id ?? '',
      walletAddress,
    })) {
      return;
    }

    setSaving(true);
    setSheetError('');
    setSheetSuccess('');

    try {
      await saveCurrentBeneficiary({
        accountName: selectedRail === 'NGN' ? accountName : undefined,
        accountNumber: selectedRail === 'NGN' ? accountNumber : undefined,
        bankName: selectedRail === 'NGN' ? bankName : undefined,
        chainId: selectedRail === 'USDC' || selectedRail === 'USDT' ? selectedNetwork?.chainId : undefined,
        displayName,
        handle: selectedRail === 'HANDLE' ? handle : undefined,
        networkId: selectedRail === 'USDC' || selectedRail === 'USDT' ? selectedNetwork?.id : undefined,
        networkName: selectedRail === 'USDC' || selectedRail === 'USDT' ? selectedNetwork?.name : undefined,
        preferredAsset: selectedRail === 'HANDLE' ? undefined : selectedRail,
        walletAddress: selectedRail === 'USDC' || selectedRail === 'USDT' ? walletAddress : undefined,
      });
      setSheetSuccess('Recipient saved.');
      await refresh();
      setTimeout(closeSheet, 650);
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Could not save this recipient.');
    } finally {
      setSaving(false);
    }
  };

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [440, 0],
  });

  const backdropOpacity = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <>
      <Screen contentStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>People</Text>
            <Text style={styles.subtitle}>
              Names Paayee can recognize before any payment preview.
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={openSheet} style={styles.addButton}>
            <Feather name="plus" size={22} color={Colors.light.black} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color={Colors.light.textTertiary} />
            <TextInput
              editable={false}
              placeholder="Search people"
              placeholderTextColor={Colors.light.textTertiary}
              style={styles.searchInput}
            />
          </View>
          <Pressable accessibilityRole="button" style={styles.filterButton}>
            <Feather name="sliders" size={19} color={Colors.light.black} />
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {filters.map((filter) => (
            <Pressable
              key={filter}
              accessibilityRole="button"
              style={[styles.filterPill, filter === 'All' && styles.filterPillActive]}>
              <Text style={[styles.filterText, filter === 'All' && styles.filterTextActive]}>
                {filter}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Saved recipients</Text>
        <View style={styles.list}>
          {loading ? (
            <PeopleSkeleton />
          ) : visibleBeneficiaries.length ? (
            visibleBeneficiaries.map((person) => <RecipientRow key={person.id} person={person} />)
          ) : (
            <EmptyPeopleState onAdd={openSheet} />
          )}
        </View>

        {canLoadMore ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisibleCount((count) => count + INITIAL_VISIBLE_RECIPIENTS)}
            style={styles.loadMoreButton}>
            <Text style={styles.loadMoreText}>Load more</Text>
          </Pressable>
        ) : null}
      </Screen>

      <Modal animationType="none" onRequestClose={closeSheet} transparent visible={sheetOpen}>
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable
              accessibilityLabel="Close add beneficiary"
              onPress={closeSheet}
              style={styles.backdropPressable}
            />
          </Animated.View>

          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={closeSheet}
                style={styles.sheetIconButton}>
                <Feather name="x" size={24} color={Colors.light.black} />
              </Pressable>
              <Text style={styles.sheetTitle}>Add beneficiary</Text>
              <Pressable accessibilityRole="button" style={styles.sheetIconButton}>
                <Feather name="help-circle" size={22} color={Colors.light.black} />
              </Pressable>
            </View>

            <View style={styles.sheetDivider} />

            <Text style={styles.sheetIntro}>
              Save bank accounts, wallet addresses, or Paayee handles you send to often.
            </Text>

            <FeedbackToast floating message={sheetError} tone="error" />
            <FeedbackToast floating message={sheetSuccess} tone="success" />

            <View style={styles.railSelector}>
              {railOptions.map((rail) => (
                <Pressable
                  key={rail.value}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedRail(rail.value);
                    setSheetError('');
                    setSheetSuccess('');
                  }}
                  style={[
                    styles.railChoice,
                    selectedRail === rail.value && styles.railChoiceActive,
                  ]}>
                  <Text
                    style={[
                      styles.railChoiceText,
                      selectedRail === rail.value && styles.railChoiceTextActive,
                    ]}>
                    {rail.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setDisplayName}
                placeholder="Ada Lin"
                placeholderTextColor={Colors.light.textTertiary}
                style={styles.fieldInput}
                value={displayName}
              />
            </View>

            {selectedRail === 'NGN' ? (
              <>
                <SheetField label="Bank name" onChangeText={setBankName} placeholder="GTBank" value={bankName} />
                <SheetField
                  keyboardType="number-pad"
                  label="Account number"
                  onChangeText={setAccountNumber}
                  placeholder="0123456789"
                  value={accountNumber}
                />
                <SheetField
                  label="Account name"
                  onChangeText={setAccountName}
                  placeholder="Ada Lin"
                  value={accountName}
                />
              </>
            ) : selectedRail === 'HANDLE' ? (
              <SheetField
                autoCapitalize="none"
                label="Paayee handle"
                onChangeText={setHandle}
                placeholder="@adalin"
                value={handle}
              />
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Network</Text>
                  <View style={styles.networkSelector}>
                    {stablecoinNetworks.map((network) => (
                      <Pressable
                        key={network.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedNetworkId(network.id)}
                        style={[
                          styles.networkChoice,
                          selectedNetwork?.id === network.id && styles.networkChoiceActive,
                        ]}>
                        <Feather
                          name="link"
                          size={15}
                          color={
                            selectedNetwork?.id === network.id
                              ? Colors.light.primary
                              : Colors.light.textTertiary
                          }
                        />
                        <Text
                          style={[
                            styles.networkChoiceText,
                            selectedNetwork?.id === network.id && styles.networkChoiceTextActive,
                          ]}>
                          {network.shortName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <SheetField
                  autoCapitalize="none"
                  label={`${selectedRail} wallet address`}
                  onChangeText={setWalletAddress}
                  placeholder="0x8A7c...91F2"
                  value={walletAddress}
                />
              </>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={
                saving ||
                !canSaveBeneficiary(selectedRail, displayName, {
                  accountName,
                  accountNumber,
                  bankName,
                  handle,
                  networkId: selectedNetwork?.id ?? '',
                  walletAddress,
                })
              }
              onPress={saveBeneficiary}
              style={[
                styles.sheetPrimaryButton,
                (saving ||
                  !canSaveBeneficiary(selectedRail, displayName, {
                    accountName,
                    accountNumber,
                    bankName,
                    handle,
                    networkId: selectedNetwork?.id ?? '',
                    walletAddress,
                  })) &&
                  styles.sheetPrimaryButtonDisabled,
              ]}>
              <Text style={styles.sheetPrimaryText}>{saving ? 'Saving...' : 'Save beneficiary'}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function SheetField({
  autoCapitalize = 'sentences',
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textTertiary}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

function canSaveBeneficiary(
  rail: BeneficiaryRail,
  displayName: string,
  values: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    handle: string;
    networkId: string;
    walletAddress: string;
  },
): boolean {
  if (!displayName.trim()) {
    return false;
  }

  if (rail === 'NGN') {
    return Boolean(
      values.bankName.trim() &&
        values.accountNumber.trim().length >= 10 &&
        values.accountName.trim(),
    );
  }

  if (rail === 'HANDLE') {
    return Boolean(values.handle.trim().replace(/^@+/, ''));
  }

  return Boolean(values.networkId && /^0x[a-fA-F0-9]{40}$/.test(values.walletAddress.trim()));
}

function RecipientRow({ person }: { person: AppRecipient }) {
  return (
    <Pressable style={styles.personRow}>
      <Avatar initials={person.initials} size={52} />
      <View style={styles.personCopy}>
        <Text style={styles.personName} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={styles.personNote} numberOfLines={1}>
          {person.note}
        </Text>
        <View style={styles.railRow}>
          {person.rails.map((rail) => (
            <Text key={`${person.id}-${rail}`} style={styles.railPill}>
              {rail}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.personMeta}>
        <Text style={styles.lastUsed} numberOfLines={2}>
          {person.lastUsed}
        </Text>
        <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
      </View>
    </Pressable>
  );
}

function PeopleSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.personRow}>
          <SkeletonBlock style={styles.rowAvatarSkeleton} />
          <View style={styles.personCopy}>
            <SkeletonBlock style={styles.rowTitleSkeleton} />
            <SkeletonBlock style={styles.rowSubtitleSkeleton} />
          </View>
        </View>
      ))}
    </>
  );
}

function EmptyPeopleState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="users" size={24} color={Colors.light.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>No saved recipients yet</Text>
      <Text style={styles.emptyText}>
        Add someone once, then sending through bank transfer, Paayee handle, or wallet becomes faster.
      </Text>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>Add recipient</Text>
      </Pressable>
    </View>
  );
}
