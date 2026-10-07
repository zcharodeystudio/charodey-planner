import { registerSchema } from '@charodey/validation';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthFooter, AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Input, PasswordInput } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { getLastTab, tabHref } from '@/lib/last-tab';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/store/auth-context';
import { colors, spacing } from '@/theme/theme';

export default function RegisterScreen() {
  const { register, isAuthenticating } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [generalError, setGeneralError] = useState<string>();

  const goPassword = () => {
    const nameResult = registerSchema.shape.name.safeParse(name);
    const emailResult = registerSchema.shape.email.safeParse(email);
    setNameError(nameResult.success ? undefined : nameResult.error.issues[0]?.message);
    setEmailError(emailResult.success ? undefined : emailResult.error.issues[0]?.message);
    if (nameResult.success && emailResult.success) setStep(1);
  };

  const submit = async () => {
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0];
      if (field === 'password') setPasswordError(issue?.message);
      if (field === 'email') {
        setEmailError(issue?.message);
        setStep(0);
      }
      if (field === 'name') {
        setNameError(issue?.message);
        setStep(0);
      }
      return;
    }
    setPasswordError(undefined);
    setGeneralError(undefined);
    try {
      await register(parsed.data);
      router.replace(tabHref(await getLastTab()) as Href);
    } catch (error) {
      const message = getErrorMessage(error);
      setGeneralError(message);
      showToast(message);
    }
  };

  return (
    <AuthScreen
      title={step === 0 ? 'Создайте аккаунт' : 'Придумайте пароль'}
      subtitle={step === 0 ? 'Имя и почта, чтобы сохранить ваши задачи' : email.trim()}
      step={step + 1}
      totalSteps={2}
      onBack={step === 0 ? () => router.back() : () => setStep(0)}
      onHome={() => router.replace('/(auth)/welcome' as Href)}
      footer={
        <View style={styles.footer}>
          {step === 0 ? (
            <Button title="Дальше" onPress={goPassword} />
          ) : (
            <Button title="Зарегистрироваться" onPress={() => void submit()} loading={isAuthenticating} />
          )}
          <AuthFooter prompt="Уже есть аккаунт?" action="Войти" onPress={() => router.replace('/(auth)/login' as Href)} />
        </View>
      }
    >
      {step === 0 ? (
        <View style={styles.form}>
          <Input
            label="Имя"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setNameError(undefined);
            }}
            autoComplete="name"
            placeholder="Карина"
            error={nameError}
          />
          <Input
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setEmailError(undefined);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
            error={emailError}
            onEnter={goPassword}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <PasswordInput
            label="Пароль"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setPasswordError(undefined);
            }}
            error={passwordError}
            onEnter={() => void submit()}
          />
          <Text style={styles.hint}>Не короче 8 символов.</Text>
          <ErrorBanner message={generalError} />
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  footer: { gap: spacing.md, paddingTop: spacing.md },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: -4 },
});
