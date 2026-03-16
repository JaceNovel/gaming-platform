# Alibaba and AliExpress Sourcing Architecture

## Goal

Add a controlled sourcing layer for physical accessory products without switching to classic dropshipping.

The customer flow stays local:

1. The customer buys a local catalog product on the platform.
2. The customer shipping address stays only in this platform.
3. Suppliers on Alibaba or AliExpress ship only to the warehouse.
4. The platform groups demand and creates upstream purchase orders in bulk.
5. The warehouse receives goods, local stock is updated, then customer fulfillment continues from the existing order pipeline.

This design fits the current codebase by reusing:

- `products` as the public catalog for accessories.
- `orders` and `order_items` as the customer demand source.
- `stock_movements` and `StockService` for local inventory updates.
- existing admin product and stock pages as the base for new sourcing dashboards.

## Existing baseline in this repository

Current behavior already provides the local commerce shell we need:

- Accessory products are regular `products` with `type=item`, `accessory_category`, `shipping_required`, `delivery_type`, `delivery_eta_days`, and `stock`.
- Customer orders already store physical-shipping metadata in `orders` and `order_items`.
- The current stock model is local stock only.
- Admin product creation and editing already support accessories and logistics hints.

That means Alibaba integration should not replace the current product model. It should add an upstream procurement domain between customer demand and local stock replenishment.

## Target architecture

### 1. Public catalog remains local

Keep `products` as the only customer-facing catalog.

Each accessory sold on the site remains a local product with:

- local retail price
- local title, description, media, category
- local shipping fee and delivery promise
- current on-hand stock
- sourcing metadata pointing to one or more Alibaba or AliExpress source SKUs

This avoids leaking supplier data into the storefront and keeps pricing, branding, and fulfillment under local control.

### 2. Add a sourcing domain

Introduce a new sourcing domain with five concerns:

1. Supplier connection and OAuth tokens
2. Imported source products and source SKUs
3. Mapping between local products and source SKUs
4. Demand aggregation from paid customer orders
5. Procurement batches, inbound shipments, and warehouse receipts

### 3. Separate three inventory states

Do not overload `products.stock` with upstream quantities.

Track three distinct states:

1. `on_hand`: already available locally, still stored in `products.stock`
2. `committed`: reserved by paid customer orders
3. `on_order`: already purchased upstream but not yet received in the warehouse

Only `on_hand` should drive immediate local shipping decisions.

### 4. Use an adapter layer for suppliers

Even if Alibaba is the first integration, model it behind a generic supplier adapter so the system can support:

- Alibaba Open Platform
- AliExpress Open Platform
- manual supplier purchase entry

Recommended interface:

- `SupplierCatalogAdapter`
- `SupplierOrderAdapter`
- `SupplierWebhookVerifier`

Concrete implementations:

- `AlibabaSupplierAdapter`
- `AliExpressSupplierAdapter`

This avoids coupling business logic to one vendor API shape.

## Data model

### Keep existing tables

Reuse these existing tables as-is:

- `products`
- `product_images`
- `orders`
- `order_items`
- `stock_movements`

### New tables

#### `supplier_accounts`

Stores supplier connection credentials and OAuth state.

Suggested columns:

- `id`
- `platform` enum: `alibaba`, `aliexpress`
- `label`
- `member_id`
- `resource_owner`
- `app_key`
- `app_secret_encrypted`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `access_token_expires_at`
- `refresh_token_expires_at`
- `scopes_json`
- `country_code`
- `currency_code`
- `is_active`
- `last_sync_at`
- `last_error_at`
- `last_error_message`
- timestamps

Notes:

- Encrypt secrets and tokens with Laravel encrypted casts or explicit encryption.
- One row can represent one authorized supplier account per platform.

#### `supplier_products`

Stores imported upstream product data.

Suggested columns:

