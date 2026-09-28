import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PrivatePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    return (
        <main style={{ padding: "40px" }}>
            <h1>Private Page</h1>
            <p>You can only see this page when you are logged in.</p>
            <p>Logged in as: {user.email}</p>
        </main>
    );
}