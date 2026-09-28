import { createClient } from "@supabase/supabase-js";

export default async function Home() {
  const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: movies, error } = await supabase
      .from("movies")
      .select("*")
      .order("id");

  if (error) {
    return (
        <main className="p-8">
          <h1 className="text-2xl font-bold">Error</h1>
          <p>{error.message}</p>
        </main>
    );
  }

  return (
      <main className="p-8">
        <h1 className="text-3xl font-bold mb-6">My Favorite Movies</h1>

        <ul className="space-y-4">
          {movies?.map((movie) => (
              <li key={movie.id} className="border rounded-lg p-4">
                <h2 className="text-xl font-semibold">{movie.title}</h2>
                <p>{movie.year}</p>
              </li>
          ))}
        </ul>
      </main>
  );
}