- `id`
- `supplier_account_id`
- `external_product_id`
- `external_offer_id`
- `title`
- `slug`
- `supplier_name`
- `source_url`
- `main_image_url`
- `category_path_json`
- `attributes_json`
- `product_payload_json`
- `status` enum: `imported`, `archived`, `blocked`
- `last_synced_at`
- timestamps

Indexes:

- unique on `supplier_account_id + external_product_id`

#### `supplier_product_skus`

Stores purchasable variants and commercial terms.

Suggested columns:

- `id`
- `supplier_product_id`
- `external_sku_id`
- `sku_label`
- `variant_attributes_json`
- `moq`
- `unit_price`
- `currency_code`
- `shipping_template_json`
- `weight_grams`
- `dimensions_json`
- `available_quantity`
- `lead_time_days`
- `logistics_modes_json`
- `sku_payload_json`
- `is_active`
- timestamps

Indexes:

- unique on `supplier_product_id + external_sku_id`

#### `product_supplier_links`

Maps one local product to one preferred supplier SKU, with optional fallbacks.

Suggested columns:

- `id`
- `product_id`
- `supplier_product_sku_id`
- `priority`
- `is_default`
- `procurement_mode` enum: `manual_batch`, `auto_batch`
- `target_moq`
- `reorder_point`
- `reorder_quantity`
- `safety_stock`
- `warehouse_destination_label`
- `expected_inbound_days`
- `pricing_snapshot_json`
- timestamps

Rules:

- A product can map to multiple source SKUs.
- Only one link should be `is_default=true`.

#### `procurement_demands`

Materialized sourcing demand created from paid customer orders.

Suggested columns:

- `id`
- `order_id`
- `order_item_id`
- `product_id`
- `product_supplier_link_id`
- `supplier_product_sku_id`
- `quantity_requested`
- `quantity_allocated_from_stock`
- `quantity_to_procure`
- `status` enum: `pending`, `batched`, `ordered`, `received`, `cancelled`
- `trigger_reason` enum: `stock_gap`, `preorder`, `manual_restock`
- `needed_by_date`
- `batch_locked_at`
- timestamps

Why this table matters:

- It decouples customer orders from procurement decisions.
- It preserves an audit trail for why upstream purchasing happened.

#### `procurement_batches`

Represents one grouped purchase to a supplier.

Suggested columns:

- `id`
- `supplier_account_id`
- `batch_number`
- `status` enum: `draft`, `approved`, `submitted`, `partially_confirmed`, `shipped`, `partially_received`, `received`, `cancelled`
- `currency_code`
- `warehouse_destination_label`
- `warehouse_address_json`
- `grouping_key`
- `supplier_order_reference`
- `supplier_order_payload_json`
- `submitted_at`
- `expected_ship_date`
- `expected_arrival_date`
- `notes`
- `created_by`
- `approved_by`
- timestamps

`grouping_key` should encode the dimensions that must match for items to be purchased together.

Recommended grouping dimensions:

- platform
- supplier account
- currency
- warehouse destination
- logistics mode
- incoterm or shipping template when relevant

#### `procurement_batch_items`

Lines inside a procurement batch.

Suggested columns:

- `id`
- `procurement_batch_id`
- `supplier_product_sku_id`
- `product_id`
- `product_supplier_link_id`
- `quantity_ordered`
- `unit_price`
- `currency_code`
- `line_total`
- `source_snapshot_json`
- timestamps

#### `procurement_batch_demand`

Pivot between batch lines and originating demand.

Suggested columns:

- `id`
- `procurement_batch_item_id`
- `procurement_demand_id`
- `quantity_covered`
- timestamps

This lets one batch line cover multiple customer order demands.

#### `inbound_shipments`

Tracks supplier-to-warehouse logistics.

Suggested columns:

- `id`
- `procurement_batch_id`
- `shipment_reference`
- `carrier_name`
- `tracking_number`
- `tracking_url`
- `status` enum: `pending`, `in_transit`, `arrived`, `customs_hold`, `delivered_to_warehouse`, `closed`
- `shipped_at`
- `arrived_at`
- `received_at`
- `shipment_payload_json`
- timestamps

