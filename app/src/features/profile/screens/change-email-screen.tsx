import { useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@react-native-vector-icons/feather';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import { requestEmailChange } from '@/integrations/supabase';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { ProfileField } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function ChangeEmailScreen() {
  const { data } = useAppData();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const currentEmail = data?.profile.email ?? '';
  const normalizedEmail = newEmail.trim().toLowerCase();
  const normalizedConfirmEmail = confirmEmail.trim().toLowerCase();
  const canSend =
    normalizedEmail.includes('@') &&
    normalizedEmail !== currentEmail.toLowerCase() &&
    normalizedEmail === normalizedConfirmEmail;

  const sendVerification = async () => {
    if (!canSend || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setSent(false);

    try {
      await requestEmailChange(normalizedEmail);
      setSent(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not start email verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Change email</Text>
        <Text style={styles.subtitle}>
          Enter your new email address. We will send a verification link before updating your account.
        </Text>
      </FadeInView>

      <FadeInView delay={90} style={styles.detailCard}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Current email</Text>
          <View style={[styles.field, styles.readOnlyField]}>
            <Text numberOfLines={1} style={styles.readOnlyText}>
              {currentEmail || 'Account email'}
            </Text>
          </View>
        </View>
        <ProfileField
          autoCapitalize="none"
          keyboardType="email-address"
          label="New email"
          onChangeText={(value) => {
            setNewEmail(value);
            setErrorMessage('');
            setSent(false);
          }}
          placeholder="name@example.com"
          value={newEmail}
        />
        <ProfileField
          autoCapitalize="none"
          keyboardType="email-address"
          label="Confirm new email"
          onChangeText={(value) => {
            setConfirmEmail(value);
            setErrorMessage('');
            setSent(false);
          }}
          placeholder="Retype new email"
          value={confirmEmail}
        />
      </FadeInView>

      {sent ? (
        <View style={styles.successCard}>
          <Feather name="mail" size={20} color={Colors.light.success} />
          <Text style={styles.successText}>
            Verification sent to {normalizedEmail}. Your email changes after you confirm it.
          </Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={[styles.subtitle, { color: Colors.light.error }]}>{errorMessage}</Text> : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Send email verification"
        onPress={canSend && !submitting ? sendVerification : undefined}
        style={[styles.primaryButton, (!canSend || submitting) && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Send verification'}</Text>
      </PressableScale>
    </ProfileShell>
  );
}
