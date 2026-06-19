import coffeeImg   from "@assets/IMG_8010_1781245320473.jpeg";
import farmerImg   from "@assets/IMG_8011_1781250413855.jpeg";
import aerialImg   from "@assets/IMG_8016_1781250402404.jpeg";
import teaImg      from "@assets/IMG_8017_1781250392113.jpeg";

import avocadoImg  from "@assets/IMG_8004_1781255323883.jpeg";
import wheatImg    from "@assets/IMG_8005_1781255323884.jpeg";

// Corn/maize field — proper crop photo
import cornFieldImg from "@assets/pexels-corn-field-547034_maize.jpg";

// Crop-specific photos from Pexels
import beansImg       from "@assets/pexels-ana-vieira-1110685065-33068285_1781331189485.jpg";
import cabbageImg     from "@assets/pexels-quang-nguyen-vinh-222549-14776851_1781331189486.jpg";
import greenhouseImg  from "@assets/pexels-karola-g-4750271_1781331189487.jpg";
import kaleImg        from "@assets/pexels-markus-winkler-1430818-2862150_1781331189488.jpg";
import riceImg        from "@assets/pexels-elizabeth-tamara-27565957-19239403_1781331189489.jpg";
import sunflowerImg   from "@assets/pexels-lisa-yakurim-40702902-13076945_1781331189490.jpg";
import poultryImg     from "@assets/pexels-gamerxtc-17064389_1781331189491.jpg";
import dairyImg       from "@assets/pexels-carina-chowanek-297993717-13340333_1781331189492.jpg";
import tomatoesImg    from "@assets/pexels-mnannapaneni-6187904_1781331189493.jpg";

export const CROP_IMAGES: Record<string, string> = {
  maize:        cornFieldImg,
  corn:         cornFieldImg,
  sorghum:      cornFieldImg,
  wheat:        wheatImg,
  barley:       wheatImg,
  grain:        wheatImg,
  avocado:      avocadoImg,
  cattle:       dairyImg,
  dairy:        dairyImg,
  livestock:    dairyImg,
  beef:         dairyImg,
  cows:         dairyImg,
  tea:          teaImg,
  coffee:       coffeeImg,
  tomatoes:     tomatoesImg,
  tomato:       tomatoesImg,
  potatoes:     aerialImg,
  beans:        beansImg,
  legumes:      beansImg,
  onions:       aerialImg,
  capsicum:     cabbageImg,
  strawberries: avocadoImg,
  kale:         kaleImg,
  sukumawiki:   kaleImg,
  greens:       kaleImg,
  spinach:      kaleImg,
  rice:         riceImg,
  macadamia:    avocadoImg,
  sugarcane:    cornFieldImg,
  cassava:      aerialImg,
  cabbage:      cabbageImg,
  vegetables:   cabbageImg,
  horticulture: greenhouseImg,
  greenhouse:   greenhouseImg,
  herbs:        greenhouseImg,
  poultry:      poultryImg,
  chicken:      poultryImg,
  layers:       poultryImg,
  broilers:     poultryImg,
  sunflower:    sunflowerImg,
  farm:         aerialImg,
};

export function getCropImage(cropType: string, imageUrl?: string | null): string {
  if (imageUrl && /^(https?:\/\/|blob:|data:)/.test(imageUrl)) return imageUrl;
  const key = (cropType ?? "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(CROP_IMAGES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return aerialImg;
}

export const FARMER_HERO_IMAGE = farmerImg;
