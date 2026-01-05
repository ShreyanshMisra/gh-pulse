import type { Metadata } from 'next';
import './globals.css';
import { Activity, BarChart3, Search, Github, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'gh-pulse | GitHub Activity Stream',
  description: 'Real-time analytics for GitHub events and trending repositories',
};

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Languages', href: '/languages', icon: BarChart3 },
  { name: 'Search', href: '/search', icon: Search },
];

function NavLink({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center gap-3 border-b border-border px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold text-foreground">gh-pulse</span>
                <span className="text-[10px] font-medium text-muted-foreground">GitHub Activity Stream</span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
              <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Overview
              </div>
              {navigation.map((item) => (
                <NavLink key={item.name} href={item.href} icon={item.icon}>
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {/* Status footer */}
            <div className="border-t border-border p-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="status-dot live" />
                  <span className="text-xs font-medium text-foreground">Live Stream</span>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Connected to GitHub Events API
                </p>
              </div>

              {/* GitHub link */}
              <a
                href="https://github.com/ShreyanshMisra/gh-pulse"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                <span>View on GitHub</span>
              </a>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 pl-64">
            {/* Top bar */}
            <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/80 px-8 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Real-Time Activity</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Live indicator */}
                <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1">
                  <span className="status-dot live" />
                  <span className="text-xs font-semibold text-success-foreground">LIVE</span>
                </div>

                {/* Time display */}
                <div className="font-mono text-xs text-muted-foreground">
                  <time suppressHydrationWarning>
                    {new Date().toLocaleTimeString('en-US', { hour12: false })}
                  </time>
                </div>
              </div>
            </header>

            {/* Page content */}
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
