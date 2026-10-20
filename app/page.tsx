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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; error?: string; generated?: string }>;
}) {
  const { sort, error: generationError, generated } = await searchParams;
  const mode = sort === "new" ? "new" : "top";

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

  const allCaptions = memes.flatMap((meme) =>
    (meme.captions ?? []).map((caption) => ({
      ...caption,
      memeTitle: meme.title,
      score: (caption.votes ?? []).reduce((sum, item) => sum + item.vote, 0),
    }))
  );

  const totalVotes = allCaptions.reduce(
    (sum, caption) => sum + (caption.votes ?? []).length,
    0
  );
  const topCaption = [...allCaptions].sort((a, b) => b.score - a.score)[0];

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

    const { data: previousRows } = await supabase
      .from("captions")
      .select("caption_text")
      .eq("meme_image_id", meme.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const previousCaptions = (previousRows ?? [])
      .map((row) => row.caption_text)
      .filter(Boolean);

    const prompt =
      `Write exactly one NEW short, funny meme caption for a chronically-online Columbia student in NYC. ` +
      `Image title: "${meme.title}". Image description: "${meme.description}". ` +
      `User direction: "${style || "Make it dry, relatable, internet-native, and under 18 words."}" ` +
      (previousCaptions.length
        ? `Do NOT repeat or closely paraphrase these existing captions: ${previousCaptions.join(" | ")}. `
        : "") +
      `Variation cue: ${Date.now()}. Return only the caption. No quotation marks, hashtags, explanations, or emojis.`;

    const token = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    if (!token) {
      console.error("Caption generation: no AI Gateway credential is available.");
      redirect("/?error=caption-generation");
    }

    const models = ["openai/gpt-5.6-sol", "anthropic/claude-sonnet-5"];
    let caption = "";

    for (const model of models) {
      try {
        const aiResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 80,
            stream: false,
          }),
          cache: "no-store",
        });

        if (!aiResponse.ok) {
          const detail = await aiResponse.text();
          console.error("AI Gateway model failed", model, aiResponse.status, detail);
          continue;
        }

        const result = await aiResponse.json();
        const candidate = String(result.choices?.[0]?.message?.content ?? "")
          .trim()
          .replace(/^["“]|["”]$/g, "")
          .slice(0, 220);

        if (candidate && !previousCaptions.some((existing) =>
          existing.trim().toLowerCase() === candidate.toLowerCase()
        )) {
          caption = candidate;
          break;
        }
      } catch (generationFailure) {
        console.error("AI Gateway request failed", model, generationFailure);
      }
    }

    if (!caption) {
      redirect("/?error=caption-generation");
    }

    const { error } = await supabase.from("captions").insert({
      meme_image_id: meme.id,
      user_id: user.id,
      prompt,
      caption_text: caption,
    });

    if (error) {
      console.error("Caption insert failed", error);
      redirect("/?error=caption-save");
    }

    redirect("/?generated=1");
  }

  async function vote  async function vote(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const captionId = String(formData.get("caption_id") ?? "");
    const value = Number(formData.get("vote"));
    if (!captionId || ![1, -1].includes(value)) return;

    const { data: current } = await supabase
      .from("votes")
      .select("id, vote")
      .eq("caption_id", captionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (current?.vote === value) {
      const { error } = await supabase.from("votes").delete().eq("id", current.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("votes").upsert(
        {
          caption_id: captionId,
          user_id: user.id,
          vote: value,
        },
        { onConflict: "caption_id,user_id" }
      );
      if (error) throw new Error(error.message);
    }

    revalidatePath("/");
  }

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
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
                <form action={signOut}>
                  <button className="textButton" type="submit">Sign out</button>
                </form>
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
            Pick a blank cat meme, generate a caption with AI, and vote on the
            lines worth sending to the group chat.
          </p>
        </div>

        <div className="statsBar">
          <div><strong>{memes.length}</strong><span>meme templates</span></div>
          <div><strong>{allCaptions.length}</strong><span>AI captions</span></div>
          <div><strong>{totalVotes}</strong><span>community votes</span></div>
          <div className="winnerStat">
            <span>Current winner</span>
            <strong>{topCaption ? `“${topCaption.caption_text}”` : "Be the first to vote"}</strong>
          </div>
        </div>
      </header>

      <section className="howItWorks">
        <span>01 Pick a cat</span>
        <span>02 Generate a caption</span>
        <span>03 Vote the winner</span>
      </section>

      {(generationError || generated) && (
        <div className={generationError ? "statusNotice error" : "statusNotice success"}>
          {generationError
            ? "Caption generation hit a temporary problem. Please try Generate caption again."
            : "New AI caption generated — scroll to the meme to see it."}
        </div>
      )}

      <section className="feedHeader">
        <div>
          <span className="eyebrow">COMMUNITY FEED</span>
          <h2>Caption battles</h2>
        </div>
        <div className="sortTabs" aria-label="Caption sort">
          <a className={mode === "top" ? "active" : ""} href="/?sort=top">Top rated</a>
          <a className={mode === "new" ? "active" : ""} href="/?sort=new">Newest</a>
        </div>
      </section>

      <section className="feed">
        {memes.map((meme) => {
          const ranked = [...(meme.captions ?? [])].sort((a, b) => {
            if (mode === "new") {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
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
                    <p className="memeDescription">{meme.description}</p>
                  </div>
                  <span className="count">{ranked.length} captions</span>
                </div>

                {user ? (
                  <form className="generator" action={generateCaption}>
                    <label htmlFor={`style-${meme.id}`}>Generate your version</label>
                    <p className="helperText">
                      Optional: give the AI a theme. Leave it blank for a surprise.
                    </p>
                    <input type="hidden" name="meme_id" value={meme.id} />
                    <div className="generatorRow">
                      <input
                        id={`style-${meme.id}`}
                        name="style"
                        placeholder="midterms, dating apps, dorm life, NYC weekends..."
                        maxLength={180}
                      />
                      <button type="submit">Generate caption</button>
                    </div>
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
                            <span>
                              AI generated · {score >= 0 ? "+" : ""}{score} points
                            </span>
                          </div>
                          <div className="voteBox" aria-label="Vote on caption">
                            <form action={vote}>
                              <input type="hidden" name="caption_id" value={caption.id} />
                              <input type="hidden" name="vote" value="1" />
                              <button
                                className={myVote === 1 ? "voteButton active" : "voteButton"}
                                type="submit"
                                disabled={!user}
                                aria-label="Upvote caption"
                                title={user ? "Upvote (click again to remove)" : "Sign in to vote"}
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
                                aria-label="Downvote caption"
                                title={user ? "Downvote (click again to remove)" : "Sign in to vote"}
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
        <div>
          <strong>CATCAPTION</strong>
          <span>AI captions + community voting</span>
        </div>
        <span>Built with Supabase, Gemini &amp; Vercel</span>
      </footer>
    </main>
  );
}
