'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Clock3,
  FolderKanban,
  GitPullRequest,
  Layers3,
  List,
  ScanLine,
  Search,
  Sprout,
  Users,
  X,
} from 'lucide-react';

const capabilities = [
  {
    id: 'projects',
    code: 'D.01',
    lane: 'delivery',
    title: 'Projects & tasks',
    icon: FolderKanban,
    summary: 'Turn a shared goal into work everyone can follow.',
    features: [
      'Projects, priorities, and ownership',
      'Sprints and task dependencies',
      'Visible blockers and delivery history',
    ],
    boundary: 'Project records will be available only to authorized members.',
  },
  {
    id: 'engineering',
    code: 'D.02',
    lane: 'delivery',
    title: 'Engineering',
    icon: GitPullRequest,
    summary: 'Connect the code to the context behind it.',
    features: [
      'Linked pull requests and reviews',
      'CI status and release activity',
      'Review queues that surface waiting work',
    ],
    boundary: 'Repository access will follow the permissions granted by your organization.',
  },
  {
    id: 'team',
    code: 'C.01',
    lane: 'coordination',
    title: 'Team & availability',
    icon: Users,
    summary: 'Find the overlap without expecting everyone to be online.',
    features: [
      'Team membership and local working hours',
      'Leave and availability',
      'Asynchronous updates and meeting context',
    ],
    boundary: 'Colleagues will see availability, not private leave details.',
  },
  {
    id: 'sessions',
    code: 'C.02',
    lane: 'coordination',
    title: 'Work sessions',
    icon: Clock3,
    summary: 'A clear record of time, controlled by the person doing the work.',
    features: [
      'User-started sessions and breaks',
      'Task worklogs and timesheets',
      'Auditable attendance corrections',
    ],
    boundary: 'No hidden screenshots, keylogging, or continuous location tracking.',
  },
  {
    id: 'insights',
    code: 'I.01',
    lane: 'context',
    title: 'Delivery insights',
    icon: ScanLine,
    summary: 'Know what needs attention—and see the evidence behind it.',
    features: [
      'Transparent delivery risk rules',
      'Supporting records for every finding',
      'An AI analyst limited to authorized data',
    ],
    boundary: 'AI explanations will stay separate from deterministic findings.',
  },
  {
    id: 'balance',
    code: 'I.02',
    lane: 'context',
    title: 'Focus & balance',
    icon: Sprout,
    summary: 'Build a sustainable rhythm, with room to switch off.',
    features: [
      'Focus blocks and quiet hours',
      'Optional break reminders',
      'Personal working-time summaries',
    ],
    boundary: 'Time tracked will never be presented as a productivity score.',
  },
] as const;

const lanes = [
  { id: 'delivery', number: '01', name: 'Delivery', description: 'Move the work' },
  { id: 'coordination', number: '02', name: 'Coordination', description: 'Connect the people' },
  { id: 'context', number: '03', name: 'Context', description: 'See the bigger picture' },
];

