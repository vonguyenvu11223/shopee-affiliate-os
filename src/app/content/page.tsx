import { ContentStudioTabs } from "@/components/content-studio-tabs";
import { getAffiliateExportData } from "@/lib/data/affiliate-export";
import { getSupabaseCapability } from "@/lib/supabase/config";
import { getTopViewCapability } from "@/providers/ai/topview-video";
import { getTikTokVerifiedUrlPrefix } from "@/providers/publishing/tiktok-publishing";
import { listContentAssets } from "@/repositories/content-asset-repository";
import { listConnectionStatuses } from "@/repositories/platform-connection-repository";

export default async function ContentPage() {
  const data = await getAffiliateExportData();
  const capability = getSupabaseCapability();
  const topview = getTopViewCapability();
  const databaseEnabled = capability.database === "AVAILABLE";
  const [assets, connections] = databaseEnabled
    ? await Promise.all([listContentAssets(), listConnectionStatuses()])
    : [[], []];

  return <>
    <div className="page-heading"><div><p>CONTENT TEST WORKFLOW · REVIEW-GATED</p><h1>Content Studio</h1><h2>Brief thủ công dùng nội dung bạn tự chứng minh. Video AI phải qua kiểm tra claim của người thật trước khi được dùng cho experiment.</h2></div></div>
    <ContentStudioTabs
      manual={{
        aiEnabled: Boolean(process.env.OPENAI_API_KEY?.trim()),
        databaseEnabled,
        products: data.products.map(product => ({ id: product.id, name: product.name, price: product.price, commissionAmount: product.commissionAmount, affiliateUrl: product.affiliateUrl })),
      }}
      prompt={{
        products: data.products.map(product => ({ id: product.id, name: product.name, category: product.category })),
      }}
      video={{
        apiEnabled: topview.capability === "AVAILABLE",
        apiReason: topview.reason,
        databaseEnabled,
        verifiedUrlPrefix: getTikTokVerifiedUrlPrefix(),
        connections: connections.map(item => ({ platform: item.platform, status: item.status, accountName: item.accountName })),
        products: data.products.map(product => ({ id: product.id, name: product.name, productUrl: product.productUrl, affiliateUrl: product.affiliateUrl })),
        assets: assets.map(asset => ({
          id: asset.id, generator: asset.generator, videoUrl: asset.videoUrl,
          generatedScript: asset.generatedScript, detectedClaims: asset.detectedClaims,
          reviewStatus: asset.reviewStatus, createdAt: asset.createdAt, costVnd: asset.costVnd,
        })),
      }}
    />
  </>;
}
