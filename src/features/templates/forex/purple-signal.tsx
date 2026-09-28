/* eslint-disable @next/next/no-img-element -- Satori renders plain <img> */
// Forex "Purple Signal" board, rough version for the Phase 1 render spike.
// Satori rules: inline styles only, flexbox only (every element with more
// than one child sets display: flex), no CSS variables, no font-stretch.
// Pure: snapshot in, JSX out. No Prisma, fetch or clock.
import type { BoardSnapshot } from "@/features/boards/snapshot";
import { flagDataUri } from "@/features/templates/assets/flags";
import { purpleSignal } from "@/features/templates/theme";

export type ForexSnapshot = Extract<BoardSnapshot, { type: "FOREX" }>;

const EQ_BARS = [120, 200, 150, 260, 180, 230, 110, 170];
const LOGO_BARS = [30, 52, 64, 40];

// "1365.0000" → "1365". Phase 2 replaces this with lib/format.ts.
function boardPrice(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

export function ForexPurpleSignal({ snapshot }: { snapshot: ForexSnapshot }) {
  const { content, rows } = snapshot;
  const t = {
    ...purpleSignal,
    primary: content.brand.primaryColor ?? purpleSignal.primary,
    accent: content.brand.accentColor ?? purpleSignal.accent,
  };

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        padding: "150px 72px 0",
        backgroundImage: t.background,
        color: t.headline,
        fontFamily: "Archivo",
        lineHeight: 1.2,
      }}
    >
      {/* Brand row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 7,
              height: 64,
            }}
          >
            {LOGO_BARS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: h,
                  borderRadius: 6,
                  backgroundColor: t.accent,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 800,
              letterSpacing: -1.5,
              lineHeight: 1,
            }}
          >
            <span>stereo</span>
            <span style={{ color: t.accent }}>linkz</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            fontSize: 28,
            fontWeight: 500,
            color: t.date,
            lineHeight: 1.3,
          }}
        >
          <span style={{ color: t.dateStrong, fontWeight: 700, fontSize: 30 }}>
            {content.dateLabel}
          </span>
          <span>{`Updated ${content.timeLabel}`}</span>
        </div>
      </div>

      {/* Headline with equalizer motif */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          marginTop: 60,
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -72,
            top: -20,
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            height: 280,
            opacity: 0.18,
          }}
        >
          {EQ_BARS.map((h, i) => (
            <div
              key={i}
              style={{
                width: 26,
                height: h,
                borderRadius: "13px 13px 0 0",
                backgroundColor: (i + 1) % 3 === 0 ? t.eqBarAlt : t.eqBar,
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 124,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 0.92,
          }}
        >
          {content.headline.split("\n").map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
        {content.subheading ? (
          <div
            style={{
              marginTop: 20,
              fontSize: 36,
              fontWeight: 500,
              color: t.subheading,
            }}
          >
            {content.subheading}
          </div>
        ) : null}
      </div>

      {/* Rate card */}
      <div
        style={{
          marginTop: 44,
          display: "flex",
          flexDirection: "column",
          backgroundColor: t.card,
          color: t.cardText,
          borderRadius: 44,
          padding: "36px 40px 34px",
          boxShadow: t.cardShadow,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 16,
            paddingBottom: 14,
          }}
        >
          {["We buy", "We sell"].map((label) => (
            <span
              key={label}
              style={{
                width: 232,
                display: "flex",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 700,
                color: t.cardMuted,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {rows.map((row) => {
          const flag = row.flagCode ? flagDataUri(row.flagCode) : null;
          return (
            <div
              key={row.currencyId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                padding: "20px 0",
                borderTop: `3px solid ${t.cardDivider}`,
              }}
            >
              <div
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  boxShadow: t.flagRing,
                  backgroundColor: t.cardDivider,
                }}
              >
                {flag ? (
                  <img src={flag} width={108} height={108} alt="" />
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 66,
                    fontWeight: 900,
                    letterSpacing: -1,
                    lineHeight: 1,
                  }}
                >
                  {row.code}
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 500,
                    color: t.cardMuted,
                    marginTop: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.name}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { value: row.buy, bg: t.primary, fg: t.primaryText },
                  { value: row.sell, bg: t.accent, fg: t.accentText },
                ].map((price, i) => (
                  <div
                    key={i}
                    style={{
                      width: 232,
                      height: 112,
                      borderRadius: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 68,
                      fontWeight: 800,
                      letterSpacing: -1.5,
                      backgroundColor: price.bg,
                      color: price.fg,
                    }}
                  >
                    {boardPrice(price.value)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {content.note ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 6,
              paddingTop: 24,
              borderTop: `3px solid ${t.cardDivider}`,
              fontSize: 30,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                flexShrink: 0,
                backgroundColor: t.primary,
              }}
            />
            <span>{content.note}</span>
          </div>
        ) : null}
      </div>

      {content.reach ? (
        <div
          style={{
            marginTop: 30,
            fontSize: 31,
            fontWeight: 500,
            lineHeight: 1.35,
            color: t.reach,
          }}
        >
          {content.reach}
        </div>
      ) : null}

      {/* Contact */}
      <div
        style={{
          marginTop: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          borderRadius: 28,
          backgroundColor: t.contactBg,
          border: `2px solid ${t.contactBorder}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{ fontSize: 28, fontWeight: 500, color: t.contactLabel }}
          >
            {content.ctaLabel}
          </span>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}>
            {content.brand.contactLine ?? ""}
          </span>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke={t.accentText}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
          </svg>
        </div>
      </div>

      {content.finePrint ? (
        <div
          style={{
            marginTop: 18,
            fontSize: 23,
            color: t.fine,
            lineHeight: 1.4,
          }}
        >
          {content.finePrint}
        </div>
      ) : null}

      {/* Bottom band: decoration only (sits under WhatsApp's reply bar) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 22,
          display: "flex",
        }}
      >
        <div style={{ flexGrow: 3, backgroundColor: t.primary }} />
        <div style={{ flexGrow: 1, backgroundColor: t.accent }} />
      </div>
    </div>
  );
}
