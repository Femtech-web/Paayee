import { type Href, useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { useAppData } from '@/features/app-data';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { DetailRow, Section } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function ProfileDetailsScreen() {
  const router = useRouter();
  const { data, loading } = useAppData();
  const user = data?.profile;

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.profileHero}>
        {loading ? (
          <>
            <View style={styles.profileCopy}>
              <SkeletonBlock style={styles.profileNameSkeleton} />
              <SkeletonBlock style={styles.profileEmailSkeleton} />
            </View>
            <SkeletonBlock style={styles.profileAvatarSkeleton} />
          </>
        ) : (
          <>
            <View style={styles.profileCopy}>
              <Text numberOfLines={1} style={styles.profileName}>
                {user?.name ?? 'Paayee user'}
              </Text>
              <Text numberOfLines={1} style={styles.profileEmail}>
                {user?.email ?? 'Account ready'}
              </Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.initials ?? 'PY'}</Text>
            </View>
          </>
        )}
      </FadeInView>

      {loading ? (
        <ProfileDetailsLoading />
      ) : (
        <>
          <Section title="Personal details">
            <DetailRow label="First name" value={user?.firstName || 'Not added'} />
            <DetailRow label="Last name" value={user?.lastName || 'Not added'} />
            <DetailRow label="Phone number" value={user?.phoneNumber ?? 'Not added'} />
          </Section>

          <Section title="Paayee handle">
            <DetailRow label="Handle" value={user?.handle ?? 'Not set'} />
          </Section>
        </>
      )}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        onPress={() => router.push('/profile/edit' as Href)}
        style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Edit profile</Text>
      </PressableScale>

      <View style={styles.footer}>
        <Text style={styles.logout}>Close account</Text>
      </View>
    </ProfileShell>
  );
}

function ProfileDetailsLoading() {
  return (
    <>
      <Section title="Personal details">
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.detailRow}>
            <SkeletonBlock style={styles.detailLabelSkeleton} />
            <SkeletonBlock style={styles.detailValueSkeleton} />
          </View>
        ))}
      </Section>

      <Section title="Paayee handle">
        <View style={styles.detailRow}>
          <SkeletonBlock style={styles.detailLabelSkeleton} />
          <SkeletonBlock style={styles.detailValueSkeleton} />
        </View>
      </Section>
    </>
  );
}
