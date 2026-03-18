"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierAccount = {
  id: number;
  label: string;
  platform: string;
};

type SupplierProduct = {
  id: number;
  title?: string | null;
  external_product_id?: string | null;
  supplier_name?: string | null;
  source_url?: string | null;
  supplier_account?: { label?: string | null; platform?: string | null } | null;
  skus_count?: number | null;
};

type RemoteSearchResult = {
  external_product_id?: string | null;
  title?: string | null;
  model_number?: string | null;
  status?: string | null;
  sku_code?: string | null;
  category_name?: string | null;
  main_image_url?: string | null;
};

type RemoteProductPayload = {
  external_offer_id?: string | null;
  title?: string | null;
  supplier_name?: string | null;
  source_url?: string | null;
  main_image_url?: string | null;
  category_path_json?: unknown[] | null;
  attributes_json?: Record<string, unknown> | null;
  product_payload_json?: Record<string, unknown> | null;
  skus?: unknown[] | null;
  _storefront_defaults?: Record<string, unknown> | null;
};

type CategoryPrediction = {
  category_id?: string | null;
  category_name?: string | null;
  category_path?: string | null;
  msg_code?: string | null;
  message?: string | null;
};

type VideoUploadResult = {
  request_id?: string | null;
  request_status?: string | null;
  video_id?: string | null;
  msg_code?: string | null;
  message?: string | null;
};

type RemoteVideo = {
  video_id?: string | null;
  title?: string | null;
  status?: string | null;
  quality?: string | null;
  video_url?: string | null;
  cover_url?: string | null;
  duration?: string | null;
  file_size?: string | null;
};

type BuyerItemSummary = {
  item_id?: string | null;
  isv_item_id?: string | null;
  title?: string | null;
  price?: string | null;
  currency?: string | null;
  available_quantity?: string | null;
  permalink?: string | null;
};

type BuyerEcoOperation =
  | "product-events"
  | "channel-batch-import"
  | "crossborder-check"
  | "product-cert"
  | "product-description"
  | "product-keyattributes"
  | "product-inventory"
  | "local-check"
  | "localregular-check"
  | "item-rec-image"
  | "product-check"
  | "product-search"
  | "item-rec";

type IopOperation =
  | "advanced-freight-calculate"
  | "basic-freight-calculate"
  | "ds-order-create"
  | "ds-product-get"
  | "ds-product-wholesale-get"
  | "ds-image-search-v2"
  | "ds-category-get"
  | "ds-feed-itemids-get"
  | "ds-member-benefit-get"
  | "buyer-freight-calculate"
  | "ds-trade-order-get"
  | "ds-order-tracking-get"
  | "merge-pay-query"
  | "buynow-order-create"
  | "logistics-tracking-get"
  | "overseas-admittance-check"
  | "dropshipping-order-pay"
  | "order-fund-query"
  | "ggs-warehouse-list"
  | "order-cancel"
  | "order-get"
  | "order-list"
  | "order-pay-result-query"
  | "seller-warehouse-list"
  | "order-logistics-query"
  | "ae-affiliate-product-shipping"
  | "ae-affiliate-sku-detail"
  | "ae-affiliate-product-detail"
  | "ae-affiliate-product-query"
  | "ae-affiliate-category-get"
  | "ae-affiliate-link-generate"
  | "ae-affiliate-order-get"
  | "ae-affiliate-order-list"
  | "ae-affiliate-order-listbyindex"
  | "ae-affiliate-hotproduct-query"
  | "ae-affiliate-hotproduct-download"
  | "ae-affiliate-product-smartmatch"
  | "ae-invoice-request-query"
  | "ae-fund-merchant-orderdetail"
  | "ae-brazil-invoice-query"
  | "ae-brazil-invoice-upload"
  | "ae-invoice-result-push"
  | "ae-hscode-regulatory-attributes-query"
  | "ae-hscode-regulatory-attributes-options"
  | "ae-fund-recipet-flowdetail-query"
  | "ae-fund-recipet-config-query"
  | "ae-fund-recipet-debt-query"
  | "ae-customize-product-info-query"
  | "ae-customize-product-template-query"
  | "ae-customize-product-info-audit-result-query"
  | "ae-customize-product-info-create"
  | "ae-local-cb-product-prices-edit"
  | "ae-local-cb-product-status-update"
  | "ae-local-cb-product-edit"
  | "ae-local-cb-products-list"
  | "ae-local-cb-product-post"
  | "ae-local-cb-products-stock-edit"
  | "ae-local-cb-product-query"
  | "ae-category-child-attributes-query"
  | "ae-category-tree-list"
  | "ae-category-item-qualification-list"
  | "ae-category-cascade-properties-query"
  | "ae-solution-sku-attribute-query"
  | "ae-seller-category-tree-query"
  | "ae-category-qualifications-list"
  | "ae-freight-seller-intention-query"
  | "ae-freight-isv-gray-query"
  | "ae-freight-template-recommend"
  | "ae-freight-template-create"
  | "ae-freight-template-list"
  | "ae-trade-order-decrypt"
  | "ae-solution-order-receiptinfo-get"
  | "ae-solution-order-get"
  | "ae-trade-verifycode"
  | "ae-trade-confirmshippingmode"
  | "ae-trade-sendcode"
  | "ae-asf-local2local-sub-declareship"
  | "ae-asf-dbs-declareship"
  | "ae-asf-local2local-self-pickup-declareship"
  | "ae-asf-dbs-declare-ship-modify"
  | "ae-asf-shipment-pack"
  | "ae-asf-order-shipping-service-get"
  | "ae-asf-package-shipping-service-get"
  | "ae-asf-local2local-split-quantity-rts-pack"
  | "ae-asf-platform-logistics-document-query"
  | "ae-asf-platform-logistics-rts"
  | "ae-asf-platform-logistics-repack"
  | "ae-asf-local-unreachable-preference-query"
  | "ae-asf-seller-address-get"
  | "ae-asf-local-unreachable-preference-update"
  | "ae-asf-local2local-transfer-to-offline"
  | "ae-asf-fulfillment-package-query"
  | "ae-asf-local-supply-shipping-service-get"
  | "ae-asf-local-supply-batch-declareship"
  | "ae-asf-local-supply-declareship-modify"
  | "ae-asf-local-supply-sub-declareship"
  | "ae-asf-local-supply-split-quantity-rts-pack"
  | "ae-asf-local-supply-platform-logistics-document-query"
  | "ae-asf-local-supply-platform-logistics-rts"
  | "ae-asf-local-supply-platform-logistics-repack"
  | "ae-asf-local-supply-seller-address-get"
  | "ae-local-service-product-stocks-update"
  | "ae-local-service-product-stocks-query"
  | "ae-local-service-products-list"
  | "ae-local-service-product-prices-edit"
  | "ae-local-service-product-post"
  | "ae-local-service-product-edit"
  | "ae-local-service-product-query"
  | "ae-local-service-product-status-update";

const ALIBABA_IOP_OPERATIONS: IopOperation[] = [
  "advanced-freight-calculate",
  "basic-freight-calculate",
  "merge-pay-query",
  "buynow-order-create",
  "logistics-tracking-get",
  "overseas-admittance-check",
  "dropshipping-order-pay",
  "order-fund-query",
  "ggs-warehouse-list",
  "order-cancel",
  "order-get",
  "order-list",
  "order-pay-result-query",
  "seller-warehouse-list",
  "order-logistics-query",
];

const ALIEXPRESS_IOP_OPERATIONS: IopOperation[] = [
  "ds-order-create",
  "ds-product-get",
  "ds-product-wholesale-get",
  "ds-image-search-v2",
  "ds-category-get",
  "ds-feed-itemids-get",
  "ds-member-benefit-get",
  "buyer-freight-calculate",
  "ds-trade-order-get",
  "ds-order-tracking-get",
  "ae-affiliate-product-shipping",
  "ae-affiliate-sku-detail",
  "ae-affiliate-product-detail",
  "ae-affiliate-product-query",
  "ae-affiliate-category-get",
  "ae-affiliate-link-generate",
  "ae-affiliate-order-get",
  "ae-affiliate-order-list",
  "ae-affiliate-order-listbyindex",
  "ae-affiliate-hotproduct-query",
  "ae-affiliate-hotproduct-download",
  "ae-affiliate-product-smartmatch",
  "ae-invoice-request-query",
  "ae-fund-merchant-orderdetail",
  "ae-brazil-invoice-query",
  "ae-brazil-invoice-upload",
  "ae-invoice-result-push",
  "ae-hscode-regulatory-attributes-query",
  "ae-hscode-regulatory-attributes-options",
  "ae-fund-recipet-flowdetail-query",
  "ae-fund-recipet-config-query",
  "ae-fund-recipet-debt-query",
  "ae-customize-product-info-query",
  "ae-customize-product-template-query",
  "ae-customize-product-info-audit-result-query",
  "ae-customize-product-info-create",
  "ae-local-cb-product-prices-edit",
  "ae-local-cb-product-status-update",
  "ae-local-cb-product-edit",
  "ae-local-cb-products-list",
  "ae-local-cb-product-post",
  "ae-local-cb-products-stock-edit",
  "ae-local-cb-product-query",
  "ae-category-child-attributes-query",
  "ae-category-tree-list",
  "ae-category-item-qualification-list",
  "ae-category-cascade-properties-query",
  "ae-solution-sku-attribute-query",
  "ae-seller-category-tree-query",
  "ae-category-qualifications-list",
  "ae-freight-seller-intention-query",
  "ae-freight-isv-gray-query",
  "ae-freight-template-recommend",
  "ae-freight-template-create",
  "ae-freight-template-list",
  "ae-trade-order-decrypt",
  "ae-solution-order-receiptinfo-get",
  "ae-solution-order-get",
  "ae-trade-verifycode",
  "ae-trade-confirmshippingmode",
  "ae-trade-sendcode",
  "ae-asf-local2local-sub-declareship",
  "ae-asf-dbs-declareship",
  "ae-asf-local2local-self-pickup-declareship",
  "ae-asf-dbs-declare-ship-modify",
  "ae-asf-shipment-pack",
  "ae-asf-order-shipping-service-get",
  "ae-asf-package-shipping-service-get",
  "ae-asf-local2local-split-quantity-rts-pack",
  "ae-asf-platform-logistics-document-query",
  "ae-asf-platform-logistics-rts",
  "ae-asf-platform-logistics-repack",
  "ae-asf-local-unreachable-preference-query",
  "ae-asf-seller-address-get",
  "ae-asf-local-unreachable-preference-update",
  "ae-asf-local2local-transfer-to-offline",
  "ae-asf-fulfillment-package-query",
  "ae-asf-local-supply-shipping-service-get",
  "ae-asf-local-supply-batch-declareship",
  "ae-asf-local-supply-declareship-modify",
  "ae-asf-local-supply-sub-declareship",
  "ae-asf-local-supply-split-quantity-rts-pack",
  "ae-asf-local-supply-platform-logistics-document-query",
  "ae-asf-local-supply-platform-logistics-rts",
  "ae-asf-local-supply-platform-logistics-repack",
  "ae-asf-local-supply-seller-address-get",
  "ae-local-service-product-stocks-update",
  "ae-local-service-product-stocks-query",
  "ae-local-service-products-list",
  "ae-local-service-product-prices-edit",
  "ae-local-service-product-post",
  "ae-local-service-product-edit",
  "ae-local-service-product-query",
  "ae-local-service-product-status-update",
];

