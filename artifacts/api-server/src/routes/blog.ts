import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";

const router: IRouter = Router();

// ─── Seed data ───────────────────────────────────────────────────────────────
export const BLOG_SEED: Array<{
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  authorName: string;
  authorRole: string;
  imageUrl: string;
  readTimeMinutes: number;
  featured: boolean;
  publishedAt: Date;
}> = [
  {
    slug: "maize-farming-kenya-seasonal-guide",
    title: "Maize Farming in Kenya: A Complete Seasonal Guide to Maximum Yields",
    excerpt: "Kenya's staple crop, maize, offers farmers reliable returns when managed well. This guide covers planting schedules, soil preparation, pest control, and harvest timing across Kenya's major growing regions.",
    category: "Crop Guide",
    authorName: "Dr. James Mwangi",
    authorRole: "Senior Agronomist",
    imageUrl: "https://picsum.photos/seed/maize-kenya/800/450",
    readTimeMinutes: 7,
    featured: true,
    publishedAt: new Date("2026-07-20"),
    content: `<h2>Why Maize Remains Kenya's Most Important Crop</h2>
<p>Maize accounts for more than 65% of the total caloric intake of Kenyans and is grown on over 1.8 million hectares across the country. Whether you're a smallholder with two acres or a commercial farmer with fifty, understanding the seasonal calendar is the single biggest factor separating profitable harvests from losses.</p>

<h2>Kenya's Two Growing Seasons</h2>
<p>Kenya's agricultural calendar is governed by two rainy seasons:</p>
<ul>
  <li><strong>Long Rains (March–June):</strong> The primary growing season. Planting should begin in late February or early March in the lowlands, and March to April in the highlands. This season typically produces 70% of Kenya's total maize output.</li>
  <li><strong>Short Rains (October–December):</strong> The secondary season, primarily suited to lower-altitude areas in the Coast and Eastern provinces. Yields are generally 20–30% lower than the long rains season.</li>
</ul>

<h2>Soil Preparation and Variety Selection</h2>
<p>The most common mistake Kenyan maize farmers make is planting the wrong variety for their altitude. Kenya's top-performing hybrid varieties are altitude-specific:</p>
<ul>
  <li><strong>H614D / DUMA 43:</strong> Best for altitudes 0–1,500m (Coastal, Eastern lowlands). Matures in 90–110 days.</li>
  <li><strong>H513 / WH403:</strong> Mid-altitude (1,500–2,100m) — the Rift Valley sweet spot. Matures in 120–130 days.</li>
  <li><strong>DK8031 / Pioneer 30G19:</strong> High altitude (above 2,100m) — Central, Nyanza highlands. Matures in 140–160 days.</li>
</ul>
<p>Prepare your land 2–3 weeks before the rains begin. Deep plough to at least 20cm and apply 50kg of DAP (Di-Ammonium Phosphate) per acre at planting. Top-dress with CAN (Calcium Ammonium Nitrate) at knee height — typically 4–6 weeks after germination.</p>

<h2>Pest and Disease Management</h2>
<p>The Fall Armyworm (<em>Spodoptera frugiperda</em>), which arrived in Kenya in 2017, remains the most significant threat to maize yields. Early-morning scouting (before 9am when the worms are still feeding) is essential. Apply Coragen or Ampligo at first infestation signs — waiting until visible leaf damage has occurred typically means 20–40% yield loss is already locked in.</p>
<p>Maize Lethal Necrosis (MLN) is a viral disease spread by thrips and aphids. Plant certified MLN-tolerant seed (look for KALRO-certified varieties) and avoid planting downwind from infected fields.</p>

<h2>Harvest Timing and Storage</h2>
<p>Harvest when moisture content is below 13.5% for safe storage, or dry on-stalk until husk turns brown. Post-harvest losses in Kenya average 30% — primarily from aflatoxin contamination in improperly stored grain. Use hermetic bags (Purdue Improved Crop Storage bags) and inspect every 2 weeks. Aflatoxin-contaminated maize is unsellable and a health hazard — prevention is far cheaper than cure.</p>

<h2>Expected Returns in 2026</h2>
<p>With current NCPB buying prices at KES 3,600/90kg bag and input costs averaging KES 18,000–22,000 per acre, a well-managed acre yielding 15–20 bags should return KES 32,000–50,000 in gross revenue. After inputs and labour, net margins of KES 12,000–28,000 per acre are achievable in the long rains season.</p>`,
  },
  {
    slug: "agricultural-investing-beginners-guide",
    title: "How Agricultural Investing Works: A Complete Beginner's Guide",
    excerpt: "Agricultural investment is one of Africa's fastest-growing asset classes. Here's everything you need to know about buying farm shares, understanding returns, and managing risk — even if you've never invested before.",
    category: "Investment",
    authorName: "Grace Wanjiku",
    authorRole: "Investment Analyst",
    imageUrl: "https://picsum.photos/seed/agri-invest/800/450",
    readTimeMinutes: 8,
    featured: true,
    publishedAt: new Date("2026-07-25"),
    content: `<h2>What Is Agricultural Investment?</h2>
<p>Agricultural investment means putting money into farming activities — either by lending to farmers or by buying a stake in their crop. In Kenya, platforms like Investa Farm allow ordinary people to buy "farm shares" in verified farms, earn returns when crops are harvested, and trade those shares with other investors before the season ends.</p>
<p>It's a fundamentally different model from the stock market: instead of buying a share in a company, you're buying a proportional stake in a specific crop cycle. The returns are tied directly to real agricultural output, not market sentiment.</p>

<h2>The Two Types of Farm Investment</h2>
<h3>Primary Market: Fund a Farm from the Start</h3>
<p>In the primary market, you invest directly into a farm that needs capital to plant. You're essentially the bank — the farmer uses your money to buy seeds, fertiliser, and labour. When the crop is harvested and sold, you receive your principal back plus your agreed return (typically 18–28% annualised for a 6-month season).</p>

<h3>Secondary Market: Trade Farm Shares</h3>
<p>The secondary market lets investors buy and sell existing farm shares — similar to a stock exchange for farms. A farmer might be 3 months into a 6-month season, and you can buy their shares from an investor who needs liquidity, then hold until harvest for the remaining return.</p>

<h2>Understanding Returns</h2>
<p>Farm investment returns in Kenya are structured as either:</p>
<ul>
  <li><strong>Mid-Season Exit:</strong> Sell your shares 30–60 days into the season for a fixed +10% return. Lower risk, faster liquidity.</li>
  <li><strong>Full Season:</strong> Hold until harvest (typically 6 months) for up to 28% return. Higher reward, more exposure to agricultural risk.</li>
</ul>
<p>These returns are not guaranteed — they're projections based on historical performance and current market conditions. Agricultural risk includes weather events, pest damage, price fluctuations at harvest, and farmer default.</p>

<h2>How Risk is Managed</h2>
<p>Reputable agri-investment platforms use several layers of risk management:</p>
<ul>
  <li><strong>KYC verification:</strong> All farmers undergo identity verification, land ownership checks, and field visits before their farms are listed.</li>
  <li><strong>Crop insurance partnerships:</strong> Many platforms partner with insurance providers to cover total crop failures.</li>
  <li><strong>Farmer Protection Funds:</strong> A reserve pool (typically 3–5% of all active investments) that compensates investors in the event of partial failures.</li>
  <li><strong>Diversification:</strong> Spreading your investment across multiple farms, crops, and regions dramatically reduces the impact of any single failure.</li>
</ul>

<h2>Getting Started: Minimum Investment and KYC</h2>
<p>Most Kenyan agri-investment platforms require a minimum investment of KES 5,000 and full KYC verification (National ID + utility bill). KYC is required by the Capital Markets Authority and the Central Bank of Kenya for all investment platforms.</p>
<p>Once verified, you can fund farms directly from your M-Pesa or linked bank account. Returns are paid out to M-Pesa or your bank when the farmer exits the season.</p>

<h2>Agricultural Investment vs. Other Asset Classes</h2>
<p>Kenyan Treasury Bills (91-day) currently yield around 14–16% per annum. Money Market Funds offer 12–15%. Agricultural investment, at projected returns of 18–28% per 6-month cycle, offers a premium above these — but with correspondingly higher risk. The key is to treat it as part of a diversified portfolio, not your entire savings.</p>`,
  },
  {
    slug: "avocado-farming-kenya-export-opportunity",
    title: "Avocado Farming in Kenya: Africa's Most Profitable Export Crop",
    excerpt: "Kenya is now the world's 5th largest avocado exporter. Learn how Hass avocados have transformed smallholder farming in Murang'a, Nyeri, and Meru — and why this crop offers some of the best long-term returns in Kenyan agriculture.",
    category: "Crop Guide",
    authorName: "Peter Kariuki",
    authorRole: "Export Agriculture Specialist",
    imageUrl: "https://picsum.photos/seed/avocado-kenya/800/450",
    readTimeMinutes: 6,
    featured: false,
    publishedAt: new Date("2026-07-15"),
    content: `<h2>Kenya's Avocado Boom</h2>
<p>In 2023, Kenya exported over 92,000 metric tonnes of avocados, generating KES 12 billion in foreign exchange earnings. By 2025, that figure had grown to an estimated KES 18 billion. The European Union — particularly the Netherlands, UK, and France — absorbs over 70% of Kenya's avocado exports.</p>
<p>What's driving this explosion? The global shift toward health-conscious eating has made avocados one of the fastest-growing food commodities worldwide. Kenya sits in an almost uniquely advantageous position: the right altitude, soil, and climate to grow premium Hass avocados that meet EU quality standards.</p>

<h2>Best Growing Regions in Kenya</h2>
<p>Avocados thrive at altitudes between 1,200 and 2,400 metres with well-distributed rainfall of 1,000–1,600mm annually. Kenya's top-producing regions are:</p>
<ul>
  <li><strong>Murang'a County:</strong> The heartland of Kenya's avocado boom. Cool highlands, rich red volcanic soils, and established export networks make this the premium growing zone.</li>
  <li><strong>Nyeri County:</strong> High-quality Hass production, increasingly attracting foreign buyer interest.</li>
  <li><strong>Meru and Tharaka-Nithi:</strong> Emerging avocado zones with lower land prices and growing infrastructure.</li>
  <li><strong>Kisii and Nyamira:</strong> High rainfall, good yields, historically overlooked but gaining traction with exporters.</li>
</ul>

<h2>Hass vs. Fuerte: Which Variety Should You Plant?</h2>
<p>For export markets, plant <strong>Hass</strong> exclusively. European and American importers have standardised on Hass. Fuerte — once Kenya's dominant variety — fetches 30–40% lower prices on the export market and is being phased out by commercial growers.</p>
<p>Hass trees take 3–4 years to first fruit from a grafted seedling (7–10 years from seed — never plant from seed for commercial production). After the initial wait, a well-managed Hass tree produces 200–400 fruits per season and continues bearing for 30+ years.</p>

<h2>Economics: How Much Can You Earn?</h2>
<p>A mature Hass orchard with 100 trees per acre (at 10m × 10m spacing) can produce 20,000–40,000 fruits per season. Export-grade fruit (Class 1) fetches KES 25–45 per fruit at the farm gate during peak EU demand (March–July). That's KES 500,000–1,800,000 per acre per season — before labour, certification, and packing costs.</p>
<p>The catch: reaching commercial maturity takes 3–4 years of investment with no returns. Farmers who invested in Hass orchards in 2020–2022 are now beginning to reap those returns, and the numbers are compelling.</p>

<h2>Export Certification Requirements</h2>
<p>To sell to EU supermarkets (the highest-value market), growers need GlobalG.A.P. certification, which requires documented pesticide records, water source certification, and regular audits. The certification process takes 3–6 months and costs approximately KES 80,000–150,000 for a small farm — but it unlocks prices that are 2–3× above the local market.</p>`,
  },
  {
    slug: "kenya-agricultural-markets-2026-trends",
    title: "Kenya's Agricultural Markets: 5 Trends Every Investor Needs to Watch in 2026",
    excerpt: "From avocado export surges to the collapse of pyrethrum, Kenya's agricultural markets are shifting fast. Here's our analysis of the five biggest trends shaping farm investment returns this year.",
    category: "Market Insight",
    authorName: "Samuel Odhiambo",
    authorRole: "Market Research Lead",
    imageUrl: "https://picsum.photos/seed/kenya-markets-2026/800/450",
    readTimeMinutes: 5,
    featured: true,
    publishedAt: new Date("2026-08-01"),
    content: `<h2>1. Climate Disruption Is Reshaping Planting Calendars</h2>
<p>The 2026 long rains arrived three weeks late across most of Kenya's breadbasket regions — Rift Valley, Western, and Nyanza — pushing maize planting calendars into late April. This delay cascades into harvest timing conflicts with the short rains and increases moisture stress risk during the critical grain-fill stage.</p>
<p>Farmers who invested in soil moisture sensors and micro-irrigation in 2024–2025 are outperforming neighbours by 15–25% yield margins. Climate-resilient farming infrastructure is no longer optional for commercial viability.</p>

<h2>2. Avocado Exports Continue to Surge — But Quality Standards Are Tightening</h2>
<p>The EU's new pesticide Maximum Residue Level (MRL) regulations, fully enforced from January 2026, have disqualified an estimated 18% of Kenya's avocado shipments that previously met old standards. Exporters are rejecting farms that cannot demonstrate full traceability from field to packing house.</p>
<p>This is bad news for smallholders without certification, but good news for GlobalG.A.P.-certified farms: the tighter supply has pushed Class-1 farmgate prices up 22% year-on-year.</p>

<h2>3. Maize Prices Are Under Pressure from Regional Imports</h2>
<p>Tanzania and Uganda have both posted above-average maize harvests in the 2025–2026 season. Combined with Kenya's own improved production, NCPB buying prices have stabilised at KES 3,600/bag — flat year-on-year. Farmers banking on price appreciation will be disappointed; the 2026 story in maize is yield, not price.</p>

<h2>4. The Rise of Specialty Coffee and Premium Tea</h2>
<p>Single-origin Kenyan AA coffee is attracting unprecedented premiums at New York C-market auctions. Three Kenyan lots broke the $10/kg barrier in Q1 2026 — prices not seen since 2011. The specialty segment remains thin (under 8% of Kenya's total coffee production) but is growing 12% annually and offers exceptional return potential for farmers who invest in processing equipment and direct-export relationships.</p>

<h2>5. Agri-Fintech Adoption Is Accelerating Among Smallholders</h2>
<p>Mobile-based agricultural investment platforms saw 340% growth in registered users between 2024 and 2026. The driving factor: M-Pesa's ecosystem has made digital transactions second nature for rural Kenyans. Over 2.1 million Kenyan smallholders now have access to formal agricultural credit via mobile platforms — up from 380,000 in 2022.</p>
<p>For investors, this means a larger, more diverse pool of verified farms to invest in, better data for risk assessment, and more liquid secondary markets as more participants enter the ecosystem.</p>`,
  },
  {
    slug: "agri-tech-transforming-east-africa",
    title: "How Agri-Tech is Transforming Small-Scale Farming in East Africa",
    excerpt: "Drones, soil sensors, satellite imagery, and AI-powered advisory apps are reaching smallholder farmers across Kenya, Tanzania, and Uganda. Here's what the technology revolution means for farm productivity and investor returns.",
    category: "Technology",
    authorName: "Amina Hassan",
    authorRole: "Technology Correspondent",
    imageUrl: "https://picsum.photos/seed/agritech-africa/800/450",
    readTimeMinutes: 6,
    featured: false,
    publishedAt: new Date("2026-07-10"),
    content: `<h2>The Technology Gap That's Being Closed</h2>
<p>A decade ago, the idea of a smallholder farmer in Bungoma County using drone imagery to assess crop health would have seemed absurd. Today, agricultural drone services are operating commercially in 18 Kenyan counties, with per-acre pricing down 60% since 2022.</p>
<p>This technology democratisation is the single biggest structural shift in East African agriculture since the Green Revolution of the 1970s. And unlike the Green Revolution — which largely bypassed sub-Saharan Africa — this one is happening from the ground up, driven by local entrepreneurs and affordable smartphones.</p>

<h2>Precision Agriculture Tools Reaching Rural Kenya</h2>
<h3>Soil Testing Apps</h3>
<p>Companies like Soil Cares (Netherlands/Kenya) have brought rapid soil testing to the farm gate. Farmers can test soil pH, nitrogen, phosphorus, and potassium levels in under 5 minutes using a handheld spectrometer connected to a smartphone. This prevents over-application of expensive fertilisers — a problem that costs Kenyan farmers an estimated KES 8 billion annually in wasted inputs.</p>

<h3>Weather Intelligence Platforms</h3>
<p>Precision weather forecasting services like AgroStar and PlantVillage are delivering hyper-local 7-day forecasts and planting advisories via SMS and WhatsApp. Unlike traditional Kenya Meteorological Department bulletins, these services are farm-specific — factoring in microclimate variations that can make the difference between a full harvest and a failed crop.</p>

<h3>Satellite Crop Monitoring</h3>
<p>Through platforms integrated with NASA's NDVI (Normalized Difference Vegetation Index) data, farm managers can now detect crop stress 2–3 weeks before it becomes visible to the human eye. Early intervention — whether from drought, nitrogen deficiency, or early disease — can save 15–30% of a yield that would otherwise be lost.</p>

<h2>What This Means for Agricultural Investors</h2>
<p>The shift to data-driven farming has a direct impact on investment risk:</p>
<ul>
  <li><strong>Better farm performance data</strong> means more accurate risk scoring and more confident investment decisions.</li>
  <li><strong>Early warning systems</strong> allow investors (through platforms) to intervene before small problems become total losses.</li>
  <li><strong>Input cost reduction</strong> (typically 12–20% with precision agriculture) improves net farm margins and return-to-investor ratios.</li>
  <li><strong>Traceability</strong> from field to market unlocks premium buyer relationships and higher farmgate prices.</li>
</ul>

<h2>The Connectivity Constraint</h2>
<p>Despite the progress, 34% of Kenya's farmland is still in areas with intermittent mobile connectivity. Offline-capable apps and SMS-based advisory systems are bridging this gap, but full digital inclusion of Kenya's 4.7 million farming households is still a 5–8 year journey.</p>`,
  },
  {
    slug: "coffee-farming-kenya-premium-returns",
    title: "Coffee Farming in Kenya: How Premium Beans Deliver Premium Returns",
    excerpt: "Kenyan AA coffee commands some of the highest prices at global auctions. This guide explains the unique wet-processing system, the Nairobi Coffee Exchange, and why a well-managed coffee farm in Kirinyaga outperforms nearly any other crop in Kenya.",
    category: "Crop Guide",
    authorName: "Dr. Lucy Wanjiku",
    authorRole: "Crop Economist",
    imageUrl: "https://picsum.photos/seed/kenya-coffee/800/450",
    readTimeMinutes: 7,
    featured: false,
    publishedAt: new Date("2026-06-28"),
    content: `<h2>Kenya's Coffee: A Global Premium Product</h2>
<p>Kenya produces less than 1% of the world's coffee by volume, yet its AA-grade washed arabica regularly appears in the world's most prestigious specialty coffee auctions. The cup profile — bright acidity, blackcurrant and citrus notes, full body — is instantly recognisable to coffee professionals and commands prices of $6–12 per kilogram at the Nairobi Coffee Exchange, versus $2–3 for commodity-grade African coffees.</p>
<p>The reason: Kenya's SL28 and SL34 varieties, combined with the Kenyan "wet processing" method (where cherry is pulped, fermented for 24–72 hours, and washed in clean running water) produces a clean, complex cup that has no close equivalent in the global market.</p>

<h2>Where Kenya's Best Coffee Grows</h2>
<p>The "Kenyan coffee belt" runs through the highland counties surrounding Mount Kenya:</p>
<ul>
  <li><strong>Kirinyaga County:</strong> Produces Kenya's most acclaimed cooperative coffees. The Ngariama and Inoi cooperatives regularly top NCE auction results.</li>
  <li><strong>Nyeri County:</strong> Home to Tegu, Othaya, and Ichamara — names revered in specialty coffee globally.</li>
  <li><strong>Murang'a County:</strong> Significant volume, reliable quality, strong cooperative infrastructure.</li>
  <li><strong>Embu and Meru:</strong> Emerging specialty zones attracting direct-trade interest from European roasters.</li>
</ul>
<p>Optimal altitude: 1,400–2,100m. Lower altitudes produce faster-maturing, lower-acidity beans that fetch commodity prices. The altitude premium is real and measurable.</p>

<h2>The Nairobi Coffee Exchange: How Pricing Works</h2>
<p>All Kenyan coffee must pass through the Nairobi Coffee Exchange (NCE), which runs bi-weekly auctions. The NCE auction system is transparent and competitive — international buyers (including Lavazza, Nestlé, and dozens of specialty roasters) bid directly against each other, ensuring farmers receive genuine market prices.</p>
<p>Average NCE prices in the 2025–2026 season ranged from KES 75 to KES 320 per kg of parchment coffee, depending on quality grade. A single auction can see prices swing dramatically based on cup quality — a 5-point score difference in a Q-grader assessment can mean a 40% price differential.</p>

<h2>Financial Returns from Coffee</h2>
<p>A mature coffee farm (trees aged 5–15 years, at 450 trees/acre) in Kirinyaga should produce 1,500–2,500kg of cherry per acre in a good season, yielding approximately 300–500kg of clean parchment coffee. At KES 150/kg average parchment price, that's KES 45,000–75,000 gross per acre.</p>
<p>Coffee is biennial-bearing: good years and poor years alternate in a recognisable pattern. The total annual farm management cost runs KES 25,000–35,000 per acre, leaving net margins of KES 10,000–40,000 per acre per year — but highly variable by season and auction price.</p>
<p>The real premium is in direct trade and certification: farms with Rainforest Alliance or Fair Trade certification, selling directly to European roasters at $8+/kg, can achieve net margins 3–4× above NCE prices.</p>`,
  },
  {
    slug: "climate-smart-agriculture-kenya",
    title: "Climate-Smart Agriculture: How Kenyan Farmers Are Adapting to a Changing Climate",
    excerpt: "Kenya's agricultural sector faces its most serious climate challenge in decades. From prolonged droughts to erratic rains, farmers are adopting new practices to protect yields — and smart investors are backing them.",
    category: "Sustainability",
    authorName: "Faith Otieno",
    authorRole: "Environmental Agriculture Writer",
    imageUrl: "https://picsum.photos/seed/climate-farm-kenya/800/450",
    readTimeMinutes: 6,
    featured: false,
    publishedAt: new Date("2026-07-05"),
    content: `<h2>The Challenge Kenya's Farmers Face</h2>
<p>The evidence is unambiguous: Kenya's rainfall patterns are becoming more erratic, droughts are intensifying, and temperature averages are rising. The 2022 and 2023 droughts were the worst in 40 years, causing an estimated KES 90 billion in agricultural losses. The 2024 long rains were the heaviest on record in parts of the Rift Valley, causing flooding and soil erosion that destroyed standing crops.</p>
<p>Farmers are caught between two extremes — and the middle ground of "normal" is shrinking. Adapting is not optional; it's existential.</p>

<h2>Water Harvesting and Conservation</h2>
<p>The most impactful adaptation in Kenya's smallholder sector has been the rapid adoption of water harvesting:</p>
<ul>
  <li><strong>Zai pits:</strong> Small planting pits that concentrate water and organic matter around each plant, improving water retention by up to 40%.</li>
  <li><strong>Tied ridges:</strong> Earthen bunds across the contour that capture runoff, reducing soil erosion and increasing soil moisture in the rooting zone.</li>
  <li><strong>On-farm reservoirs:</strong> Plastic-lined "water pans" (50,000–200,000 litres) that harvest roof and surface runoff during rains for use during dry spells.</li>
</ul>
<p>Farmers who installed water pans in 2022–2023 maintained 60–80% of normal yields during the 2023 drought, while neighbours without storage lost 50–90% of their crops.</p>

<h2>Drought-Tolerant Varieties</h2>
<p>KALRO (Kenya Agricultural and Livestock Research Organisation) has released a new generation of drought-tolerant crop varieties:</p>
<ul>
  <li><strong>WEMA Maize (drought-tolerant):</strong> Maintains 80–90% of normal yield under 30% rainfall deficit. Adopted by 1.2 million Kenyan farmers as of 2026.</li>
  <li><strong>KARI Nyota Beans:</strong> Matures in 55–60 days (vs 90 for standard varieties), allowing planting at irregular rain onset and harvesting before mid-season dry spells.</li>
  <li><strong>Sorghum and Millet Revival:</strong> Traditional drought-resistant cereals are being repositioned as premium products — organic sorghum flour now sells for 3× standard maize flour in urban markets.</li>
</ul>

<h2>Agroforestry: Trees as Climate Insurance</h2>
<p>The fastest-growing climate-smart practice in Kenya is deliberate agroforestry — integrating trees into cropland. The Greenbelt Movement, founded by Wangari Maathai, demonstrated the principle; commercial farmers are now implementing it for economics as well as ecology.</p>
<p>Calliandra, Leucaena, and Grevillea trees intercropped with maize and coffee provide: nitrogen fixation (reducing fertiliser costs by 15–25%), windbreaks (reducing crop lodging during heavy rains), and supplementary income from timber and firewood. Farms with established agroforestry systems show 20–35% lower yield volatility during climate stress events.</p>

<h2>The Investment Implication</h2>
<p>From an agricultural investment perspective, farms with documented climate-smart practices carry meaningfully lower risk profiles. Water harvesting infrastructure, drought-tolerant varieties, and agroforestry all reduce the probability of total crop loss — the tail risk that makes agricultural investment nerve-wracking.</p>
<p>When evaluating a farm for investment, look for: evidence of water storage capacity, use of KALRO-certified drought-tolerant seed, and trees on or around the farm boundary. These are the markers of a farmer who has thought about climate risk.</p>`,
  },
  {
    slug: "understanding-farm-share-returns",
    title: "Understanding Farm Share Returns: The Complete Investor's Deep Dive",
    excerpt: "What exactly are you buying when you invest in a farm share? How are returns calculated? What happens at harvest? This deep-dive explains the mechanics of agricultural investment from first principles.",
    category: "Investment",
    authorName: "David Mwangi",
    authorRole: "Head of Investor Education",
    imageUrl: "https://picsum.photos/seed/farm-returns-kenya/800/450",
    readTimeMinutes: 9,
    featured: false,
    publishedAt: new Date("2026-07-30"),
    content: `<h2>What a Farm Share Actually Is</h2>
<p>When you buy shares in a farm on a platform like Investa Farm, you're not buying land. You're not becoming a co-owner of the farm business. You're purchasing a proportional claim on the proceeds from a specific crop cycle — the money generated when that farmer sells their harvest.</p>
<p>Conceptually, it works like this: A farmer needs KES 500,000 to fund a tomato crop for the coming season. They list 10,000 shares at KES 50 each on the platform. You buy 1,000 shares (KES 50,000 = 10% of the farm). When the farmer harvests and sells their tomatoes for KES 650,000 (a 30% return), you receive 10% of KES 650,000 = KES 65,000. Your KES 50,000 became KES 65,000 — a 30% return in one crop cycle.</p>

<h2>How Returns Are Calculated</h2>
<p>Returns are expressed as a percentage of the amount invested, not annualised — because agricultural investment is season-based, not time-based. A 6-month season that returns 25% is equivalent to approximately 50% annualised, which is why the headline numbers look large compared to bank savings or Treasury Bills.</p>
<p>The actual return depends on:</p>
<ul>
  <li><strong>Crop price at harvest:</strong> Set by local or export market conditions. A bumper harvest across the region can depress prices even for a successful farm.</li>
  <li><strong>Yield achieved:</strong> Actual tonnes harvested vs. the projected yield at the time of listing.</li>
  <li><strong>Input cost overruns:</strong> If the farmer needed more fertiliser or labour than budgeted, the surplus comes from returns, not your principal.</li>
  <li><strong>Platform fees:</strong> Typically 3–8% of the return, charged by the platform for risk management, KYC, and operational costs.</li>
</ul>

<h2>The Exit Timeline</h2>
<p>Timing your investment correctly is critical. Here's the typical farm investment lifecycle:</p>
<ol>
  <li><strong>Listing (Day 0):</strong> Farm is listed with a funding target, crop type, projected yield, and projected return range.</li>
  <li><strong>Funding Phase (Days 0–30):</strong> Investors buy shares until the target is reached. Funds are held in escrow.</li>
  <li><strong>Active Season (Months 1–6):</strong> Farmer plants, manages, and grows the crop. You receive periodic farm updates.</li>
  <li><strong>Harvest:</strong> Crop is sold. Platform verifies sale documentation and calculates actual returns.</li>
  <li><strong>Payout (within 14 days of harvest):</strong> Principal + returns distributed to investor wallets.</li>
</ol>

<h2>What Happens When Things Go Wrong</h2>
<p>Agricultural investment carries genuine risk of partial or total loss. The hierarchy of recovery is:</p>
<ol>
  <li><strong>Crop insurance:</strong> Covers verified natural disasters (drought, flood, disease outbreak). Most platforms carry insurance policies; check the coverage terms before investing.</li>
  <li><strong>Farmer Protection Fund:</strong> The platform's own reserve pool. Covers partial losses not covered by insurance, up to the fund's capacity.</li>
  <li><strong>Farmer liability:</strong> If the failure results from farmer negligence (not planting on time, using funds for non-farm purposes), the farmer bears personal liability. Recovery in these cases is slow and uncertain.</li>
</ol>
<p>Realistically: in a portfolio of 10 farm investments, expect 1–2 to underperform, 1 to potentially fail partially or fully, and 7–8 to perform at or near projections. The mathematics of diversification work in your favour.</p>

<h2>Portfolio Construction: How Many Farms?</h2>
<p>Academic research on agricultural investment diversification (Barnett & Mahul, 2007; World Bank, 2022) consistently shows that 8–12 farms across at least 3 different crop types and 2 different geographic regions reduces portfolio volatility by 60–70% compared to single-farm investment. Below 5 farms, you're exposed to correlated regional risks — a single regional drought can wipe out all of your investments simultaneously.</p>
<p>The practical takeaway: invest KES 5,000–10,000 in each of 8–12 farms rather than KES 50,000–100,000 in one or two. The expected return is identical; the risk profile is dramatically better.</p>`,
  },
];

