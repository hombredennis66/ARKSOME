import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="brand-gradient grid size-14 place-items-center rounded-2xl text-xl font-bold text-white">
        A
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        That page does not exist, or the post has been unpublished. There is plenty more to discover
        in the feed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Compass className="size-4" /> Back to the feed
      </Link>
    </div>
  );
}
