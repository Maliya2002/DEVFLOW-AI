'use client';

import { Button } from '@/components/ui/button';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="empty-page"><p className="eyebrow">SOMETHING WENT WRONG</p><h1>Let’s try that again.</h1><p>We couldn’t load this view. Your next step is a fresh attempt.</p><Button onClick={() => reset()}>Try again</Button></div>;
}
