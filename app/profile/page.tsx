import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AvatarUploader from "./AvatarUploader";

export default async function ProfilePage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single();

    async function updateProfile(formData: FormData) {
        "use server";

        const supabase = await createClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            redirect("/login");
        }

        const firstName = formData.get("first_name") as string;
        const lastName = formData.get("last_name") as string;

        await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
            })
            .eq("id", user.id);

        revalidatePath("/profile");
    }

    const needsName = !profile?.first_name || !profile?.last_name;

    return (
        <main style={{ padding: "40px", maxWidth: "500px" }}>
            <h1>Profile</h1>

            <p>Email: {user.email}</p>

            {profile?.avatar_url && (
                <img
                    src={profile.avatar_url}
                    alt="Profile"
                    width={120}
                    height={120}
                    style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                        marginTop: "20px",
                        marginBottom: "20px",
                    }}
                />
            )}

            <AvatarUploader userId={user.id} />

            {needsName && (
                <p style={{ marginTop: "20px" }}>
                    Please add your first name and last name.
                </p>
            )}

            <form
                action={updateProfile}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px",
                    marginTop: "20px",
                }}
            >
                <label>
                    First name
                    <input
                        name="first_name"
                        defaultValue={profile?.first_name ?? ""}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "8px",
                            marginTop: "5px",
                        }}
                    />
                </label>

                <label>
                    Last name
                    <input
                        name="last_name"
                        defaultValue={profile?.last_name ?? ""}
                        style={{
                            display: "block",
                            width: "100%",
                            padding: "8px",
                            marginTop: "5px",
                        }}
                    />
                </label>

                <button
                    type="submit"
                    style={{
                        padding: "10px",
                        cursor: "pointer",
                    }}
                >
                    Save Profile
                </button>
            </form>
        </main>
    );
}

