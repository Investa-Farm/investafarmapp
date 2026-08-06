import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, ArrowRight, BookOpen, Search, TrendingUp } from "lucide-react";
import { useSeo } from "@/hooks/use-seo";
import logoSrc from "@assets/Investa_8_-removebg-preview_(1)_1778315943098.png";

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  authorName: string;
  authorRole: string;
  imageUrl: string | null;
  readTimeMinutes: number;
  featured: boolean;
  publishedAt: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Crop Guide":    { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", dot: "bg-green-500" },
  "Investment":   { bg: "bg-blue-100 dark:bg-blue-900/40",  text: "text-blue-700 dark:text-blue-300",  dot: "bg-blue-500" },
  "Market Insight": { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  "Technology":   { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  "Sustainability": { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  "News":         { bg: "bg-red-100 dark:bg-red-900/40",   text: "text-red-700 dark:text-red-300",   dot: "bg-red-500" },
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  "Crop Guide":    "from-green-800 to-green-600",
  "Investment":   "from-blue-800 to-blue-600",
  "Market Insight": "from-purple-800 to-purple-600",
  "Technology":   "from-orange-700 to-amber-600",
  "Sustainability": "from-teal-700 to-emerald-600",
  "News":         "from-red-700 to-rose-600",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function CategoryBadge({ category }: { category: string }) {
  const c = CATEGORY_COLORS[category] ?? { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {category}
    </span>
  );
}

function PostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const [, setLocation] = useLocation();
  const gradient = CATEGORY_GRADIENTS[post.category] ?? "from-gray-800 to-gray-600";

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      onClick={() => setLocation(`/blog/${post.slug}`)}
      className={`group cursor-pointer rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${featured ? "md:col-span-2" : ""}`}
    >
      {/* Image / gradient placeholder */}
      <div className={`relative ${featured ? "h-56 md:h-64" : "h-44"} overflow-hidden`}>
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-end p-5`}>
            <BookOpen size={32} className="text-white/30" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={post.category} />
        </div>
        {featured && (
          <div className="absolute top-3 right-3">
            <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide flex items-center gap-1">
              <TrendingUp size={10} /> Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h2 className={`font-bold text-foreground leading-snug mb-2 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors ${featured ? "text-xl" : "text-base"}`}>
          {post.title}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-600 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {post.authorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground leading-none">{post.authorName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(post.publishedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Clock size={11} />
            <span>{post.readTimeMinutes} min</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function BlogIndex() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useSeo({
    title: "Farm Intelligence Blog — News & Guides for Kenyan Agriculture",
    description: "Crop guides, investment insights, market trends, and agri-tech news for Kenyan farmers and agricultural investors. Stay ahead with Investa Farm's editorial team.",
    canonicalPath: "/blog",
    keywords: "Kenya farming news, agricultural investment Kenya, crop guide Kenya, maize farming, avocado export Kenya, agri-tech Africa",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "name": "Investa Farm Blog",
      "description": "Agricultural news, crop guides, investment insights, and market analysis for Kenya and East Africa.",
      "url": "https://investafarm.com/blog",
      "publisher": {
        "@type": "Organization",
        "name": "Investa Farm",
        "url": "https://investafarm.com",
        "logo": { "@type": "ImageObject", "url": "https://investafarm.com/logo.png" },
      },
    },
  });

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const r = await fetch("/api/blog");
      if (!r.ok) throw new Error("Failed to load posts");
      return r.json();
    },
  });

  const categories = ["All", ...Array.from(new Set(posts.map((p) => p.category)))];

  const filtered = posts.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.excerpt.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered.filter((p) => p.featured);
  const rest = filtered.filter((p) => !p.featured);

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#16a34a] text-white">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-12">
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setLocation("/")}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <img src={logoSrc} alt="Investa Farm" className="h-8 w-auto" />
          </div>

          <div className="mb-6">
            <p className="text-green-300 text-sm font-semibold uppercase tracking-widest mb-2">Farm Intelligence</p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-3">
              News & Insights for<br />
              <span className="text-green-300">Kenyan Agriculture</span>
            </h1>
            <p className="text-green-100/80 text-lg max-w-xl">
              Crop guides, investment analysis, market trends, and agri-tech coverage — written by agronomists and farm finance specialists.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-green-300" />
            <input
              type="text"
              placeholder="Search articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-green-300/70 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="bg-background border-b border-border sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all ${
                  activeCategory === cat
                    ? "bg-green-700 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts grid */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No articles found</p>
            <p className="text-sm mt-1">Try a different category or search term</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeCategory + search}>
              {/* Featured posts */}
              {featured.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Featured</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {featured.map((p, i) => (
                      <PostCard key={p.slug} post={p} featured={i === 0 && featured.length === 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Rest */}
              {rest.length > 0 && (
                <div>
                  {featured.length > 0 && <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 mt-8">More Articles</p>}
                  <div className="grid gap-4 md:grid-cols-2">
                    {rest.map((p) => (
                      <PostCard key={p.slug} post={p} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer CTA */}
      <div className="bg-muted/40 border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground mb-2">Ready to invest in Kenyan agriculture?</p>
          <h3 className="text-xl font-bold text-foreground mb-4">Start with as little as KES 5,000</h3>
          <button
            onClick={() => setLocation("/investor-auth")}
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Get Started <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
