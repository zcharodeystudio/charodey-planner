import { Href, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/store/auth-context';
import { colors, radii, spacing } from '@/theme/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const initial = user?.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={styles.heading}>Профиль</Text>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <Text style={styles.note}>
          Напоминание ставится на экране задачи. На телефоне в Expo Go или в собранном приложении оно придёт уведомлением.
          В браузере время сохраняется и видно на карточке.
        </Text>
        <Button
          title="Выйти"
          variant="secondary"
          onPress={() => {
            void logout().then(() => router.replace('/(auth)/welcome' as Href));
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryPressed,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  email: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
