import Link from "next/link";

// Says nothing about why: no "expired", no "switched off".
export default function LinkNotFound() {
  return (
    <main className="page">
      <section className="closed">
        <h2>Link not found</h2>
        <p>Check the link you were sent, or message us on WhatsApp.</p>
        <Link className="btn ghost" href="/" style={{ marginTop: 18 }}>
          Back to website
        </Link>
      </section>
    </main>
  );
}
