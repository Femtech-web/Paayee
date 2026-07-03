import { Feather } from '@react-native-vector-icons/feather';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/features/app-data';
import { upsertCurrentProfile } from '@/integrations/supabase';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { ProfileField } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function EditProfileScreen() {
  const router = useRouter();
  const { data } = useAppData();
  const user = data?.profile;
  const [errorMessage, setErrorMessage] = useState('');
  const [firstName, setFirstName] = useState<string>();
  const [handle, setHandle] = useState<string>();
  const [lastName, setLastName] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const firstNameValue = firstName ?? user?.firstName ?? '';
  const handleValue = handle ?? user?.handle?.replace('@', '') ?? '';
  const lastNameValue = lastName ?? user?.lastName ?? '';
  const canSave =
    firstNameValue.trim().length > 1 &&
    lastNameValue.trim().length > 1 &&
    handleValue.trim().length > 2;

  const saveProfile = async () => {
    if (!canSave || submitting) {
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setSaved(false);

    try {
      await upsertCurrentProfile({
        firstName: firstNameValue,
        handle: handleValue,
        lastName: lastNameValue,
      });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Edit profile</Text>
        <Text style={styles.subtitle}>
          Update the name and handle people see when they send money to you.
        </Text>
      </FadeInView>

      <FadeInView delay={90} style={styles.detailCard}>
        <ProfileField label="First name" onChangeText={setFirstName} value={firstNameValue} />
        <ProfileField label="Last name" onChangeText={setLastName} value={lastNameValue} />
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Change email address"
            onPress={() => router.push('/profile/email' as Href)}
            style={[styles.field, styles.readOnlyField]}>
            <Text numberOfLines={1} style={styles.readOnlyText}>
              {user?.email ?? 'Account email'}
            </Text>
            <Feather name="chevron-right" size={19} color="#B6BDCA" />
          </PressableScale>
          <Text style={styles.noteText}>Changing email requires verification before it becomes active.</Text>
        </View>
        <ProfileField
          label="Paayee handle"
          onChangeText={(value) => {
            setHandle(value.replace(/[^a-z0-9_]/gi, '').toLowerCase());
            setSaved(false);
          }}
          placeholder="yourname"
          value={handleValue}
        />
      </FadeInView>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Save profile"
        onPress={canSave && !submitting ? saveProfile : undefined}
        style={[styles.primaryButton, (!canSave || submitting) && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{submitting ? 'Saving...' : 'Save profile'}</Text>
      </PressableScale>
      {saved ? <Text style={[styles.subtitle, { textAlign: 'center' }]}>Profile updated.</Text> : null}
      {errorMessage ? <Text style={[styles.subtitle, { color: Colors.light.error }]}>{errorMessage}</Text> : null}
    </ProfileShell>
  );
}
