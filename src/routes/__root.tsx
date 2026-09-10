import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel-spacious max-w-md text-center animate-fade-in-up">
        <p className="text-label text-primary">404</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">Pagina non trovata</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questo percorso non esiste nel tuo agente.
        </p>
        <Link
          to="/"
          className="btn-primary mt-6 inline-flex items-center justify-center px-5 py-2.5 text-sm"
        >
          Torna a JARVIS
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="panel-spacious max-w-md text-center animate-fade-in-up">
        <h1 className="font-display text-xl text-foreground">Qualcosa non ha funzionato</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puoi riprovare o tornare alla home dell&apos;agente.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-primary px-4 py-2 text-sm"
          >
            Riprova
          </button>
          <a
            href="/"
            className="btn-matrix inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground hover:border-primary/40"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "JARVIS — Il tuo agente personale" },
      {
        name: "description",
        content:
          "JARVIS: agente IA personale con carattere, memoria, mani (One MCP) e regole. Ops server, codice e automazioni.",
      },
      { property: "og:title", content: "JARVIS — Il tuo agente personale" },
      {
        property: "og:description",
        content: "Il tuo Claude personale — chat, codice, host e connettori.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0c1018" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
