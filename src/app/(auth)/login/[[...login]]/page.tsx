import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/wordmark";

export default async function LoginPage() {
  const { userId } = await auth();
  if (userId) redirect("/admin");

  return (
    <div className="grid min-h-screen flex-1 grid-cols-1 bg-bg-surface min-[900px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col overflow-hidden bg-brand-panel px-6 pt-7 pb-[30px] text-white min-[900px]:px-[52px] min-[900px]:py-11">
        <Wordmark />
        {/* The tilted sample board from login.html is added in Phase 6 (6.3),
            once the template components exist. */}
        <h2 className="relative mt-7 max-w-[12ch] text-[32px] leading-none font-extrabold tracking-[-1.6px] font-stretch-[112%] min-[900px]:mt-auto min-[900px]:text-[clamp(34px,3.6vw,52px)]">
          Update the rates. Post in seconds.
        </h2>
        <p className="relative mt-4 max-w-[38ch] text-base text-brand-panel-text">
          Manage forex and POF rates, then turn them into a WhatsApp Status
          board in one tap.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-8">
        <div className="flex w-full max-w-[380px] flex-col gap-4">
          <SignIn
            appearance={{
              variables: {
                colorPrimary: "var(--accent-primary)",
                colorPrimaryForeground: "var(--bg-surface)",
                colorForeground: "var(--text-primary)",
                colorMutedForeground: "var(--text-secondary)",
                colorBackground: "var(--bg-surface)",
                colorInput: "var(--bg-surface)",
                colorInputForeground: "var(--text-primary)",
                colorBorder: "var(--border-default)",
                colorRing: "var(--accent-primary)",
                colorDanger: "var(--state-error)",
                borderRadius: "10px",
                fontFamily: "var(--font-sans)",
                fontSize: "15px",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full max-w-none rounded-none border-0 shadow-none",
                card: "gap-4 bg-transparent p-0 shadow-none",
                header: "items-start text-left",
                headerTitle:
                  "text-[28px] font-[750] tracking-[-0.6px] font-stretch-[106%]",
                headerSubtitle: "text-[15px] text-text-secondary",
                socialButtonsBlockButton:
                  "h-[46px] border border-border-default text-[15.5px] font-semibold text-text-primary shadow-none hover:bg-bg-subtle",
                dividerLine: "bg-border-default",
                dividerText: "text-[13px] text-text-muted",
                formFieldLabel: "text-[13.5px] font-semibold",
                formFieldInput:
                  "h-[42px] border border-border-input shadow-none focus:border-accent-primary",
                formButtonPrimary:
                  "h-[46px] bg-accent-primary bg-none text-[15.5px] font-semibold shadow-none hover:bg-accent-primary-hover",
                buttonArrowIcon: "hidden",
                footer: "bg-none bg-transparent",
                footerAction: "hidden",
              },
            }}
          />
          <p className="flex items-center justify-center gap-1.5 text-center text-[12.5px] text-text-muted">
            <Lock className="h-[13px] w-[13px]" strokeWidth={1.9} aria-hidden />
            Secured by Clerk. Only invited accounts can open the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
