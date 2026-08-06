import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, User, Share2, ArrowRight, BookOpen } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  authorRole: string;
  imageUrl: string | null;
  readTimeMinutes: number;
  featured: boolean;
  publishedAt: string;
  updatedAt: string;
  related: RelatedPost[];
}

interface RelatedPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string | null;
  readTimeMinutes: number;
  publishedAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Crop Guide":     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Investment":    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Market Insight": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Technology":    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "Sustainability": "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "News":          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Crop Guide":     "from-green-800 to-green-600",
  "Investment":    "from-blue-800 to-blue-600",
  "Market Insight": "from-purple-800 to-purple-600",
  "Technology":    "from-orange-700 to-amber-600",
  "Sustainability": "from-teal-700 to-emerald-600",
  "News":          "from-red-700 to-rose-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function PostSkeleton() {
  return (
    <div className="animate-pulse space-y-4 max-w-3xl mx-auto px-4 py-8">
      <div className="h-6 w-24 bg-muted rounded-full" />
      <div className="h-10 bg-muted rounded-xl w-3/4" />
      <div className="h-5 bg-muted rounded-lg w-1/2" />
      <div className="h-64 bg-muted rounded-2xl" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-muted rounded" />)}
      </div>
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["/api/blog", slug],
    queryFn: async () => {
      const r = await fetch(`/api/blog/${slug}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!slug,
  });

  useSeo(
    post
      ? {
          title: post.title,
          description: post.excerpt,
          canonicalPath: `/blog/${post.slug}`,
          ogImage: post.imageUrl ?? undefined,
          ogType: "article",
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          author: post.authorName,
          structuredData: {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.excerpt,
            "author": {
              "@type": "Person",
              "name": post.authorName,
              "jobTitle": post.authorRole,
            },
            "publisher": {
              "@type": "Organization",
              "name": "Investa Farm",
              "url": "https://investafarm.com",
              "logo": { "@type": "ImageObject", "url": "https://investafarm.com/logo.png" },
            },
            "datePublished": post.publishedAt,
            "dateModified": post.updatedAt,
            "image": post.imageUrl ?? "https://investafarm.com/opengraph.jpg",
            "url": `https://investafarm.com/blog/${post.slug}`,
            "mainEntityOfPage": `https://investafarm.com/blog/${post.slug}`,
            "articleSection": post.category,
          },
        }
      : {
          title: "Loading article…",
          description: "Agricultural investment and farming news from Investa Farm.",
        }
  );

  const handleShare = async () => {
    if (!post) return;
    try {
      await navigator.share({
        title: post.title,
        text: post.excerpt,
        url: window.location.href,
      });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) return (
    <div className="min-h-dvh bg-background">
      <div className="bg-gradient-to-b from-[#052e16] to-[#14532d] px-4 pt-8 pb-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setLocation("/blog")}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" />
        </div>
      </div>
      <PostSkeleton />
    </div>
  );

  if (isError || !post) return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground px-4">
      <BookOpen size={40} className="opacity-30" />
      <p className="font-medium">Article not found</p>
      <button
        onClick={() => setLocation("/blog")}
        className="text-sm text-green-700 font-semibold hover:underline"
      >
        Back to blog
      </button>
    </div>
  );

  const gradient = CATEGORY_GRADIENTS[post.category] ?? "from-gray-800 to-gray-600";
  const catColor = CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="min-h-dvh bg-background">
      {/* Top bar */}
      <div className="bg-gradient-to-b from-[#052e16] to-[#14532d] px-4 pt-8 pb-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/blog")}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <img src={logoSrc} alt="Investa Farm" className="h-7 w-auto" />
            </div>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              title="Share article"
            >
              <Share2 size={16} />
            </button>
          </div>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="pb-8"
          >
            <span className={`inline-flex text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wide mb-4 ${catColor}`}>
              {post.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white leading-tight mb-3">
              {post.title}
            </h1>
            <p className="text-green-200/80 text-base leading-relaxed mb-5">
              {post.excerpt}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-green-200/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  {post.authorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm leading-none">{post.authorName}</p>
                  <p className="text-green-300/70 text-xs mt-0.5">{post.authorRole}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} />
                <span>{formatDate(post.publishedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={13} />
                <span>{post.readTimeMinutes} min read</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Hero image */}
      {post.imageUrl ? (
        <div className="w-full h-56 md:h-72 overflow-hidden">
          <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`w-full h-24 bg-gradient-to-r ${gradient}`} />
      )}

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        <div
          className="prose prose-zinc dark:prose-invert prose-p:leading-relaxed prose-p:text-base prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2 prose-li:my-1 prose-a:text-green-700 dark:prose-a:text-green-400 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Share CTA */}
        <div className="mt-10 p-5 rounded-2xl bg-muted/50 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground text-sm">Found this useful?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Share it with fellow farmers and investors.</p>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
          >
            <Share2 size={14} /> Share Article
          </button>
        </div>

        {/* Author card */}
        <div className="mt-8 p-5 rounded-2xl border border-border bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {post.authorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-bold text-foreground">{post.authorName}</p>
              <p className="text-xs text-muted-foreground">{post.authorRole} · Investa Farm</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Part of the Investa Farm editorial team — bringing you expert analysis on Kenyan agriculture, crop markets, and agricultural investment.
          </p>
        </div>
      </article>

      {/* Related posts */}
      {post.related.length > 0 && (
        <section className="bg-muted/30 border-t border-border mt-4 py-10">
          <div className="max-w-3xl mx-auto px-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Related Articles</p>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {post.related.map((r) => (
                <button
                  key={r.slug}
                  onClick={() => setLocation(`/blog/${r.slug}`)}
                  className="text-left rounded-xl border border-border bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className={`h-28 bg-gradient-to-br ${CATEGORY_GRADIENTS[r.category] ?? "from-gray-800 to-gray-600"} overflow-hidden`}>
                    {r.imageUrl && (
                      <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">{r.category}</p>
                    <p className="text-sm font-bold text-foreground leading-snug line-clamp-2 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                      {r.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Clock size={10} /> {r.readTimeMinutes} min
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="bg-gradient-to-br from-[#052e16] to-[#16a34a] py-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-green-300 text-sm font-semibold mb-2">Investa Farm</p>
          <h3 className="text-2xl font-extrabold text-white mb-3">Put this knowledge to work</h3>
          <p className="text-green-200/80 text-sm mb-6 max-w-sm mx-auto">
            Invest in verified Kenyan farms and earn returns from real harvests. Start with KES 5,000.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setLocation("/investor-auth")}
              className="flex items-center justify-center gap-2 bg-white text-green-800 font-bold px-6 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm"
            >
              Start Investing <ArrowRight size={15} />
            </button>
            <button
              onClick={() => setLocation("/blog")}
              className="flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              More Articles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
