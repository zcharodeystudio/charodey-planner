import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PaletteButton } from '@/components/color-wheel';
import { Screen } from '@/components/ui/screen';
import { useAndroidBack } from '@/lib/android-back';
import { useAuth } from '@/store/auth-context';
import { usePlanner } from '@/store/planner-context';
import { useTheme } from '@/store/theme-context';
import { colors, radii, spacing } from '@/theme/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const planner = usePlanner();
  const { user, logout } = useAuth();
  const initial = user?.name.trim().charAt(0).toUpperCase() || '?';
  const [paletteOpen, setPaletteOpen] = useState(false);

  const onHardwareBack = useCallback(() => {
    if (!paletteOpen) return false;
    setPaletteOpen(false);
    return true;
  }, [paletteOpen]);
  useAndroidBack(onHardwareBack);

  const openTasks = () => {
    planner.apply({ scope: 'all', listId: null, range: 'all' });
    router.navigate('/(app)/(tabs)/today' as Href);
  };

  return (
    <Screen>
      <View style={styles.scroll}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Профиль</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Выйти"
              hitSlop={8}
              onPress={() => {
                void logout().then(() => router.replace('/(auth)/welcome' as Href));
              }}
              style={styles.logout}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}>
              <Text style={[styles.initial, { color: theme.primaryPressed }]}>{initial}</Text>
            </View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>

          <Entry title="Задачи" onPress={openTasks} />
          <Entry title="Списки" onPress={() => router.push('/(app)/lists' as Href)} />
          <Entry title="Проекты" onPress={() => router.push('/(app)/projects' as Href)} />
          <Entry title="Заметки" onPress={() => router.push('/(app)/notes' as Href)} />
          <Text style={styles.section}>Настройки</Text>
          <View style={styles.settings}>
            <Setting icon="arrow-up" title="Новые задачи сверху" hint="Выключено: в течение дня задачи идут по времени, с раннего к позднему" value={planner.newOnTop} onChange={planner.setNewOnTop} />
          </View>
          <View style={styles.fold}>
            <Text style={styles.section}>Цвет</Text>
            <PaletteButton color={theme.primary} open={paletteOpen} onOpenChange={setPaletteOpen} onColor={theme.setAccentColor} />
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}

function Entry({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable style={styles.link} onPress={onPress}>
      <Text style={[styles.modeTitle, { color: theme.primary }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

function Setting({
  icon,
  title,
  hint,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.setting}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.primary, false: colors.border }} thumbColor={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    paddingTop: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  logout: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  email: { fontSize: 15, color: colors.inkMuted },
  section: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
  fold: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  settings: { gap: spacing.md },
  setting: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  linkCopy: { flex: 1, gap: 2 },
  linkTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  modeTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
});
