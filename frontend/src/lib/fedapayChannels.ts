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
    topupChannels: ["Mtn Benin", "Moov Benin", "BESTCASH Money", "Celtiis Cash", "Coris Money"],
    withdrawMethods: [
      { value: "mtn", label: "Mtn Benin" },
      { value: "moov", label: "Moov Benin" },
      { value: "bestcash", label: "BESTCASH Money" },
      { value: "celtiis", label: "Celtiis Cash" },
      { value: "coris_money", label: "Coris Money" },
      { value: "bank", label: "Banque" },
    ],
  },
  {
    code: "TG",
    label: "Togo",
    topupChannels: ["Moov Togo", "Togocel T-Money"],
    withdrawMethods: [
      { value: "moov_tg", label: "Moov Togo" },
      { value: "togocel", label: "Togocel T-Money" },
      { value: "bank", label: "Banque" },
    ],
  },
  {
    code: "CI",
    label: "Cote d'Ivoire",
    topupChannels: ["Mtn Cote d'Ivoire"],
    withdrawMethods: [
      { value: "mtn_ci", label: "Mtn Cote d'Ivoire" },
      { value: "bank", label: "Banque" },
    ],
  },
  {
    code: "SN",
    label: "Senegal",
    topupChannels: ["Free Senegal"],
    withdrawMethods: [
      { value: "free_sn", label: "Free Senegal" },
      { value: "bank", label: "Banque" },
    ],
  },
  {
    code: "NE",
    label: "Niger",
    topupChannels: ["Airtel Niger"],
    withdrawMethods: [
      { value: "airtel_ne", label: "Airtel Niger" },
      { value: "bank", label: "Banque" },
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
  return getWithdrawMethodsForCountry(country)[0]?.value ?? "bank";
};

export const fedapayTopupDescription =
  "Paiement via FedaPay avec les canaux Mobile Money supportés au Benin, Togo, Cote d'Ivoire, Senegal et Niger.";

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