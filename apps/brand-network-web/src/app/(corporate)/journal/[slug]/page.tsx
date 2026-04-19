import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false },
};

export default function JournalArticlePage() {
  notFound();
}
