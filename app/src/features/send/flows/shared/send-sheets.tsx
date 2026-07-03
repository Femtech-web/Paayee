import { Feather } from '@react-native-vector-icons/feather';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import {
  sendAssetOptions,
  type BankOption,
  type SendAssetCode,
  type SendAssetOption,
  type StablecoinNetworkOption,
} from '../../send-data';
import { sendStyles as styles } from '../../send-screen.styles';
import { AssetIcon } from './send-ui';

export function BankPickerSheet({
  banks,
  onClose,
  onQueryChange,
  onSelect,
  open,
  query,
  selectedBank,
}: {
  banks: BankOption[];
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (bank: BankOption) => void;
  open: boolean;
  query: string;
  selectedBank: BankOption | null;
}) {
  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityLabel="Close bank list" style={styles.sheetBackdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select bank name</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Feather name="x" size={24} color="#202633" />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Feather name="search" size={20} color="#8F96A3" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={onQueryChange}
              placeholder="Enter search text"
              placeholderTextColor="#B7BDC8"
              style={styles.searchInput}
            />
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
            {banks.map((bank) => (
              <Pressable key={bank.id} onPress={() => onSelect(bank)} style={styles.bankRow}>
                <Text style={styles.bankName}>{bank.name}</Text>
                <Feather
                  name={selectedBank?.id === bank.id ? 'check-circle' : 'circle'}
                  size={22}
                  color={selectedBank?.id === bank.id ? Colors.light.primary : '#B6BDCA'}
                />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function BalancePickerSheet({
  allowedCodes,
  assets,
  onClose,
  onSelect,
  open,
  selectedAsset,
}: {
  allowedCodes?: SendAssetCode[];
  assets?: SendAssetOption[];
  onClose: () => void;
  onSelect: (asset: SendAssetOption) => void;
  open: boolean;
  selectedAsset: SendAssetOption;
}) {
  const groups = ['Local money', 'Stablecoins'] as const;
  const availableAssets = allowedCodes
    ? (assets ?? sendAssetOptions).filter((asset) => allowedCodes.includes(asset.code))
    : (assets ?? sendAssetOptions);

  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityLabel="Close balance list" style={styles.sheetBackdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select balance</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Feather name="x" size={24} color="#202633" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
            {groups.map((group) => {
              const groupAssets = availableAssets.filter((asset) => asset.group === group);

              if (groupAssets.length === 0) {
                return null;
              }

              return (
                <View key={group} style={styles.balanceGroup}>
                  <Text style={styles.balanceGroupTitle}>{group}</Text>
                  {groupAssets.map((asset) => (
                    <Pressable
                      key={asset.code}
                      onPress={() => onSelect(asset)}
                      style={styles.balanceRow}>
                      <AssetIcon asset={asset} size={34} />
                      <View style={styles.balanceCopy}>
                        <Text style={styles.balanceName}>{asset.name}</Text>
                        <Text style={styles.balanceCode}>{asset.code}</Text>
                      </View>
                      <Feather
                        name={selectedAsset.code === asset.code ? 'check-circle' : 'circle'}
                        size={23}
                        color={selectedAsset.code === asset.code ? Colors.light.primary : '#B6BDCA'}
                      />
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function NetworkPickerSheet({
  networks,
  onClose,
  onSelect,
  open,
  selectedNetwork,
}: {
  networks: StablecoinNetworkOption[];
  onClose: () => void;
  onSelect: (network: StablecoinNetworkOption) => void;
  open: boolean;
  selectedNetwork: StablecoinNetworkOption | null;
}) {
  return (
    <Modal animationType="slide" transparent visible={open} onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable
          accessibilityLabel="Close network list"
          style={styles.sheetBackdrop}
          onPress={onClose}
        />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select network</Text>
            <Pressable onPress={onClose} style={styles.sheetClose}>
              <Feather name="x" size={24} color="#202633" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
            {networks.map((network) => (
              <Pressable
                key={network.id}
                onPress={() => onSelect(network)}
                style={styles.bankRow}>
                <View style={styles.balanceCopy}>
                  <Text style={styles.bankName}>{network.name}</Text>
                  <Text style={styles.balanceCode}>{network.shortName}</Text>
                </View>
                <Feather
                  name={selectedNetwork?.id === network.id ? 'check-circle' : 'circle'}
                  size={22}
                  color={selectedNetwork?.id === network.id ? Colors.light.primary : '#B6BDCA'}
                />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
