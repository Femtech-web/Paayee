import { StyleSheet } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

export const styles = StyleSheet.create({
  content: {
    paddingTop: 20,
    gap: 22,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 40,
    lineHeight: 46,
  },
  insightButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  insightText: {
    color: Colors.light.primary,
    fontFamily: Fonts.demi,
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: {
    flex: 1,
    color: Colors.light.black,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  filterButton: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionHeader: {
    gap: 14,
    marginTop: 2,
  },
  sectionTitle: {
    color: Colors.light.textSecondary,
    fontFamily: Fonts.demi,
    fontSize: 16,
    lineHeight: 21,
  },
  sectionLine: {
    height: 1,
    backgroundColor: Colors.light.border,
  },
  transactionList: {
    gap: 22,
  },
  transactionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  transactionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  transactionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  transactionTitle: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 18,
    lineHeight: 23,
  },
  transactionDetail: {
    color: Colors.light.textTertiary,
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  amountBlock: {
    width: 112,
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmount: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 16,
    lineHeight: 21,
    textAlign: 'right',
  },
  amountPositive: {
    color: Colors.light.success,
  },
  amountNegative: {
    color: Colors.light.error,
  },
  amountReceipt: {
    color: Colors.light.textSecondary,
  },
  secondaryAmount: {
    color: Colors.light.textTertiary,
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  loadMoreButton: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  loadMoreText: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 14,
  },
});
