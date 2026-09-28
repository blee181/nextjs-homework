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
        <main style={{ padding: "40px" }}>
            <h1>Login</h1>

            <button onClick={signInWithGoogle}>
                Sign in with Google
            </button>
        </main>
    );
}
