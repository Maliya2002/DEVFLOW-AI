import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <div className="empty-page"><Compass size={40} aria-hidden="true" /><p className="eyebrow">404 · OFF THE MAP</p><h1>That page isn’t here.</h1><p>The link may have changed. Head back to your workspace overview.</p><Button asChild><Link href="/">Back to overview</Link></Button></div>;
}
