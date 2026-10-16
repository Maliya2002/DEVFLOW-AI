import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { WorkspaceMap } from '@/components/workspace-map';

export default function OverviewPage() {
  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DEVFLOW / ENGINEERING WORKSPACE</p>
          <h1>
            Workspace overview
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
        </div>
        <div className="edition">
          <span>FOUNDATION</span>
          <strong>Edition 001</strong>
        </div>
      </div>
      <section className="overview-intro" aria-label="Workspace introduction">
        <p>
          A shared picture of the work.
          <br />
          <span>Space for the people behind it.</span>
        </p>
        <a href="#workspace-direction" className="text-action">
          Explore the workspace
          <ArrowDown size={15} aria-hidden="true" />
        </a>
      </section>
      <div className="build-strip">
        <span className="build-marker" />
        <strong>Foundation preview</strong>
        <span className="strip-divider">/</span>
        <span>Explore the structure. Your team’s story comes next.</span>
        <span className="strip-index">DF / PREVIEW</span>
      </div>
      <WorkspaceMap />
      <section className="preview-footnote" aria-label="Preview information">
        <span className="annotation-index">NOTE / 01</span>
        <div>
          <h2>An empty workspace, intentionally.</h2>
          <p>
            Accounts, projects, and team records aren’t available yet. This map shows what’s
            planned—not live employee data.
          </p>
        </div>
        <Link href="/connection">
          Check service connection
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>
      <section className="principle-strip" aria-label="Product principles">
        <span>OUR OPERATING PRINCIPLES</span>
        <p>
          01 <strong>Transparent by design</strong>
        </p>
        <p>
          02 <strong>Private by default</strong>
        </p>
        <p>
          03 <strong>Hours ≠ productivity</strong>
        </p>
      </section>
    </div>
  );
}
