-- ===========================================================================
-- ARKSOME — development seed data
-- Safe to run repeatedly (uses ON CONFLICT DO NOTHING / DO UPDATE).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Reward configuration (drives the whole reward engine)
-- ---------------------------------------------------------------------------
insert into public.reward_configs (key, label, amount, daily_limit, per_user_limit, enabled, description)
values
  ('daily_checkin',   'Daily check-in',        10, 1,   null,  true,  'Claim once per calendar day.'),
  ('streak_bonus',    'Streak bonus',          25, 1,   null,  true,  'Awarded every 7-day streak milestone.'),
  ('quiz_correct',    'Correct quiz answer',    5, 40,  null,  true,  'Paid per correct answer, subject to the daily cap.'),
  ('quiz_completed',  'Quiz completed',        15, 3,   null,  true,  'Bonus for finishing a quiz.'),
  ('content_read',    'Content discovery',      2, 5,   null,  true,  'Earn for exploring new published content.'),
  ('referral_signup', 'Referral signup',       50, 20,  100,  true,  'Credited when a referred member joins.'),
  ('rewarded_ad',     'Rewarded ad',           20, 5,   null,  false, 'Disabled until the rewarded ad integration is policy-approved.'),
  ('admin_adjustment','Admin adjustment',       0, null, null, false,  'Manual adjustments made by administrators.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Activities
-- ---------------------------------------------------------------------------
insert into public.activities (key, title, description, activity_type, reward_amount, enabled, config, position)
values
  ('daily_checkin', 'Daily check-in', 'Come back every day to keep your streak alive.', 'checkin', 10, true, '{"streak_bonus_every": 7}'::jsonb, 1),
  ('quick_quiz',    'Knowledge challenge', 'Answer five questions and earn AC for every correct answer.', 'quiz', 0, true, '{"quiz_slug": "arksome-basics"}', 2),
  ('explore',       'Discovery task', 'Open a few new posts from your feed today.', 'discovery', 10, true, '{"required": 3}'::jsonb, 3),
  ('streaks',       'Streak milestones', 'Hit 7, 14 and 30 day streaks for bonus coins.', 'streak', 25, true, '{"milestones": [7, 14, 30]}'::jsonb, 4)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------------
insert into public.quizzes (slug, title, description, reward_amount, max_attempts_per_day, is_active, questions, answers)
values (
  'arksome-basics',
  'ARKSOME Basics',
  'A short quiz about how ARKSOME and ARKSOME Coins work.',
  15,
  2,
  true,
  '[
    {"id": "q1", "question": "What is the official ARKSOME currency called?", "options": ["ARKSOME Coins (AC)", "Ark tokens", "Points cash", "ARK USD"]},
    {"id": "q2", "question": "Can ARKSOME Coins be withdrawn as cash?", "options": ["Yes, instantly", "Yes, after verification", "No, they are internal points only", "Only for admins"]},
    {"id": "q3", "question": "What happens to your coin balance if you refresh the feed?", "options": ["It increases", "It decreases", "Nothing — refreshes never earn coins", "It resets weekly"]},
    {"id": "q4", "question": "How should sponsored content be shown?", "options": ["Hidden among posts", "Clearly labelled", "Only to new users", "With a pop-up"]},
    {"id": "q5", "question": "Where are coin balance changes validated?", "options": ["In the browser", "On the server", "By advertisers", "By moderators"]}
  ]'::jsonb,
  '[1, 2, 2, 1, 1]'::jsonb
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Ad placements & campaigns (all disabled until provider approval)
-- ---------------------------------------------------------------------------
insert into public.ad_placements (key, name, location, format, enabled)
values
  ('feed_top',      'Feed leaderboard',  'feed-top',      'leaderboard', false),
  ('feed_inline',   'Feed inline',       'feed-inline',   'in-feed',     false),
  ('sidebar',       'Sidebar rectangle', 'sidebar',       'rectangle',   false),
  ('rewarded_web',  'Rewarded web ad',   'rewarded',      'rewarded',    false)
on conflict (key) do nothing;

insert into public.campaigns (name, sponsor, status, starts_at, ends_at)
values ('Launch partner campaign', 'Example Sponsor Ltd', 'draft', null, null)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------
insert into public.content (slug, type, status, title, excerpt, body, cover_url, video_url, duration_seconds, is_sponsored, sponsor_name, tags, published_at, view_count)
values
(
  'why-discovery-feeds-feel-endless',
  'article', 'published',
  'Why discovery feeds never feel finished',
  'Infinite scroll is a design choice with real consequences for attention and wellbeing.',
  'Every feed you use is engineered to keep you scrolling. The trick is not addiction in the cartoon sense — it is variable reward. Each refresh is a small lottery: sometimes something wonderful, usually nothing much.

The healthy response is not to delete every app. It is to notice the design. When you can name the mechanism, it loses some of its power.

Practical ideas: set a stopping point before you start, keep the sound off, and give yourself one deliberate destination per session instead of open-ended browsing.',
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&q=80',
  null, null, false, null, '{attention,design,wellbeing}', now() - interval '2 hours', 1842
),
(
  'short-video-attention-economy',
  'video', 'published',
  'Short video and the attention economy',
  'A two minute explanation of why short-form video feels so compulsive.',
  null,
  'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=1200&q=80',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  15, false, null, '{video,attention}', now() - interval '6 hours', 3120
),
(
  'five-facts-about-ocean-currents',
  'article', 'published',
  'Five facts about ocean currents you were never taught',
  'The ocean moves more heat around the planet than the atmosphere does.',
  '1. The Gulf Stream transports roughly the equivalent of 100 times the world''s total energy consumption.
2. Deep water formation in the North Atlantic drives a global conveyor belt that takes about a thousand years to complete.
3. Ocean currents slow down by about 15 percent during the strongest El Niño events.
4. The Kuroshio current off Japan carries warmer water north than any other current in the Pacific.
5. Marine life depends on currents to spread larvae — collapse a current and a fishery follows.',
  'https://images.unsplash.com/photo-1498623116890-37e912163d5d?w=1200&q=80',
  null, null, false, null, '{science,ocean}', now() - interval '1 day', 5210
),
(
  'city-gardens-that-feed-neighbours',
  'article', 'published',
  'The city gardens that feed their neighbours',
  'Rooftop and verge gardens are quietly rewriting urban food supply.',
  'In Nairobi, Mombasa and Lagos, small plots between apartment blocks produce more vegetables per square metre than most commercial farms. The reason is simple: everything is harvested the same day it is picked.

The economics work because transport and cold storage costs disappear. What does not work is scale — these gardens are networks, not factories. Support them with water access, seed libraries and a place to sell, and they grow.',
  'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80',
  null, null, false, null, '{food,community,urban}', now() - interval '2 days', 907
),
(
  'how-your-phone-charges-faster-than-you-think',
  'article', 'published',
  'How your phone charges faster than you think',
  'Battery chemistry, heat, and the myth of the perfect charger.',
  'Fast charging is not one technology but a negotiation between the charger, the cable, the phone and temperature. The battery itself sets the rules: lithium cells accept current quickly up to about 80 percent, then slow down to protect themselves.

Heat is the real enemy. A phone that charges slowly in summer is usually doing exactly the right thing — protecting a cell that would otherwise degrade in months rather than years.',
  'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=1200&q=80',
  null, null, false, null, '{tech,battery}', now() - interval '3 days', 2441
),
(
  'partner-offer-learn-data-basics',
  'article', 'published',
  'Sponsored: free data basics workshop this weekend',
  'A partner-run session covering spreadsheets, charts and honest dashboards.',
  'This session is brought to you by our launch partner. It covers the fundamentals of reading data honestly: what a chart is hiding, when an average is misleading, and how to build a dashboard nobody misreads.

Seats are limited. The workshop is free to attend and no purchase is required.',
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
  null, null, true, 'Example Sponsor Ltd', '{sponsored,education}', now() - interval '4 days', 640
),
(
  'sleep-architecture-explained',
  'video', 'published',
  'Sleep architecture in ninety seconds',
  'What actually happens across a night of sleep.',
  null,
  'https://images.unsplash.com/photo-1520206183501-b80df6134f40?w=1200&q=80',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  15, false, null, '{video,health}', now() - interval '5 days', 4188
),
(
  'the-case-for-boring-technology',
  'article', 'published',
  'The case for boring technology',
  'Why the most reliable systems are rarely the exciting ones.',
  'New tools are interesting. Boring tools are dependable. The teams that ship steadily tend to pick proven components and save their ambition for the product itself.

Boring does not mean bad. It means the surprises are already known — and surprises, in production, are expensive.',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80',
  null, null, false, null, '{tech,engineering}', now() - interval '6 days', 3302
),
(
  'community-spotlight-local-repair-cafe',
  'community', 'published',
  'Community spotlight: the Saturday repair café',
  'Volunteers fix what the shop says cannot be fixed.',
  'Every Saturday, a room behind the library fills with toasters, kettles and lamps waiting for a second life. Last month the volunteers repaired 84 items and estimate they kept around 300 kg of waste out of landfill.

If you have something broken, bring it. If you know how to fix things, bring that instead.',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1200&q=80',
  null, null, false, null, '{community,repair}', now() - interval '7 days', 1120
),
(
  'maps-that-lie-a-short-history',
  'article', 'published',
  'Maps that lie: a short history of cartographic spin',
  'Every map is an argument about what matters.',
  'Mercator makes Greenland look like Africa. National boundaries are drawn by whoever won the last war. Projection is politics with a ruler.

The fix is not a better map — it is looking at several and asking what each one is for.',
  'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80',
  null, null, false, null, '{history,maps}', now() - interval '8 days', 2876
)
on conflict (slug) do nothing;
