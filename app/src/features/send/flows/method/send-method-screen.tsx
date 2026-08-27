import { type Href, useRouter } from 'expo-router';
import { Text } from 'react-native';

import { FadeInView } from '@/components/motion/fade-in-view';
import { sendStyles as styles } from '../../send-screen.styles';
import { ScreenShell, TopBar } from '../shared/send-layout';
import { SendMethod } from '../shared/send-ui';

export function SendMethodScreen() {
  const router = useRouter();

  return (
    <ScreenShell>
      <TopBar />
      <FadeInView delay={60} style={styles.hero}>
        <Text style={styles.title}>Send money</Text>
        <Text style={styles.subtitle}>Choose how the money should leave Paayee.</Text>
      </FadeInView>

      <FadeInView delay={120} style={styles.methodList}>
        <SendMethod
          icon="home"
          title="Send to bank account"
          text="NGN transfers will return when Paayee’s local money provider is connected."
          soon
        />
        <SendMethod
          icon="at-sign"
          title="Send to Paayee handle"
          text="Choose Spendable or Private USDC and USDT."
          onPress={() => router.push('/send/handle' as Href)}
        />
        <SendMethod
          icon="link-2"
          title="Send to stablecoin wallet"
          text="Send USDC or USDT to a supported wallet address."
          onPress={() => router.push('/send/stablecoin' as Href)}
        />
      </FadeInView>
    </ScreenShell>
  );
}
