import "server-only";

// The deposit address as a QR code, drawn on the server as SVG (qrcode;
// nothing extra is sent to the browser). Plain address text, which every
// wallet's scanner reads; colours are the board ink on white.
import QRCode from "qrcode";

export function addressQrSvg(address: string): Promise<string> {
  return QRCode.toString(address, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1F0B3FFF", light: "#FFFFFFFF" },
  });
}
