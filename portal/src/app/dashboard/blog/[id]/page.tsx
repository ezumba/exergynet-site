'use client';

import { useParams } from 'next/navigation';
import ArticleEditor from '@/components/ArticleEditor';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditor articleId={id} />;
}
