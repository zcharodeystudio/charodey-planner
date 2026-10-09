import { useLocalSearchParams } from 'expo-router';
import { ProjectDocument } from '@/components/project-document';

export default function ProjectPageScreen() {
  const { projectId, pageId } = useLocalSearchParams<{ projectId: string; pageId: string }>();
  if (!projectId || !pageId) return null;
  return <ProjectDocument projectId={projectId} pageId={pageId} />;
}
