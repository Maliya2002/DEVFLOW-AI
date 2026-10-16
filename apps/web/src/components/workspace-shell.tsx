'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, CircleHelp, LayoutDashboard, Menu, PlugZap, X } from 'lucide-react';

const navigation = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/connection', label: 'Connection', icon: PlugZap },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  return (
    <div
      className="workspace"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="mobile-bar">
        <Link href="/" className="brand" aria-label="DevFlow AI overview">
          <span className="brand-mark">df/</span>DevFlow<span className="brand-ai">AI</span>
        </Link>
        <button
          ref={toggle}
          className="menu-toggle"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="workspace-sidebar"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <aside id="workspace-sidebar" className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <Link href="/" className="brand desktop-brand" aria-label="DevFlow AI overview">
          <span className="brand-mark">df/</span>DevFlow<span className="brand-ai">AI</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">W/</span>
          <div>
            <strong>Workspace</strong>
            <span>Not connected yet</span>
          </div>
        </div>
        <p className="nav-label">WORKSPACE INDEX</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname === href ? 'nav-active' : ''}`}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
              <span className="nav-index" aria-hidden="true">
                {href === '/' ? '01' : '02'}
              </span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-coordinate" aria-hidden="true">
          <span>WORK / PEOPLE / CONTEXT</span>
          <div />
          <span>BUILD WITH INTENTION.</span>
        </div>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span>THE DEVFLOW PRINCIPLE</span>
            <strong>
              Measure the work.
              <br />
              Respect the person.
            </strong>
            <p>
              No hidden monitoring.
              <br />
              No productivity scores.
            </p>
          </div>
          <a
            className="help-link"
            href="https://github.com/Maliya2002/DEVFLOW-AI"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={17} aria-hidden="true" />
            Project documentation
            <ArrowUpRight size={15} aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <div className="sidebar-footer">
            <span className="preview-dot" />
            FOUNDATION<span>001</span>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>
              {pathname === '/connection' ? 'Connection' : pathname === '/' ? 'Overview' : 'Page'}
            </span>
          </div>
          <span className="preview-badge">PREVIEW</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>Designed for thoughtful teams.</span>
          <span>Clarity. Focus. Balance.</span>
        </footer>
      </div>
    </div>
  );
}
