import type { Metadata } from 'next';
import { ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { ConnectionStatus } from '@/components/connection-status';

export const metadata: Metadata = { title: 'Connection' };

export default function ConnectionPage() {
  return <div className="page-content connection-page"><Link className="back-link" href="/"><ArrowLeft size={16} aria-hidden="true" />Back to overview</Link><div className="page-heading"><div><p className="eyebrow">STAY CONNECTED</p><h1>Service connection</h1><p className="page-description">A quick check that your workspace can reach the DevFlow service.</p></div></div><ConnectionStatus /><div className="info-note"><Info size={19} aria-hidden="true" /><p>This check confirms service availability only. Accounts, data storage, and team workflows are still being built.</p></div></div>;
}
