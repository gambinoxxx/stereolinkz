// What a referrer sends a friend (WhatsApp share, no number: they pick
// the chat). The link carries the code; nothing else is added.
export function referralShareMessage(brand: string, shareUrl: string): string {
  return `I use ${brand} for my deals. Start yours with my link and they’ll know I sent you: ${shareUrl}`;
}

// The referrer asking us about a reward.
export function referralQuestionMessage(brand: string, code: string): string {
  return `Hi ${brand}, I have a question about my referral rewards (code ${code}).`;
}
