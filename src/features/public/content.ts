// The landing page's words (code-standards.md → Public Site). Rates,
// currency and coin names come from the latest boards, never from here
// (Invariant 1). The optional parts are null until the owner gives real
// content, and their sections stay hidden while they are: never ship the
// design's placeholders (sample reviews, payout time, licence line).

export type Review = {
  quote: string;
  name: string; // as the customer agreed to be named
  detail: string; // "Sold forex · Lagos"
};

export type Faq = { question: string; answer: string };

export const content = {
  brand: "Stereolinkz",
  // The wordmark, as on the boards: "stereo" + gold "linkz".
  wordmark: { lead: "stereo", accent: "linkz" },

  meta: {
    title: "Stereolinkz · One chat for all your money",
    description:
      "Sell forex and crypto, get proof of funds and pay school fees abroad, all on WhatsApp. Today’s rates, updated by our team.",
  },

  nav: [
    { href: "#services", label: "Services" },
    { href: "#rates", label: "Rates" },
    { href: "#world", label: "Pay abroad" },
    { href: "#how", label: "How it works" },
    { href: "#faq", label: "FAQ" },
  ],

  messages: {
    hello: "Hi Stereolinkz, I’d like today’s rate",
    schoolFees: "Hi Stereolinkz, I want to pay school fees abroad",
  },

  hero: {
    live: "Latest rates",
    noBoard: "Today’s rates on WhatsApp",
    headline: ["One", "chat", "for", "all", "your"],
    headlineAccent: "money.",
    rotatorLead: "On WhatsApp, you can",
    // Shown when there's no board to name the currency or coins from.
    rotatorForexFallback: "sell foreign currency",
    rotatorCryptoFallback: "sell crypto",
    rotatorRest: [
      "pay school fees abroad",
      "get proof of funds",
      "pay suppliers in China",
    ],
    primaryCta: "Chat on WhatsApp",
    secondaryCta: "See today’s rates",
    schoolFeesNote: {
      title: "School fees abroad",
      body: "Paid to the school directly",
    },
  },

  tickerServices: [
    { lead: "School fees abroad", bold: "same day" },
    { lead: "Payments to", bold: "UK · US · EU · Canada · China" },
    { lead: "Real people on", bold: "WhatsApp" },
  ],

  services: {
    kicker: "What we do",
    forex: {
      tag: "💵 Forex",
      fallbackTitle: "Sell your foreign currency.",
      body: "Cash or bank deposit, paid straight to your naira account at today’s rate.",
    },
    crypto: {
      tag: "🪙 Crypto",
      fallbackTitle: "Sell your crypto.",
      body: "Rates in naira per $1. We confirm the network and address, you send, we pay.",
    },
    pof: {
      tag: "📄 Proof of funds",
      title: "Statements for visas and schools.",
      body: "Proof of funds for visa, school and travel applications, at a monthly rate.",
    },
    abroad: {
      tag: "🌍 Pay abroad",
      title: "School fees and bills, sent today.",
      body: "Tuition, rent and suppliers in the UK, US, Europe, Canada, China and more. Low fees, same day.",
      facts: [
        { label: "Delivery", value: "Same day" },
        { label: "China", value: "T+1" },
      ],
    },
  },

  rates: {
    kicker: "Today’s rates",
    title: "Clear rates. No surprises.",
    sub: "The same rates we post on our WhatsApp Status. Tell us your amount and we’ll confirm before you send.",
    empty: "Today’s rates are shared on WhatsApp",
    emptySub: "Message us and we’ll send you today’s rates straight away.",
    disclaimers: {
      forex: "Naira per unit. Large amounts are agreed on request.",
      crypto:
        "Naira per $1 of coin (per coin for stablecoins). Always confirm the network before you send.",
      pof: "For visa, school and travel applications. Terms apply.",
    },
  },

  calculator: {
    title: "How much will I get?",
    selling: "I’m selling",
    buying: "I’m buying",
    youSend: "You send",
    youWant: "You want",
    youReceive: "You receive",
    youPay: "You pay",
    cta: "Get this rate on WhatsApp",
    fine: "Indicative only. Your rate is confirmed in the chat before you send anything.",
  },

  world: {
    kicker: "Payments abroad",
    title: "Same day. Anywhere.",
    sub: "Wire, ACH or local bank transfer into the UK, US, Europe, Canada, China and beyond. You pay in naira, they receive in their currency.",
    stats: [
      { value: "Same day", label: "Most payments abroad" },
      { value: "T+1", label: "Settlement to China and the rest of the world" },
      { value: "Low", label: "Fees, agreed before you pay" },
    ],
    payoutLabel: "Minute typical payout",
    cities: [
      { name: "London", flag: "gb", left: "30%", top: "13%" },
      { name: "New York", flag: "us", left: "1%", top: "30%" },
      { name: "Toronto", flag: "ca", left: "8%", top: "12%" },
      { name: "Shanghai", flag: "cn", left: "70%", top: "24%" },
      { name: "Frankfurt", flag: "eu", left: "54%", top: "7%" },
    ],
    home: { name: "Lagos", flag: "ng" },
  },

  fees: {
    kicker: "Students and parents",
    title: "School fees abroad, paid today.",
    sub: "Send us the invoice. We pay the school directly at a clear rate and send you the confirmation.",
    ticks: [
      "Tuition, deposits, accommodation and application fees",
      "UK, US, Canada, Europe, Australia and more",
      "Proof of funds for your visa, from the same team",
      "A payment confirmation you can forward to the school",
    ],
    cta: "Send us your invoice",
    example: {
      tag: "Example",
      title: "Tuition payment · University abroad",
      amount: "4500",
      status: "Paid to the school · confirmation sent",
      delivery: "Same day",
    },
  },

  steps: {
    kicker: "How it works",
    title: "Simple, fast and safe.",
    list: [
      {
        title: "Message us",
        body: "Tell us what you want to sell or pay, and how much.",
      },
      {
        title: "Confirm the rate",
        body: "We reply with today’s rate and exactly what you’ll receive.",
      },
      {
        title: "Send",
        body: "Transfer, deposit cash or send coins to the details we give you.",
      },
      {
        title: "Get paid",
        body: "Naira in your account, or your payment delivered abroad.",
      },
    ],
    restart: "Restart",
    chatLabel: "Example conversation",
  },

  mega: ["FOREX", "CRYPTO", "PROOF OF FUNDS", "SCHOOL FEES"],

  reviewsSection: { kicker: "Customers", title: "Hear it from our clients." },

  faq: {
    kicker: "FAQ",
    title: "Questions, answered.",
    sub: "Something else? Ask us on WhatsApp. We reply fast.",
    items: [
      {
        question: "Are the rates on this page final?",
        answer:
          "They’re the rates from our latest board, with the time it was made. Rates can change during the day, so we always confirm your exact rate in the chat before you send anything.",
      },
      {
        question: "Which crypto networks do you accept?",
        answer:
          "The networks are listed beside each coin in the Crypto tab. Only send on the network we confirm, to the address we give you in the chat.",
      },
      {
        question: "What is proof of funds and who needs it?",
        answer:
          "Many visa, school and travel applications ask for a bank statement showing enough funds. We arrange this for a monthly rate, shown in the POF tab.",
      },
      {
        question: "Can you pay a school or supplier directly?",
        answer:
          "Yes. Send us the invoice or payment details. We pay the recipient directly and send you the confirmation.",
      },
    ] satisfies Faq[],
    // Added at the top once the owner gives a real typical payout time.
    payoutQuestion: "How fast will I be paid?",
  },

  cta: {
    title: "Get today’s rate in one message.",
    body: "Say hi on WhatsApp. A real person replies with the rate and what you’ll receive.",
    button: "Chat on WhatsApp",
  },

  footer: {
    about:
      "Forex, crypto, proof of funds and payments abroad, handled by real people on WhatsApp.",
    services: [
      { href: "#services", label: "Sell forex" },
      { href: "#services", label: "Sell crypto" },
      { href: "#services", label: "Proof of funds" },
      { href: "#fees", label: "School fees abroad" },
    ],
    company: [
      { href: "#how", label: "How it works" },
      { href: "#faq", label: "FAQ" },
    ],
    disclaimer:
      "Rates shown are indicative and can change without notice. Your rate is confirmed before you send. Crypto prices are volatile; always confirm the network and address in the chat before sending coins.",
  },

  // ── Optional: null hides the part that uses it ──────────────────────
  // Real reviews only, used with the customer's permission.
  reviews: null as Review[] | null,
  // A real typical payout time in minutes, e.g. 9. Shown in the payments
  // abroad stats and as the first FAQ answer.
  typicalPayoutMinutes: null as number | null,
  // Registered business name, RC number and any licence wording, exactly
  // as the owner gives it. Never claim a licence that isn't real.
  legalLine: null as string | null,
  // Shown under Contact in the footer once the owner confirms it.
  location: null as string | null,
};
