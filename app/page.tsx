export default function Home() {
    return (
        <main style={{ padding: "32px" }}>
            <h1>My Favorite Movies</h1>

            <div style={{ marginBottom: "30px" }}>
                <a href="/login" style={{ marginRight: "20px" }}>
                    Login
                </a>

                <a href="/profile" style={{ marginRight: "20px" }}>
                    Profile
                </a>

                <a href="/private">
                    Private Page
                </a>
            </div>

            <div
                style={{
                    border: "1px solid black",
                    padding: "16px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                }}
            >
                <h2>Parasite</h2>
                <p>2019</p>
            </div>

            <div
                style={{
                    border: "1px solid black",
                    padding: "16px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                }}
            >
                <h2>Spirited Away</h2>
                <p>2001</p>
            </div>

            <div
                style={{
                    border: "1px solid black",
                    padding: "16px",
                    marginBottom: "16px",
                    borderRadius: "8px",
                }}
            >
                <h2>Paprika</h2>
                <p>2006</p>
            </div>
        </main>
    );
}