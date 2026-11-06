import { useEffect, useState } from 'react';

import type { GalleryItem } from './gallery-store';
import { CameraIcon, PlayIcon, QrIcon } from './icons';

interface Props {
  item: GalleryItem;
  onOpen: (item: GalleryItem) => void;
  onShowQr: (driveUrl: string) => void;
}

export function ViewerCard({ item, onOpen, onShowQr }: Props) {
  // Pop-in animation on arrival (see .viewer-item-new in live-viewer.css).
  const [isNew, setIsNew] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsNew(false), 600);
    return () => clearTimeout(t);
  }, []);

  const isVideo = item.type === 'video';
  const label = isVideo ? `Video${item.duration ? ` (${item.duration}s)` : ''}` : 'Photo';

  return (
    <div
      className={`viewer-item${isNew ? ' viewer-item-new' : ''}`}
      data-type={item.type}
      data-filename={item.filename}
    >
      <button
        type="button"
        className="viewer-item-media"
        aria-label={isVideo ? 'Open video' : 'Open photo'}
        onClick={() => onOpen(item)}
      >
        <span className="viewer-item-frame">
          {item.data ? (
            <img className="viewer-item-img" src={item.data} alt="" />
          ) : (
            <span className="viewer-item-placeholder">
              {isVideo ? <PlayIcon size={32} /> : <CameraIcon size={32} strokeWidth={1.5} />}
            </span>
          )}
          {isVideo && item.data && (
            <span className="viewer-item-play" aria-hidden="true">
              <span>
                <PlayIcon size={18} />
              </span>
            </span>
          )}
        </span>
      </button>
      <div className="viewer-item-footer">
        <span className="viewer-item-label">{label}</span>
        <span className="viewer-item-time">{new Date(item.ts).toLocaleTimeString()}</span>
        {item.driveUrl && (
          <button
            type="button"
            className="viewer-qr-btn"
            aria-label="Show QR code to play from Google Drive"
            onClick={() => item.driveUrl && onShowQr(item.driveUrl)}
          >
            <QrIcon />
            <span>QR</span>
          </button>
        )}
      </div>
    </div>
  );
}
