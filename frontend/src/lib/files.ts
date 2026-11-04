import { FILE_DATA_MAX } from '@charodey/validation';
import { Platform } from 'react-native';
import { showToast } from '@/lib/toast';

const RAW_MAX = 4_000_000;

export type PickedFile = {
  name: string;
  mimeType: string;
  data: string;
};

function tooBig() {
  showToast('Файл больше 4 МБ');
}

function acceptData(name: string, mimeType: string, data: string): PickedFile | null {
  if (data.length > FILE_DATA_MAX) {
    tooBig();
    return null;
  }
  return { name, mimeType, data };
}

async function shrinkBrowserImage(file: File): Promise<PickedFile | null> {
  if (!file.type.startsWith('image/') || file.size <= 500_000) return readBrowserFile(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return readBrowserFile(file);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.62);
    return acceptData(file.name.replace(/\.\w+$/, '.jpg'), 'image/jpeg', data);
  } catch {
    return readBrowserFile(file);
  }
}

function readBrowserFile(file: File): Promise<PickedFile | null> {
  if (file.size > RAW_MAX) {
    tooBig();
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(acceptData(file.name, file.type || 'application/octet-stream', String(reader.result)));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function pickWebFile(accept?: string, capture?: boolean): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void (file.type.startsWith('image/') ? shrinkBrowserImage(file) : readBrowserFile(file)).then(resolve);
    };
    input.click();
  });
}

async function shrinkNativeImage(uri: string, name: string): Promise<PickedFile | null> {
  try {
    const manipulator = await import('expo-image-manipulator');
    const result = await manipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.62,
      format: manipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) return null;
    return acceptData(name.replace(/\.\w+$/, '.jpg'), 'image/jpeg', `data:image/jpeg;base64,${result.base64}`);
  } catch {
    return null;
  }
}

export function pickFromCamera(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') return pickWebFile('image/*', true);
  return pickNativeCamera();
}

async function pickNativeCamera(): Promise<PickedFile | null> {
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    showToast('Нет доступа к камере');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.uri) return null;
  return shrinkNativeImage(asset.uri, asset.fileName || `photo-${Date.now()}.jpg`);
}

export async function pickFromGallery(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') return pickWebFile('image/*');
  const ImagePicker = await import('expo-image-picker');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    showToast('Нет доступа к галерее');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset?.uri) return null;
  return shrinkNativeImage(asset.uri, asset.fileName || `photo-${Date.now()}.jpg`);
}

export async function pickAttachment(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') return pickWebFile();
  const DocumentPicker = await import('expo-document-picker');
  const FileSystem = await import('expo-file-system/legacy');
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.mimeType?.startsWith('image/') && asset.uri) return shrinkNativeImage(asset.uri, asset.name);
  if (asset.size && asset.size > RAW_MAX) {
    tooBig();
    return null;
  }
  const mimeType = asset.mimeType || 'application/octet-stream';
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return acceptData(asset.name, mimeType, `data:${mimeType};base64,${base64}`);
}

export async function openAttachment(file: PickedFile) {
  if (!file.data) {
    showToast('Файл ещё не загружен');
    return;
  }
  if (Platform.OS === 'web') {
    window.open(file.data, '_blank');
    return;
  }
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = file.data.includes(',') ? file.data.slice(file.data.indexOf(',') + 1) : file.data;
  const safeName = file.name.replace(/[^\w.-]+/g, '_') || `file-${Date.now()}`;
  const path = `${FileSystem.cacheDirectory}${Date.now()}-${safeName}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  const Sharing = await import('expo-sharing');
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: file.mimeType, dialogTitle: file.name });
    return;
  }
  showToast('Не удалось открыть файл');
}
