import { Environment, IntegrationApiKeys, IntegrationCommerceCodes, Options } from "transbank-sdk";
import { getEnv } from "@/lib/env";

export function getTransbankOptions() {
  const env = getEnv();

  if (env.TRANSBANK_ENV === "production") {
    if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY) {
      throw new Error("transbank_not_configured");
    }

    return new Options(env.TRANSBANK_COMMERCE_CODE, env.TRANSBANK_API_KEY, Environment.Production);
  }

  return new Options(IntegrationCommerceCodes.WEBPAY_PLUS, IntegrationApiKeys.WEBPAY, Environment.Integration);
}