// ─── Seed helper (called from index.ts or migrate) ────────────────────────────
export async function seedBlogPosts(log: (msg: string) => void) {
  for (const post of BLOG_SEED) {
    const existing = await db
      .select({ id: blogPostsTable.id })
      .from(blogPostsTable)
      .where(eq(blogPostsTable.slug, post.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(blogPostsTable).values(post);
      log(`[blog] Seeded: ${post.title}`);
    }
  }
}

// ─── Public routes ────────────────────────────────────────────────────────────

// GET /api/blog — list all posts (newest first)
router.get("/blog", async (_req, res) => {
  const posts = await db
    .select({
      id: blogPostsTable.id,
      slug: blogPostsTable.slug,
      title: blogPostsTable.title,
      excerpt: blogPostsTable.excerpt,
      category: blogPostsTable.category,
      authorName: blogPostsTable.authorName,
      authorRole: blogPostsTable.authorRole,
      imageUrl: blogPostsTable.imageUrl,
      readTimeMinutes: blogPostsTable.readTimeMinutes,
      featured: blogPostsTable.featured,
      publishedAt: blogPostsTable.publishedAt,
    })
    .from(blogPostsTable)
    .orderBy(desc(blogPostsTable.publishedAt));

  res.json(posts);
});

// GET /api/blog/:slug — single post with content
router.get("/blog/:slug", async (req, res) => {
  const { slug } = req.params;
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(eq(blogPostsTable.slug, slug))
    .limit(1);

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  // Fetch 3 related posts (same category, excluding current)
  const related = await db
    .select({
      slug: blogPostsTable.slug,
      title: blogPostsTable.title,
      excerpt: blogPostsTable.excerpt,
      category: blogPostsTable.category,
      imageUrl: blogPostsTable.imageUrl,
      readTimeMinutes: blogPostsTable.readTimeMinutes,
      publishedAt: blogPostsTable.publishedAt,
    })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.category, post.category))
    .orderBy(desc(blogPostsTable.publishedAt))
    .limit(4);

  res.json({
    ...post,
    related: related.filter((r) => r.slug !== slug).slice(0, 3),
  });
});

export default router;
