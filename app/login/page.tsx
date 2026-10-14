"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="loginPage">
      <section className="loginCard">
        <a className="brand" href="/">← Memehattan</a>
        <span className="eyebrow" style={{ marginTop: 32 }}>MEMBERS ONLY</span>
        <h1>Make the<br />internet worse.</h1>
        <p>
          Sign in to generate AI captions and vote on everyone else&apos;s attempts.
          Browsing stays public.
        </p>
        <button className="googleButton" onClick={signInWithGoogle}>
          Continue with Google →
        </button>
      </section>
    </main>
  );
}
