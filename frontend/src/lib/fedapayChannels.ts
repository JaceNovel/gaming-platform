export type FedaPayWithdrawMethodOption = {
  value: string;
  label: string;
};

export type FedaPayCountryOption = {
  code: string;
  label: string;
  topupChannels: string[];
  withdrawMethods: FedaPayWithdrawMethodOption[];
};

export type FedaPayPayoutSupport = {
  configured_modes?: string[];
  countries?: Array<{
    code: string;
    label: string;
    methods: Array<{
      value: string;
      resolved_mode: string;
      enabled: boolean;
      aliases: string[];
    }>;
  }>;
};

export const SUPPORTED_FEDAPAY_COUNTRIES: FedaPayCountryOption[] = [
  {
    code: "BJ",
    label: "Benin",
    topupChannels: ["Mtn Benin", "Moov Benin"],
    withdrawMethods: [
      { value: "mtn_bj", label: "Mtn Benin" },
      { value: "moov_bj", label: "Moov Benin" },
    ],
  },
  {
    code: "TG",
    label: "Togo",
    topupChannels: ["Moov Togo", "Togocel T-Money"],
    withdrawMethods: [
      { value: "moov_tg", label: "Moov Togo" },
      { value: "togocel", label: "Togocel T-Money" },
    ],
  },
  {
    code: "CI",
    label: "Cote d'Ivoire",
    topupChannels: ["Mtn Cote d'Ivoire", "Moov Cote d'Ivoire", "Orange Cote d'Ivoire", "Wave Cote d'Ivoire", "Djamo Cote d'Ivoire"],
    withdrawMethods: [
      { value: "mtn_ci", label: "Mtn Cote d'Ivoire" },
      { value: "moov_ci", label: "Moov Cote d'Ivoire" },
      { value: "orange_ci", label: "Orange Cote d'Ivoire" },
      { value: "wave_ci", label: "Wave Cote d'Ivoire" },
      { value: "djamo_ci", label: "Djamo Cote d'Ivoire" },
    ],
  },
  {
    code: "SN",
    label: "Senegal",
    topupChannels: ["Free Senegal", "Orange Senegal", "Wave Senegal", "E-money Senegal", "Wizall Senegal", "Djamo Senegal"],
    withdrawMethods: [
      { value: "freemoney_sn", label: "Free Senegal" },
      { value: "orange_sn", label: "Orange Senegal" },
      { value: "wave_sn", label: "Wave Senegal" },
      { value: "e_money_sn", label: "E-money Senegal" },
      { value: "wizall_sn", label: "Wizall Senegal" },
      { value: "djamo_sn", label: "Djamo Senegal" },
    ],
  },
  {
    code: "NE",
    label: "Niger",
    topupChannels: ["Airtel Niger"],
    withdrawMethods: [
      { value: "airtel_ne", label: "Airtel Niger" },
    ],
  },
];

export const getSupportedFedaPayCountry = (country: string): FedaPayCountryOption | undefined => {
  const normalized = String(country).trim().toUpperCase();
  return SUPPORTED_FEDAPAY_COUNTRIES.find((entry) => entry.code === normalized);
};

export const getDefaultFedaPayCountry = (country?: string | null): string => {
  const normalized = String(country ?? "").trim().toUpperCase();
  return getSupportedFedaPayCountry(normalized)?.code ?? "BJ";
};

export const getWithdrawMethodsForCountry = (country: string): FedaPayWithdrawMethodOption[] => {
  return getSupportedFedaPayCountry(country)?.withdrawMethods ?? SUPPORTED_FEDAPAY_COUNTRIES[0]?.withdrawMethods ?? [];
};

export const getDefaultWithdrawMethod = (country: string): string => {
  return getWithdrawMethodsForCountry(country)[0]?.value ?? "mtn_bj";
};

export const fedapayTopupDescription =
  "Paiement via Moneroo avec les canaux Mobile Money supportes au Benin, Togo, Cote d'Ivoire, Senegal et Niger.";

export const filterWithdrawMethodsBySupport = (
  country: string,
  support: FedaPayPayoutSupport | null | undefined,
): FedaPayWithdrawMethodOption[] => {
  const methods = getWithdrawMethodsForCountry(country);
  const countrySupport = support?.countries?.find((entry) => entry.code === String(country).trim().toUpperCase());
  if (!countrySupport) {
    return methods;
  }

  const enabledValues = new Set(countrySupport.methods.filter((entry) => entry.enabled).map((entry) => entry.value));
  const filtered = methods.filter((method) => enabledValues.has(method.value));
  return filtered.length > 0 ? filtered : methods;
};