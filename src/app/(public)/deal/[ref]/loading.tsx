// The tracking page while the deal loads: the reference chip, title, lead,
// status, then the main card and the progress card (deal-track.html).
// Nothing here depends on the deal or its token.
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your deal…</span>
      <div aria-hidden="true">
        <div className="dhead">
          <div style={{ flex: "1 1 320px" }}>
            <span
              className="sk"
              style={{ width: 118, height: 38, borderRadius: 999 }}
            />
            <span
              className="sk"
              style={{
                marginTop: 16,
                width: "min(560px, 100%)",
                height: "clamp(36px, 5vw, 57px)",
              }}
            />
            <span
              className="sk"
              style={{ marginTop: 14, width: "min(440px, 90%)", height: 22 }}
            />
          </div>
          <span
            className="sk"
            style={{ width: 168, height: 34, borderRadius: 999 }}
          />
        </div>
        <div className="grid">
          <section className="card">
            <span className="sk" style={{ width: "50%", height: 24 }} />
            <span
              className="sk"
              style={{ marginTop: 16, width: "100%", height: 88 }}
            />
            <span
              className="sk"
              style={{
                marginTop: 14,
                width: "100%",
                height: 54,
                borderRadius: 999,
              }}
            />
          </section>
          <section className="card">
            <span className="sk" style={{ width: "45%", height: 24 }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", gap: 14, marginTop: 22 }}>
                <span
                  className="sk"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    flex: "none",
                  }}
                />
                <div style={{ flex: 1 }}>
                  <span className="sk" style={{ width: "60%", height: 17 }} />
                  <span
                    className="sk"
                    style={{ marginTop: 7, width: "80%", height: 14 }}
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
