/* eslint-disable @next/next/no-img-element -- Satori renders plain <img> */
// Shared board layout for every template (stereolinkz-rate-boards.html).
// Rendered by Satori on the server and by BoardFrame in the browser, so:
//   - inline styles only, flexbox only, colours from the theme
//   - every element with more than one child sets display: "flex"
//   - no CSS variables, grid, font-stretch or measured text fitting
//   - pure: the snapshot in, JSX out (Invariant 4)
import type { CSSProperties, ReactNode } from "react";

import type {
  ForexSnapshot,
  PofSnapshot,
} from "@/features/boards/build-snapshot";
import { bankSlug } from "@/features/banks/slug";
import { flagDataUri } from "@/features/templates/assets/flags";
import {
  percentPillFontSize,
  pofNoteBelow,
  pricePillFontSize,
} from "@/features/templates/text-rules";
import { BANK_MARK_HEX, type BoardTheme } from "@/features/templates/theme";
import { bankMarkIndex, bankMonogram } from "@/lib/bank-mark";
import { formatBoardPrice, formatPercent } from "@/lib/format";

export const BOARD_W = 1080;
export const BOARD_H = 1920;

// The same two font names Satori registers (lib/render/fonts.ts) and the
// browser declares (components/board/board-fonts.css).
export const BOARD_FONT = "Archivo, 'Archivo latin-ext'";

const LOGO_BARS = [30, 52, 64, 40];
const EQ_BARS = [120, 200, 150, 260, 180, 230, 110, 170];

const ellipsis: CSSProperties = {
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

type Content = ForexSnapshot["content"];

function Brand({ content, theme }: { content: Content; theme: BoardTheme }) {
  const { brand } = content;
  if (brand.logoUrl) {
    return (
      <img
        src={brand.logoUrl}
        alt=""
        width={400}
        height={64}
        style={{
          width: 400,
          height: 64,
          objectFit: "contain",
          objectPosition: "left",
        }}
      />
    );
  }
  // No logo: the equalizer bars and the brand name, lowercase.
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 64 }}
      >
        {LOGO_BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: h,
              borderRadius: 6,
              backgroundColor: theme.accent,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 60,
          fontWeight: 800,
          letterSpacing: -1.5,
          lineHeight: 1,
          color: theme.wordmark,
          maxWidth: 560,
          ...ellipsis,
        }}
      >
        {brand.name.toLowerCase()}
      </div>
    </div>
  );
}

function Header({ content, theme }: { content: Content; theme: BoardTheme }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Brand content={content} theme={theme} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.3,
          color: theme.date,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, color: theme.dateStrong }}>
          {content.dateLabel}
        </div>
        <div>{`Updated ${content.timeLabel}`}</div>
      </div>
    </div>
  );
}

function Hero({ content, theme }: { content: Content; theme: BoardTheme }) {
  const lines = content.headline.split("\n");
  return (
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
          opacity: theme.eqOpacity,
        }}
      >
        {EQ_BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: 26,
              height: h,
              borderRadius: "13px 13px 0 0",
              backgroundColor: (i + 1) % 3 === 0 ? theme.eqBarAlt : theme.eqBar,
            }}
          />
        ))}
      </div>
      {/* Two lines by design; anything longer is clipped (the generator
          prevents it in Phase 7). */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: 2 * 124 * 0.92 + 8,
          overflow: "hidden",
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: -4,
          lineHeight: 0.92,
          color: theme.text,
        }}
      >
        {lines.slice(0, 2).map((line, i) => (
          <div key={i} style={ellipsis}>
            {line}
          </div>
        ))}
      </div>
      {content.subheading ? (
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            fontWeight: 500,
            color: theme.subheading,
            ...ellipsis,
          }}
        >
          {content.subheading}
        </div>
      ) : null}
    </div>
  );
}

