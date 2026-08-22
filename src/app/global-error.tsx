"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Erro global", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ maxWidth: 640, margin: "12vh auto", padding: "0 24px", fontFamily: "Arial, sans-serif" }}>
          <p>Não foi possível carregar a plataforma.</p>
          <button type="button" onClick={reset}>Tentar novamente</button>
        </main>
      </body>
    </html>
  );
}
