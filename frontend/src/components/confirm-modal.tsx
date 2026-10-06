import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { colors, radii, spacing } from '@/theme/theme';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmTitle?: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  visible,
  title,
  message,
  confirmTitle = 'Удалить',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button title="Отмена" variant="secondary" onPress={onClose} />
            <Button title={confirmTitle} variant="danger" onPress={onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 31, 28, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.sm,
  },
});
