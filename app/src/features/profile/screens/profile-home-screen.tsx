import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { SkeletonBlock } from '@/components/loading/skeleton';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { signOutCurrentUser } from '@/features/auth';
import { useAppData } from '@/features/app-data';
import { useDisplayCurrencyPreference } from '@/features/preferences/display-currency-preference';

import { profileStyles as styles } from '../profile-screen.styles';
import { ProfileShell } from '../components/profile-shell';
import { Section, SettingsRow } from '../components/profile-ui';

export function ProfileHomeScreen() {
  const router = useRouter();
  const { data, loading } = useAppData();
  const { currency: displayCurrency } = useDisplayCurrencyPreference();
  const [errorMessage, setErrorMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const user = data?.profile;
  const verificationSubmitted = Boolean(
    user?.firstName &&
      user.lastName &&
      user.phoneNumber &&
      user.dateOfBirth &&
      user.countryOfResidence &&
      user.residentialAddress,
  );
  const verificationBadge = loading ? undefined : verificationSubmitted ? 'verified' : 'basic';

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const logOut = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setErrorMessage('');

    try {
      await signOutCurrentUser();
      router.replace('/auth/login' as Href);
    } catch {
      setErrorMessage('Could not log out. Try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <ProfileShell>
      <FadeInView delay={40} style={styles.hero}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>Manage your Paayee account, limits, and security.</Text>
      </FadeInView>

      <FadeInView delay={80} style={styles.profileHero}>
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

      <Section title="Account">
        <SettingsRow
          icon="user"
          title="Your profile"
          onPress={() => router.push('/profile/details' as Href)}
        />
        <SettingsRow
          icon="check-circle"
          title="Account verification"
          badge={verificationBadge}
          onPress={() => router.push('/profile/verification' as Href)}
        />
        <SettingsRow
          icon="credit-card"
          title="Total balance currency"
          badge={loading ? undefined : displayCurrency}
          isLast
          onPress={() => router.push('/profile/display-currency' as Href)}
        />
      </Section>

      <Section title="Finances">
        <SettingsRow
          icon="activity"
          title="Transaction limits"
          isLast
          onPress={() => router.push('/profile/limits' as Href)}
        />
      </Section>

      <Section title="Security">
        <SettingsRow
          icon="mail"
          title="Sign-in email"
          onPress={() => router.push('/profile/email' as Href)}
        />
        <SettingsRow
          icon="shield"
          title="Biometric unlock"
          onPress={() => router.push('/profile/security/biometrics' as Href)}
        />
        <SettingsRow
          icon="hash"
          title="Change your PIN"
          isLast
          onPress={() => router.push('/profile/security/pin' as Href)}
        />
      </Section>

      <Section title="Support">
        <SettingsRow icon="message-circle" title="Talk to support" />
        <SettingsRow
          icon="repeat"
          title="See our rates"
          isLast
          onPress={() => router.push('/profile/rates' as Href)}
        />
      </Section>

      <View style={styles.footer}>
        <FeedbackToast message={errorMessage} tone="error" />
        <PressableScale accessibilityRole="button" accessibilityLabel="Log out" onPress={logOut}>
          <Text style={styles.logout}>{loggingOut ? 'Logging out...' : 'Log out'}</Text>
        </PressableScale>
        <Text style={styles.version}>v0.1.0</Text>
      </View>
    </ProfileShell>
  );
}
