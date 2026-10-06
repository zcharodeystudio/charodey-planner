import { loginSchema } from '@charodey/validation';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AuthFooter, AuthScreen } from '@/components/auth-screen';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Input, PasswordInput } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/store/auth-context';
import { spacing } from '@/theme/theme';

export default function LoginScreen() {
  const { login, isAuthenticating } = useAuth();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [generalError, setGeneralError] = useState<string>();

  const goPassword = () => {
    const parsed = loginSchema.shape.email.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? 'Введите корректный email');
      return;
    }
    setEmailError(undefined);
    setStep(1);
  };

  const submit = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'password') setPasswordError(issue.message);
      else setEmailError(issue?.message);
      return;
    }
    setPasswordError(undefined);
    setGeneralError(undefined);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.replace('/(app)/(tabs)/today' as Href);
    } catch (error) {
      const message = getErrorMessage(error);
      setGeneralError(message);
      showToast(message);
    }
  };

  return (
    <AuthScreen
      title={step === 0 ? 'Введите email' : 'Введите пароль'}
      subtitle={step === 0 ? 'Войдите в свой планировщик' : email.trim()}
      step={step + 1}
      totalSteps={2}
      onBack={step === 0 ? () => router.back() : () => setStep(0)}
      onHome={() => router.replace('/(auth)/welcome' as Href)}
      footer={
        <View style={styles.footer}>
          {step === 0 ? (
            <Button title="Дальше" onPress={goPassword} />
          ) : (
            <Button title="Войти" onPress={() => void submit()} loading={isAuthenticating} />
          )}
          <AuthFooter prompt="Нет аккаунта?" action="Создать" onPress={() => router.replace('/(auth)/register' as Href)} />
        </View>
      }
    >
      {step === 0 ? (
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
          <ErrorBanner message={generalError} />
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  footer: { gap: spacing.md, paddingTop: spacing.md },
});
