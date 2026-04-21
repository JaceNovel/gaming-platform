# Documentation complete: automatisation DS AliExpress et auto-paiement

## 1. Objet

Ce document explique comment le systeme automatise aujourd'hui le flux Dropshipping (DS) AliExpress dans ce depot, en particulier:

- la creation de commande fournisseur DS
- la tentative d'auto-paiement AliExpress au moment de la creation
- les verifications obligatoires avant envoi
- les facteurs metier et techniques a integrer pour que cela fonctionne en production
- ce qui est deja automatise
- ce qui est seulement prepare mais pas encore completement integre

Important: il faut distinguer 2 paiements differents.

- Paiement client sur notre plateforme: aujourd'hui principalement Moneroo cote application.
- Paiement fournisseur sur AliExpress DS: gere par AliExpress au niveau du compte acheteur connecte, avec compte DS actif et PayPal lie sur AliExpress.

Le systeme n'utilise donc pas Moneroo pour payer AliExpress. Moneroo encaisse le client. AliExpress debite ensuite le moyen de paiement lie au compte DS quand `try_to_pay=true` est envoye.

## 2. Vue d'ensemble du flux

### 2.1 Flux unitaire commande par commande

1. Le client paie sa commande sur notre plateforme.
2. La commande entre dans le flux fournisseur AliExpress.
3. L'admin peut generer un draft DS.
4. Le backend construit le payload `aliexpress.ds.order.create`.
5. Le backend fait un precheck `aliexpress.ds.freight.query` pour chaque SKU.
6. Le backend remplace le `logistics_service_name` par la valeur exacte retournee par AliExpress.
7. Le backend appelle `aliexpress.ds.order.create` avec:
   - `pay_currency=USD`
   - `try_to_pay=true`
8. Si AliExpress cree la commande et paye, la commande locale passe cote fournisseur en statut `paid`.
9. Si AliExpress cree la commande mais que le paiement echoue, la commande locale reste exploitable mais le statut fournisseur reste `pending`.
10. L'admin ou un sync manuel recupere ensuite l'etat distant avec:
    - `aliexpress.trade.ds.order.get`
    - `aliexpress.ds.order.tracking.get`

### 2.2 Flux groupe par batch

1. Des commandes client physiques entrent en statut de regroupement.
2. Le systeme attend que le seuil de grouping soit libere cote client.
3. Le systeme attend aussi que le MOQ fournisseur soit atteint.
4. Un draft batch peut etre cree automatiquement ou manuellement.
5. Le backend construit un seul payload `aliexpress.ds.order.create` pour tout le lot.
6. Le backend fait le meme precheck freight par ligne.
7. Le backend tente la creation et l'auto-paiement DS du batch.

## 3. Ce qui est deja automatise dans le depot

## 3.1 Plumbing OAuth/API AliExpress

Le depot est deja cable pour AliExpress sur `https://api-sg.aliexpress.com` avec:

- OAuth AliExpress
- support des endpoints token standard et security
- appels GOP pour auth/system
- appels TOP `/sync?method=...` pour les APIs business
- mapping des operations DS dans la config fournisseur

Methodes DS deja configurees dans le backend:

- `aliexpress.ds.order.create`
- `aliexpress.ds.product.get`
- `aliexpress.ds.product.wholesale.get`
- `aliexpress.ds.product.specialinfo.get`
- `aliexpress.ds.text.search`
- `aliexpress.ds.search.event.report`
- `aliexpress.ds.image.searchV2`
- `aliexpress.ds.category.get`
- `aliexpress.ds.feed.itemids.get`
- `aliexpress.ds.member.benefit.get`
- `aliexpress.ds.freight.query`
- `aliexpress.trade.ds.order.get`
- `aliexpress.ds.order.tracking.get`

## 3.2 Construction automatique du draft DS

Le backend construit automatiquement les drafts DS dans:

- `App\Services\AliExpressOrderFulfillmentService`
- `App\Services\AliExpressProcurementBatchService`

Le draft force aujourd'hui:

```json
{
  "ds_extend_request": {
    "payment": {
      "pay_currency": "USD",
      "try_to_pay": "true"
    }
  },
  "param_place_order_request4_open_api_d_t_o": {
    "out_order_id": "...",
    "logistics_address": { "...": "..." },
    "product_items": [
      {
        "product_id": "...",
        "sku_attr": "...",
        "product_count": "1",
        "logistics_service_name": "...",
        "order_memo": "..."
      }
    ]
  }
}
```

Points importants:

