import { Platform } from 'react-native';
import { deleteItem, getItem, setItem } from '@/lib/storage';
import type { Task } from '@/api/client';

const MAP_KEY = 'notificationIds';

type IdMap = Record<string, string>;

async function readMap(): Promise<IdMap> {
  const raw = await getItem(MAP_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as IdMap;
  } catch {
    return {};
  }
}

async function writeMap(map: IdMap) {
  await setItem(MAP_KEY, JSON.stringify(map));
}

export async function syncTaskReminder(task: Task) {
  if (Platform.OS === 'web') return 'web' as const;
  const Notifications = await import('expo-notifications');
  const map = await readMap();
  const previous = map[task.id];
  if (previous) {
    await Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
    delete map[task.id];
  }

  const remindAt = task.remindAt ? new Date(task.remindAt) : null;
  if (!remindAt || task.done || remindAt.getTime() <= Date.now()) {
    await writeMap(map);
    return 'skipped' as const;
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.status === 'granted';
  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.status === 'granted';
  }
  if (!granted) {
    await writeMap(map);
    return 'denied' as const;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Напоминания',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Напоминание',
      body: task.title,
      data: { taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: remindAt,
    },
  });
  map[task.id] = notificationId;
  await writeMap(map);
  return 'scheduled' as const;
}

export async function cancelTaskReminder(taskId: string) {
  if (Platform.OS === 'web') return;
  const map = await readMap();
  const previous = map[taskId];
  if (!previous) return;
  const Notifications = await import('expo-notifications');
  await Notifications.cancelScheduledNotificationAsync(previous).catch(() => undefined);
  delete map[taskId];
  if (Object.keys(map).length === 0) await deleteItem(MAP_KEY);
  else await writeMap(map);
}

export async function configureNotifications() {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