function Card({ theme, children }: { theme: BoardTheme; children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 44,
        display: "flex",
        flexDirection: "column",
        backgroundColor: theme.card,
        color: theme.cardText,
        borderRadius: 44,
        padding: "36px 40px 34px",
        boxShadow: theme.cardShadow,
        ...(theme.cardBorder
          ? { border: `2px solid ${theme.cardBorder}` }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

function ChatIcon({ color }: { color: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" />
    </svg>
  );
}

function Footer({ content, theme }: { content: Content; theme: BoardTheme }) {
  // A column div, not a fragment: Satori lays a fragment out as a row.
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {content.brand.contactLine ? (
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 32px",
            borderRadius: 28,
            backgroundColor: theme.contactBg,
            border: `2px solid ${theme.contactBorder}`,
            color: theme.contactText,
          }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: theme.contactLabel,
                ...ellipsis,
              }}
            >
              {content.ctaLabel}
            </div>
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: -0.5,
                ...ellipsis,
              }}
            >
              {content.brand.contactLine}
            </div>
          </div>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.accent,
            }}
          >
            <ChatIcon color={theme.accentText} />
          </div>
        </div>
      ) : null}
      {content.finePrint ? (
        <div
          style={{
            marginTop: 18,
            fontSize: 23,
            lineHeight: 1.4,
            color: theme.fine,
          }}
        >
          {content.finePrint}
        </div>
      ) : null}
    </div>
  );
}

// The board: 1080 × 1920. The top 150px (WhatsApp's progress bar and name)
// and the bottom ~320px (caption and Reply bar) hold only the band and
// small print (ui-context.md → Board safe area).
function BoardShell({
  content,
  theme,
  children,
}: {
  content: Content;
  theme: BoardTheme;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: BOARD_W,
        height: BOARD_H,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        padding: "150px 72px 0",
        backgroundImage: theme.background,
        color: theme.text,
        fontFamily: BOARD_FONT,
        lineHeight: 1.2,
      }}
    >
      <Header content={content} theme={theme} />
      <Hero content={content} theme={theme} />
      {children}
      <Footer content={content} theme={theme} />
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
        <div style={{ flexGrow: 3, backgroundColor: theme.primary }} />
        <div style={{ flexGrow: 1, backgroundColor: theme.accent }} />
      </div>
    </div>
  );
}

const divider = (theme: BoardTheme) => `3px solid ${theme.cardDivider}`;

// ── Forex ────────────────────────────────────────────────────────────

function Flag({
  row,
  theme,
}: {
  row: ForexSnapshot["rows"][number];
  theme: BoardTheme;
}) {
  const src = row.flagCode ? flagDataUri(row.flagCode) : null;
  return (
    <div
      style={{
        width: 108,
        height: 108,
        borderRadius: 54,
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: theme.flagRing,
        backgroundColor: theme.cardDivider,
        color: theme.cardText,
        fontSize: 32,
        fontWeight: 900,
      }}
    >
      {src ? <img src={src} alt="" width={108} height={108} /> : row.code}
    </div>
  );
}

function PricePill({
  value,
  bg,
  fg,
}: {
  value: string;
  bg: string;
  fg: string;
}) {
  const text = formatBoardPrice(value);
  return (
    <div
      style={{
        width: 232,
        height: 112,
        borderRadius: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontSize: pricePillFontSize(text),
        fontWeight: 800,
        letterSpacing: -1.5,
        backgroundColor: bg,
        color: fg,
      }}
    >
      {text}
    </div>
  );
}

