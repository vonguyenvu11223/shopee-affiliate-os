# Architecture

## Current architecture

Đây là ứng dụng độc lập trong repository hiện có. UI dùng Next.js App Router, React và TypeScript strict. Domain model không phụ thuộc UI; toán tài chính và scoring nằm trong `src/lib/intelligence`.

## Provider boundary đề xuất

```ts
interface ProductProvider {
  searchProducts(input: ProductSearchInput): Promise<ProductSearchResult>;
  getProduct(id: string): Promise<Product | null>;
}

interface AffiliateProvider {
  generateAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLinkResult>;
}
```

Production provider phải sử dụng API chính thức hoặc file xuất chính thức do người dùng chủ động tải lên. Repository không có provider dữ liệu demo và không được dùng cookie/session Shopee để gọi endpoint nội bộ.

## Data flow

```text
Shopee Provider → Normalize → Product DB → Snapshot
→ Velocity / Acceleration → Radar → Expected Profit
→ Test → Attribution → Scale / Kill → Learning
```

## Quy tắc quyết định

- LLM không tính ROI, velocity, commission hoặc master score.
- Mọi prediction phải có confidence và lineage.
- Không publish trước quality/compliance check.
- Không scale trước khi có validated commission.
