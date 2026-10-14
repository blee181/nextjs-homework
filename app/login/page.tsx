"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://nextjs-homework-sigma.vercel.app/auth/callback",
      },
    });
  };

  return (
    <main className="loginPage">
      <section className="loginCard">
        <a className="brand" href="/">← CATCAPTION</a>
        <span className="eyebrow" style={{ marginTop: 32 }}>MEMBERS ONLY</span>
        <h1>Make a cat<br />say something better.</h1>
        <p>
          Sign in to generate AI captions, upvote the funniest ones, and change
          your vote whenever something better shows up.
        </p>
        <button className="googleButton" onClick={signInWithGoogle}>
          Continue with Google →
        </button>
      </section>
    </main>
  );
}