const ALIEXPRESS_IOP_OPERATION_GROUPS: Array<{ label: string; operations: IopOperation[] }> = [
  {
    label: "DS Catalog & Orders",
    operations: [
      "ds-product-get",
      "ds-product-wholesale-get",
      "ds-image-search-v2",
      "ds-category-get",
      "ds-feed-itemids-get",
      "ds-member-benefit-get",
      "buyer-freight-calculate",
      "ds-order-create",
      "ds-trade-order-get",
      "ds-order-tracking-get",
    ],
  },
  {
    label: "Affiliate",
    operations: [
      "ae-affiliate-product-shipping",
      "ae-affiliate-sku-detail",
      "ae-affiliate-product-detail",
      "ae-affiliate-product-query",
      "ae-affiliate-category-get",
      "ae-affiliate-link-generate",
      "ae-affiliate-order-get",
      "ae-affiliate-order-list",
      "ae-affiliate-order-listbyindex",
      "ae-affiliate-hotproduct-query",
      "ae-affiliate-hotproduct-download",
      "ae-affiliate-product-smartmatch",
    ],
  },
  {
    label: "Invoice & Tax",
    operations: [
      "ae-invoice-request-query",
      "ae-brazil-invoice-query",
      "ae-brazil-invoice-upload",
      "ae-invoice-result-push",
      "ae-hscode-regulatory-attributes-query",
      "ae-hscode-regulatory-attributes-options",
    ],
  },
  {
    label: "Funds & Freight",
    operations: [
      "ae-fund-merchant-orderdetail",
      "ae-fund-recipet-flowdetail-query",
      "ae-fund-recipet-config-query",
      "ae-fund-recipet-debt-query",
      "ae-freight-seller-intention-query",
      "ae-freight-isv-gray-query",
      "ae-freight-template-recommend",
      "ae-freight-template-create",
      "ae-freight-template-list",
    ],
  },
  {
    label: "Orders & Trade",
    operations: [
      "ae-trade-order-decrypt",
      "ae-solution-order-receiptinfo-get",
      "ae-solution-order-get",
      "ae-trade-verifycode",
      "ae-trade-confirmshippingmode",
      "ae-trade-sendcode",
    ],
  },
  {
    label: "Customize & Category",
    operations: [
      "ae-customize-product-info-query",
      "ae-customize-product-template-query",
      "ae-customize-product-info-audit-result-query",
      "ae-customize-product-info-create",
      "ae-category-child-attributes-query",
      "ae-category-tree-list",
      "ae-category-item-qualification-list",
      "ae-category-cascade-properties-query",
      "ae-solution-sku-attribute-query",
      "ae-seller-category-tree-query",
      "ae-category-qualifications-list",
    ],
  },
  {
    label: "ASF Local Supply",
    operations: [
      "ae-asf-local-supply-shipping-service-get",
      "ae-asf-local-supply-batch-declareship",
      "ae-asf-local-supply-declareship-modify",
      "ae-asf-local-supply-sub-declareship",
      "ae-asf-local-supply-split-quantity-rts-pack",
      "ae-asf-local-supply-platform-logistics-document-query",
      "ae-asf-local-supply-platform-logistics-rts",
      "ae-asf-local-supply-platform-logistics-repack",
      "ae-asf-local-supply-seller-address-get",
    ],
  },
  {
    label: "ASF Logistics",
    operations: [
      "ae-asf-local2local-sub-declareship",
      "ae-asf-dbs-declareship",
      "ae-asf-local2local-self-pickup-declareship",
      "ae-asf-dbs-declare-ship-modify",
      "ae-asf-shipment-pack",
      "ae-asf-order-shipping-service-get",
      "ae-asf-package-shipping-service-get",
      "ae-asf-local2local-split-quantity-rts-pack",
      "ae-asf-platform-logistics-document-query",
      "ae-asf-platform-logistics-rts",
      "ae-asf-platform-logistics-repack",
      "ae-asf-local-unreachable-preference-query",
      "ae-asf-seller-address-get",
      "ae-asf-local-unreachable-preference-update",
      "ae-asf-local2local-transfer-to-offline",
      "ae-asf-fulfillment-package-query",
    ],
  },
  {
    label: "Local Service & Crossborder",
    operations: [
      "ae-local-cb-product-prices-edit",
      "ae-local-cb-product-status-update",
      "ae-local-cb-product-edit",
      "ae-local-cb-products-list",
      "ae-local-cb-product-post",
      "ae-local-cb-products-stock-edit",
      "ae-local-cb-product-query",
      "ae-local-service-product-stocks-update",
      "ae-local-service-product-stocks-query",
      "ae-local-service-products-list",
      "ae-local-service-product-prices-edit",
      "ae-local-service-product-post",
      "ae-local-service-product-edit",
      "ae-local-service-product-query",
      "ae-local-service-product-status-update",
    ],
  },
];

const stringifyTemplate = (value: unknown) => JSON.stringify(value, null, 2);

const BUYER_ITEM_TEMPLATES = {
  add: stringifyTemplate({
    isv_item_id: "isv-demo-001",
    title: "Gaming Headset RGB",
    description: "USB gaming headset with detachable microphone",
    price: "29.90",
    original_price: "39.90",
    currency: "USD",
    available_quantity: "25",
    image_urls: ["https://example.com/headset-main.jpg"],
    variations: [
      {
        variation_id: "var-001",
        isv_variation_id: "isv-var-001",
        price: "29.90",
        available_quantity: "25",
        image_urls: ["https://example.com/headset-black.jpg"],
      },
    ],
  }),
  update: stringifyTemplate({
    item_id: "14001030307",
    title: "Gaming Headset RGB v2",
    price: "27.90",
    available_quantity: "18",
  }),
  delete: stringifyTemplate({
    item_id: "14001030307",
  }),
  query: stringifyTemplate({
    item_id: "14001030307",
    page: 1,
    page_size: 20,
  }),
} as const;

const BUYER_ECO_TEMPLATES: Record<BuyerEcoOperation, string> = {
  "product-events": stringifyTemplate({
    events: [
      {
        item_id: "14001030307",
        status: "ACTIVE",
        price: "69.00",
        currency: "USD",
      },
    ],
  }),
  "channel-batch-import": stringifyTemplate({
    ecology_id_list: ["eco-001", "eco-002"],
    channel_name: "shopify",
  }),
  "crossborder-check": stringifyTemplate({
    page: 1,
    page_size: 20,
  }),
  "product-cert": stringifyTemplate({
    product_id: "1601206892606",
  }),
  "product-description": stringifyTemplate({
    product_id: "1601206892606",
  }),
  "product-keyattributes": stringifyTemplate({
    product_id: "1601206892606",
  }),
  "product-inventory": stringifyTemplate({
    product_id: "1600927952535",
    shipping_from: "CN",
  }),
  "local-check": stringifyTemplate({
    page: 1,
    page_size: 20,
  }),
  "localregular-check": stringifyTemplate({
    page: 1,
    page_size: 20,
  }),
  "item-rec-image": stringifyTemplate({
    item_id: "14001030307",
    page: 1,
    page_size: 20,
  }),
  "product-check": stringifyTemplate({
    page: 1,
    page_size: 20,
    destination_country: "US",
  }),
  "product-search": stringifyTemplate({
    keyword: "wireless headset",
    page: 1,
    page_size: 20,
    destination_country: "US",
  }),
  "item-rec": stringifyTemplate({
    item_id: "14001030307",
    page: 1,
    page_size: 20,
  }),
};

