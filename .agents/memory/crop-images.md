---
name: Crop image fallback pattern
description: How to get good crop images across market pages when farm imageUrl is null
---

Farm listings from the API often have null/undefined `imageUrl`. Use a local helper to map crop type → Unsplash URL.

**Pattern:**
```ts
const CROP_IMAGES: Record<string, string> = {
  maize:    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80",
  tomatoes: "https://images.unsplash.com/photo-1546470427-1f7e0c82a8a5?w=200&q=80",
  avocado:  "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&q=80",
  tea:      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=80",
  coffee:   "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=200&q=80",
  wheat:    "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=200&q=80",
  farm:     "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=200&q=80",
};

function getCropImage(cropType: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const key = cropType?.toLowerCase().replace(/\s+/g, "") ?? "";
  for (const [k, v] of Object.entries(CROP_IMAGES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return CROP_IMAGES.farm;
}
```

**Why:** Without fallback images, farm cards render broken image icons which looks bad.

**How to apply:** Use `getCropImage(listing.cropType, listing.imageUrl)` anywhere farm images are displayed in market pages.
