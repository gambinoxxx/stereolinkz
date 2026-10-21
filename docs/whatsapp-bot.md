# WhatsApp bot

The Stereolinkz WhatsApp bot answers customers on the WhatsApp Cloud API
(Meta, direct, no third-party provider). It shows a menu, links each
service to its deal form on stereolinkz.com, posts today's rates from the
latest Forex and POF boards, tracks a deal by its number (only for the
deal's own WhatsApp number) and hands the chat to a person on request.

Code: `src/app/api/whatsapp/webhook/route.ts` (the webhook) and
`src/features/whatsapp/` (`bot.ts` decisions and replies, `handle.ts`
running them, `client.ts` sending, `signature.ts` Meta's checks,
`payload.ts` parsing). Data: `WhatsAppContact` (pause and state per chat)
and `WhatsAppEvent` (message ids, for idempotency). No message text is
ever stored or logged, and phone numbers are never logged.

## Environment variables

Real values go in Vercel (Production) and, for local testing, `.env.local`.
Never in code, commits or chat.

| Name | What it is |
| --- | --- |
| `WHATSAPP_TOKEN` | A permanent system-user access token (Business settings → System users → Generate token, with `whatsapp_business_messaging` and `whatsapp_business_management`). Not the 24-hour temporary token. |
| `WHATSAPP_PHONE_NUMBER_ID` | The phone number's id (WhatsApp → API Setup). Test number: `1408309812364681`. |
| `WHATSAPP_VERIFY_TOKEN` | A random string you choose; Meta sends it back when you set the webhook. |
| `WHATSAPP_APP_SECRET` | App settings → Basic → App secret. Signs every webhook post. |
| `WHATSAPP_GRAPH_VERSION` | `v25.0` |

Without `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` the bot still
records messages but sends nothing. Without `WHATSAPP_APP_SECRET` every
post is refused (401); without `WHATSAPP_VERIFY_TOKEN` verification fails
(403).

## Setting the webhook in Meta

1. Deploy with the variables set.
2. Meta for Developers → your app → WhatsApp → Configuration → Webhook →
   Edit.
3. Callback URL: `https://stereolinkz.com/api/whatsapp/webhook`.
   Verify token: the value of `WHATSAPP_VERIFY_TOKEN`. Verify and save.
   (Meta calls `GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`;
   the route answers with the challenge.)
4. Under Webhook fields, subscribe to **messages**. Once the real number
   is connected with the WhatsApp Business app (coexistence), also
   subscribe to **smb_message_echoes**: a reply sent from the app pauses
   the bot in that chat for 12 hours.

## Testing with the test number

1. WhatsApp → API Setup: add your own phone as a recipient (Meta sends a
   code to confirm it).
2. From that phone, message the test number "hi". The bot answers with
   the menu list.
3. Try each option: a service (link to its form), Today's rates, Track my
   deal (send a deal number like SLZ-1047; you only see the status if the
   deal was made with your number), Talk to a person (the team gets an
   email if Resend is set up; the bot stays quiet for 12 hours or until
   you type "menu").
4. Vercel → Logs shows `[whatsapp]` lines only for failures (HTTP status
   and Meta's error code, nothing else).

## Rules

- Free-form replies only, and only in answer to a customer message (inside
  their 24-hour window). No message templates yet.
- The bot never mentions crypto, never invents a rate (no board → "a team
  member will confirm your rate"), and never shows another customer's
  deal: a number mismatch gets the same reply as a missing deal.
- "Talk to a person" pauses the bot for that chat for 12 hours and emails
  `DEAL_ALERT_TO` (at most once an hour per chat) with no customer
  details: the team replies from the WhatsApp Business app. "menu" or
  "hi" resumes the bot early.
- Meta retries deliveries: each message id is handled once.
