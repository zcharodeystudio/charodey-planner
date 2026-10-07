import { Platform } from 'react-native';
import { showToast } from '@/lib/toast';

const MAX_BYTES = 700_000;

export type PickedFile = {
  name: string;
  mimeType: string;
  data: string;
};

export async function pickAttachment(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        if (file.size > MAX_BYTES) {
          showToast('Файл больше 700 КБ');
          return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: String(reader.result),
          });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  const DocumentPicker = await import('expo-document-picker');
  const FileSystem = await import('expo-file-system/legacy');
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_BYTES) {
    showToast('Файл больше 700 КБ');
    return null;
  }
  const mimeType = asset.mimeType || 'application/octet-stream';
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { name: asset.name, mimeType, data: `data:${mimeType};base64,${base64}` };
}
