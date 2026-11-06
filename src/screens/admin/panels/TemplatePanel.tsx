// Photo template: the background image behind the photos, with a live
// preview of the chosen layout.

import { useEffect, useRef, useState } from 'react';

import { LAYOUT_DEFS, type LayoutDef, PAPER_SIZES } from '../../../constants';
import { updateSettings } from '../../../state/settings';
import { useSetting } from '../../../ui/useSettings';
import { ChooseFile, PanelHeader, useFileZone } from '../controls';

function layoutDef(layout: string): LayoutDef {
  return LAYOUT_DEFS[layout] ?? (LAYOUT_DEFS['4x6-1'] as LayoutDef);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Draw a small preview of the layout: background, photo slots, footer zone. */
function drawPreview(canvas: HTMLCanvasElement, def: LayoutDef, bg: HTMLImageElement | null): void {
  const maxH = 260;
  const scale = maxH / def.pH;
  canvas.width = Math.round(def.pW * scale);
  canvas.height = maxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (bg) {
    ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Geometry mirrors computeLayout, scaled.
  const pad = Math.round(def.pW * 0.05 * scale);
  const gap = Math.round(def.pW * 0.025 * scale);
  const footerH = Math.round(def.pH * 0.15 * scale);
  const photoZoneW = canvas.width - 2 * pad;
  const photoZoneH = canvas.height - 2 * pad - footerH;
  const maxPhotoW = Math.floor((photoZoneW - gap * (def.cols - 1)) / def.cols);
  const maxPhotoH = Math.floor((photoZoneH - gap * (def.rows - 1)) / def.rows);
  const slotW = def.square === false ? maxPhotoW : Math.min(maxPhotoW, maxPhotoH);
  const slotH = def.square === false ? maxPhotoH : slotW;
  const gridW = slotW * def.cols + gap * (def.cols - 1);
  const gridH = slotH * def.rows + gap * (def.rows - 1);
  const startX = Math.round((canvas.width - gridW) / 2);
  const startY = Math.round(pad + (photoZoneH - gridH) / 2);

  const slotColors = ['#e2e8f0', '#f1f5f9', '#dde6ef', '#eef2f6'];
  let si = 0;
  for (let r = 0; r < def.rows; r++) {
    for (let c = 0; c < def.cols; c++, si++) {
      const px = startX + c * (slotW + gap);
      const py = startY + r * (slotH + gap);
      ctx.fillStyle = slotColors[si % slotColors.length] as string;
      ctx.fillRect(px, py, slotW, slotH);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.max(8, Math.round(slotW * 0.38))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📷', px + slotW / 2, py + slotH / 2);
    }
  }

  // Footer zone: dashed line, tinted when there's no background.
  const footerY = canvas.height - footerH;
  if (!bg) {
    ctx.fillStyle = 'rgba(148,163,184,0.12)';
    ctx.fillRect(0, footerY, canvas.width, footerH);
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(148,163,184,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(canvas.width, footerY);
  ctx.stroke();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

export function TemplatePanel() {
  const layout = useSetting('layout');
  const bg = useSetting('templateBg');
  const [fileName, setFileName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const def = layoutDef(layout);
  const sizeStr = `${def.pW} × ${def.pH} px`;

  const applyFile = (file: File): void => {
    loadImage(file)
      .then((img) => {
        setFileName(file.name);
        updateSettings({ templateBg: img });
      })
      .catch((e) => console.error('Failed to load background image', e));
  };
  const { zone, input, dragOver } = useFileZone(applyFile, (f) => /image\/(jpeg|png)/.test(f.type));

  useEffect(() => {
    if (canvasRef.current) drawPreview(canvasRef.current, def, bg);
  }, [def, bg]);

  return (
    <>
      <PanelHeader icon={<i className="fa-regular fa-image" />} title="Photo Template" />

      <div className="template-hint-bar">
        <div className="hint-icon">
          <i className="fa-solid fa-ruler-combined" />
        </div>
        <div className="hint-text">
          <div className="hint-layout-row">
            <strong id="hint-layout-name">{def.name}</strong>
            <span className="hint-size-badge" id="hint-canvas-size">
              {sizeStr}
            </span>
          </div>
          <div className="hint-sub" id="hint-paper">
            {PAPER_SIZES[def.paper]?.selphy ?? ''}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Background Image</h3>
        <p className="admin-lead admin-lead-tight">
          Fills the canvas behind your captured photos. If no image is uploaded, the background
          defaults to white.
          <br />
          Accepts <strong>JPG, JPEG, PNG</strong> &middot; Recommended size:{' '}
          <strong>
            <span id="bg-size-hint">{sizeStr}</span>
          </strong>
        </p>
        <div
          className={`settings-card template-upload-card${dragOver ? ' drag-over' : ''}`}
          id="bg-upload-zone"
          onDragOver={zone.onDragOver}
          onDragEnter={zone.onDragEnter}
          onDragLeave={zone.onDragLeave}
          onDrop={zone.onDrop}
        >
          {bg ? (
            <div className="upload-preview-state" id="bg-preview-state">
              <img className="upload-thumb" id="bg-thumb" src={bg.src} alt="Background preview" />
              <div className="upload-preview-info">
                <span className="upload-filename" id="bg-filename">
                  {fileName || 'image.png'}
                </span>
                <span className="upload-dims" id="bg-dims">
                  {bg.naturalWidth} × {bg.naturalHeight} px
                </span>
                <button
                  type="button"
                  className="btn-outline btn-remove-upload"
                  id="btn-clear-bg"
                  onClick={() => updateSettings({ templateBg: null })}
                >
                  <i className="fa-solid fa-xmark" /> Remove
                </button>
              </div>
            </div>
          ) : (
            // biome-ignore lint/a11y/useKeyWithClickEvents: Choose File is the keyboard path
            <div className="upload-empty-state" id="bg-empty-state" onClick={zone.onClick}>
              <div className="upload-icon">
                <i className="fa-regular fa-image" />
              </div>
              <div className="upload-prompt">
                <span className="upload-title">Upload Background</span>
                <span className="upload-sub">Click anywhere or drag &amp; drop a file here</span>
              </div>
              <ChooseFile
                id="btn-pick-bg"
                inputId="upload-template-bg"
                input={input}
                accept=".jpg,.jpeg,.png"
              />
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="section-title">Live Preview</h3>
        <div className="template-canvas-wrap">
          <canvas id="template-preview-canvas" ref={canvasRef} />
          <span className="template-canvas-label" id="template-canvas-label">
            {def.name}
          </span>
        </div>
      </div>
    </>
  );
}
