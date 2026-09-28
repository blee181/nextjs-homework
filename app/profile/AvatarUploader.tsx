"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AvatarUploader({
                                           userId,
                                       }: {
    userId: string;
}) {
    const [uploading, setUploading] = useState(false);
    const supabase = createClient();

    async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) return;

        setUploading(true);

        const fileExt = file.name.split(".").pop();
        const filePath = `${userId}/avatar.${fileExt}`;

        const { error } = await supabase.storage
            .from("avatars")
            .upload(filePath, file, {
                upsert: true,
            });

        if (error) {
            alert(error.message);
            setUploading(false);
            return;
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(filePath);

        await supabase
            .from("profiles")
            .update({ avatar_url: publicUrl })
            .eq("id", userId);

        setUploading(false);
        window.location.reload();
    }

    return (
        <div style={{ marginTop: "20px" }}>
            <label>
                Upload profile photo
                <input
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    style={{ display: "block", marginTop: "8px" }}
                />
            </label>

            {uploading && <p>Uploading...</p>}
        </div>
    );
}