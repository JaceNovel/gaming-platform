# Import AliExpress par ID produit

Ce document decrit le code reel du depot qui permet d'importer un produit AliExpress a partir de son identifiant produit (`external_product_id`).

## Objectif

Le flux fait 2 choses distinctes:

1. charger un produit distant depuis l'API AliExpress a partir de son ID
2. transformer cette reponse en produit fournisseur local, puis optionnellement en produit storefront

## Point d'entree front

L'ecran admin d'import catalogue pre-remplit le formulaire a partir d'un `external_product_id`.

Fichier concerne:

- `frontend/src/app/admin/sourcing/import/page.tsx`

Code cle:

```tsx
const fetchRemoteProduct = async () => {
  const res = await fetch(`${API_BASE}/admin/sourcing/catalog/fetch-remote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      supplier_account_id: Number(supplierAccountId),
      external_product_id: trimInput(externalProductId),
      lookup_type: lookupType,
      remote_mode: remoteMode,
      ship_to_country: trimInput(dsShipToCountry) || undefined,
      target_currency: trimInput(dsTargetCurrency) || undefined,
      target_language: trimInput(dsTargetLanguage) || undefined,
      remove_personal_benefit: dsRemovePersonalBenefit,
    }),
  });
};
```

Ensuite, quand l'utilisateur valide le formulaire, le meme `external_product_id` est reutilise pour l'import local:

```tsx
const res = await fetch(`${API_BASE}/admin/sourcing/catalog/import`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...getAuthHeaders(),
  },
  body: JSON.stringify({
    supplier_account_id: Number(supplierAccountId),
    external_product_id: trimInput(externalProductId),
    external_offer_id: trimInput(externalOfferId) || undefined,
    title: trimInput(title),
    supplier_name: trimInput(supplierName) || undefined,
    source_url: trimInput(sourceUrl) || undefined,
    main_image_url: trimInput(mainImageUrl) || undefined,
    category_path_json: remoteProductData?.category_path_json ?? undefined,
    attributes_json: remoteProductData?.attributes_json ?? undefined,
    product_payload_json: remoteProductData?.product_payload_json ?? undefined,
    _storefront_defaults: remoteProductData?._storefront_defaults ?? undefined,
    skus: parsedSkus,
  }),
});
```

## Routes backend

Les routes exposees par l'API admin sont:

```php
Route::post('/sourcing/catalog/fetch-remote', [AdminSupplierCatalogController::class, 'fetchRemote']);
Route::post('/sourcing/catalog/import', [AdminSupplierCatalogController::class, 'import']);
```

## Controleur backend

Le controleur qui porte le flux est `App\Http\Controllers\Api\AdminSupplierCatalogController`.

### 1. Apercu distant par ID produit

La methode `fetchRemote()` valide l'entree puis appelle `SupplierApiClient::fetchRemoteProduct()`:

```php
$normalized = $supplierApiClient->fetchRemoteProduct(
    $account,
    (string) $data['external_product_id'],
    $data['lookup_type'] ?? null,
    [
        'remote_mode' => $data['remote_mode'] ?? 'standard',
        'ship_to_country' => strtoupper((string) ($data['ship_to_country'] ?? 'TG')),
        'target_currency' => $data['target_currency'] ?? null,
        'target_language' => $data['target_language'] ?? null,
        'remove_personal_benefit' => $data['remove_personal_benefit'] ?? null,
        'biz_model' => $data['biz_model'] ?? null,
        'province_code' => $data['province_code'] ?? null,
        'city_code' => $data['city_code'] ?? null,
    ]
);
```

### 2. Import local du produit

La methode `import()` persiste ensuite le produit fournisseur via `SupplierCatalogImportService::import()` avec le `external_product_id` et les SKU deja normalises.

```php
$product = $importService->import((int) $data['supplier_account_id'], $data);
```

Si l'option est active, le flux cree aussi un produit storefront via `AliExpressBulkCatalogImportService::syncStorefrontProductFromSupplierImport()`.

## Service principal: chargement du produit par ID

Le coeur de l'integration est dans `App\Services\SupplierApiClient`.

### Selection de la methode AliExpress

Le service choisit la methode distante selon `remote_mode`:

```php
$remoteMode = (string) ($options['remote_mode'] ?? 'standard');
$methodName = match ($remoteMode) {
    'ds_product' => trim((string) ($config['ds_product_get_method'] ?? '')),
    'ds_wholesale' => trim((string) ($config['ds_product_wholesale_get_method'] ?? '')),
    default => trim((string) ($config['product_detail_method'] ?? $config['product_detail_path'] ?? '')),
};
```

Concretement pour AliExpress:

- mode `standard` -> `aliexpress.solution.product.info.get`
- mode `ds_product` -> `aliexpress.ds.product.get`
- mode `ds_wholesale` -> `aliexpress.ds.product.wholesale.get`

### Construction des parametres avec l'ID produit

Le point exact ou l'ID est injecte est `buildProductLookupParams()`:

```php
if ($methodName === 'aliexpress.solution.product.info.get') {
    return [
        'product_id' => $externalProductId,
        'productId' => $externalProductId,
    ];
}

