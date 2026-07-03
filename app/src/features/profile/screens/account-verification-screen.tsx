import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { FeedbackToast } from '@/components/feedback-toast';
import { FadeInView } from '@/components/motion/fade-in-view';
import { PressableScale } from '@/components/motion/pressable-scale';
import { useAppData } from '@/features/app-data';
import { upsertCurrentProfile } from '@/integrations/supabase';

import { BackBar, ProfileShell } from '../components/profile-shell';
import { DetailRow, ProfileField } from '../components/profile-ui';
import { profileStyles as styles } from '../profile-screen.styles';

export function AccountVerificationScreen() {
  const router = useRouter();
  const { data, refresh } = useAppData();
  const profile = data?.profile;
  const [address, setAddress] = useState<string>();
  const [country, setCountry] = useState<string>();
  const [dateOfBirth, setDateOfBirth] = useState<string>();
  const [errorMessage, setErrorMessage] = useState('');
  const [firstName, setFirstName] = useState<string>();
  const [lastName, setLastName] = useState<string>();
  const [phone, setPhone] = useState<string>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const addressValue = address ?? profile?.residentialAddress ?? '';
  const countryValue = country ?? profile?.countryOfResidence ?? 'Nigeria';
  const dateOfBirthValue = formatDateOfBirthInput(dateOfBirth ?? profile?.dateOfBirth ?? '');
  const firstNameValue = firstName ?? (profile?.firstName === 'there' ? '' : profile?.firstName) ?? '';
  const lastNameValue = lastName ?? profile?.lastName ?? '';
  const phoneValue = phone ?? profile?.phoneNumber ?? '';
  const identityComplete =
    firstNameValue.trim().length > 1 &&
    lastNameValue.trim().length > 1 &&
    phoneValue.trim().length > 6 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthValue.trim());
  const addressComplete = countryValue.trim().length > 1 && addressValue.trim().length > 8;
  const canContinue = step === 1 ? identityComplete : step === 2 ? addressComplete : true;

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    const timeout = setTimeout(() => setErrorMessage(''), 5000);

    return () => clearTimeout(timeout);
  }, [errorMessage]);

  const continueFlow = async () => {
    if (!canContinue || submitting) {
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await upsertCurrentProfile({
        countryOfResidence: countryValue,
        dateOfBirth: dateOfBirthValue,
        firstName: firstNameValue,
        lastName: lastNameValue,
        phoneNumber: phoneValue,
        residentialAddress: addressValue,
      });
      await refresh();
      setSuccessMessage('Verification details submitted.');
      setTimeout(() => router.replace('/profile' as Href), 900);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save verification details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileShell detail>
      <FeedbackToast floating message={successMessage} tone="success" />
      <FeedbackToast floating message={errorMessage} tone="error" />
      <BackBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.detailTitle}>Account verification</Text>
        <Text style={styles.subtitle}>
          Add the details Paayee uses to protect your account and review higher limit access. Step {step} of 3.
        </Text>
      </FadeInView>

      <View style={styles.stepTrack}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={[styles.stepDot, item <= step && styles.stepDotActive]} />
        ))}
      </View>

      <FadeInView delay={90} style={styles.detailCard}>
        {step === 1 ? (
          <>
            <Text style={styles.cardTitle}>Identity and contact</Text>
            <ProfileField label="Legal first name" onChangeText={setFirstName} value={firstNameValue} />
            <ProfileField label="Legal last name" onChangeText={setLastName} value={lastNameValue} />
            <ProfileField label="Phone number" keyboardType="phone-pad" onChangeText={setPhone} value={phoneValue} />
            <ProfileField
              label="Date of birth"
              keyboardType="numbers-and-punctuation"
              onChangeText={(value) => setDateOfBirth(formatDateOfBirthInput(value))}
              placeholder="YYYY-MM-DD"
              value={dateOfBirthValue}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.cardTitle}>Residence</Text>
            <ProfileField label="Country of residence" onChangeText={setCountry} value={countryValue} />
            <ProfileField
              label="Residential address"
              multiline
              onChangeText={setAddress}
              placeholder="Street, city, state"
              value={addressValue}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.cardTitle}>Review details</Text>
            <DetailRow label="Legal name" value={`${firstNameValue} ${lastNameValue}`} />
            <DetailRow label="Phone number" value={phoneValue} />
            <DetailRow label="Date of birth" value={dateOfBirthValue} />
            <DetailRow label="Country" value={countryValue} />
            <DetailRow label="Address" value={addressValue} />
          </>
        ) : null}
      </FadeInView>

      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Your details help us protect your account and keep your limits up to date.
        </Text>
      </View>

      {step > 1 && !successMessage ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Go to previous verification step"
          onPress={() => setStep((current) => (current === 3 ? 2 : 1))}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </PressableScale>
      ) : null}

      <PressableScale
        style={[styles.primaryButton, (!canContinue || submitting || successMessage) && styles.primaryButtonDisabled]}
        onPress={canContinue && !submitting && !successMessage ? continueFlow : undefined}>
        <Text style={styles.primaryButtonText}>
          {submitting ? 'Saving...' : step === 3 ? 'Submit verification' : 'Continue'}
        </Text>
      </PressableScale>
    </ProfileShell>
  );
}

function formatDateOfBirthInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 4) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}