#### `warehouse_receipts`

Records actual received quantities.

Suggested columns:

- `id`
- `inbound_shipment_id`
- `received_by`
- `received_at`
- `notes`
- timestamps

#### `warehouse_receipt_items`

Suggested columns:

- `id`
- `warehouse_receipt_id`
- `procurement_batch_item_id`
- `product_id`
- `supplier_product_sku_id`
- `quantity_received`
- `quantity_damaged`
- `quantity_missing`
- `stock_movement_id`
- timestamps

On receipt confirmation, use the existing `StockService` to increment local product stock and create the corresponding `stock_movements` row.

#### `supplier_webhook_events`

Stores raw callbacks for auditability and replay.

Suggested columns:

- `id`
- `supplier_account_id`
- `platform`
- `event_type`
- `external_event_id`
- `signature_valid`
- `headers_json`
- `payload_json`
- `processed_at`
- `processing_status`
- `processing_error`
- timestamps

#### `supplier_sync_runs`

Tracks imports and polling jobs.

Suggested columns:

- `id`
- `supplier_account_id`
- `job_type` enum: `catalog_import`, `product_refresh`, `order_sync`, `token_refresh`
- `status` enum: `running`, `success`, `failed`
- `started_at`
- `finished_at`
- `meta_json`
- `error_message`
- timestamps

## Order and stock flow

### A. Customer order placement

1. Customer buys an accessory using the existing product page, cart, checkout, and order flow.
2. Payment success continues through the current payment settlement pipeline.
3. For each physical order item:
   - if local stock is available, reserve or decrement from current stock flow
   - if local stock is insufficient, create `procurement_demands`
4. Order status remains local and customer-facing.
5. Customer never sees supplier order identifiers.

### B. Demand creation rule

For each paid `order_item` tied to a sourced accessory:

- `allocatable = min(local_available, quantity)`
- `to_procure = quantity - allocatable`

If `to_procure > 0`, insert a `procurement_demands` row.

Recommended behavior:

- local stock available: ship immediately or mark partially ready
- no stock and sourced product: mark the fulfillment meta as waiting inbound stock
- no source mapping: raise admin exception state

### C. Batch grouping logic

Create a scheduled job such as `BuildProcurementBatchesJob`.

It should group eligible demand rows using:

- same supplier account
- same platform
- same default source SKU or compatible source family
- same destination warehouse
- same currency
- same logistics mode
- optionally same purchase window

Recommended batch creation policy:

1. Group pending demands by `grouping_key`.
2. Sum quantities per source SKU.
3. Check MOQ per SKU.
4. If MOQ is not reached:
   - keep the demand open, or
   - allow admin override to create batch anyway.
5. If MOQ is reached or admin forces creation:
   - create `procurement_batches`
   - create `procurement_batch_items`
   - attach covered demands in `procurement_batch_demand`
   - mark demands as `batched`

### D. Upstream purchase submission

Support two modes:

1. `manual_submit`
   - admin reviews a draft batch
   - admin uses the supplier link or prepared payload
   - admin pastes back the upstream supplier order reference

2. `api_submit`
   - Laravel calls the Alibaba or AliExpress order API
   - request is signed according to Open Platform requirements
   - response reference is saved in `supplier_order_reference`

Start with `manual_submit` plus API-assisted payload generation. This is lower risk and matches the business process where the operator still controls the grouped purchase.

### E. Inbound receiving

1. Supplier order or shipment status is synced by polling or webhook.
2. Admin creates or confirms an inbound receipt.
3. For each received line:
   - create `warehouse_receipt_items`
   - increment `products.stock` through `StockService`
   - mark covered demands as `received`
4. Orders waiting for stock can then move to normal local shipping.

## Alibaba and AliExpress integration design

