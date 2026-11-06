// Photo layout: which paper size and how many photos per print.

import { updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { PanelHeader } from '../controls';

interface LayoutChoice {
  value: string;
  /** Grid class for the mini paper: grid-rows-N, grid-cols-N or grid-2x2. */
  grid: string;
  colors: string[];
  title: string;
}

interface LayoutGroup {
  name: string;
  badge: { className: string; text: string; check?: boolean };
  paper: string;
  layouts: LayoutChoice[];
}

const GROUPS: LayoutGroup[] = [
  {
    name: '2 × 6 in Strip',
    badge: { className: 'selphy-wide', text: 'Selphy Wide paper' },
    paper: 'mini-2x6',
    layouts: [
      { value: '2x6-2', grid: 'grid-rows-2', colors: ['red', 'green'], title: '2 Photos' },
      { value: '2x6-3', grid: 'grid-rows-3', colors: ['red', 'green', 'blue'], title: '3 Photos' },
    ],
  },
  {
    name: '4 × 6 in Portrait',
    badge: { className: 'selphy-native', text: 'Selphy native', check: true },
    paper: 'mini-4x6',
    layouts: [
      { value: '4x6-1', grid: 'grid-rows-1', colors: ['red'], title: '1 Photo' },
      { value: '4x6-2', grid: 'grid-rows-2', colors: ['red', 'green'], title: '2 Photos' },
      {
        value: '4x6-4',
        grid: 'grid-2x2',
        colors: ['red', 'green', 'blue', 'yellow'],
        title: '4 Photos',
      },
    ],
  },
  {
    name: '4 × 6 in Landscape',
    badge: { className: 'selphy-native', text: 'Selphy native', check: true },
    paper: 'mini-4x6l',
    layouts: [
      { value: '4x6l-1', grid: 'grid-rows-1', colors: ['red'], title: '1 Photo' },
      { value: '4x6l-2', grid: 'grid-cols-2', colors: ['red', 'green'], title: '2 Photos' },
      {
        value: '4x6l-3',
        grid: 'grid-cols-3',
        colors: ['red', 'green', 'blue'],
        title: '3 Photos',
      },
    ],
  },
  {
    name: '5 × 7 in Portrait',
    badge: { className: 'selphy-scaled', text: 'Scales to 4×6 on Selphy' },
    paper: 'mini-5x7',
    layouts: [
      { value: '5x7-1', grid: 'grid-rows-1', colors: ['blue'], title: '1 Photo' },
      { value: '5x7-2', grid: 'grid-rows-2', colors: ['blue', 'yellow'], title: '2 Photos' },
    ],
  },
  {
    name: '6 × 8 in Portrait',
    badge: { className: 'selphy-scaled', text: 'Scales to Wide on Selphy' },
    paper: 'mini-6x8',
    layouts: [
      { value: '6x8-1', grid: 'grid-rows-1', colors: ['red'], title: '1 Photo' },
      {
        value: '6x8-4',
        grid: 'grid-2x2',
        colors: ['red', 'green', 'blue', 'yellow'],
        title: '4 Photos',
      },
    ],
  },
];

export function LayoutPanel() {
  const layout = useSetting('layout');
  return (
    <>
      <PanelHeader icon={<i className="fa-solid fa-border-all" />} title="Photo Layout" />

      <div className="settings-section">
        <h3 className="section-title">Photo layout</h3>
        <p className="admin-lead">
          All layouts use the polaroid-style template. Photos are square-cropped to fit. Select the
          paper size that matches your Canon Selphy CP1500.
        </p>

        {GROUPS.map((group) => (
          <div key={group.name} className="layout-size-group">
            <div className="layout-size-header">
              <span className="layout-size-name">{group.name}</span>
              <span className={`selphy-badge ${group.badge.className}`}>
                {group.badge.check && <i className="fa-solid fa-check" />} {group.badge.text}
              </span>
            </div>
            <div className="settings-card admin-layout-card">
              <div className="layout-grid">
                {group.layouts.map((l) => (
                  <label key={l.value} className="layout-card">
                    <input
                      type="radio"
                      name="layout"
                      value={l.value}
                      checked={layout === l.value}
                      onChange={() => updateSettings({ layout: l.value })}
                    />
                    <div className="card-content">
                      <div className="mini-paper-wrap">
                        <div className={`mini-paper ${group.paper} ${l.grid}`}>
                          {l.colors.map((c, i) => (
                            // Fixed list; position is the identity.
                            // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
                            <div key={i} className={`mini-photo bg-${c}`} />
                          ))}
                        </div>
                        <div className="mini-paper-footer" />
                      </div>
                      <span className="title">{l.title}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
