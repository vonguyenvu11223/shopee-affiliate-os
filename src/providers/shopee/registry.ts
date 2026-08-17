import "server-only";

import { OfficialCsvProductProvider } from "@/providers/shopee/official-csv-product-provider";
import { ManualAffiliateProvider } from "@/providers/shopee/manual-affiliate-provider";
import { ManualShopeeAccountProvider } from "@/providers/shopee/manual-account-provider";
import { UnavailableShopeePublishingProvider } from "@/providers/shopee/unavailable-publishing-provider";

export const shopeeProviders = {
  products: new OfficialCsvProductProvider(),
  affiliate: new ManualAffiliateProvider(),
  account: new ManualShopeeAccountProvider(),
  publishing: new UnavailableShopeePublishingProvider(),
};
