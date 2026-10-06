import { Href, router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { radii, spacing } from '@/theme/theme';

export default function WelcomeScreen() {
  return (
    <AuthScreen
      title="Чародей"
      subtitle="Планировщик задач на каждый день. Создавайте дела, открывайте их по датам и ставьте напоминания."
      footer={
        <View style={styles.footer}>
          <Button title="Создать аккаунт" onPress={() => router.push('/(auth)/register' as Href)} />
          <Button title="У меня уже есть аккаунт" variant="secondary" onPress={() => router.push('/(auth)/login' as Href)} />
        </View>
      }
    >
      <View style={styles.logoWrap}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
});