export function WorkspaceMap() {
  const [selected, setSelected] = useState<string>('projects');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'map' | 'list'>('map');
  const search = useRef<HTMLInputElement>(null);
  const visible = capabilities.filter(
    (item) =>
      (filter === 'all' || item.lane === filter) &&
      `${item.title} ${item.summary} ${item.features.join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const capability = visible.find((item) => item.id === selected) ?? visible[0] ?? capabilities[0];
  const Icon = capability.icon;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key === '/' &&
        !(
          target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
        )
      ) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function chooseNext() {
    const index = visible.findIndex((item) => item.id === capability.id);
    const next = visible[(index + 1) % visible.length];
    if (next) setSelected(next.id);
  }

  return (
    <section id="workspace-direction" className="workspace-map" aria-labelledby="map-title">
      <div className="map-toolbar">
        <div>
          <Layers3 size={16} aria-hidden="true" />
          <h2 id="map-title">The workspace map</h2>
          <span className="map-version">01—06</span>
        </div>
        <div className="view-toggle" role="group" aria-label="Workspace view">
          <button
            aria-label="Map view"
            aria-pressed={view === 'map'}
            onClick={() => setView('map')}
          >
            <Layers3 size={14} aria-hidden="true" />
            Map
          </button>
          <button
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List size={15} aria-hidden="true" />
            List
          </button>
        </div>
      </div>
      <div className="explorer-controls">
        <div className="map-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={search}
            aria-label="Search planned capabilities"
            placeholder="Find a capability…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                event.stopPropagation();
              }
            }}
          />
          {query ? (
            <button
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                search.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        <div className="map-filters" role="group" aria-label="Filter capabilities">
          {[{ id: 'all', name: 'All' }, ...lanes].map((lane) => (
            <button
              key={lane.id}
              aria-pressed={filter === lane.id}
              onClick={() => setFilter(lane.id)}
            >
              {lane.name}
            </button>
          ))}
        </div>
        <span className="result-count" role="status">
          {visible.length} / 6 planned
        </span>
      </div>
      <div className={`map-layout ${view === 'list' ? 'list-view' : ''}`}>
        <div className="map-canvas">
          <div className="canvas-ruler" aria-hidden="true">
            <span>A</span>
            <span>B</span>
            <span>C</span>
            <span>D</span>
          </div>
          <div className="map-origin">
            <span className="origin-mark">df/</span>
            <div>
              <strong>Your organization</strong>
              <span>Setup comes next</span>
            </div>
            <span className="origin-label">START HERE ↘</span>
          </div>
          {visible.length ? (
            <div className="map-lanes">
              {lanes
                .filter((lane) => visible.some((item) => item.lane === lane.id))
                .map((lane) => (
                  <div className="map-lane" key={lane.id}>
                    <div className="lane-label">
                      <span>{lane.number}</span>
                      <div>
                        <h3>{lane.name}</h3>
                        <p>{lane.description}</p>
                      </div>
                    </div>
                    <div className="lane-nodes">
                      {visible
                        .filter((item) => item.lane === lane.id)
                        .map((item) => {
                          const NodeIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              className={`map-node ${item.id === capability.id ? 'node-selected' : ''}`}
                              aria-pressed={item.id === capability.id}
                              aria-controls="capability-detail"
                              onClick={() => setSelected(item.id)}
                            >
                              <span className="node-code-label">{item.code}</span>
                              <NodeIcon size={20} aria-hidden="true" />
                              <strong>{item.title}</strong>
                              <span className="node-state">
                                <span />
                                Planned
                              </span>
                              <ArrowRight className="node-arrow" size={15} aria-hidden="true" />
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="map-no-results">
              <Search size={28} aria-hidden="true" />
              <h3>No matching capabilities</h3>
              <p>Try another search or reset your filters.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                  search.current?.focus();
                }}
              >
                Reset filters
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {visible.length > 0 && (
            <a className="mobile-detail-link" href="#capability-detail">
              View {capability.title} details
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          )}
          <div className="canvas-caption">
            <span>SELECT A CAPABILITY TO EXPLORE</span>
            <span>WORKSPACE / STRUCTURE</span>
          </div>
        </div>
        {visible.length > 0 ? (
          <aside
            id="capability-detail"
            className="capability-detail"
            aria-label="Selected capability"
          >
            <div className="detail-kicker">
              <span>CAPABILITY / {capability.code}</span>
              <span className="detail-status">PLANNED</span>
            </div>
            <div aria-live="polite" aria-atomic="true">
              <div className="detail-icon">
                <Icon size={30} strokeWidth={1.3} aria-hidden="true" />
              </div>
              <h3>{capability.title}</h3>
              <p className="detail-summary">{capability.summary}</p>
              <div className="detail-divider" />
              <h4>WHAT BELONGS HERE</h4>
              <ul>
                {capability.features.map((feature, index) => (
                  <li key={feature}>
                    <span>0{index + 1}</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="detail-boundary">
                <span>THE BOUNDARY</span>
                <p>{capability.boundary}</p>
              </div>
            </div>
            <div className="detail-footer">
              <span className="outline-square" />
              Not available in this preview
            </div>
            <button className="next-capability" onClick={chooseNext} disabled={visible.length < 2}>
              Explore next
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </aside>
        ) : (
          <aside className="capability-detail detail-empty">
            <span className="detail-kicker">NOTHING SELECTED</span>
            <p>Clear your search to return to the workspace map.</p>
          </aside>
        )}
      </div>
    </section>
  );
}
