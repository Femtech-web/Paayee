import { Feather } from '@react-native-vector-icons/feather';
import { useState } from 'react';
import { Animated, Easing, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import { styles } from './people-screen.styles';

type Beneficiary = {
  initials: string;
  name: string;
  note: string;
  rails: string[];
  lastUsed: string;
};

const beneficiaries: Beneficiary[] = [
  {
    initials: 'al',
    name: 'Ada Lin',
    note: '0x8A7c...91F2',
    rails: ['USDC', 'USDT'],
    lastUsed: 'Last sent 200 USDC',
  },
  {
    initials: 'to',
    name: 'Tobi Okoro',
    note: 'GTBank ending 8421',
    rails: ['NGN', 'USDC'],
    lastUsed: 'Voice alias ready',
  },
  {
    initials: 'mk',
    name: 'Mina K',
    note: '0x7B8...42F1',
    rails: ['USDT'],
    lastUsed: 'Recipient decrypted',
  },
  {
    initials: 'ao',
    name: 'Akolade Adeyemi',
    note: 'First Bank ending 3678',
    rails: ['NGN'],
    lastUsed: 'Last sent 50,000 NGN',
  },
  {
    initials: 'nt',
    name: 'Nora Tayo',
    note: '0x21C...8B40',
    rails: ['USDC'],
    lastUsed: 'New recipient',
  },
  {
    initials: 'ik',
    name: 'Ikenna Udo',
    note: 'Zenith ending 1042',
    rails: ['NGN', 'USDT'],
    lastUsed: 'Last sent 85 USDT',
  },
];

const filters = ['All', 'NGN', 'USDC', 'USDT', 'Recent'] as const;

export function PeopleScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProgress] = useState(() => new Animated.Value(0));

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
      }
    });
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

        <Text style={styles.sectionLabel}>All beneficiaries</Text>
        <View style={styles.list}>
          {beneficiaries.map((person) => (
            <Pressable key={person.name} style={styles.personRow}>
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
                    <Text key={`${person.name}-${rail}`} style={styles.railPill}>
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
          ))}
        </View>

        <Pressable accessibilityRole="button" style={styles.loadMoreButton}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </Pressable>
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
              Save a name once, then Paayee can match it safely in chat or voice.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldPlaceholder}>Ada Lin</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Wallet or NGN rail</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldPlaceholder}>0x8A7c...91F2 or bank details</Text>
              </View>
            </View>

            <View style={styles.sheetOption}>
              <View style={styles.sheetOptionIcon}>
                <Feather name="mic" size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.sheetOptionCopy}>
                <Text style={styles.sheetOptionTitle}>Voice alias</Text>
                <Text style={styles.sheetOptionText}>Paayee will still confirm every payment.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.light.textTertiary} />
            </View>

            <Pressable accessibilityRole="button" style={styles.sheetPrimaryButton}>
              <Text style={styles.sheetPrimaryText}>Save beneficiary</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