### OAuth

Use the documented authorization-code flow.

Proposed backend endpoints:

- `GET /api/admin/sourcing/supplier-accounts/{platform}/connect`
- `GET /api/admin/sourcing/oauth/{platform}/callback`

Flow:

1. Admin clicks connect.
2. Backend redirects to supplier authorization URL.
3. Callback receives authorization code.
4. Backend exchanges code for access token and refresh token.
5. Store encrypted tokens in `supplier_accounts`.

Refresh policy:

- refresh token before expiration in a scheduled job
- also refresh on demand when API returns token-expired response

### Request signing

Implement a dedicated signer service per platform.

Suggested classes:

- `App\Services\Sourcing\AlibabaSignatureService`
- `App\Services\Sourcing\AlibabaApiClient`
- `App\Services\Sourcing\AliExpressApiClient`

Rules:

- keep the canonicalization and HMAC logic isolated from business services
- log signature inputs only in redacted form
- never store plain app secrets or tokens in logs

### Catalog import

Add an admin-driven import flow rather than automatic full mirroring.

Recommended import modes:

1. import by product URL
2. import by supplier product ID
3. import by keyword search from supplier API

Import steps:

1. fetch upstream product and SKU payload
2. create or update `supplier_products`
3. create or update `supplier_product_skus`
4. let admin map the chosen SKU to an existing or new local `product`

### Order and logistics sync

Use both pull and push where possible:

- polling jobs for resilience
- webhook ingestion for faster updates

Recommended jobs:

- `SyncSupplierCatalogJob`
- `RefreshSupplierTokensJob`
- `SyncProcurementBatchStatusJob`
- `ProcessSupplierWebhookJob`

### Webhook verification

Persist raw webhook payloads first, then process asynchronously.

Handler steps:

1. save event in `supplier_webhook_events`
2. verify signature
3. enqueue async processor
4. update matching `procurement_batches` or `inbound_shipments`
5. keep idempotency using `external_event_id`

## Laravel implementation layout

### Models

Add:

- `SupplierAccount`
- `SupplierProduct`
- `SupplierProductSku`
- `ProductSupplierLink`
- `ProcurementDemand`
- `ProcurementBatch`
- `ProcurementBatchItem`
- `InboundShipment`
- `WarehouseReceipt`
- `WarehouseReceiptItem`
- `SupplierWebhookEvent`
- `SupplierSyncRun`

### Services

Add:

- `SourcingDemandService`
- `ProcurementBatchService`
- `WarehouseReceiptService`
- `SupplierConnectionService`
- `AlibabaApiClient`
- `AliExpressApiClient`

Recommended service responsibilities:

- `SourcingDemandService`: translate paid `order_items` into procurement demand
- `ProcurementBatchService`: group demand, check MOQ, create batch lines, submit or prepare upstream orders
- `WarehouseReceiptService`: receive inbound goods, post stock movements, update demand and batch statuses

### Jobs

Add:

- `CreateProcurementDemandForOrderJob`
- `BuildProcurementBatchesJob`
- `RefreshSupplierTokensJob`
- `SyncSupplierOrdersJob`
- `ProcessSupplierWebhookJob`

### Controllers

Add admin APIs under a new namespace, for example:

- `AdminSupplierAccountController`
- `AdminSupplierCatalogController`
- `AdminProductSourcingController`
- `AdminProcurementController`
- `AdminInboundShipmentController`

### Integration points with existing flow

#### Payment success

Current payment success already triggers downstream fulfillment logic.

Add one more step after a paid order is confirmed:

- inspect sourced physical `order_items`
- create procurement demand when local stock is not enough

Good extension points in the current codebase are the payment settlement services and physical order delivery path.

#### Stock updates

Do not update `products.stock` directly from sourcing controllers.

Always use the existing `StockService` so inventory movements stay auditable in `stock_movements`.

## Admin dashboard design

Add a new admin section: `Sourcing`.