- le `pay_currency` est verrouille a `USD`
- `try_to_pay` est force a `true`
- `out_order_id` est genere par notre backend pour eviter les doublons et faciliter le tracing
- l'adresse logistique est generee a partir de l'adresse hub/fournisseur configuree
- les `product_items` sont derives du mapping local produit -> SKU fournisseur AliExpress

## 3.3 Verification freight avant creation

Avant tout `ds.order.create`, le backend lance un precheck sur chaque ligne avec `aliexpress.ds.freight.query`.

Le but est de verifier:

- que le `product_id` existe
- que le SKU DS pointe vers un vrai `selectedSkuId` numerique
- que le `logistics_service_name` est autorise pour ce SKU et cette destination
- que la quantite et la devise sont acceptables

Si un precheck echoue, la creation DS est bloquee avant appel d'achat reel.

## 3.4 Reconciliation automatique du service logistique

Le depot gere deja un point critique: AliExpress peut renvoyer un nom de service legerement different de celui stocke localement.

Exemples consideres comme meme famille:

- `AliExpress Selection Standard`
- `AliExpress Standard Shipping`
- `Expedition standard AliExpress`

Mais au moment du create-order, le backend reecrit le payload avec la valeur exacte retournee par `ds.freight.query` pour le SKU concerne.

Sans cette etape, `aliexpress.ds.order.create` peut echouer avec erreur de livraison invalide.

## 3.5 Reparation automatique des mappings SKU DS

Le depot a aussi deja integre une protection importante contre les mauvais mappings SKU:

- le mapping local ne doit pas pointer vers un SKU placeholder
- il faut un `selectedSkuId` numerique valide
- si le mapping est douteux, le service peut rafraichir le produit via:
  - `ds.product.get`
  - `ds.product.wholesale.get`
- le relink n'est fait que si un SKU numerique sur est trouve

Cela evite un grand nombre d'echecs de precheck et de create-order.

## 3.6 Gestion du resultat create-order et du paiement partiel

Le depot gere deja le cas metier suivant:

- commande creee cote AliExpress
- mais auto-paiement echoue

Ce cas est traite comme:

- succes de creation fournisseur
- mais warning de paiement

Effet local:

- si create OK et pas de warning paiement: statut fournisseur local `paid`
- si create OK avec warning paiement: statut fournisseur local `pending`

Donc le systeme sait deja distinguer:

- `create-success + pay-success`
- `create-success + autoPay-fail`
- `create-fail`

## 3.7 Synchronisation de statut distant

Une fois la commande DS creee, le backend peut synchroniser:

- l'etat commande via `aliexpress.trade.ds.order.get`
- le tracking via `aliexpress.ds.order.tracking.get`

Le resultat est repercute localement sur:

- statut fournisseur
- numero de tracking
- provider logistique
- package id
- dernier payload requete/reponse

Les statuts fournisseur locaux utilises par l'application sont:

- `pending`
- `paid`
- `grouping`
- `supplier_ordered`
- `warehouse_received`
- `delivering`
- `delivered`

## 3.8 Flux batch groupe deja present

Le module batch fournisseur est deja present avec:

- table `procurement_batches`
- table `procurement_batch_items`
- persistance de `supplier_order_payload_json`
- generation automatique de drafts quand les conditions de grouping sont remplies

Le batch n'est cree que si:

- la commande client est payee
- `grouping_released_at` est renseigne
- le MOQ fournisseur est atteint
- les demandes d'un meme batch partagent:
  - le meme fournisseur
  - la meme destination d'entrepot
  - la meme devise

La quantite de grouping effective repose aujourd'hui sur:

- MOQ de base du lien produit fournisseur ou du SKU fournisseur
- multiplie par `10`

Et le lot est considere pret quand:

- la quantite requise est atteinte
- et le montant minimum de lot atteint `25000 XOF`

## 4. Points d'entree admin deja exposes

### 4.1 Commande unitaire

Routes admin utiles:

- `GET /api/admin/orders/{order}/supplier/aliexpress/ds-draft`
- `POST /api/admin/orders/{order}/supplier/aliexpress/create-order`
- `POST /api/admin/orders/{order}/supplier/aliexpress/sync-order`

### 4.2 Batch groupe

Routes admin utiles:

- `GET /api/admin/sourcing/grouped-ready?platform=aliexpress`
- `GET /api/admin/sourcing/batches/{procurementBatch}/aliexpress/ds-draft`
- `POST /api/admin/sourcing/batches/{procurementBatch}/aliexpress/create-order`

### 4.3 Explorer technique AliExpress

Le back-office expose aussi un explorateur IOP qui permet des appels bruts pour debug/test sur des operations comme:

