import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Welcome to Next.js
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Get started by editing <code className="rounded bg-muted px-2 py-1 font-mono text-sm">app/page.tsx</code>
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild>
            <a href="https://nextjs.org/docs" target="_blank" rel="noopener noreferrer">
              Read the Docs
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://nextjs.org/learn" target="_blank" rel="noopener noreferrer">
              Learn Next.js
            </a>
          </Button>
        </div>
      </div>
    </main>
  )
}
