import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type AvatarProps = {
  initials: string;
  muted?: boolean;
  size?: number;
};

export function Avatar({ initials, muted = false, size = 44 }: AvatarProps) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        muted && styles.avatarMuted,
      ]}>
      <Text style={[styles.initials, size < 40 && styles.initialsSmall]}>
        {initials.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatarMuted: {
    backgroundColor: Colors.light.railSoft,
    borderColor: '#F5DBA8',
  },
  initials: {
    color: Colors.light.black,
    fontFamily: Fonts.demi,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  initialsSmall: {
    fontSize: 12,
  },
});