- `ds-order-create`
- `ds-freight-query`
- `ds-trade-order-get`
- `ds-order-tracking-get`
- `ds-member-benefit-get`
- et les operations produit/recherche DS

## 5. Prerequis metier obligatoires pour l'auto-paiement DS

L'auto-paiement DS ne depend pas seulement du code. Il depend fortement de l'etat du compte AliExpress connecte.

Les prerequis identifies dans le depot et les notes repo sont:

1. L'appKey doit etre whitelistee pour les APIs DS.
2. Le compte acheteur AliExpress connecte doit etre active dans DS Center.
3. Un compte PayPal doit etre lie au compte AliExpress.
4. Le pays de destination doit etre supporte par le mode DS choisi.
5. La devise de paiement doit rester `USD`.
6. Les permissions OAuth DS doivent etre presentes sur l'application et sur le token reconnecte.

Si un de ces points manque, on peut observer:

- `InsufficientPermission`
- creation DS refusee
- creation DS acceptee mais auto-paiement non effectif
- erreurs de devise
- erreurs d'adresse ou de methode de livraison

## 6. Facteurs techniques a integrer ou a verifier absolument

## 6.1 Facteurs compte/API

- `app_key` autorisee par AliExpress pour DS
- `app_secret` correct
- access token valide
- refresh token valide
- scopes DS reellement accordes
- reconnexion du compte apres ajout de scopes

## 6.2 Facteurs paiement fournisseur

- compte DS actif sur AliExpress
- PayPal bien lie sur le compte AliExpress acheteur
- capacite de debit effective cote AliExpress/PayPal
- meme devise de paiement pour tout le panier DS
- `pay_currency=USD`
- interpretation correcte du cas `OrderCreated, autoPay fail`

## 6.3 Facteurs produit/SKU

- `product_id` AliExpress valide
- `selectedSkuId` numerique reel
- `sku_attr` coherent avec le SKU choisi
- prix et stock encore valides cote AliExpress
- eviter les vieux SKUs importes devenus inactifs
- lien local produit -> supplier SKU bien resolu

## 6.4 Facteurs logistiques

- adresse hub/fournisseur active et valide
- pays de destination coherent avec le flux DS
- service logistique disponible pour le SKU
- ne jamais envoyer aveuglement un nom de service logistique memorise
- toujours valider puis re-ecrire avec la valeur retournee par `ds.freight.query`

## 6.5 Facteurs batch/grouping

- grouping release cote client
- MOQ fournisseur atteint
- meme fournisseur dans le batch
- meme destination warehouse
- meme devise
- quantite consolidee suffisante
- montant minimum lot respecte si votre process l'impose metier

## 6.6 Facteurs persistance/observabilite

- stocker le draft envoye
- stocker la reponse brute AliExpress
- stocker le resultat du freight check
- stocker `external_order_id`
- stocker tracking/provider/package id
- distinguer statut local de creation et statut de paiement

Le depot le fait deja en grande partie via:

- `latest_request_payload_json`
- `latest_response_payload_json`
- `metadata_json`
- `supplier_order_payload_json` pour les batches

## 7. Erreurs metier deja interpretees dans le code

Le backend mappe deja plusieurs erreurs connues:

- `B_DROPSHIPPER_DELIVERY_ADDRESS_VALIDATE_FAIL`
  - adresse hub invalide
- `BLACKLIST_BUYER_IN_LIST`
  - compte acheteur invalide / blackliste
- `USER_ACCOUNT_DISABLED`
  - compte acheteur desactive
- `PRICE_PAY_CURRENCY_ERROR`
  - devise incoherente
- `DELIVERY_METHOD_NOT_EXIST`
  - service logistique non valide
- `INVENTORY_HOLD_ERROR`
  - stock indisponible
- `REPEATED_ORDER_ERROR`
  - doublon de commande

Le backend transforme aussi `InsufficientPermission` en message plus actionnable pour l'admin:

- activer les scopes DS
- reconnecter le compte OAuth
- relancer la creation DS

## 8. Ce qui n'est pas encore completement integre

Voici la partie la plus importante si l'objectif est une automatisation DS complete de niveau production.

### 8.1 `aliexpress.ds.address.get`

La doc cible DS mentionne `aliexpress.ds.address.get` comme API utile pour recuperer/normaliser les adresses acheteur DS.

Etat actuel du depot:

- non vu comme operation mappee dans `config/services.php` / `SupplierApiClient`
- le backend construit l'adresse a partir de nos propres `SupplierReceivingAddress`

Consequence:

- le flux actuel fonctionne sur adresse interne/hub maitrisee par nous
- mais pas encore sur une synchronisation native du carnet d'adresses DS AliExpress

