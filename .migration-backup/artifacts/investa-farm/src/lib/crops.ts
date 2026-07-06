import coffeeImg   from "@assets/IMG_8010_1781245320473.jpeg";
import farmerImg   from "@assets/IMG_8011_1781250413855.jpeg";
import aerialImg   from "@assets/IMG_8016_1781250402404.jpeg";
import teaImg      from "@assets/pexels-fatima-yusuf-323522203-30541313_1781945539888.jpg";

import avocadoImg  from "@assets/IMG_8004_1781255323883.jpeg";
import wheatImg    from "@assets/IMG_8005_1781255323884.jpeg";

// Corn/maize field — proper crop photo
import cornFieldImg from "@assets/pexels-livier-garcia-645743-1459331_1781945539889.jpg";

// Crop-specific photos from Pexels
import beansImg       from "@assets/pexels-christian-hembert-1081250355-35553039_1781945539887.jpg";
import dryBeansImg    from "@assets/pexels-ana-vieira-1110685065-33068285_1781945269212.jpg";
import cabbageImg     from "@assets/pexels-quang-nguyen-vinh-222549-14776851_1781945269218.jpg";
import greenhouseImg  from "@assets/pexels-karola-g-4750271_1781945269221.jpg";
import kaleImg        from "@assets/pexels-markus-winkler-1430818-2862150_1781945269224.jpg";
import riceImg        from "@assets/pexels-elizabeth-tamara-27565957-19239403_1781945269226.jpg";
import sunflowerImg   from "@assets/pexels-lisa-yakurim-40702902-13076945_1781945269227.jpg";
import sunflowerCloseImg from "@assets/pexels-f-2154796291-34537615_1781945269227.jpg";
import chicksImg      from "@assets/pexels-gamerxtc-17064389_1781945269229.jpg";
import dairyImg       from "@assets/pexels-carina-chowanek-297993717-13340333_1781945269230.jpg";
import tomatoGreenImg from "@assets/pexels-mnannapaneni-6187904_1781945269231.jpg";
import tomatoesImg    from "@assets/pexels-the-design-lady-746806315-30964381_1781945539890.jpg";
import turkeyImg      from "@assets/pexels-nc-farm-bureau-mark-27083566_1781945539889.jpg";

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
  kidney:       beansImg,
  drybeans:     dryBeansImg,
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
  poultry:      chicksImg,
  chicken:      chicksImg,
  layers:       chicksImg,
  broilers:     chicksImg,
  turkey:       turkeyImg,
  turkeys:      turkeyImg,
  sunflower:    sunflowerImg,
  sunflowers:   sunflowerCloseImg,
  farm:         aerialImg,
  tomatogreen:  tomatoGreenImg,
};

export function getCropImage(cropType: string, _imageUrl?: string | null): string {
  const key = (cropType ?? "").toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(CROP_IMAGES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return aerialImg;
}

export const FARMER_HERO_IMAGE = aerialImg;
