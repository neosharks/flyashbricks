'use client';

/**
 * Catches failures in the root layout itself, which error.tsx cannot reach.
 * The translation provider may be what failed, so the text is in both
 * languages and the styles are inline.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <main>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
          <p lang="hi" style={{ marginTop: '0.25rem' }}>
            कुछ गड़बड़ हो गई
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              minHeight: '44px',
              padding: '0 1.25rem',
              borderRadius: '0.5rem',
              border: 0,
              background: '#a8432a',
              color: 'white',
              fontWeight: 500,
            }}
          >
            Try again / फिर कोशिश करें
          </button>
        </main>
      </body>
    </html>
  );
}
