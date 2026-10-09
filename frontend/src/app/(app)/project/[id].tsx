import { useLocalSearchParams } from 'expo-router';
import { ProjectDocument } from '@/components/project-document';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <ProjectDocument projectId={id} />;
}