export function ForexBoard({
  snapshot,
  theme,
}: {
  snapshot: ForexSnapshot;
  theme: BoardTheme;
}) {
  const { content, rows } = snapshot;
  return (
    <BoardShell content={content} theme={theme}>
      <Card theme={theme}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 16,
            paddingBottom: 14,
          }}
        >
          {["We buy", "We sell"].map((label) => (
            <div
              key={label}
              style={{
                width: 232,
                display: "flex",
                justifyContent: "center",
                fontSize: 30,
                fontWeight: 700,
                color: theme.cardMuted,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.currencyId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "20px 0",
              borderTop: divider(theme),
            }}
          >
            <Flag row={row} theme={theme} />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                flexShrink: 1,
                minWidth: 0,
                // Lets a long currency name shrink (with an ellipsis)
                // instead of pushing the price pills out of the card.
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: 66,
                  fontWeight: 900,
                  letterSpacing: -1,
                  lineHeight: 1,
                }}
              >
                {row.code}
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  color: theme.cardMuted,
                  marginTop: 6,
                  ...ellipsis,
                }}
              >
                {row.name}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
              <PricePill
                value={row.buy}
                bg={theme.primary}
                fg={theme.primaryText}
              />
              <PricePill
                value={row.sell}
                bg={theme.accent}
                fg={theme.accentText}
              />
            </div>
          </div>
        ))}
        {content.note ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 6,
              paddingTop: 24,
              borderTop: divider(theme),
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
                backgroundColor: theme.primary,
              }}
            />
            <div style={ellipsis}>{content.note}</div>
          </div>
        ) : null}
      </Card>
      {content.reach ? (
        <div
          style={{
            marginTop: 30,
            fontSize: 31,
            fontWeight: 500,
            lineHeight: 1.35,
            color: theme.reach,
          }}
        >
          {content.reach}
        </div>
      ) : null}
    </BoardShell>
  );
}

// ── POF ──────────────────────────────────────────────────────────────

function BankMonogram({ row }: { row: PofSnapshot["rows"][number] }) {
  // Same colour as the admin BankMark: the slug is always bankSlug(name).
  const color = BANK_MARK_HEX[bankMarkIndex(bankSlug(row.name))];
  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        flexShrink: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: row.logoUrl ? "#FFFFFF" : color,
        color: "#FFFFFF",
        fontSize: 34,
        fontWeight: 800,
      }}
    >
      {row.logoUrl ? (
        <img
          src={row.logoUrl}
          alt=""
          width={80}
          height={80}
          style={{ width: 80, height: 80, objectFit: "cover" }}
        />
      ) : (
        bankMonogram(row.name)
      )}
    </div>
  );
}

function NotePill({ note, theme }: { note: string; theme: BoardTheme }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "6px 16px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        backgroundColor: theme.accent,
        color: theme.accentText,
        fontSize: 24,
        fontWeight: 700,
      }}
    >
      {note}
    </div>
  );
}

export function PofBoard({
  snapshot,
  theme,
}: {
  snapshot: PofSnapshot;
  theme: BoardTheme;
}) {
  const { content, rows } = snapshot;
  return (
    <BoardShell content={content} theme={theme}>
      <Card theme={theme}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingBottom: 14,
            fontSize: 30,
            fontWeight: 700,
            color: theme.cardMuted,
          }}
        >
          <div>Bank</div>
          <div
            style={{ width: 200, display: "flex", justifyContent: "center" }}
          >
            Per month
          </div>
        </div>
        {rows.map((row) => {
          const label = row.shortName ?? row.name;
          const below = pofNoteBelow(label, row.note);
          return (
            <div
              key={row.bankId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                // 12px, not the design's 16px: with 6 banks the design's
                // contact panel ends at 1618px, inside the bottom safe area.
                padding: "12px 0",
                borderTop: divider(theme),
              }}
            >
              <BankMonogram row={row} />
              <div
                style={{
                  display: "flex",
                  flexDirection: below ? "column" : "row",
                  alignItems: below ? "flex-start" : "center",
                  gap: below ? 8 : 18,
                  flexGrow: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    letterSpacing: -0.5,
                    lineHeight: 1.05,
                    maxWidth: "100%",
                    ...ellipsis,
                  }}
                >
                  {label}
                </div>
                {row.note ? <NotePill note={row.note} theme={theme} /> : null}
              </div>
              <div
                style={{
                  width: 200,
                  height: 88,
                  borderRadius: 22,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.primary,
                  color: theme.primaryText,
                  fontSize: percentPillFontSize(formatPercent(row.rate)),
                  fontWeight: 800,
                  letterSpacing: -1,
                }}
              >
                {formatPercent(row.rate)}
              </div>
            </div>
          );
        })}
      </Card>
    </BoardShell>
  );
}
