import { ImageResponse } from 'next/og';

export const alt = 'Fly Ash Bricks — factory management software for brick plants in India';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The preview card shown when the site is shared on WhatsApp, Facebook or X. */
export default function OpenGraphImage() {
  const brick = (x: number, y: number, w: number) => (
    <div
      key={`${x}-${y}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: 44,
        borderRadius: 8,
        background: '#c98b6b',
        border: '4px solid #f4ede8',
      }}
    />
  );

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#f6f8f8',
        fontFamily: 'sans-serif',
        padding: 72,
        position: 'relative',
      }}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', width: 680, justifyContent: 'center' }}
      >
        <div style={{ fontSize: 30, color: '#0f8f7e', fontWeight: 700 }}>Fly Ash Bricks</div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#1d232b',
            lineHeight: 1.1,
            marginTop: 16,
          }}
        >
          Your whole brick factory, in one simple app
        </div>
        <div style={{ fontSize: 28, color: '#55606d', marginTop: 24 }}>
          Raw material · Production · Stock · GST invoices · Attendance
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', width: 380, height: 486 }}>
        {[0, 1, 2, 3, 4, 5, 6].flatMap((row) =>
          row % 2 === 0
            ? [brick(20, 420 - row * 52, 160), brick(184, 420 - row * 52, 160)]
            : [brick(100, 420 - row * 52, 160), brick(264, 420 - row * 52, 100)],
        )}
      </div>
    </div>,
    size,
  );
}
