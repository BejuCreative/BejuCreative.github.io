// Beju Creative client portal: settings. Plain values only; edit and redeploy.
// The anon key is public by design (row-level security protects the data).
// NEVER put the service-role key or any other secret in this file.
window.BEJU_PORTAL = {
  supabaseUrl: "https://zfnpvcrnujxlycmqukqs.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbnB2Y3JudWp4bHljbXF1a3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMjMyNzgsImV4cCI6MjEwNzg5OTI3OH0.1MT1RtPT_REhVtekoLRga_BRvlxZnWSzwUF-Z_S314Y",

  google: false,      // true = show "Continue with Google" (turn on only after the Google provider is set up in Supabase Auth)
  showPrices: true,   // false = packs show "Book a call to get pricing" instead of prices and buy buttons
  callUrl: "https://cal.com/beju-creative/15min-call",
  crmUrl: "https://juceviciussimas-max.github.io/beju-v2/app/",   // shown on Account only when profiles.is_admin = true

  // Buy = this Stripe Payment Link + ?prefilled_email=<email>&client_reference_id=<user id>.
  // The id must match the link's metadata.package so the stripe-webhook function adds the right credits.
  packs: [
    { id: "short_5_150", name: "Starter", videos: 5, price: 150, monthly: false, note: "Use within 30 days",
      link: "https://buy.stripe.com/00w8wP9n47AEgpU7YC5EY0S" },
    { id: "monthly_growth_300", name: "Growth", videos: 15, price: 300, monthly: true,
      link: "https://buy.stripe.com/6oU3cv9n48EI6Pka6K5EY0T" },
    { id: "monthly_daily_500", name: "Daily", videos: 30, price: 500, monthly: true, best: true,
      link: "https://buy.stripe.com/6oU7sL56O2gk2z4en05EY0U" },
  ],
  perks: ["Delivered within 24 hours, usually faster", "Unlimited changes until you're happy", "Made from the videos you already have"],
};