Recommended pages:

### 1. Supplier Accounts

Purpose:

- connect Alibaba or AliExpress account
- show token expiry
- show last sync status
- reconnect on auth failure

Main actions:

- connect
- refresh token
- disable account
- run test connection

### 2. Supplier Catalog Import

Purpose:

- import a supplier product by URL, ID, or search
- review source title, price, MOQ, variants, logistics modes

Main actions:

- import
- refresh
- archive
- open source page

### 3. Product Sourcing Mapping

Purpose:

- map a local product to one or more supplier SKUs
- define default source, MOQ target, reorder point, safety stock, logistics mode

Main actions:

- link SKU
- set default source
- define thresholds
- switch between manual and auto batching

### 4. Demand Queue

Purpose:

- show all `procurement_demands` generated from customer orders
- highlight unmapped products, MOQ blockers, urgent demand

Main actions:

- force batch
- change source SKU
- cancel demand
- mark as covered manually

### 5. Procurement Batches

Purpose:

- review grouped upstream purchase orders
- approve and submit
- store external order references

Main actions:

- create draft
- approve
- submit
- attach supplier order number
- export batch CSV or PDF for manual ordering

### 6. Inbound Shipments and Receipts

Purpose:

- track goods to warehouse
- record actual received quantities
- update stock

Main actions:

- add shipment tracking
- receive partial delivery
- receive full delivery
- flag damaged or missing units

## Frontend implementation plan

Add Next.js admin pages under:

- `frontend/src/app/admin/sourcing/accounts/page.tsx`
- `frontend/src/app/admin/sourcing/import/page.tsx`
- `frontend/src/app/admin/sourcing/mappings/page.tsx`
- `frontend/src/app/admin/sourcing/demand/page.tsx`
- `frontend/src/app/admin/sourcing/batches/page.tsx`
- `frontend/src/app/admin/sourcing/inbound/page.tsx`

Update the admin shell navigation with a `Sourcing` entry gated behind stock or product permissions.

The UI can reuse the current admin table pattern already used by products, orders, and stock.

## Status model recommendation

Keep customer-facing statuses separate from sourcing statuses.

### Customer order statuses

Do not expose supplier states directly to customers.

Customer-visible states can stay simple:

- paid
- preparing
- waiting_stock
- shipped
- delivered

### Procurement statuses

Use sourcing-specific statuses internally:

- demand: `pending`, `batched`, `ordered`, `received`, `cancelled`
- batch: `draft`, `approved`, `submitted`, `shipped`, `received`, `cancelled`
- inbound shipment: `pending`, `in_transit`, `arrived`, `received`, `closed`

## Recommended rollout order

### Phase 1

Implement the internal sourcing data model and admin manual workflow only:

- schema
- admin supplier accounts
- manual source import
- local product to source mapping
- procurement demand generation
- draft procurement batches
- manual upstream order reference entry
- warehouse receipt and stock increment

This phase is enough to operationalize controlled sourcing.

### Phase 2

Add supplier API automation:

- OAuth connect
- token refresh
- signed supplier requests
- supplier product refresh
- supplier order status sync

### Phase 3

Add optimization:

- automatic batch build scheduler
- reorder point suggestions
- safety stock dashboards
- landed cost analytics

## Important implementation rules

1. Do not create a second storefront catalog for supplier items.
2. Do not store customer delivery addresses in supplier orders.
3. Do not treat supplier stock as local stock.
4. Do not mutate local inventory outside `StockService`.
5. Do not submit supplier orders automatically until manual workflow is stable.

## Recommended first implementation slice

If implementation starts now, the first code slice should be:

1. migrations for sourcing tables
2. Eloquent models and relations
3. admin CRUD for supplier accounts and product-source mappings
4. demand generation from paid order items
5. draft batch creation and manual warehouse receipt

That slice fits the current repository well and delivers immediate operational value before full Alibaba API automation is enabled.