// Draws a QR code with the vendored qrcode.min.js, which index.html loads as
// a plain script and which sets `window.QRCode`. It isn't bundled, so this
// is a no-op if the script hasn't loaded yet.

interface QRCodeOptions {
  text: string;
  width: number;
  height: number;
  colorDark: string;
  colorLight: string;
  correctLevel: number;
}

type QRCodeGlobal = (new (
  el: HTMLElement,
  opts: QRCodeOptions,
) => unknown) & {
  CorrectLevel: { L: number; M: number; Q: number; H: number };
};

export interface QrStyle {
  size: number;
  dark: string;
  light: string;
}

/** Replace the contents of `target` with a QR code for `text`. */
export function renderQr(target: HTMLElement, text: string, style: QrStyle): void {
  target.innerHTML = '';
  const QRCode = (window as unknown as { QRCode?: QRCodeGlobal }).QRCode;
  if (!QRCode) return;
  new QRCode(target, {
    text,
    width: style.size,
    height: style.size,
    colorDark: style.dark,
    colorLight: style.light,
    correctLevel: QRCode.CorrectLevel.M,
  });
}
