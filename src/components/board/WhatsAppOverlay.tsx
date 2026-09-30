import { BOARD_FONT } from "@/features/templates/layout";

// Preview only (never in the PNG): where WhatsApp's progress bars, name,
// caption and Reply bar sit on a Status (generator-edited.html .wa). Drawn
// in board pixels inside BoardFrame, so it scales with the board.
export function WhatsAppOverlay({
  name,
  caption = "Good day, see today’s rates.",
}: {
  name: string;
  caption?: string;
}) {
  return (
    <div className="absolute inset-0" style={{ fontFamily: BOARD_FONT }}>
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: 230,
          padding: "30px 36px 0",
          background: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0))",
        }}
      >
        <div className="flex" style={{ gap: 10 }}>
          <i
            className="block flex-1 bg-white"
            style={{ height: 7, borderRadius: 4 }}
          />
          <i
            className="block flex-1 bg-white/50"
            style={{ height: 7, borderRadius: 4 }}
          />
        </div>
        <div
          className="flex items-center text-white"
          style={{
            gap: 22,
            marginTop: 34,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.2,
          }}
        >
          <div
            className="shrink-0 rounded-full bg-white"
            style={{ width: 84, height: 84 }}
          />
          <div>
            {name}
            <small
              className="block opacity-80"
              style={{ fontSize: 30, fontWeight: 400 }}
            >
              just now
            </small>
          </div>
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end"
        style={{
          height: 320,
          gap: 34,
          padding: "0 40px 56px",
          background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.6) 45%)",
        }}
      >
        <div
          className="text-center text-white"
          style={{
            fontSize: 44,
            fontWeight: 500,
            lineHeight: 1.2,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {caption}
        </div>
        <div
          className="flex items-center self-stretch text-white"
          style={{
            height: 110,
            borderRadius: 55,
            padding: "0 48px",
            fontSize: 40,
            fontWeight: 500,
            background: "rgba(80,80,90,0.75)",
          }}
        >
          Reply
        </div>
      </div>
    </div>
  );
}
