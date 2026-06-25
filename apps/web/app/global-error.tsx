"use client";

// Last-resort boundary: catches errors thrown in the root layout itself.
// It replaces the entire document, so it cannot rely on the app stylesheet —
// styles are inlined deliberately.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-UG">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily:
            "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#0f172a",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#15655a",
            }}
          >
            SkulPulse
          </div>
          <h1 style={{ fontSize: 22, margin: "12px 0 6px", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.5, margin: 0 }}>
            The app ran into an unexpected problem. You can try again — if it keeps
            happening, please contact support.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: "#94a3b8",
                marginTop: 12,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 38,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              background: "#15655a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