const IOP_TEMPLATES: Record<IopOperation, string> = {
  "advanced-freight-calculate": stringifyTemplate({
    e_company_id: "cVmhg7/xG8q3UQgcH/5Fag==",
    destination_country: "US",
    address: {
      zip: "35022",
      country: { code: "US", name: "United States" },
      address: "4595 Clubview Drive",
      province: { code: "AL", name: "Alabama" },
      city: { code: "Bessemer", name: "Bessemer" },
    },
    logistics_product_list: [
      {
        quantity: "1",
        product_id: "1600191825486",
        sku_id: "12321",
      },
    ],
    dispatch_location: "CN",
    enable_distribution_waybill: false,
  }),
  "basic-freight-calculate": stringifyTemplate({
    destination_country: "US",
    product_id: "213421",
    quantity: "3",
    zip_code: "90001",
    dispatch_location: "CN",
    enable_distribution_waybill: false,
  }),
  "ds-order-create": stringifyTemplate({
    ds_extend_request: {
      payment: {
        try_to_pay: "true",
        pay_currency: "USD",
      },
    },
    param_place_order_request4_open_api_d_t_o: {
      out_order_id: "gp-demo-order-001",
      logistics_address: {
        country: "TG",
        city: "Lome",
        address: "Rue de la Paix",
        address2: "Quartier administratif",
        full_name: "Client Demo",
        contact_person: "Client Demo",
        mobile_no: "90000000",
        phone_country: "+228",
        zip: "0000",
        locale: "fr_FR",
      },
      product_items: [
        {
          product_id: "1005003784285827",
          sku_attr: "73:175#Black Green;71:193#Polarized",
          product_count: "1",
          logistics_service_name: "AliExpress Selection Standard",
        },
      ],
    },
  }),
  "ds-product-get": stringifyTemplate({
    ship_to_country: "TG",
    product_id: "1005003784285827",
    target_currency: "USD",
    target_language: "fr",
    remove_personal_benefit: false,
  }),
  "ds-product-wholesale-get": stringifyTemplate({
    ship_to_country: "TG",
    product_id: "1005003784285827",
    target_currency: "USD",
    target_language: "fr",
    remove_personal_benefit: false,
  }),
  "ds-image-search-v2": stringifyTemplate({
    param0: {
      search_type: "similar",
      image_base64: "BASE64_IMAGE_HERE",
      currency: "USD",
      lang: "en",
      sort_type: "price",
      sort_order: "ASC",
      ship_to: "US",
    },
  }),
  "ds-category-get": stringifyTemplate({
    categoryId: "21",
    language: "fr",
  }),
  "ds-feed-itemids-get": stringifyTemplate({
    page_size: 20,
    category_id: "21",
    feed_name: "DS bestseller",
  }),
  "ds-member-benefit-get": stringifyTemplate({}),
  "buyer-freight-calculate": stringifyTemplate({
    param_aeop_freight_calculate_for_buyer_d_t_o: {
      country_code: "TG",
      price: "19.99",
      product_id: "1005003784285827",
      sku_id: "12000027158136202",
      product_num: "1",
      send_goods_country_code: "CN",
      price_currency: "USD",
    },
  }),
  "ds-trade-order-get": stringifyTemplate({
    single_order_query: {
      order_id: "10000001",
    },
  }),
  "ds-order-tracking-get": stringifyTemplate({
    ae_order_id: "10000001",
    language: "en_US",
  }),
  "merge-pay-query": stringifyTemplate(["23423333", "123421"]),
  "buynow-order-create": stringifyTemplate({
    channel_refer_id: "124232",
    logistics_detail: {
      shipment_address: {
        zip: "10012",
        country: "United States of America",
        address: "1000 Fifth Avenue at 82nd Street, New York, NY",
        city: "New York",
        contact_person: "John Doe",
        country_code: "US",
        province: "New York",
      },
      dispatch_location: "CN",
      carrier_code: "EX_ASP_JYC_FEDEX",
    },
    product_list: [
      {
        quantity: "10",
        product_id: "100001",
        sku_id: "200001",
      },
    ],
    properties: {
      platform: "Shopify",
      orderId: "1111111111111",
    },
    remark: "order remarks",
    enable_distribution_waybill: false,
  }),
  "logistics-tracking-get": stringifyTemplate("2345323432"),
  "overseas-admittance-check": stringifyTemplate({}),
  "dropshipping-order-pay": stringifyTemplate({
    user_ip: "10.11.102.11",
    isv_drop_shipper_registration_time: "1616595118627",
    order_id_list: ["1234", "2234"],
    is_pc: true,
    accept_language: "en-US,en;q=0.9",
    screen_resolution: "1024*1024",
    user_agent: "Mozilla/5.0",
    payment_method: "CREDIT_CARD",
  }),
  "order-fund-query": stringifyTemplate({
    e_trade_id: "21342134",
    data_select: "fund_transaction_fee",
  }),
  "ggs-warehouse-list": stringifyTemplate({
    product_id: "12134343",
    page_size: 10,
    current_page: 1,
  }),
  "order-cancel": stringifyTemplate("1234532134"),
  "order-get": stringifyTemplate({
    e_trade_id: "12342132",
    data_select: "draft_role",
    language: "en_US",
  }),
  "order-list": stringifyTemplate({
    start_page: 0,
    role: "buyer",
    page_size: 10,
    status: "unpay",
  }),
  "order-pay-result-query": stringifyTemplate("2134213421"),
  "seller-warehouse-list": stringifyTemplate({
    product_id: "12343213",
    country_code: "US",
    current_page: 1,
  }),
  "order-logistics-query": stringifyTemplate({
    trade_id: "2134532",
    data_select: "logistic_order",
  }),
  "ae-affiliate-product-shipping": stringifyTemplate({
    product_id: "33006951782",
    sku_id: "12000029786932962",
    ship_to_country: "TG",
    target_currency: "USD",
    target_sale_price: "100.03",
    target_language: "FR",
    tax_rate: "0.1",
  }),
  "ae-affiliate-sku-detail": stringifyTemplate({
    ship_to_country: "TG",
    product_id: "1005007588427363",
    target_currency: "USD",
    target_language: "FR",
    need_deliver_info: "Yes",
  }),
  "ae-affiliate-product-detail": stringifyTemplate({
    fields: "commission_rate,sale_price",
    product_ids: "33006951782",
    target_currency: "USD",
    target_language: "FR",
    country: "TG",
  }),
  "ae-affiliate-product-query": stringifyTemplate({
    keywords: "gaming headset",
    page_no: 1,
    page_size: 20,
    sort: "SALE_PRICE_ASC",
    target_currency: "USD",
    target_language: "FR",
    ship_to_country: "TG",
  }),
  "ae-affiliate-category-get": stringifyTemplate({}),
  "ae-affiliate-link-generate": stringifyTemplate({
    ship_to_country: "TG",
    promotion_link_type: 0,
    source_values: "https://www.aliexpress.com/item/33006951782.html",
  }),
  "ae-affiliate-order-get": stringifyTemplate({
    fields: "commission_rate,created_time",
    order_ids: "1111,2222",
  }),
  "ae-affiliate-order-list": stringifyTemplate({
    time_type: "Payment Completed Time",
    start_time: "2026-03-01 00:00:00",
    end_time: "2026-03-17 23:59:59",
    page_no: 1,
    page_size: 20,
    status: "Payment Completed",
  }),
  "ae-affiliate-order-listbyindex": stringifyTemplate({
    time_type: "Payment Completed Time",
    start_time: "2026-03-01 00:00:00",
    end_time: "2026-03-17 23:59:59",
    page_size: 20,
    status: "Payment Completed",
  }),
  "ae-affiliate-hotproduct-query": stringifyTemplate({
    keywords: "gaming mouse",
    page_no: 1,
    page_size: 20,
    sort: "LAST_VOLUME_DESC",
    target_currency: "USD",
    target_language: "FR",
    ship_to_country: "TG",
  }),
  "ae-affiliate-hotproduct-download": stringifyTemplate({
    category_id: "7",
    fields: "app_sale_price,shop_id",
    page_no: 1,
    page_size: 20,
    target_currency: "USD",
    target_language: "FR",
    country: "TG",
  }),
  "ae-affiliate-product-smartmatch": stringifyTemplate({
    page_no: 1,
    device_id: "primegaming-demo-device",
    fields: "app_sale_price,shop_id",
    keywords: "gaming keyboard",
    country: "TG",
    target_currency: "USD",
    target_language: "FR",
  }),
  "ae-invoice-request-query": stringifyTemplate({
    param0: {
      orderId: "8197713881212202",
      customerId: "us1001278184lzaae",
    },
  }),
  "ae-fund-merchant-orderdetail": stringifyTemplate({
    orderId: "1108202950093697",
    pageSize: 20,
    currentPage: 1,
    timeSelect: {
      statType: "payTime",
      startTimestamp: "172900000000",
      endTimestamp: "172900000000",
    },
    settleStatus: "completed",
    additionalParameter: {
      orderType: "POP",
      sellingRegion: "AEG",
    },
  }),
  "ae-brazil-invoice-query": stringifyTemplate({
    trade_order_id_list: ["1118013810220"],
    source: "ISV",
  }),
  "ae-brazil-invoice-upload": stringifyTemplate({
    originalFileName: "invoice.xml",
    source: "ISV",
    orderId: 1118013810156440,
    __file_params: {
      invoiceData: {
        file_name: "invoice.xml",
        content_base64: "PHhtbD48aW52b2ljZT48L2ludm9pY2U+PC94bWw+",
      },
    },
  }),
  "ae-invoice-result-push": stringifyTemplate({
    invoiceStatus: "GENERATED_SUCCESS",
    invoiceDate: 1737374768053,
    invoiceNo: "INV-2026-0001",
    requestNo: "req-2026-0001",
    invoiceFileType: "pdf",
    invoiceDirection: "BLUE",
    invoiceName: "invoice.pdf",
    orderId: "15235236246",
    customerId: "isRich235",
    __file_params: {
      invoiceData: {
        file_name: "invoice.pdf",
        content_base64: "JVBERi0xLjQKJcTl8uXr",
      },
    },
  }),
  "ae-hscode-regulatory-attributes-query": stringifyTemplate({
    image_url: "https://ae-pic-a1.aliexpress-media.com/kf/example.jpg",
    tax_type: "DUTY",
    hs_code: "2101112126",
    language: "zh_CN",
    source: "ISV",
    title: "jx test cn and not cn",
    extend_info: { title_non_english: false },
    scene: "new_product",
    item_id: "1005008551953038",
    category_list_json: JSON.stringify([
      { categoryId: 21, categoryName: "Office & School Supplies", isLeaf: false },
      { categoryId: 100003155, categoryName: "Notebooks & Writing Pads", isLeaf: false },
      { categoryId: 200001789, categoryName: "Planners", isLeaf: true },
    ]),
    seller_id: 200042360,
    element_map: {
      "Brand Name": "NoEnName_Null",
      Origin: "Mainland China",
    },
  }),
  "ae-hscode-regulatory-attributes-options": stringifyTemplate({
    language: "zh_CN",
    source: "ISV",
    title: "9-36V24V12V to 12V13.8V15V19V24V28V voltage regulator module",
    extend_info: { title_non_english: false },
    scene: "new_product",
    item_id: "1005008819315485",
    seller_id: 200042360,
    image_url: "https://ae01.alicdn.com/kf/example.jpg",
    tax_type: "DUTY",
    category_list_json: JSON.stringify([
      { categoryId: 21, categoryName: "Office & School Supplies", isLeaf: false },
      { categoryId: 200001789, categoryName: "Planners", isLeaf: true },
    ]),
    selected_property_value_list_json: JSON.stringify([
      {
        valueId: "3188",
        valueName: "Notebooks, Memo Pads",
        propertyName: "Product name",
        propertyId: "731",
      },
    ]),
    element_map: {
      "Brand Name": "SZDULI",
      Origin: "Mainland China",
    },
  }),
  "ae-fund-recipet-flowdetail-query": stringifyTemplate({
    orderId: "123",
    pageSize: 20,
    receiptFlowTypes: [],
    pageNo: 1,
    currency: "USD",
    startTimestamp: 1680862820049,
    endTimestamp: 1685862820059,
  }),
  "ae-fund-recipet-config-query": stringifyTemplate({}),
  "ae-fund-recipet-debt-query": stringifyTemplate({}),
  "ae-customize-product-info-query": stringifyTemplate({
    param0: {
      locale: "en_US",
      customize_info_id: "123",
    },
  }),
  "ae-customize-product-template-query": stringifyTemplate({
    param0: {
      item_id: "123",
      sku_id: "123",
      locale: "en_US",
    },
  }),
  "ae-customize-product-info-audit-result-query": stringifyTemplate({
    param0: {
      customize_info_id: "123",
    },
  }),
  "ae-customize-product-info-create": stringifyTemplate({
    param0: {
      locale: "en_US",
      customize_template: {
        item_id: "123",
        sku_id: "123",
        customize_template_id: "1234",
        pic_url: "https://example.com/template.jpeg",
        pic_width: "600",
        pic_height: "600",
        customize_template_items: [
          {
            type: "image",
            title: "image 1",
            max_size: "3072",
            order: "1",
            limit_rect_f: {
              container_height: "600",
              top: "186",
              left: "165",
              width: "185",
              container_width: "600",
              height: "185",
            },
          },
        ],
      },
      customize_info: {
        customize_pic_url: "https://example.com/result.png",
        snapshot_customize_template_id: "123",
        customize_info_id: "12345",
        customize_info_items: [
          {
            type: "text",
            order: "1",
            content_value: "hello",
            lint_text: "Please upload a JPEG or PNG file up to 3 MB.",
            content_sniping_url: "https://example.com/sniping.png",
            content_rect_f: {
              container_height: "600",
              top: "0",
              left: "47",
              width: "87",
              container_width: "600",
              height: "185",
            },
          },
        ],
      },
    },
  }),
  "ae-local-cb-product-prices-edit": stringifyTemplate({
    product_id: 10123123123,
    channel: "AE_GLOBAL",
    channel_seller_id: 6046768601,
    sku_id2_price_map: {
      "14:193": "0.6",
      "14:175": "0.9",
    },
  }),
  "ae-local-cb-product-status-update": stringifyTemplate({
    channel: "AE_GLOBAL",
    product_opt_type: "ON_SHELF",
    channel_seller_id: 6046768601,
    product_id: 101232323232,
  }),
  "ae-local-cb-product-edit": stringifyTemplate({
    channel: "AE_GLOBAL",
    channel_seller_id: 6046768601,
    local_cb_product_dto: {
      product_info_dto: {
        product_id: "1001231321",
        category_id: "349",
        locale: "ko_KR",
        currency_code: "USD",
      },
      product_property_list: [],
      product_sku_list: [],
      detail_source_list: [],
    },
  }),
  "ae-local-cb-products-list": stringifyTemplate({
    channel_seller_id: 6046768601,
    channel: "AE_GLOBAL",
    page_size: 20,
    current_page: 1,
    search_condition_do: {
      product_status: "ONLINE",
      product_id: "100012313213",
    },
  }),
  "ae-local-cb-product-post": stringifyTemplate({
    channel_seller_id: "6046768601",
    channel: "AE_GLOBAL",
    local_cb_product_dto: {
      product_info_dto: {
        category_id: "349",
        locale: "ko_KR",
        currency_code: "USD",
      },
      product_property_list: [],
      product_sku_list: [],
      detail_source_list: [],
    },
  }),
  "ae-local-cb-products-stock-edit": stringifyTemplate({
    product_id: 100010231231,
    channel: "AE_GLOBAL",
    channel_seller_id: 6046768601,
    sku_stocks: {
      "14:200003699;5:100014064": 240,
      "14:200003699;5:361386": 220,
    },
  }),
  "ae-local-cb-product-query": stringifyTemplate({
    channel_seller_id: 6046768601,
    product_id: 1005005246838039,
    channel: "AE_GLOBAL",
  }),
  "ae-category-child-attributes-query": stringifyTemplate({
    channel_seller_id: 2671514005,
    channel: "AE_GLOBAL",
    locale: "en_US",
    product_type: "2",
    param1: 349,
    param2: ["219=9441741844"],
  }),
  "ae-category-tree-list": stringifyTemplate({
    channel_seller_id: 2671514005,
    only_with_permission: true,
    channel: "AE_GLOBAL",
    category_id: 0,
  }),
  "ae-category-item-qualification-list": stringifyTemplate({
    category_id: 200001426,
    local: "zh_CN",
    channel_seller_id: 2678881002,
  }),
  "ae-category-cascade-properties-query": stringifyTemplate({
    locale: "en_US",
    category_id: 123,
  }),
  "ae-solution-sku-attribute-query": stringifyTemplate({
    query_sku_attribute_info_request: {
      category_id: 5090301,
      channel: "AE_GLOBAL",
      locale: "en_US",
    },
  }),
  "ae-seller-category-tree-query": stringifyTemplate({
    category_id: 509,
    filter_no_permission: true,
  }),
  "ae-category-qualifications-list": stringifyTemplate({
    category_id: 200001426,
    local: "zh_CN",
    channel_seller_id: 26710008,
  }),
  "ae-freight-seller-intention-query": stringifyTemplate({
    sellerId: 200042360,
  }),
  "ae-freight-isv-gray-query": stringifyTemplate({
    sellerId: 200042360,
  }),
  "ae-freight-template-recommend": stringifyTemplate({
    sellerId: 200042360,
    compressFlag: "true",
    compressedData: "H4sIAAAAAAAAA+3BMQEAAADCoPVPbQ0PoAAAAAAAAAAA",
  }),
  "ae-freight-template-create": stringifyTemplate({
    sellerId: "200042360",
    compressFlag: "true",
    itemId: "1005010585507583",
    freightId: "50164494212",
    itemTagSet: "1",
    taxType: "1",
    baseShippingCountries: "BG,UA,HU,US",
    freeShippingCountries: "BG,UA,HU,US",
    itemBlackShippingCountries: "AU",
    regionalPricingCountries: "BG,UA,HU,US",
    currency: "USD",
    compressedData: "1",
  }),
  "ae-freight-template-list": stringifyTemplate({
    channelSellerId: "123",
  }),
  "ae-trade-order-decrypt": stringifyTemplate({
    orderId: "8152891820014001",
    oaid: "MjAwMDQyMzYw-ssfsvnL3Nv%2B%2B54ABsv%2BaoQ",
  }),
  "ae-solution-order-receiptinfo-get": stringifyTemplate({
    param1: {
      order_id: "123456789",
    },
  }),
  "ae-solution-order-get": stringifyTemplate({
    create_date_start: "2017-10-12 12:12:12",
    create_date_end: "2017-10-12 12:12:12",
    modified_date_start: "2017-10-12 12:12:12",
    modified_date_end: "2017-10-12 12:12:12",
    order_status_list: ["SELLER_PART_SEND_GOODS"],
    buyer_login_id: "test_id",
    page_size: 20,
    current_page: 1,
    order_status: "SELLER_PART_SEND_GOODS",
  }),
  "ae-trade-verifycode": stringifyTemplate({
    param_1: {
      code: "1Q2W3E",
      biz_type: "mart",
      order_id: "12345678",
    },
  }),
  "ae-trade-confirmshippingmode": stringifyTemplate({
    order_id: 12345,
    shipping_mode: "SELF_SHIPPING",
  }),
  "ae-trade-sendcode": stringifyTemplate({
    param_1: {
      biz_type: "mega",
      order_id: "1111111",
      send_code_list: [
        {
          order_line_id: "1111112",
          code_list: [
            { code: "xxxxx", expire_time: "1744371921000" },
          ],
        },
      ],
    },
  }),
  "ae-asf-local2local-sub-declareship": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    sellerId: 1001,
    subTradeOrderList: [
      {
        sendType: "offline",
        tradeOrderLineId: "tradeOrderLineId",
        shipmentList: [
          { carrierCode: "carrierCode", logisticsNo: "logisticsNo", serviceName: "serviceName" },
        ],
      },
    ],
  }),
  "ae-asf-dbs-declareship": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    shipmentProviderCode: "shipmentProviderCode",
    trackingNumber: "trackingNumber",
    tradeOrderItemIdList: [{ tradeOrderItemId: "tradeOrderItemId" }],
    locale: "fr_FR",
    carrierCode: "carrierCode",
  }),
  "ae-asf-local2local-self-pickup-declareship": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    tradeOrderLineList: ["1109917450146008"],
    sellerId: 1001,
  }),
  "ae-asf-dbs-declare-ship-modify": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    newShipmentProviderCode: "SPAIN_LOCAL_CORREOORDINARIO",
    newTrackingNumber: "newTrackingNumber",
    locale: "es_ES",
    oldTrackingNumber: "oldTrackingNumber",
    carrierCode: "carrierCode",
  }),
  "ae-asf-shipment-pack": stringifyTemplate({
    tradeOrderId: 123,
    tradeOrderItemIdList: [{ tradeOrderItemId: "123" }],
    addressId: "3000012313213",
    sendOption: "DOOR_PICKUP",
    locale: "en_US",
    solutionCode: "AE_KR_DBS_Hanjin",
  }),
  "ae-asf-order-shipping-service-get": stringifyTemplate({
    tradeOrderId: 123,
    locale: "fr_FR",
    tradeOrderItemIdList: [123],
  }),
  "ae-asf-package-shipping-service-get": stringifyTemplate({
    locale: "es_ES",
    tradeOrderId: 123,
    tradeOrderItemIdList: [123],
    pageSize: 20,
    pageNo: 1,
  }),
  "ae-asf-local2local-split-quantity-rts-pack": stringifyTemplate({
    sellerId: "sellerId",
    tradeOrderId: 123,
    tradeOrderItemSupportItemDTOS: [{ quantity: "1", tradeOrderItemId: "tradeOrderItemId" }],
    addressId: 3000012313213,
    refundAddressId: "refundAddressId",
    sendOption: "sendOption",
    solutionCode: "solutionCode",
  }),
  "ae-asf-platform-logistics-document-query": stringifyTemplate({
    documentType: "WAY_BILL",
    queryDocumentRequestList: [{ tradeOrderId: "1116072020216440", packageId: "FP1112612851119001", trackingNumber: "AN260041745BR" }],
    locale: "fr_FR",
  }),
  "ae-asf-platform-logistics-rts": stringifyTemplate({
    packageId: "packageId",
    tradeOrderId: 123,
    locale: "es_ES",
    trackingNumber: "trackingNumber",
  }),
  "ae-asf-platform-logistics-repack": stringifyTemplate({
    tradeOrderId: 123,
    locale: "es_ES",
    trackingNumber: "trackingNumber",
    packageId: "packageId",
  }),
  "ae-asf-local-unreachable-preference-query": stringifyTemplate({
    countryCode: "TG",
    locale: "fr_FR",
  }),
  "ae-asf-seller-address-get": stringifyTemplate({
    addressType: "pickup,refund",
    locale: "fr_FR",
  }),
  "ae-asf-local-unreachable-preference-update": stringifyTemplate({
    countryCode: "TG",
    locale: "fr_FR",
    dealType: "DESTROY",
  }),
  "ae-asf-local2local-transfer-to-offline": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    sellerId: 1001,
    packageId: "FP23111111879810480",
    subTradeOrderList: [
      {
        tradeOrderLineId: "tradeOrderLineId",
        shipmentList: [
          { quantity: "1", carrierCode: "carrierCode", logisticsNo: "logisticsNo", serviceName: "serviceName" },
        ],
      },
    ],
  }),
  "ae-asf-fulfillment-package-query": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    locale: "es_ES",
    packageId: "packageId",
    createStartTime: "1756349803958",
    createEndTime: "1756349803958",
    current: "1",
    pageSize: "20",
  }),
  "ae-asf-local-supply-shipping-service-get": stringifyTemplate({
    tradeOrderId: 1116072020216440,
    tradeOrderItemIdList: [1116072020216441],
    sellerId: 200042360,
  }),
  "ae-asf-local-supply-batch-declareship": stringifyTemplate({
    sellerId: 200042360,
    declareShipOpenRequestList: [
      {
        tradeOrderId: "tradeOrderId",
        tradeOrderItemIdList: ["tradeOrderItemIdList"],
        carrierCode: "carrierCode",
        shippingServiceCode: "shippingServiceCode",
        trackingNumber: "trackingNumber",
      },
    ],
  }),
  "ae-asf-local-supply-declareship-modify": stringifyTemplate({
    tradeOrderId: 1116072020216440,
    tradeOrderItemIdList: [1116072020216441],
    trackingNumber: "trackingNumber",
    modifyTrackingNumber: "modifyTrackingNumber",
    modifyShippingServiceCode: "modifyShippingServiceCode",
    sellerId: 200042360,
    carrierCode: "carrierCode",
  }),
  "ae-asf-local-supply-sub-declareship": stringifyTemplate({
    tradeOrderId: "tradeOrderId",
    sellerId: 200042360,
    subTradeOrderList: [
      {
        sendType: "sendType",
        tradeOrderLineId: "tradeOrderLineId",
        shipmentList: [
          {
            carrierCode: "carrierCode",
            logisticsNo: "logisticsNo",
            serviceName: "serviceName",
          },
        ],
      },
    ],
  }),
  "ae-asf-local-supply-split-quantity-rts-pack": stringifyTemplate({
    sellerId: "sellerId",
    tradeOrderId: 1116072020216440,
    tradeOrderItemSupportItemDTOS: [
      { quantity: "1", tradeOrderItemId: "tradeOrderItemId" },
    ],
    addressId: 3000012313213,
    refundAddressId: "refundAddressId",
    sendOption: "sendOption",
    solutionCode: "solutionCode",
  }),
  "ae-asf-local-supply-platform-logistics-document-query": stringifyTemplate({
    documentType: "WAY_BILL",
    queryDocumentRequestList: [
      {
        tradeOrderId: "1116072020216440",
        packageId: "FP1112612851119001",
        trackingNumber: "AN260041745BR",
      },
    ],
    locale: "es_ES",
  }),
  "ae-asf-local-supply-platform-logistics-rts": stringifyTemplate({
    packageId: "packageId",
    tradeOrderId: 1116072020216440,
    locale: "es_ES",
    trackingNumber: "trackingNumber",
  }),
  "ae-asf-local-supply-platform-logistics-repack": stringifyTemplate({
    packageId: "packageId",
    tradeOrderId: 1116072020216440,
    locale: "es_ES",
    trackingNumber: "trackingNumber",
  }),
  "ae-asf-local-supply-seller-address-get": stringifyTemplate({
    addressType: "pickup,refund",
    locale: "es_ES",
  }),
  "ae-local-service-product-stocks-update": stringifyTemplate({
    channel_seller_id: 2671514005,
    product_id: 1005005080449315,
    channel: "AE_GLOBAL",
    product_sku_stock_list: [
      {
        sku_id: "12000031565399476",
        sku_warehouse_stock_list: [
          { warehouse_type: "dropshipping", warehouse_code: "dropshipping", sellable_quantity: "100" },
        ],
      },
    ],
  }),
  "ae-local-service-product-stocks-query": stringifyTemplate({
    channel_seller_id: 2678881002,
    product_id: 1005005080449184,
    channel: "AE_GLOBAL",
  }),
  "ae-local-service-products-list": stringifyTemplate({
    channel_seller_id: 2678881002,
    channel: "AE_GLOBAL",
    page_size: 20,
    current_page: 1,
    search_condition_do: {
      product_status: "ONLINE",
      product_id: "123423",
    },
  }),
  "ae-local-service-product-prices-edit": stringifyTemplate({
    channel_seller_id: 2671514005,
    product_id: 1005005080449315,
    channel: "AE_GLOBAL",
    sku_price_model_list: [
      {
        sku_id: "1233222211",
        supply_price: "12.32",
        dim_supply_price_list: [{ country_code: "ES", country_supply_price: "233.2" }],
      },
    ],
  }),
  "ae-local-service-product-post": stringifyTemplate({
    channel: "AE_GLOBAL",
    channel_seller_id: 2678881002,
    local_service_product_dto: {
      product_info_dto: { category_id: "623", locale: "en_US", currency_code: "CNY" },
      product_sku_list: [],
      product_property_list: [],
      detail_source_list: [],
    },
  }),
  "ae-local-service-product-edit": stringifyTemplate({
    channel: "AE_GLOBAL",
    channel_seller_id: 2678881002,
    local_service_product_dto: {
      product_info_dto: { product_id: "1003222112233", category_id: "623", locale: "en_US", currency_code: "CNY" },
      product_sku_list: [],
      product_property_list: [],
      detail_source_list: [],
    },
  }),
  "ae-local-service-product-query": stringifyTemplate({
    channel_seller_id: 2678881002,
    product_id: 1005005246838039,
    channel: "AE_GLOBAL",
  }),
  "ae-local-service-product-status-update": stringifyTemplate({
    channel_seller_id: "2678881002",
    product_id: "123",
    channel: "AE_GLOBAL",
    product_opt_type: "ON_SHELF",
  }),
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingImportPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const supportedIopOperations = platform === "aliexpress" ? ALIEXPRESS_IOP_OPERATIONS : ALIBABA_IOP_OPERATIONS;
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [supplierAccountId, setSupplierAccountId] = useState("");
  const [externalProductId, setExternalProductId] = useState("");
  const [lookupType, setLookupType] = useState<"product_id" | "sku_id">("product_id");
  const [remoteMode, setRemoteMode] = useState<"standard" | "ds_product" | "ds_wholesale">(platform === "aliexpress" ? "ds_product" : "standard");
  const [dsShipToCountry, setDsShipToCountry] = useState("TG");
  const [dsTargetCurrency, setDsTargetCurrency] = useState("USD");
  const [dsTargetLanguage, setDsTargetLanguage] = useState("fr");
  const [dsRemovePersonalBenefit, setDsRemovePersonalBenefit] = useState(false);
  const [searchModelNumber, setSearchModelNumber] = useState("");
  const [searchSkuCode, setSearchSkuCode] = useState("");
  const [remoteResults, setRemoteResults] = useState<RemoteSearchResult[]>([]);
  const [searchingRemote, setSearchingRemote] = useState(false);
  const [externalOfferId, setExternalOfferId] = useState("");
  const [title, setTitle] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [autoCreateStorefrontProduct, setAutoCreateStorefrontProduct] = useState(platform === "aliexpress");
  const [publishStorefrontProduct, setPublishStorefrontProduct] = useState(false);
  const [usdToXofRate, setUsdToXofRate] = useState("620");
  const [remoteProductData, setRemoteProductData] = useState<RemoteProductPayload | null>(null);
  const [predictionDescription, setPredictionDescription] = useState("");
  const [predictingCategory, setPredictingCategory] = useState(false);
  const [predictedCategory, setPredictedCategory] = useState<CategoryPrediction | null>(null);
  const [videoPath, setVideoPath] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoCover, setVideoCover] = useState("");
  const [videoRequestId, setVideoRequestId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [videoProductId, setVideoProductId] = useState("");
  const [videoUploadResult, setVideoUploadResult] = useState<VideoUploadResult | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [checkingVideoResult, setCheckingVideoResult] = useState(false);
  const [queryingVideos, setQueryingVideos] = useState(false);
  const [attachingVideo, setAttachingVideo] = useState(false);
  const [buyerInsertReq, setBuyerInsertReq] = useState(BUYER_ITEM_TEMPLATES.add);
  const [buyerUpdateReq, setBuyerUpdateReq] = useState(BUYER_ITEM_TEMPLATES.update);
  const [buyerDeleteReq, setBuyerDeleteReq] = useState(BUYER_ITEM_TEMPLATES.delete);
  const [buyerQueryReq, setBuyerQueryReq] = useState(BUYER_ITEM_TEMPLATES.query);
  const [buyerItems, setBuyerItems] = useState<BuyerItemSummary[]>([]);
  const [buyerRawResponse, setBuyerRawResponse] = useState("");
  const [runningBuyerAction, setRunningBuyerAction] = useState<"add" | "update" | "delete" | "query" | null>(null);
  const [buyerEcoOperation, setBuyerEcoOperation] = useState<BuyerEcoOperation>("product-description");
  const [buyerEcoPayload, setBuyerEcoPayload] = useState(BUYER_ECO_TEMPLATES["product-description"]);
  const [buyerEcoRawResponse, setBuyerEcoRawResponse] = useState("");
  const [runningBuyerEco, setRunningBuyerEco] = useState(false);
  const [iopOperation, setIopOperation] = useState<IopOperation>(platform === "aliexpress" ? "ae-affiliate-product-query" : "advanced-freight-calculate");
  const [iopPayload, setIopPayload] = useState(IOP_TEMPLATES[platform === "aliexpress" ? "ae-affiliate-product-query" : "advanced-freight-calculate"]);
  const [iopRawResponse, setIopRawResponse] = useState("");
  const [runningIop, setRunningIop] = useState(false);
  const [attachmentFileName, setAttachmentFileName] = useState("waybill.jpg");
  const [attachmentBase64, setAttachmentBase64] = useState("");
  const [attachmentResponse, setAttachmentResponse] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [fetchingRemote, setFetchingRemote] = useState(false);
  const [skusJson, setSkusJson] = useState(
    JSON.stringify(
      [
        {
          external_sku_id: "sku-001",
          sku_label: "Noir / USB-C",
          moq: 10,
          unit_price: 12.5,
          currency_code: "USD",
          available_quantity: 250,
          lead_time_days: 7,
          variant_attributes_json: { color: "black", connector: "usb-c" },
          logistics_modes_json: ["air", "sea"],
        },
      ],
      null,
      2,
    ),
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/sourcing/supplier-accounts?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
        fetch(`${API_BASE}/admin/sourcing/supplier-products?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
      ]);
      if (!accountsRes.ok || !productsRes.ok) throw new Error(`Impossible de charger les données d’import ${platformLabel}`);
      const accountsPayload = await accountsRes.json();
      const productsPayload = await productsRes.json();
      setAccounts(Array.isArray(accountsPayload?.data) ? accountsPayload.data : []);
      setProducts(Array.isArray(productsPayload?.data) ? productsPayload.data : []);
    } catch (err) {
      setError(`Impossible de charger les données d’import ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!supplierAccountId && accounts.length) setSupplierAccountId(String(accounts[0].id));
  }, [accounts, supplierAccountId]);

  useEffect(() => {
    setBuyerEcoPayload(BUYER_ECO_TEMPLATES[buyerEcoOperation]);
  }, [buyerEcoOperation]);

  useEffect(() => {
    setIopPayload(IOP_TEMPLATES[iopOperation]);
  }, [iopOperation]);

  useEffect(() => {
    const defaultOperation = platform === "aliexpress" ? "ae-affiliate-product-query" : "advanced-freight-calculate";
    setIopOperation(defaultOperation);
    setIopPayload(IOP_TEMPLATES[defaultOperation]);
    setRemoteMode(platform === "aliexpress" ? "ds_product" : "standard");
    setAutoCreateStorefrontProduct(platform === "aliexpress");
  }, [platform]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const parsedSkus = JSON.parse(skusJson);
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          external_product_id: externalProductId.trim(),
          external_offer_id: externalOfferId.trim() || undefined,
          title: title.trim(),
          supplier_name: supplierName.trim() || undefined,
          source_url: sourceUrl.trim() || undefined,
          main_image_url: mainImageUrl.trim() || undefined,
          category_path_json: remoteProductData?.category_path_json ?? undefined,
          attributes_json: remoteProductData?.attributes_json ?? undefined,
          product_payload_json: remoteProductData?.product_payload_json ?? undefined,
          _storefront_defaults: remoteProductData?._storefront_defaults ?? undefined,
          auto_create_storefront_product: autoCreateStorefrontProduct || undefined,
          publish_storefront_product: publishStorefrontProduct || undefined,
          usd_to_xof_rate: usdToXofRate.trim() ? Number(usdToXofRate) : undefined,
          skus: parsedSkus,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Import impossible");
      }
      const payload = await res.json().catch(() => null);
      const storefrontProductId = payload?.storefront?.product?.id;
      setSuccess(storefrontProductId ? `Produit importé et ajouté au site (#${storefrontProductId}).` : "Catalogue fournisseur importé.");
      setExternalProductId("");
      setExternalOfferId("");
      setTitle("");
      setSupplierName("");
      setSourceUrl("");
      setMainImageUrl("");
      setRemoteProductData(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? "Import impossible. Vérifie le JSON des SKU.");
    }
  };

  const fetchRemoteProduct = async () => {
    setError("");
    setSuccess("");
    setPredictedCategory(null);
    if (!supplierAccountId || !externalProductId.trim()) {
      setError("Sélectionne un compte fournisseur et renseigne un external product ID.");
      return;
    }

    setFetchingRemote(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/fetch-remote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          external_product_id: externalProductId.trim(),
          lookup_type: lookupType,
          remote_mode: remoteMode,
          ship_to_country: dsShipToCountry.trim() || undefined,
          target_currency: dsTargetCurrency.trim() || undefined,
          target_language: dsTargetLanguage.trim() || undefined,
          remove_personal_benefit: dsRemovePersonalBenefit,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Chargement API impossible");
      }
      const payload = await res.json();
      const product = payload?.data as RemoteProductPayload | undefined;
      setExternalOfferId(product?.external_offer_id || "");
      setTitle(product?.title || "");
      setSupplierName(product?.supplier_name || "");
      setSourceUrl(product?.source_url || "");
      setMainImageUrl(product?.main_image_url || "");
      setSkusJson(JSON.stringify(product?.skus ?? [], null, 2));
      setRemoteProductData(product ?? null);
      setSuccess("Produit fournisseur chargé depuis l’API et formulaire prérempli.");
    } catch (err: any) {
      setError(err?.message ?? "Chargement API impossible");
    } finally {
      setFetchingRemote(false);
    }
  };

  const searchRemoteProducts = async () => {
    setError("");
    setSuccess("");
    setRemoteResults([]);
    if (!supplierAccountId || (!searchModelNumber.trim() && !searchSkuCode.trim())) {
      setError("Renseigne un compte fournisseur et au moins un model number ou sku code.");
      return;
    }

    setSearchingRemote(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/search-remote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          model_number: searchModelNumber.trim() || undefined,
          sku_code: searchSkuCode.trim() || undefined,
          page_index: 1,
          page_size: 10,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Recherche API impossible");
      }
      const payload = await res.json();
      setRemoteResults(Array.isArray(payload?.data) ? payload.data : []);
      setSuccess("Recherche fournisseur terminée.");
    } catch (err: any) {
      setError(err?.message ?? "Recherche API impossible");
    } finally {
      setSearchingRemote(false);
    }
  };

  const predictCategory = async () => {
    setError("");
    setSuccess("");
    setPredictedCategory(null);
    if (!supplierAccountId || !title.trim()) {
      setError("Sélectionne un compte fournisseur et renseigne un titre pour la prédiction de catégorie.");
      return;
    }

    setPredictingCategory(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/predict-category`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          title: title.trim(),
          description: predictionDescription.trim() || undefined,
          image: mainImageUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Prédiction catégorie impossible");
      }
      const payload = await res.json();
      setPredictedCategory(payload?.data ?? null);
      setSuccess("Prédiction de catégorie récupérée.");
    } catch (err: any) {
      setError(err?.message ?? "Prédiction catégorie impossible");
    } finally {
      setPredictingCategory(false);
    }
  };

  const uploadVideo = async () => {
    setError("");
    setSuccess("");
    setVideoUploadResult(null);
    if (!supplierAccountId || !videoPath.trim() || !videoName.trim()) {
      setError("Renseigne un compte fournisseur, une URL vidéo et un nom de vidéo.");
      return;
    }

    setUploadingVideo(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/videos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          video_path: videoPath.trim(),
          video_name: videoName.trim(),
          video_cover: videoCover.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Upload vidéo impossible");
      }
      const payload = await res.json();
      setVideoUploadResult(payload?.data ?? null);
      setVideoRequestId(payload?.data?.request_id || "");
      setVideoId(payload?.data?.video_id || "");
      setSuccess(`Upload vidéo déclenché côté ${platformLabel}.`);
    } catch (err: any) {
      setError(err?.message ?? "Upload vidéo impossible");
    } finally {
      setUploadingVideo(false);
    }
  };

  const checkVideoUploadResult = async () => {
    setError("");
    setSuccess("");
    if (!supplierAccountId || !videoRequestId.trim()) {
      setError("Renseigne un compte fournisseur et un req_id vidéo.");
      return;
    }

    setCheckingVideoResult(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/videos/upload-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          req_id: videoRequestId.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Suivi upload vidéo impossible");
      }
      const payload = await res.json();
      setVideoUploadResult(payload?.data ?? null);
      setVideoId(payload?.data?.video_id || videoId);
      setSuccess("Statut d’upload vidéo récupéré.");
    } catch (err: any) {
      setError(err?.message ?? "Suivi upload vidéo impossible");
    } finally {
      setCheckingVideoResult(false);
    }
  };

  const queryVideos = async () => {
    setError("");
    setSuccess("");
    setRemoteVideos([]);
    if (!supplierAccountId) {
      setError("Sélectionne un compte fournisseur.");
      return;
    }

    setQueryingVideos(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/videos/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          current_page: 1,
          page_size: 10,
          video_id: videoId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Liste vidéo impossible");
      }
      const payload = await res.json();
      setRemoteVideos(Array.isArray(payload?.data?.items) ? payload.data.items : []);
      setSuccess(`Liste des vidéos ${platformLabel} récupérée.`);
    } catch (err: any) {
      setError(err?.message ?? "Liste vidéo impossible");
    } finally {
      setQueryingVideos(false);
    }
  };

  const attachVideoMain = async () => {
    setError("");
    setSuccess("");
    if (!supplierAccountId || !videoId.trim() || !videoProductId.trim()) {
      setError("Renseigne un compte fournisseur, un video_id et un product_id Alibaba.");
      return;
    }

    setAttachingVideo(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/videos/attach-main`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          video_id: videoId.trim(),
          product_id: videoProductId.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Liaison vidéo produit impossible");
      }
      const payload = await res.json();
      setSuccess(payload?.data?.success ? "Vidéo liée comme vidéo principale du produit." : "Réponse reçue, vérifie le détail du provider.");
    } catch (err: any) {
      setError(err?.message ?? "Liaison vidéo produit impossible");
    } finally {
      setAttachingVideo(false);
    }
  };

  const runBuyerAction = async (action: "add" | "update" | "delete" | "query") => {
    setError("");
    setSuccess("");
    setBuyerRawResponse("");
    if (!supplierAccountId) {
      setError("Sélectionne un compte fournisseur.");
      return;
    }

    const config = {
      add: { endpoint: "buyer-items/add", key: "insertReq", raw: buyerInsertReq },
      update: { endpoint: "buyer-items/update", key: "updateReq", raw: buyerUpdateReq },
      delete: { endpoint: "buyer-items/delete", key: "deleteReq", raw: buyerDeleteReq },
      query: { endpoint: "buyer-items/query", key: "queryReq", raw: buyerQueryReq },
    }[action];

    setRunningBuyerAction(action);
    try {
      let parsed: unknown = config.raw;
      if (action !== "query" || config.raw.trim().startsWith("{") || config.raw.trim().startsWith("[")) {
        parsed = JSON.parse(config.raw);
      }

      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/${config.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          [config.key]: parsed,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Action buyer solution impossible");
      }

      const payload = await res.json();
      setBuyerRawResponse(JSON.stringify(payload?.data?.raw ?? payload?.data ?? {}, null, 2));
      if (action === "query") {
        setBuyerItems(Array.isArray(payload?.data?.items) ? payload.data.items : []);
      }
      setSuccess(`Action buyer solution ${action} terminée.`);
    } catch (err: any) {
      setError(err?.message ?? "Action buyer solution impossible");
    } finally {
      setRunningBuyerAction(null);
    }
  };

  const runBuyerEcoOperation = async () => {
    setError("");
    setSuccess("");
    setBuyerEcoRawResponse("");
    if (!supplierAccountId) {
      setError("Sélectionne un compte fournisseur.");
      return;
    }

    setRunningBuyerEco(true);
    try {
      let parsedPayload: unknown = buyerEcoPayload;
      if (buyerEcoPayload.trim().startsWith("{") || buyerEcoPayload.trim().startsWith("[")) {
        parsedPayload = JSON.parse(buyerEcoPayload);
      }

      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/buyer-eco/${buyerEcoOperation}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          request_payload: parsedPayload,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Opération buyer eco impossible");
      }

      const payload = await res.json();
      setBuyerEcoRawResponse(JSON.stringify(payload?.data?.raw ?? payload?.data ?? {}, null, 2));
      setSuccess(`Opération buyer eco ${buyerEcoOperation} terminée.`);
    } catch (err: any) {
      setError(err?.message ?? "Opération buyer eco impossible");
    } finally {
      setRunningBuyerEco(false);
    }
  };

  const runIopOperation = async () => {
    setError("");
    setSuccess("");
    setIopRawResponse("");
    if (!supplierAccountId) {
      setError("Sélectionne un compte fournisseur.");
      return;
    }

    setRunningIop(true);
    try {
      let parsedPayload: unknown = iopPayload;
      if (iopPayload.trim().startsWith("{") || iopPayload.trim().startsWith("[")) {
        parsedPayload = JSON.parse(iopPayload);
      }

      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/iop/${iopOperation}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          request_payload: parsedPayload,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Opération IOP impossible");
      }

      const payload = await res.json();
      setIopRawResponse(JSON.stringify(payload?.data?.raw ?? payload?.data ?? {}, null, 2));
      setSuccess(`Opération IOP ${iopOperation} terminée.`);
    } catch (err: any) {
      setError(err?.message ?? "Opération IOP impossible");
    } finally {
      setRunningIop(false);
    }
  };

  const uploadOrderAttachment = async () => {
    setError("");
    setSuccess("");
    setAttachmentResponse("");
    if (!supplierAccountId || !attachmentFileName.trim() || !attachmentBase64.trim()) {
      setError("Renseigne un compte fournisseur, un nom de fichier et un contenu base64.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/iop/order-attachment-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          file_name: attachmentFileName.trim(),
          file_content_base64: attachmentBase64.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Upload pièce jointe impossible");
      }

      const payload = await res.json();
      setAttachmentResponse(JSON.stringify(payload?.data ?? {}, null, 2));
      setSuccess("Pièce jointe de commande uploadée.");
    } catch (err: any) {
      setError(err?.message ?? "Upload pièce jointe impossible");
    } finally {
      setUploadingAttachment(false);
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Import catalogue fournisseur vers supplier_products et supplier_product_skus">
      <div className="grid gap-6 xl:grid-cols-[520px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Importer un produit fournisseur</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Compte fournisseur</span>
              <select value={supplierAccountId} onChange={(e) => setSupplierAccountId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label} · {account.platform}</option>
                ))}
              </select>
            </label>
            {platform === "alibaba" ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Recherche fournisseur</h3>
                  <p className="text-xs text-slate-500">Interroge l’API produit distante du compte {platformLabel} sélectionné.</p>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Model number</span>
                  <input value={searchModelNumber} onChange={(e) => setSearchModelNumber(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">SKU code</span>
                  <input value={searchSkuCode} onChange={(e) => setSearchSkuCode(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <button type="button" onClick={searchRemoteProducts} disabled={searchingRemote} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {searchingRemote ? "Recherche..." : "Chercher dans le catalogue fournisseur"}
                </button>
                {remoteResults.length ? (
                  <div className="grid gap-2">
                    {remoteResults.map((result) => (
                      <button
                        key={`${result.external_product_id}-${result.sku_code ?? "na"}`}
                        type="button"
                        onClick={() => {
                          setExternalProductId(result.external_product_id || "");
                          setTitle(result.title || "");
                          setMainImageUrl(result.main_image_url || "");
                          setLookupType("product_id");
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left"
                      >
                        <div className="text-sm font-medium text-slate-900">{result.title || "Produit"}</div>
                        <div className="mt-1 text-xs text-slate-500">ID: {result.external_product_id || "—"} · SKU: {result.sku_code || "—"}</div>
                        <div className="text-xs text-slate-500">{result.category_name || "Sans catégorie"} · {result.status || "statut inconnu"}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">External product ID</span>
              <input value={externalProductId} onChange={(e) => setExternalProductId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
              <span className="text-xs text-slate-500">{platform === "aliexpress" ? "Pour AliExpress DS, renseigne l’item id du produit." : "Pour Alibaba ICBU v2, renseigne le product_id ou le sku_id selon le mode choisi ci-dessous."}</span>
            </label>
            {platform === "aliexpress" ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Source produit AliExpress</h3>
                  <p className="text-xs text-slate-500">Charge un produit DS standard ou wholesale, puis importe-le directement dans le site.</p>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Mode distant</span>
                  <select value={remoteMode} onChange={(e) => setRemoteMode(e.target.value as "standard" | "ds_product" | "ds_wholesale")} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <option value="ds_product">DS product</option>
                    <option value="ds_wholesale">DS wholesale</option>
                    <option value="standard">Standard product info</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Ship to</span>
                    <input value={dsShipToCountry} onChange={(e) => setDsShipToCountry(e.target.value.toUpperCase())} className="rounded-xl border border-slate-200 bg-white px-3 py-2" maxLength={2} />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Currency</span>
                    <input value={dsTargetCurrency} onChange={(e) => setDsTargetCurrency(e.target.value.toUpperCase())} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Language</span>
                    <input value={dsTargetLanguage} onChange={(e) => setDsTargetLanguage(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={dsRemovePersonalBenefit} onChange={(e) => setDsRemovePersonalBenefit(e.target.checked)} />
                  Retirer les promotions personnelles
                </label>
              </div>
            ) : (
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Mode de lecture API</span>
                <select value={lookupType} onChange={(e) => setLookupType(e.target.value as "product_id" | "sku_id")} className="rounded-xl border border-slate-200 px-3 py-2">
                  <option value="product_id">product_id</option>
                  <option value="sku_id">sku_id</option>
                </select>
              </label>
            )}
            <button type="button" onClick={fetchRemoteProduct} disabled={fetchingRemote} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              {fetchingRemote ? "Chargement API..." : "Préremplir depuis l’API fournisseur"}
            </button>
            {platform === "aliexpress" ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Ajout au site</h3>
                  <p className="text-xs text-slate-500">Crée aussi le produit storefront et le mapping par défaut pendant l’import.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={autoCreateStorefrontProduct} onChange={(e) => setAutoCreateStorefrontProduct(e.target.checked)} />
                  Créer le produit sur le site
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={publishStorefrontProduct} onChange={(e) => setPublishStorefrontProduct(e.target.checked)} />
                  Publier immédiatement le produit
                </label>
                <label className="grid gap-1 text-sm sm:max-w-[180px]">
                  <span className="text-slate-600">Taux USD → FCFA</span>
                  <input value={usdToXofRate} onChange={(e) => setUsdToXofRate(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
              </div>
            ) : null}
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">External offer ID</span>
              <input value={externalOfferId} onChange={(e) => setExternalOfferId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Titre</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Nom fournisseur</span>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">URL source</span>
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Image principale</span>
              <input value={mainImageUrl} onChange={(e) => setMainImageUrl(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            {platform === "alibaba" ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Prédiction de catégorie</h3>
                  <p className="text-xs text-slate-500">Utilise `/alibaba/icbu/category/predict/v2` avec le titre, la description optionnelle et l’image principale.</p>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Description pour la prédiction</span>
                  <textarea value={predictionDescription} onChange={(e) => setPredictionDescription(e.target.value)} rows={4} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <button type="button" onClick={predictCategory} disabled={predictingCategory} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {predictingCategory ? "Prédiction..." : "Prédire la catégorie Alibaba"}
                </button>
                {predictedCategory ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <div className="font-medium">{predictedCategory.category_name || "Catégorie non renvoyée"}</div>
                    <div className="text-xs text-amber-800">ID: {predictedCategory.category_id || "—"}</div>
                    <div className="mt-1 text-xs text-amber-800">{predictedCategory.category_path || predictedCategory.message || "Aucun chemin renvoyé"}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {platform === "alibaba" ? (
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Vidéos Alibaba</h3>
                <p className="text-xs text-slate-500">Upload par URL, suivi d’encodage, liste des vidéos et liaison comme vidéo principale du produit.</p>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Video URL</span>
                <input value={videoPath} onChange={(e) => setVideoPath(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Video name</span>
                <input value={videoName} onChange={(e) => setVideoName(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Video cover URL</span>
                <input value={videoCover} onChange={(e) => setVideoCover(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={uploadVideo} disabled={uploadingVideo} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {uploadingVideo ? "Upload vidéo..." : "Envoyer la vidéo"}
                </button>
                <button type="button" onClick={queryVideos} disabled={queryingVideos} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {queryingVideos ? "Chargement vidéos..." : "Lister les vidéos"}
                </button>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">req_id</span>
                <input value={videoRequestId} onChange={(e) => setVideoRequestId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <button type="button" onClick={checkVideoUploadResult} disabled={checkingVideoResult} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                {checkingVideoResult ? "Vérification..." : "Vérifier le statut d’upload"}
              </button>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">video_id</span>
                <input value={videoId} onChange={(e) => setVideoId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">product_id Alibaba</span>
                <input value={videoProductId} onChange={(e) => setVideoProductId(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
              </label>
              <button type="button" onClick={attachVideoMain} disabled={attachingVideo} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                {attachingVideo ? "Liaison..." : "Lier comme vidéo principale"}
              </button>
              {videoUploadResult ? (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                  <div className="font-medium">req_id: {videoUploadResult.request_id || "—"}</div>
                  <div className="text-xs text-sky-800">Statut: {videoUploadResult.request_status || videoUploadResult.msg_code || "—"}</div>
                  <div className="text-xs text-sky-800">video_id: {videoUploadResult.video_id || "—"}</div>
                  <div className="mt-1 text-xs text-sky-800">{videoUploadResult.message || "Aucun message renvoyé"}</div>
                </div>
              ) : null}
              {remoteVideos.length ? (
                <div className="grid gap-2">
                  {remoteVideos.map((remoteVideo) => (
                    <button
                      key={`${remoteVideo.video_id ?? "na"}-${remoteVideo.title ?? "video"}`}
                      type="button"
                      onClick={() => {
                        setVideoId(remoteVideo.video_id || "");
                        setVideoCover(remoteVideo.cover_url || "");
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left"
                    >
                      <div className="text-sm font-medium text-slate-900">{remoteVideo.title || "Vidéo"}</div>
                      <div className="mt-1 text-xs text-slate-500">ID: {remoteVideo.video_id || "—"} · {remoteVideo.status || "statut inconnu"}</div>
                      <div className="text-xs text-slate-500">Qualité: {remoteVideo.quality || "—"} · Durée: {remoteVideo.duration || "—"}</div>
                    </button>
                  ))}
                </div>
              ) : null}
              </div>
            ) : null}
            {platform === "alibaba" ? (
              <>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Buyer Solution</h3>
                    <p className="text-xs text-slate-500">Appels bruts vers `/eco/buyer/item/add`, `/query`, `/update` et `/delete` avec signature côté backend.</p>
                  </div>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">insertReq JSON</span>
                    <textarea value={buyerInsertReq} onChange={(e) => setBuyerInsertReq(e.target.value)} rows={5} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                  <button type="button" onClick={() => setBuyerInsertReq(BUYER_ITEM_TEMPLATES.add)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Recharger le modèle add
                  </button>
                  <button type="button" onClick={() => runBuyerAction("add")} disabled={runningBuyerAction !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {runningBuyerAction === "add" ? "Envoi..." : "Uploader le produit buyer solution"}
                  </button>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">queryReq</span>
                    <textarea value={buyerQueryReq} onChange={(e) => setBuyerQueryReq(e.target.value)} rows={5} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                  <button type="button" onClick={() => setBuyerQueryReq(BUYER_ITEM_TEMPLATES.query)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Recharger le modèle query
                  </button>
                  <button type="button" onClick={() => runBuyerAction("query")} disabled={runningBuyerAction !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {runningBuyerAction === "query" ? "Lecture..." : "Lire les produits buyer solution"}
                  </button>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">updateReq JSON</span>
                    <textarea value={buyerUpdateReq} onChange={(e) => setBuyerUpdateReq(e.target.value)} rows={5} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                  <button type="button" onClick={() => setBuyerUpdateReq(BUYER_ITEM_TEMPLATES.update)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Recharger le modèle update
                  </button>
                  <button type="button" onClick={() => runBuyerAction("update")} disabled={runningBuyerAction !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {runningBuyerAction === "update" ? "Mise à jour..." : "Mettre à jour le produit buyer solution"}
                  </button>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">deleteReq JSON</span>
                    <textarea value={buyerDeleteReq} onChange={(e) => setBuyerDeleteReq(e.target.value)} rows={4} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                  <button type="button" onClick={() => setBuyerDeleteReq(BUYER_ITEM_TEMPLATES.delete)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Recharger le modèle delete
                  </button>
                  <button type="button" onClick={() => runBuyerAction("delete")} disabled={runningBuyerAction !== null} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {runningBuyerAction === "delete" ? "Suppression..." : "Supprimer le produit buyer solution"}
                  </button>
                  {buyerItems.length ? (
                    <div className="grid gap-2">
                      {buyerItems.map((item) => (
                        <div key={`${item.item_id ?? "na"}-${item.isv_item_id ?? "na"}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left">
                          <div className="text-sm font-medium text-slate-900">{item.title || "Produit"}</div>
                          <div className="mt-1 text-xs text-slate-500">item_id: {item.item_id || "—"} · isv_item_id: {item.isv_item_id || "—"}</div>
                          <div className="text-xs text-slate-500">{item.price || "—"} {item.currency || ""} · stock {item.available_quantity || "—"}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {buyerRawResponse ? (
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-600">Réponse brute</span>
                      <textarea value={buyerRawResponse} readOnly rows={10} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                    </label>
                  ) : null}
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Buyer Discovery & Channel</h3>
                    <p className="text-xs text-slate-500">Explorateur brut pour `eco/buyer/product/*`, `item/rec*`, listes local/crossborder et événements de canal.</p>
                  </div>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Opération</span>
                    <select value={buyerEcoOperation} onChange={(e) => setBuyerEcoOperation(e.target.value as BuyerEcoOperation)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <option value="product-description">product-description</option>
                      <option value="product-search">product-search</option>
                      <option value="product-check">product-check</option>
                      <option value="product-cert">product-cert</option>
                      <option value="product-keyattributes">product-keyattributes</option>
                      <option value="product-inventory">product-inventory</option>
                      <option value="crossborder-check">crossborder-check</option>
                      <option value="local-check">local-check</option>
                      <option value="localregular-check">localregular-check</option>
                      <option value="item-rec">item-rec</option>
                      <option value="item-rec-image">item-rec-image</option>
                      <option value="product-events">product-events</option>
                      <option value="channel-batch-import">channel-batch-import</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">request_payload JSON</span>
                    <textarea value={buyerEcoPayload} onChange={(e) => setBuyerEcoPayload(e.target.value)} rows={8} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                  <button type="button" onClick={() => setBuyerEcoPayload(BUYER_ECO_TEMPLATES[buyerEcoOperation])} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Recharger le modèle de l’opération
                  </button>
                  <button type="button" onClick={runBuyerEcoOperation} disabled={runningBuyerEco} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {runningBuyerEco ? "Exécution..." : "Exécuter l’opération buyer eco"}
                  </button>
                  {buyerEcoRawResponse ? (
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-600">Réponse brute</span>
                      <textarea value={buyerEcoRawResponse} readOnly rows={12} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{platform === "aliexpress" ? "AliExpress Affiliate Explorer" : "IOP Orders & Freight"}</h3>
                <p className="text-xs text-slate-500">{platform === "aliexpress" ? "Tests bruts des APIs affiliate AliExpress pour catalogue, SKU, shipping, liens et commandes." : "Calcul de fret, création de commande, paiement, suivi logistique, entrepôts et requêtes ordre Alibaba."}</p>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Opération IOP</span>
                <select value={iopOperation} onChange={(e) => setIopOperation(e.target.value as IopOperation)} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                  {platform === "aliexpress"
                    ? ALIEXPRESS_IOP_OPERATION_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.operations.map((operation) => (
                            <option key={operation} value={operation}>{operation}</option>
                          ))}
                        </optgroup>
                      ))
                    : supportedIopOperations.map((operation) => (
                        <option key={operation} value={operation}>{operation}</option>
                      ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">request_payload JSON</span>
                <textarea value={iopPayload} onChange={(e) => setIopPayload(e.target.value)} rows={10} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
              </label>
              <button type="button" onClick={() => setIopPayload(IOP_TEMPLATES[iopOperation])} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                Recharger le modèle de l’opération
              </button>
              <button type="button" onClick={runIopOperation} disabled={runningIop} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                {runningIop ? "Exécution..." : "Exécuter l’opération IOP"}
              </button>
              {iopRawResponse ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Réponse brute</span>
                  <textarea value={iopRawResponse} readOnly rows={12} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                </label>
              ) : null}
              {platform === "alibaba" ? (
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Order Attachment Upload</h4>
                  <p className="text-xs text-slate-500">Colle le contenu du fichier en base64 pour appeler `/alibaba/order/attachment/upload`.</p>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Nom du fichier</span>
                  <input value={attachmentFileName} onChange={(e) => setAttachmentFileName(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-slate-600">Contenu base64</span>
                  <textarea value={attachmentBase64} onChange={(e) => setAttachmentBase64(e.target.value)} rows={6} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                </label>
                <button type="button" onClick={uploadOrderAttachment} disabled={uploadingAttachment} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {uploadingAttachment ? "Upload..." : "Uploader la pièce jointe"}
                </button>
                {attachmentResponse ? (
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Réponse upload</span>
                    <textarea value={attachmentResponse} readOnly rows={6} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
                  </label>
                ) : null}
              </div>
              ) : null}
            </div>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">SKU JSON</span>
              <textarea value={skusJson} onChange={(e) => setSkusJson(e.target.value)} rows={12} className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">Importer</button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Catalogue importé</h2>
              <p className="text-sm text-slate-500">Produits source déjà stockés côté back-office.</p>
            </div>
            <button type="button" onClick={loadAll} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Produit source</th>
                  <th className="pb-3 pr-4">Compte</th>
                  <th className="pb-3 pr-4">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && products.length === 0 ? <tr><td colSpan={3} className="py-4 text-slate-500">Aucun produit importé.</td></tr> : null}
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-slate-900">{product.title || "Produit"}</div>
                      <div className="text-xs text-slate-500">{product.external_product_id || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{product.supplier_account?.label || "—"}</div>
                      <div>{product.supplier_account?.platform || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">{product.skus_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}