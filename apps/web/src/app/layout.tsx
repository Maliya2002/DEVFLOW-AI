import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import './globals.css';
import { WorkspaceShell } from '@/components/workspace-shell';

export const metadata: Metadata = {
  title: { default: 'Workspace overview | DevFlow AI', template: '%s | DevFlow AI' },
  description:
    'A thoughtful workspace for remote engineering teams. Coordinate work, protect focus, and build with clarity.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <WorkspaceShell>{children}</WorkspaceShell>
      </body>
    </html>
  );
}
