// The admin dashboard: the sidebar (Launch Kiosk and the panel list) and the
// panels. Every panel stays mounted and only the active one shows, so a
// camera test or a half-typed PIN survives switching panels.

import { type MouseEvent, type ReactNode, useState } from 'react';

import { FaIcon } from './controls';
import { CapturePanel } from './panels/CapturePanel';
import { DashboardPanel } from './panels/DashboardPanel';
import { DisclaimerPanel } from './panels/DisclaimerPanel';
import { LayoutPanel } from './panels/LayoutPanel';
import { LiveViewerPanel } from './panels/LiveViewerPanel';
import { OverlayPanel } from './panels/OverlayPanel';
import { PhotoPanel } from './panels/PhotoPanel';
import { PromptsPanel } from './panels/PromptsPanel';
import { SecurityPanel } from './panels/SecurityPanel';
import { TemplatePanel } from './panels/TemplatePanel';
import { ThankYouPanel } from './panels/ThankYouPanel';
import { WelcomePanel } from './panels/WelcomePanel';

type PanelId =
  | 'dashboard'
  | 'capture'
  | 'welcome'
  | 'photo'
  | 'photo-layout'
  | 'template'
  | 'video-overlay'
  | 'vg-thankyou'
  | 'vg-prompts'
  | 'disclaimer'
  | 'security'
  | 'live-viewer';

interface NavEntry {
  id: PanelId;
  label: string;
  icon: ReactNode;
}

const BASIC: NavEntry[] = [
  { id: 'capture', label: 'Capture settings', icon: <FaIcon name="camera" /> },
];

const ADVANCED: NavEntry[] = [
  { id: 'welcome', label: 'Welcome screen', icon: <FaIcon name="mobile-screen" /> },
  { id: 'photo', label: 'Photo', icon: <FaIcon name="camera-retro" /> },
  { id: 'photo-layout', label: 'Photo Layout', icon: <FaIcon name="border-all" /> },
  { id: 'template', label: 'Photo Template', icon: <FaIcon name="image" regular /> },
  { id: 'video-overlay', label: 'Video Overlay', icon: <FaIcon name="film" /> },
  { id: 'vg-thankyou', label: 'Thank You Screen', icon: <FaIcon name="champagne-glasses" /> },
  {
    id: 'vg-prompts',
    label: 'Pre-Recording Prompts',
    icon: <FaIcon name="comment-dots" regular />,
  },
  { id: 'disclaimer', label: 'Disclaimer', icon: <FaIcon name="file-lines" /> },
  { id: 'security', label: 'Security', icon: <FaIcon name="shield-halved" /> },
  { id: 'live-viewer', label: 'Live Gallery Viewer', icon: <FaIcon name="video" /> },
];

const DASHBOARD: NavEntry = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: <FaIcon name="desktop" />,
};

function renderPanel(id: PanelId, active: boolean): ReactNode {
  switch (id) {
    case 'dashboard':
      return <DashboardPanel />;
    case 'capture':
      return <CapturePanel active={active} />;
    case 'welcome':
      return <WelcomePanel />;
    case 'photo':
      return <PhotoPanel />;
    case 'photo-layout':
      return <LayoutPanel />;
    case 'template':
      return <TemplatePanel />;
    case 'video-overlay':
      return <OverlayPanel />;
    case 'vg-thankyou':
      return <ThankYouPanel />;
    case 'vg-prompts':
      return <PromptsPanel />;
    case 'disclaimer':
      return <DisclaimerPanel />;
    case 'security':
      return <SecurityPanel />;
    case 'live-viewer':
      return <LiveViewerPanel />;
  }
}

const ALL: NavEntry[] = [DASHBOARD, ...BASIC, ...ADVANCED];

// ─── Launch Kiosk ────────────────────────────────────────────────────────────

interface CameraError {
  title: string;
  hint: string;
}

function describeCameraError(err: unknown): CameraError {
  const e = err as { name?: string; message?: string };
  const name = e.name ?? 'Error';
  let hint: string;
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    hint =
      'The selected camera was not found. Unplug and replug the USB cable, then tap Refresh in Camera Settings.';
  } else if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    hint =
      'Camera permission was denied. Grant camera access in your browser settings, then try again.';
  } else if (name === 'NotReadableError' || name === 'TrackStartError') {
    hint =
      'The camera is in use by another app, or the USB connection dropped. Unplug and replug, close other camera apps, then try again.';
  } else {
    hint = e.message ?? String(err);
  }
  return { title: `Camera error: ${name}`, hint };
}

function useLaunch() {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const launch = async (): Promise<void> => {
    const kiosk = window.PB.kiosk;
    if (!kiosk || launching) return;
    setLaunching(true);
    setError(null);
    try {
      await kiosk.launch();
    } catch (err) {
      console.error('Camera error:', err);
      setError(describeCameraError(err));
    } finally {
      setLaunching(false);
    }
  };
  return { launching, error, dismiss: () => setError(null), launch };
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function AdminApp() {
  const [active, setActive] = useState<PanelId>('dashboard');
  const { launching, error, dismiss, launch } = useLaunch();

  const navLink = (entry: NavEntry) => (
    <a
      key={entry.id}
      href={`#panel-${entry.id}`}
      id={
        entry.id === 'dashboard' || entry.id === 'capture' || entry.id === 'welcome'
          ? undefined
          : `nav-${entry.id}`
      }
      className={`nav-item${active === entry.id ? ' active' : ''}`}
      aria-current={active === entry.id ? 'page' : undefined}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        setActive(entry.id);
      }}
    >
      <span className="icon">{entry.icon}</span> {entry.label}
    </a>
  );

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <button
            type="button"
            id="btn-launch-booth"
            className="btn-primary w-100 launch-btn"
            disabled={launching}
            onClick={launch}
          >
            {launching ? (
              'Initializing Hardware...'
            ) : (
              <>
                <FaIcon name="rocket" /> Launch Kiosk
              </>
            )}
          </button>
          {error && (
            <div id="camera-error-card" role="alert">
              <strong id="camera-error-title">{error.title}</strong>
              <p id="camera-error-msg">{error.hint}</p>
              <button type="button" id="btn-camera-error-close" onClick={dismiss}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        <nav className="nav-menu">
          {navLink(DASHBOARD)}
          <div className="nav-section">BASIC</div>
          {BASIC.map(navLink)}
          <div className="nav-section">ADVANCED</div>
          {ADVANCED.map(navLink)}
        </nav>

        <div className="sidebar-footer">
          {/* Shown only on mobile, where the header is hidden. */}
          <button
            type="button"
            id="btn-launch-booth-mobile"
            className="btn-primary"
            disabled={launching}
            onClick={launch}
          >
            <FaIcon name="rocket" /> Launch
          </button>
        </div>
      </aside>

      <main className="main-content">
        {ALL.map((entry) => (
          <div
            key={entry.id}
            id={`panel-${entry.id}`}
            className="admin-panel"
            hidden={active !== entry.id}
          >
            {renderPanel(entry.id, active === entry.id)}
          </div>
        ))}
      </main>
    </>
  );
}
