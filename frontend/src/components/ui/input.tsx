import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '@/theme/theme';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  onEnter?: () => void;
};

export function Input({ label, error, onEnter, ...props }: InputProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null]}
        onSubmitEditing={onEnter}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PasswordInput({ label, error, onEnter, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.password, error ? styles.inputError : null]}
          secureTextEntry={!visible}
          onSubmitEditing={onEnter}
          {...props}
        />
        <Pressable onPress={() => setVisible((value) => !value)} style={styles.eye} hitSlop={8}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  password: {
    paddingRight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 15,
  },
});
