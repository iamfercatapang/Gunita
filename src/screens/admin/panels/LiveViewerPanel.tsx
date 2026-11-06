// Live Gallery Viewer: host a peer-to-peer link so a second device shows
// every capture as it's made. The host itself is src/lib/live-viewer/host.ts.

import { useEffect, useRef, useSyncExternalStore } from 'react';

import { renderQr } from '../../../lib/qr';
import { getLiveViewerStatus, subscribeLiveViewerStatus } from '../../../state/live-viewer-status';
import { PanelHeader, useDraftSetting } from '../controls';

const trim = (t: string): string => t.trim();

function Qr({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && text)
      renderQr(ref.current, text, { size: 164, dark: '#1e293b', light: '#ffffff' });
  }, [text]);
  return <div id="lv-qr-container" ref={ref} />;
}

export function LiveViewerPanel() {
  const lv = useSyncExternalStore(subscribeLiveViewerStatus, getLiveViewerStatus);
  const [addr, setAddr] = useDraftSetting('lvNetworkAddr', trim);

  return (
    <>
      <PanelHeader
        icon={<i className="fa-solid fa-video" />}
        title="Live Gallery Viewer"
        subClassName="admin-panel-lead"
        sub="Let a second device — a TV, tablet, or phone — display every capture in real-time over your local Wi-Fi network."
      />

      <div className="settings-section">
        <h3 className="section-title">How it works</h3>
        <div className="info-box admin-steps">
          <p>
            <strong>1.</strong> Click <strong>Start Hosting</strong> below. A unique QR code
            appears.
          </p>
          <p>
            <strong>2.</strong> On the viewer device, open the camera app and scan the QR code — it
            opens a full-screen gallery page.
          </p>
          <p>
            <strong>3.</strong> Every new photo or video captured on this device appears on the
            viewer instantly over your local Wi-Fi.
          </p>
          <p className="admin-steps-note">
            <strong>Note:</strong> An internet connection is needed for the first few seconds to
            establish the peer-to-peer link. After that, all data flows directly over your local
            network.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Network Address</h3>
        <div className="settings-card admin-card-compact">
          <p className="admin-body-text">
            The QR code only works on other devices when it points to this device's{' '}
            <strong>local network IP</strong>, not <code>localhost</code>. Enter the address mobile
            devices can reach this page at.
          </p>
          <label className="admin-field-label" htmlFor="lv-network-addr">
            Network address of this device
          </label>
          <input
            type="text"
            id="lv-network-addr"
            className="text-input admin-input-addr"
            placeholder="e.g. http://192.168.1.100"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
          />
          <p className="admin-hint admin-hint-spaced">
            Find it in: Wi-Fi settings → your connected network → IP address. Then enter{' '}
            <code>http://&lt;IP&gt;</code> here.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Session</h3>
        <div className="settings-card admin-card-roomy">
          {lv.active ? (
            <div id="lv-active-state">
              <div className="lv-status-row">
                <div
                  className={`lv-status-dot${lv.connected ? ' lv-dot-on' : ''}`}
                  id="lv-status-dot"
                />
                <output id="lv-status-text">{lv.statusText}</output>
                <button
                  type="button"
                  id="btn-lv-stop"
                  className="btn-outline"
                  onClick={() => window.PB.liveViewer.host.stop()}
                >
                  Stop
                </button>
              </div>
              <div className="lv-active-body">
                <div>
                  <Qr text={lv.viewerUrl} />
                  <p className="lv-qr-caption">Scan with viewer device</p>
                </div>
                <div className="lv-details">
                  <div className="lv-url-label">Viewer URL (open manually if QR won't scan):</div>
                  <div id="lv-viewer-url">{lv.viewerUrl}</div>
                  <div className="lv-stat">
                    <span>Viewers connected: </span>
                    <strong id="lv-viewer-count">{lv.viewers}</strong>
                  </div>
                  <div className="lv-stat lv-stat-tight">
                    <span>Captures sent this session: </span>
                    <strong id="lv-sent-count">{lv.sent}</strong>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div id="lv-idle-state">
              <button
                type="button"
                id="btn-lv-start"
                className="btn-primary lv-start-btn"
                onClick={() => window.PB.liveViewer.host.start()}
              >
                <i className="fa-solid fa-video" /> Start Hosting
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
