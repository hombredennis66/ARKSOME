import type { Content } from "@/lib/database.types";

/**
 * Demo feed used when Supabase is not configured yet, so the UI can be
 * reviewed before credentials exist. Clearly marked as demo data.
 */
export const DEMO_CONTENT: Array<
  Pick<
    Content,
    | "id"
    | "slug"
    | "type"
    | "title"
    | "excerpt"
    | "body"
    | "cover_url"
    | "video_url"
    | "duration_seconds"
    | "is_sponsored"
    | "sponsor_name"
    | "tags"
    | "published_at"
    | "view_count"
  >
> = [
  {
    id: "demo-1",
    slug: "why-discovery-feeds-feel-endless",
    type: "article",
    title: "Why discovery feeds never feel finished",
    excerpt: "Infinite scroll is a design choice with real consequences for attention.",
    body: "Every feed you use is engineered to keep you scrolling. The trick is variable reward: each refresh is a small lottery.\n\nNotice the mechanism and it loses some of its power. Set a stopping point before you start, keep the sound off, and give yourself one deliberate destination per session.",
    cover_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["attention", "design"],
    published_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    view_count: 1842,
  },
  {
    id: "demo-2",
    slug: "short-video-attention-economy",
    type: "video",
    title: "Short video and the attention economy",
    excerpt: "A two minute explanation of why short-form video feels so compulsive.",
    body: null,
    cover_url: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200&q=80",
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    duration_seconds: 15,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["video", "attention"],
    published_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
    view_count: 3120,
  },
  {
    id: "demo-3",
    slug: "five-facts-about-ocean-currents",
    type: "article",
    title: "Five facts about ocean currents you were never taught",
    excerpt: "The ocean moves more heat around the planet than the atmosphere does.",
    body: "1. The Gulf Stream transports roughly 100 times the world's total energy consumption.\n2. Deep water formation drives a conveyor belt that takes about a thousand years to complete.\n3. Ocean currents slow by around 15 percent during the strongest El Niño events.",
    cover_url: "https://images.unsplash.com/photo-1498623116890-37e912163d5d?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["science", "ocean"],
    published_at: new Date(Date.now() - 26 * 3600_000).toISOString(),
    view_count: 5210,
  },
  {
    id: "demo-4",
    slug: "partner-offer-learn-data-basics",
    type: "article",
    title: "Sponsored: free data basics workshop this weekend",
    excerpt: "A partner-run session covering spreadsheets, charts and honest dashboards.",
    body: "This session is brought to you by our launch partner. Seats are limited and no purchase is required.",
    cover_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: true,
    sponsor_name: "Example Sponsor Ltd",
    tags: ["sponsored", "education"],
    published_at: new Date(Date.now() - 50 * 3600_000).toISOString(),
    view_count: 640,
  },
  {
    id: "demo-5",
    slug: "sleep-architecture-explained",
    type: "video",
    title: "Sleep architecture in ninety seconds",
    excerpt: "What actually happens across a night of sleep.",
    body: null,
    cover_url: "https://images.unsplash.com/photo-1520206183501-b80df6134f40?w=1200&q=80",
    video_url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    duration_seconds: 15,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["video", "health"],
    published_at: new Date(Date.now() - 74 * 3600_000).toISOString(),
    view_count: 4188,
  },
  {
    id: "demo-6",
    slug: "community-spotlight-local-repair-cafe",
    type: "community",
    title: "Community spotlight: the Saturday repair café",
    excerpt: "Volunteers fix what the shop says cannot be fixed.",
    body: "Every Saturday a room behind the library fills with toasters, kettles and lamps waiting for a second life. Last month the volunteers repaired 84 items.",
    cover_url: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["community", "repair"],
    published_at: new Date(Date.now() - 98 * 3600_000).toISOString(),
    view_count: 1120,
  },
  {
    id: "demo-7",
    slug: "the-case-for-boring-technology",
    type: "article",
    title: "The case for boring technology",
    excerpt: "Why the most reliable systems are rarely the exciting ones.",
    body: "New tools are interesting. Boring tools are dependable. Teams that ship steadily pick proven components and save their ambition for the product itself.",
    cover_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["tech", "engineering"],
    published_at: new Date(Date.now() - 130 * 3600_000).toISOString(),
    view_count: 3302,
  },
  {
    id: "demo-8",
    slug: "maps-that-lie-a-short-history",
    type: "article",
    title: "Maps that lie: a short history of cartographic spin",
    excerpt: "Every map is an argument about what matters.",
    body: "Mercator makes Greenland look like Africa. National boundaries are drawn by whoever won the last war. Projection is politics with a ruler.",
    cover_url: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80",
    video_url: null,
    duration_seconds: null,
    is_sponsored: false,
    sponsor_name: null,
    tags: ["history", "maps"],
    published_at: new Date(Date.now() - 160 * 3600_000).toISOString(),
    view_count: 2876,
  },
];
