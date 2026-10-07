import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidBack(onBack: () => boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [onBack]);
}