### 8.2 Webhook `DROPSHIPPER_ORDER_STATUS_UPDATE`

La doc DS cible recommande le webhook `DROPSHIPPER_ORDER_STATUS_UPDATE`.

Etat actuel du depot:

- aucune integration visible du webhook DS AliExpress
- la synchro semble aujourd'hui reposer sur actions manuelles / sync explicite

Consequence:

- les changements de statut distants ne poussent pas automatiquement vers notre backend
- risque de decalage entre etat AliExpress et etat local si aucun sync n'est lance

### 8.3 Paiement de rattrapage explicite

Le depot est centre sur le mode prefere:

- `ds.order.create` avec `try_to_pay=true`

Il expose aussi l'operation `dropshipping-order-pay` dans le client API, mais le flux metier principal documente dans le code se concentre surtout sur create + auto-pay.

Consequence:

- pour un scenario `order created but autoPay failed`, il faut verifier si vous voulez un flux admin explicite de repaiement fournisseur
- la base technique existe partiellement cote `SupplierApiClient`, mais le flux metier complet de reprise doit etre confirme avant usage intensif

## 9. Difference entre paiement client et paiement fournisseur

Pour eviter toute confusion interne:

- le client paye notre plateforme en monnaie locale selon le tunnel de paiement app
- ce paiement local ne regle pas directement AliExpress
- ensuite notre backend cree la commande fournisseur DS sur le compte AliExpress connecte
- AliExpress tente alors de debiter le PayPal lie a ce compte

Donc les facteurs a monitorer sont doubles:

- sante du paiement client dans notre app
- sante du paiement fournisseur dans AliExpress DS

## 10. Recommandation d'integration complete

Si l'objectif est une automatisation DS vraiment complete, robuste et presque sans intervention manuelle, il faut viser ce package minimum:

1. OAuth AliExpress avec scopes DS validement reconnectes.
2. Verification admin de l'eligibilite DS du compte via test technique et, si utile, `ds.member.benefit.get`.
3. Import produit DS avec nettoyage des faux SKUs et preservation du `selectedSkuId` numerique.
4. Precheck freight obligatoire avant tout create-order.
5. Reecriture systematique du `logistics_service_name` avec la valeur retournee par AliExpress.
6. Creation `ds.order.create` avec `pay_currency=USD` et `try_to_pay=true`.
7. Gestion explicite du cas `create ok / pay fail`.
8. Sync distant periodique ou manuel avec `trade.ds.order.get` et `ds.order.tracking.get`.
9. Integration du webhook `DROPSHIPPER_ORDER_STATUS_UPDATE` pour la vraie automatisation event-driven.
10. Ajout de `ds.address.get` si vous voulez fiabiliser ou aligner la gestion d'adresses sur la vision native AliExpress DS.
11. Ecran admin pour repaiement/retry si autoPay fail frequemment.
12. Alerting sur erreurs de permission, devise, livraison, stock et compte blackliste.

## 11. Risques principaux a ne pas sous-estimer

- croire que le paiement client Moneroo signifie que le paiement AliExpress est regle: faux
- laisser des mappings SKU avec ID non numerique ou obsolete
- ne pas relancer de `ds.freight.query` avant `ds.order.create`
- ne pas distinguer `commande creee` et `commande payee`
- ne pas reconnecter le compte apres ajout de scopes DS
- se fier a un service logistique memorise au lieu de celui renvoye en temps reel
- ne pas implementer de webhook ou de job de resynchronisation periodique

## 12. Etat reel du systeme aujourd'hui

En resume:

- le socle d'automatisation DS AliExpress est deja present et fonctionnel pour le create-order avec tentative d'auto-paiement
- le depot sait deja preparer le draft, controler le freight, normaliser les services logistiques, corriger certains mappings SKU et synchroniser ensuite le statut distant
- le flux batch groupe est deja present avec contraintes MOQ + grouping
- l'automatisation n'est pas encore totalement fermee en boucle car il manque encore, a minima, le webhook de statut DS et probablement l'integration `ds.address.get` si vous voulez une couverture DS native complete

## 13. Checklist go-live

- App AliExpress whitelistee DS
- Scopes DS actifs
- Compte reconnecte apres changement de scopes
- Compte DS Center actif
- PayPal lie au compte AliExpress
- Tests create-order en USD valides
- Tests `autoPay fail` valides et geres
- Tests freight par SKU valides
- Verification des `selectedSkuId` numeriques
- Batch grouping + MOQ verifies
- Observabilite sur requetes/reponses active
- Strategy de resync ou webhook DS en place
