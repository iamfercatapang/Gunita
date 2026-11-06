// "Recent Captures" on the admin dashboard, plus its "View all" window and
// lightbox. Classes match the pre-React markup, so styles.css and admin.css
// apply unchanged.

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Capture, CaptureType } from '../../state/captures';
import { Lightbox } from './Lightbox';
import {
  CameraIcon,
  PlayIcon,
  QrIcon,
  VideoIcon,
  VideoThumb,
  useCaptures,
  useEscape,
} from './shared';

/** The dashboard shows this many of each; "View all" shows the rest. */
const DASHBOARD_LIMIT = 8;

interface Open {
  type: CaptureType;
  index: number;
}

export function DashboardGallery() {
  const { photos, videos } = useCaptures();
  const [tab, setTab] = useState<CaptureType>('photo');
  const [modalOpen, setModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Open | null>(null);

  const openLightbox = useCallback((type: CaptureType, index: number) => {
    setModalOpen(false);
    setLightbox({ type, index });
  }, []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <>
      <div className="gallery-header">
        <h3 className="section-title" style={{ margin: 0 }}>
          Recent Captures
        </h3>
        <button
          type="button"
          id="btn-view-all-gallery"
          className="gallery-view-all"
          onClick={() => setModalOpen(true)}
        >
          View all →
        </button>
      </div>
      <TypeTabs
        active={tab}
        onChange={setTab}
        counts={{ photo: photos.length, video: videos.length }}
      />
      {tab === 'photo' ? (
        <div id="dashboard-gallery-photo" className="gallery-grid">
          {photos.length === 0 ? (
            <div className="empty-gallery">No photos yet. Launch the Kiosk to start a session!</div>
          ) : (
            photos
              .slice(0, DASHBOARD_LIMIT)
              .map((c, i) => (
                <GalleryTile
                  key={c.id}
                  capture={c}
                  num={photos.length - i}
                  onOpen={() => openLightbox('photo', i)}
                />
              ))
          )}
        </div>
      ) : (
        <div id="dashboard-gallery-video" className="gallery-grid gallery-grid-video">
          {videos.length === 0 ? (
            <div className="empty-gallery">
              No videos yet. Switch to Video Guestbook mode and record a message!
            </div>
          ) : (
            videos
              .slice(0, DASHBOARD_LIMIT)
              .map((c, i) => (
                <GalleryTile
                  key={c.id}
                  capture={c}
                  num={videos.length - i}
                  onOpen={() => openLightbox('video', i)}
                />
              ))
          )}
        </div>
      )}
      {modalOpen &&
        createPortal(
          <GalleryModal
            photos={photos}
            videos={videos}
            onOpen={openLightbox}
            onClose={closeModal}
          />,
          document.body,
        )}
      {lightbox &&
        createPortal(
          <Lightbox
            items={lightbox.type === 'photo' ? photos : videos}
            startIndex={lightbox.index}
            variant="admin"
            onClose={closeLightbox}
          />,
          document.body,
        )}
    </>
  );
}

function TypeTabs({
  active,
  onChange,
  counts,
}: {
  active: CaptureType;
  onChange: (t: CaptureType) => void;
  counts?: Record<CaptureType, number>;
}) {
  return (
    <div className="capture-tabs-nav" role="tablist" style={{ marginBottom: '1.25rem' }}>
      {(['photo', 'video'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={active === t}
          className={`capture-tab-btn${active === t ? ' active' : ''}`}
          onClick={() => onChange(t)}
        >
          {t === 'photo' ? <CameraIcon /> : <VideoIcon />}
          {t === 'photo' ? 'PhotoBooth' : 'Video Guestbook'}
          {counts && (
            <span
              className="gallery-tab-count"
              id={t === 'photo' ? 'count-photos' : 'count-videos'}
            >
              {counts[t]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function GalleryTile({
  capture,
  num,
  onOpen,
}: { capture: Capture; num: number; onOpen: () => void }) {
  const isVideo = capture.type === 'video';
  const label = `${isVideo ? 'Video' : 'Photo'} #${num}`;
  return (
    <div className={`gallery-item${isVideo ? ' gallery-item-video' : ''}`} title={label}>
      <button
        type="button"
        className="gallery-item-open"
        aria-label={`Open ${label}`}
        onClick={onOpen}
      >
        {isVideo ? <VideoThumb src={capture.src} /> : <img src={capture.src} alt="" />}
        {isVideo && (
          <span className="gallery-play-icon">
            <PlayIcon />
          </span>
        )}
        <span className="overlay">{label}</span>
      </button>
      {capture.driveUrl && (
        <button
          type="button"
          className="gallery-qr-btn"
          title="Open in Google Drive"
          onClick={() => capture.driveUrl && window.open(capture.driveUrl, '_blank', 'noopener')}
        >
          <QrIcon />
          QR
        </button>
      )}
    </div>
  );
}

function GalleryModal({
  photos,
  videos,
  onOpen,
  onClose,
}: {
  photos: readonly Capture[];
  videos: readonly Capture[];
  onOpen: (type: CaptureType, index: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<CaptureType>('photo');
  useEscape(onClose);
  const list = tab === 'photo' ? photos : videos;

  return (
    <div
      id="gallery-modal"
      className="gallery-modal-overlay gallery-fade-in"
      data-theme="dark"
      // Not <dialog>: the overlay div is the backdrop, and showModal()'s own
      // backdrop and top layer aren't what the existing CSS expects.
      // biome-ignore lint/a11y/useSemanticElements: see above
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-modal-title"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes for keyboard users */}
      <div id="gallery-modal-backdrop" onClick={onClose} />
      <div className="gallery-modal-inner">
        <div className="gallery-modal-header">
          <h2 id="gallery-modal-title">
            All Captures{' '}
            <span id="gallery-modal-count" className="gallery-modal-count">
              ({photos.length + videos.length})
            </span>
          </h2>
          <button
            type="button"
            className="gallery-modal-close"
            id="gallery-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <TypeTabs active={tab} onChange={setTab} />
        <div
          className={`gallery-modal-grid${tab === 'video' ? ' gallery-modal-grid-video' : ''}`}
          id={tab === 'photo' ? 'gallery-modal-grid' : 'gallery-modal-grid-video'}
        >
          {list.length === 0 ? (
            <div className="empty-gallery">
              {tab === 'photo' ? 'No photos captured yet.' : 'No videos captured yet.'}
            </div>
          ) : (
            list.map((c, i) => {
              const label = `${tab === 'photo' ? 'Photo' : 'Video'} #${list.length - i}`;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`gallery-modal-item${tab === 'video' ? ' gallery-modal-item-video' : ''}`}
                  title={label}
                  aria-label={`Open ${label}`}
                  onClick={() => onOpen(tab, i)}
                >
                  {tab === 'video' ? <VideoThumb src={c.src} /> : <img src={c.src} alt="" />}
                  {tab === 'video' && (
                    <span className="gallery-play-icon">
                      <PlayIcon />
                    </span>
                  )}
                  <span className="overlay">{label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
