import { StyleSheet } from 'react-native';

import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

export const setupStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  safeArea: {
    flex: 1,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: 22,
  },
  topBar: {
    height: 70,
    justifyContent: 'center',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  content: {
    gap: 26,
  },
  reviewContent: {
    flex: 1,
    gap: 22,
  },
  kicker: {
    color: '#586174',
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  title: {
    color: '#202633',
    fontFamily: Fonts.demi,
    fontSize: 34,
    lineHeight: 42,
  },
  subtitle: {
    marginTop: -16,
    color: '#5D6678',
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 25,
  },
  infoBox: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: Colors.light.railSoft,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9A842',
  },
  infoText: {
    color: '#826529',
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 25,
  },
  detailsList: {
    gap: 0,
  },
  detailRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },
  detailLabel: {
    color: '#8A94A8',
    fontFamily: Fonts.medium,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#586174',
    fontFamily: Fonts.demi,
    fontSize: 15,
  },
  footer: {
    marginTop: 'auto',
    gap: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
  },
  primaryButtonText: {
    color: Colors.light.white,
    fontFamily: Fonts.demi,
    fontSize: 16,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: '#E3E7EE',
  },
  secondaryButtonText: {
    color: '#3D4658',
    fontFamily: Fonts.demi,
    fontSize: 16,
  },
  readyCard: {
    borderRadius: 24,
    padding: 18,
    gap: 18,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: '#E7EBF2',
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.success,
  },
  readyTitle: {
    color: '#202633',
    fontFamily: Fonts.demi,
    fontSize: 16,
  },
  readyText: {
    marginTop: 4,
    color: '#8A94A8',
    fontFamily: Fonts.sans,
    fontSize: 14,
  },
  instructionList: {
    gap: 0,
  },
  instructionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F4',
  },
  instructionCopy: {
    flex: 1,
    minWidth: 0,
  },
  instructionLabel: {
    color: '#8A94A8',
    fontFamily: Fonts.medium,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  instructionValue: {
    marginTop: 4,
    color: '#202633',
    fontFamily: Fonts.demi,
    fontSize: 16,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.railSoft,
  },
});