if (in_array($methodName, ['aliexpress.ds.product.get', 'aliexpress.ds.product.wholesale.get'], true)) {
    return array_filter([
        'ship_to_country' => strtoupper(trim((string) ($options['ship_to_country'] ?? 'TG'))) ?: 'TG',
        'product_id' => $externalProductId,
        'target_currency' => $this->nullableStringForParams($options['target_currency'] ?? null),
        'target_language' => $this->nullableStringForParams($options['target_language'] ?? null),
        'remove_personal_benefit' => array_key_exists('remove_personal_benefit', $options) ? ($options['remove_personal_benefit'] ? 'true' : 'false') : null,
        'biz_model' => $this->nullableStringForParams($options['biz_model'] ?? null),
        'province_code' => $this->nullableStringForParams($options['province_code'] ?? null),
        'city_code' => $this->nullableStringForParams($options['city_code'] ?? null),
    ], static fn ($value) => $value !== null && $value !== '');
}
```

## Normalisation de la reponse distante

Apres l'appel AliExpress, la reponse brute est transformee en structure locale uniforme.

### Mode standard

Le normaliseur retourne notamment:

- `external_product_id`
- `external_offer_id`
- `title`
- `supplier_name`
- `source_url`
- `main_image_url`
- `category_path_json`
- `attributes_json`
- `product_payload_json`
- `skus`

### Mode DS

Pour les appels `aliexpress.ds.product.get` et `aliexpress.ds.product.wholesale.get`, le service utilise un normaliseur dedie `normalizeAliExpressDsProductResponse()` qui:

- lit `ae_item_base_info_dto`
- extrait les images depuis `ae_multimedia_info_dto.image_urls`
- genere l'URL source `https://www.aliexpress.com/item/{product_id}.html`
- extrait les SKU et leurs prix
- renseigne `_storefront_defaults` pour faciliter la creation du produit local

Extrait utile:

```php
return [
    'supplier_account_id' => $account->id,
    'external_product_id' => $externalProductId,
    'external_offer_id' => $productConverter['main_product_id'] ?? null,
    'title' => $title,
    'supplier_name' => $storeInfo['store_name'] ?? $account->label,
    'source_url' => $sourceUrl,
    'main_image_url' => $mainImageUrl,
    'category_path_json' => array_values(array_filter([
        trim((string) ($baseInfo['category_sequence'] ?? '')),
        trim((string) ($baseInfo['category_id'] ?? '')),
    ])),
    'attributes_json' => [
        'target_currency' => $targetCurrency,
        'target_language' => $options['target_language'] ?? null,
        'ship_to_country' => $options['ship_to_country'] ?? null,
    ],
    'product_payload_json' => array_merge($payload, [
        'result' => $result,
    ]),
    'skus' => $normalizedSkus,
];
```

## Configuration necessaire

La config centrale est dans `config/services.php` et s'appuie sur `.env`.

Variables cle:

```env
ALIEXPRESS_PRODUCT_DETAIL_METHOD=aliexpress.solution.product.info.get
ALIEXPRESS_DS_PRODUCT_GET_METHOD=aliexpress.ds.product.get
ALIEXPRESS_PRODUCT_LOOKUP_PARAM=product_id
```

Mapping config reel:

```php
'product_detail_method' => env('ALIEXPRESS_PRODUCT_DETAIL_METHOD', 'aliexpress.solution.product.info.get'),
'ds_product_get_method' => env('ALIEXPRESS_DS_PRODUCT_GET_METHOD', 'aliexpress.ds.product.get'),
'product_lookup_param' => env('ALIEXPRESS_PRODUCT_LOOKUP_PARAM', 'product_id'),
```

## Requete API minimale

Pour charger un produit AliExpress par ID sans encore l'importer en base:

```http
POST /api/admin/sourcing/catalog/fetch-remote
Content-Type: application/json

{
  "supplier_account_id": 12,
  "external_product_id": "1005008409003645",
  "remote_mode": "ds_product",
  "ship_to_country": "TG",
  "target_currency": "USD",
  "target_language": "fr"
}
```

Pour l'importer ensuite en catalogue fournisseur local:

```http
POST /api/admin/sourcing/catalog/import
Content-Type: application/json

{
  "supplier_account_id": 12,
  "external_product_id": "1005008409003645",
  "title": "Nom du produit",
  "skus": [
    {
      "external_sku_id": "12000044944828317",
      "sku_label": "Default",
      "variant_attributes_json": [],
      "moq": 1,
      "unit_price": 12.99,
      "currency_code": "USD"
    }
  ]
}
```

## Resume technique

Le code qui a permis l'integration de l'import par ID produit est donc principalement:

- `frontend/src/app/admin/sourcing/import/page.tsx` pour envoyer `external_product_id`
- `App\Http\Controllers\Api\AdminSupplierCatalogController::fetchRemote()` pour charger le produit distant
- `App\Services\SupplierApiClient::fetchRemoteProduct()` pour appeler AliExpress avec l'ID produit
- `App\Services\SupplierApiClient::buildProductLookupParams()` pour placer `product_id` dans la requete
- `App\Services\SupplierApiClient::normalizeProductResponse()` et `normalizeAliExpressDsProductResponse()` pour convertir la reponse API en format local
- `App\Http\Controllers\Api\AdminSupplierCatalogController::import()` puis `SupplierCatalogImportService::import()` pour persister le produit en base

Si tu veux, je peux aussi te sortir la meme chose sous forme de pack copier-coller avec uniquement les extraits PHP indispensables, sans l'explication autour.