export type MobileMoneyProvider = "mpesa" | "mtn" | "bank";

export interface CountryConfig {
  code: string;
  name: string;
  provider: MobileMoneyProvider;
}

// Countries Investa Farm serves, mapped to the mobile money network available there.
export const COUNTRIES: CountryConfig[] = [
  { code: "KE", name: "Kenya", provider: "mpesa" },
  { code: "TZ", name: "Tanzania", provider: "mpesa" },
  { code: "UG", name: "Uganda", provider: "mtn" },
  { code: "RW", name: "Rwanda", provider: "mtn" },
  { code: "ZA", name: "South Africa", provider: "mtn" },
  { code: "GH", name: "Ghana", provider: "mtn" },
  { code: "ET", name: "Ethiopia", provider: "bank" },
  { code: "NG", name: "Nigeria", provider: "bank" },
  { code: "ZW", name: "Zimbabwe", provider: "bank" },
  { code: "ZM", name: "Zambia", provider: "mtn" },
  { code: "MW", name: "Malawi", provider: "bank" },
  { code: "MZ", name: "Mozambique", provider: "mpesa" },
  { code: "SD", name: "Sudan", provider: "bank" },
  { code: "SO", name: "Somalia", provider: "bank" },
  { code: "BI", name: "Burundi", provider: "bank" },
  { code: "DJ", name: "Djibouti", provider: "bank" },
  { code: "GB", name: "UK", provider: "bank" },
  { code: "US", name: "USA", provider: "bank" },
  { code: "AE", name: "United Arab Emirates", provider: "bank" },
  { code: "DE", name: "Germany", provider: "bank" },
  { code: "FR", name: "France", provider: "bank" },
  { code: "NL", name: "Netherlands", provider: "bank" },
];

export function getCountry(name: string | null | undefined): CountryConfig | undefined {
  if (!name) return undefined;
  return COUNTRIES.find(c => c.name === name || c.code === name);
}

export function getMobileMoneyProvider(countryName: string | null | undefined): MobileMoneyProvider {
  return getCountry(countryName)?.provider ?? "mpesa";
}
