import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Vote = { vote: number; user_id: string };
type Caption = {
  id: string;
  caption_text: string;
  prompt: string;
  created_at: string;
  user_id: string;
  votes: Vote[] | null;
};
type Meme = {
  id: string;
  image_url: string;
  title: string;
  description: string;
  captions: Caption[] | null;
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("meme_images")
    .select(
      "id, image_url, title, description, captions(id, caption_text, prompt, created_at, user_id, votes(vote, user_id))"
    )
    .order("created_at", { ascending: true });

  const memes = (data ?? []) as Meme[];

  async function generateCaption(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const memeId = String(formData.get("meme_id") ?? "");
    const style = String(formData.get("style") ?? "").trim().slice(0, 180);

    const { data: meme } = await supabase
      .from("meme_images")
      .select("id, title, description")
      .eq("id", memeId)
      .single();

    if (!meme) throw new Error("Meme not found.");

    const prompt =
      `Write exactly one short, funny meme caption for a chronically-online Columbia student in NYC. ` +
      `Image title: "${meme.title}". Image description: "${meme.description}". ` +
      `User direction: "${style || "Make it dry, relatable, internet-native, and under 18 words."}" ` +
      `Return only the caption. No quotation marks, hashtags, explanations, or emojis.`;

    const token = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    if (!token) throw new Error("AI Gateway is not configured.");

    const aiResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 80,
      }),
      cache: "no-store",
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      console.error("AI Gateway error", aiResponse.status, detail);
      throw new Error("Caption generation failed. Please try again.");
    }

    const result = await aiResponse.json();
    const caption = String(result.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["“]|["”]$/g, "")
      .slice(0, 220);

    if (!caption) throw new Error("The AI returned an empty caption.");

    const { error } = await supabase.from("captions").insert({
      meme_image_id: meme.id,
      user_id: user.id,
      prompt,
      caption_text: caption,
    });

    if (error) throw new Error(error.message);
    revalidatePath("/");
  }

  async function vote(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const captionId = String(formData.get("caption_id") ?? "");
    const value = Number(formData.get("vote"));
    if (!captionId || ![1, -1].includes(value)) return;

    const { error } = await supabase.from("votes").upsert(
      {
        caption_id: captionId,
        user_id: user.id,
        vote: value,
      },
      { onConflict: "caption_id,user_id" }
    );

    if (error) throw new Error(error.message);
    revalidatePath("/");
  }

  return (
    <main className="shell">
      <header className="hero">
        <nav className="nav">
          <a className="brand" href="/">CATCAPTION</a>
          <div className="navLinks">
            {user ? (
              <>
                <span className="signedIn">Signed in</span>
                <a href="/profile">Profile</a>
              </>
            ) : (
              <a className="loginLink" href="/login">Sign in with Google</a>
            )}
          </div>
        </nav>

        <div className="heroCopy">
          <span className="eyebrow">AI MEME CAPTION LAB</span>
          <h1>Give the cat<br />a better line.</h1>
          <p>
            Pick a blank cat meme, ask AI for a caption, then vote on the ones
            that deserve to survive the group chat.
          </p>
        </div>
      </header>

      <section className="howItWorks">
        <span>01 Pick a cat</span>
        <span>02 Generate a caption</span>
        <span>03 Vote the winner</span>
      </section>

      <section className="feed">
        {memes.map((meme) => {
          const ranked = [...(meme.captions ?? [])].sort((a, b) => {
            const scoreA = (a.votes ?? []).reduce((sum, item) => sum + item.vote, 0);
            const scoreB = (b.votes ?? []).reduce((sum, item) => sum + item.vote, 0);
            return scoreB - scoreA;
          });

          return (
            <article className="memeCard" key={meme.id}>
              <div className="imagePanel">
                <img src={meme.image_url} alt={meme.description} />
                <div className="imageLabel">{meme.title}</div>
              </div>

              <div className="captionPanel">
                <div className="sectionTitle">
                  <div>
                    <span className="eyebrow">CAPTION BATTLE</span>
                    <h2>{meme.title}</h2>
                  </div>
                  <span className="count">{ranked.length} captions</span>
                </div>

                {user ? (
                  <form className="generator" action={generateCaption}>
                    <input type="hidden" name="meme_id" value={meme.id} />
                    <label htmlFor={`style-${meme.id}`}>Give the AI a direction</label>
                    <div className="generatorRow">
                      <input
                        id={`style-${meme.id}`}
                        name="style"
                        placeholder="midterms, dating apps, dorm life, NYC weekends..."
                        maxLength={180}
                      />
                      <button type="submit">Generate</button>
                    </div>
                    <small>The exact prompt used to generate each caption is saved in the database.</small>
                  </form>
                ) : (
                  <a className="lockedCta" href="/login">
                    Sign in to generate captions and vote →
                  </a>
                )}

                <div className="captionList">
                  {ranked.length === 0 ? (
                    <div className="emptyState">
                      No captions yet. Sign in and be the first to caption this one.
                    </div>
                  ) : (
                    ranked.map((caption, index) => {
                      const votes = caption.votes ?? [];
                      const score = votes.reduce((sum, item) => sum + item.vote, 0);
                      const myVote = user
                        ? votes.find((item) => item.user_id === user.id)?.vote
                        : undefined;

                      return (
                        <div className="captionItem" key={caption.id}>
                          <div className="rank">#{index + 1}</div>
                          <div className="captionBody">
                            <p>{caption.caption_text}</p>
                            <span>caption · score {score >= 0 ? "+" : ""}{score}</span>
                          </div>
                          <div className="voteBox">
                            <form action={vote}>
                              <input type="hidden" name="caption_id" value={caption.id} />
                              <input type="hidden" name="vote" value="1" />
                              <button
                                className={myVote === 1 ? "voteButton active" : "voteButton"}
                                type="submit"
                                disabled={!user}
                                aria-label="Upvote"
                              >
                                ↑
                              </button>
                            </form>
                            <strong>{score}</strong>
                            <form action={vote}>
                              <input type="hidden" name="caption_id" value={caption.id} />
                              <input type="hidden" name="vote" value="-1" />
                              <button
                                className={myVote === -1 ? "voteButton active" : "voteButton"}
                                type="submit"
                                disabled={!user}
                                aria-label="Downvote"
                              >
                                ↓
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer>
        CATCAPTION · AI captions + community voting · built with Supabase and Gemini
      </footer>
    </main>
  );
}
