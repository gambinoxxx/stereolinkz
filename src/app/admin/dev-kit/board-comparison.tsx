/* eslint-disable @next/next/no-img-element -- a data: URI PNG, shown as is */
import { BoardFrame } from "@/components/board/BoardFrame";
import { WhatsAppOverlay } from "@/components/board/WhatsAppOverlay";
import { renderBoardPng } from "@/lib/render/render-board";
import { forexFixture, pofFixture } from "@/test/board-fixtures";

const CASES = [
  { key: "forex/purple-signal", snapshot: forexFixture },
  { key: "forex/daylight", snapshot: forexFixture },
  { key: "pof/purple-signal", snapshot: pofFixture },
  { key: "pof/daylight", snapshot: pofFixture },
] as const;

// Dev only: the browser preview and the server PNG of the same fixture,
// side by side at the same width. They must look the same.
export async function BoardComparison() {
  const rendered = await Promise.all(
    CASES.map(async (c) => {
      const snapshot = c.snapshot();
      const { png, ms } = await renderBoardPng(snapshot, c.key);
      return {
        ...c,
        snapshot,
        src: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
        ms,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {rendered.map((c) => (
        <div key={c.key} className="flex flex-col gap-2">
          <span className="text-[12.5px] font-semibold text-text-muted">
            {c.key}: preview (left) and PNG (right, rendered in {c.ms} ms)
          </span>
          <div className="grid grid-cols-2 gap-3 sheet:max-w-[640px]">
            <BoardFrame templateKey={c.key} snapshot={c.snapshot} />
            <img
              src={c.src}
              alt={`${c.key} PNG`}
              className="aspect-[9/16] w-full rounded-control"
            />
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-text-muted">
          With the WhatsApp overlay (preview only)
        </span>
        <div className="w-full max-w-[300px]">
          <BoardFrame
            templateKey="forex/purple-signal"
            snapshot={rendered[0]!.snapshot}
            overlay={<WhatsAppOverlay name="Stereolinkz" />}
          />
        </div>
      </div>
    </div>
  );
}
