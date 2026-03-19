<?php

use App\Http\Controllers\Api\AdminCategoryController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminOfferController;
use App\Http\Controllers\Api\AdminProductController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AdminOrderController;
use App\Http\Controllers\Api\AdminRedeemCodeController;
use App\Http\Controllers\Api\AdminRedeemLotController;
use App\Http\Controllers\Api\AdminMeController;
use App\Http\Controllers\Api\AdminAuditLogController;
use App\Http\Controllers\Api\AdminDbWalletController;
use App\Http\Controllers\Api\AdminDbWalletWelcomeBonusController;
use App\Http\Controllers\Api\AdminMarketplaceSellerController;
use App\Http\Controllers\Api\AdminMarketplaceListingController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PayPalWebhookController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\FedaPayPayoutWebhookController;
use App\Http\Controllers\Api\FedaPayWebhookController;
use App\Http\Controllers\Api\PremiumController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PushController;
use App\Http\Controllers\Api\ReferralController;
use App\Http\Controllers\Api\StorefrontTransitController;
use App\Http\Controllers\Api\GuideController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\PhoneChangeRequestController;
use App\Http\Controllers\Api\AdminPhoneChangeController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\LikeController;
use App\Http\Controllers\Api\PublicStatsController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\ImageProxyController;
use App\Http\Controllers\Api\MeRedeemController;
use App\Http\Controllers\Api\SellerKycController;
use App\Http\Controllers\Api\PartnerWalletController;
use App\Http\Controllers\Api\DeviceTokenController;
use App\Http\Controllers\Api\PlayIntegrityController;
use App\Http\Controllers\Api\AdminMarketplaceWithdrawController;
use App\Http\Controllers\Api\AdminPremiumRequestController;
use App\Http\Controllers\Api\AdminMarketplaceOrderController;
use App\Http\Controllers\Api\MarketplaceListingController;
use App\Http\Controllers\Api\MarketplaceCheckoutController;
use App\Http\Controllers\Api\MarketplaceOrderController;
use App\Http\Controllers\Api\MarketplaceDisputeController;
use App\Http\Controllers\Api\SellerMarketplaceOrderController;
use App\Http\Controllers\Api\AdminMarketplaceDisputeController;
use App\Http\Controllers\Api\AdminMarketplaceCommissionController;
use App\Http\Controllers\Api\PublicStorageController;
use App\Http\Controllers\Api\TournamentController;
use App\Http\Controllers\Api\AdminTournamentController;
use App\Http\Controllers\Api\TournamentRegistrationController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:reset-password');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::post('/password/update', [AuthController::class, 'updatePassword'])->middleware('auth:sanctum');
    Route::delete('/delete', [AuthController::class, 'deleteAccount'])->middleware('auth:sanctum');
});

Route::middleware('auth:sanctum')->get('/me', [AuthController::class, 'me']);

Route::get('/health', function () {
    $dbStatus = 'ok';
    $dbError = null;
    try {
        DB::connection()->getPdo();
    } catch (Throwable $e) {
        $dbStatus = 'fail';
        $dbError = $e->getMessage();
    }

    return response()->json([
        'ok' => true,
        'app' => 'PRIME Gaming',
        'app_env' => app()->environment(),
        'app_url' => config('app.url'),
        'db' => $dbStatus,
        'error' => $dbError,
        'time' => now()->toIso8601String(),
    ]);
});

Route::get('/health/db', function () {
    $url = env('DATABASE_URL', env('DB_URL'));
    $host = null;
    if ($url) {
        $parts = parse_url($url);
        $host = $parts['host'] ?? null;
    }
    $resolved = null;
    if ($host) {
        $resolved = gethostbyname($host);
    }

    try {
        DB::connection()->getPdo();
        return response()->json([
            'ok' => true,
            'db' => 'connected',
            'host' => $host,
            'resolved' => $resolved,
            'time' => now()->toIso8601String(),
        ]);
    } catch (Throwable $e) {
        return response()->json([
            'ok' => false,
            'db' => 'error',
            'host' => $host,
            'resolved' => $resolved,
            'message' => $e->getMessage(),
            'time' => now()->toIso8601String(),
        ], 500);
    }
});

// Public files (uploads) served through API
Route::get('/storage/{path}', [PublicStorageController::class, 'show'])->where('path', '.*');

// Client-side error reporting (best-effort, no auth)
Route::post('/client-errors', [\App\Http\Controllers\Api\ClientErrorController::class, 'store']);

// Image proxy (for external image URLs copied from websites)
Route::get('/image-proxy', [ImageProxyController::class, 'show']);

// Public listing routes
Route::apiResource('games', GameController::class)->only(['index', 'show']);
Route::get('products/{product}', [ProductController::class, 'show']);
Route::get('products', [ProductController::class, 'index']);
Route::get('storefront/countries', [StorefrontTransitController::class, 'countries']);
Route::get('storefront/countries/resolve', [StorefrontTransitController::class, 'resolve']);
Route::get('categories', [CategoryController::class, 'index']);
Route::get('categories/{category}', [CategoryController::class, 'show']);
Route::get('gaming-accounts/listings', [MarketplaceListingController::class, 'index']);
Route::get('gaming-accounts/listings/{sellerListing}', [MarketplaceListingController::class, 'showPublic'])->whereNumber('sellerListing');
Route::get('/stats/home', [PublicStatsController::class, 'home']);
Route::get('/stats/overview', [PublicStatsController::class, 'overview']);
Route::get('/likes/stats', [LikeController::class, 'stats']);
Route::get('/tournaments', [TournamentController::class, 'index']);
Route::get('/tournaments/ramadan-winners', [TournamentController::class, 'ramadanWinners']);
Route::get('/tournaments/{slug}', [TournamentController::class, 'show']);

// Webhooks (no auth required)
Route::post('/payments/cinetpay/webhook', [PaymentWebhookController::class, 'handle'])->name('api.payments.cinetpay.webhook');
Route::match(['get', 'post'], '/payments/cinetpay/return', [PaymentWebhookController::class, 'redirect'])->name('api.payments.cinetpay.return');
Route::match(['get', 'post'], '/payments/fedapay/return', [PaymentController::class, 'redirectFedapayReturn'])->name('api.payments.fedapay.return');
Route::match(['get', 'post'], '/payments/paypal/return', [PaymentController::class, 'redirectPaypalReturn'])->name('api.payments.paypal.return');
Route::post('/payments/fedapay/webhook', [FedaPayWebhookController::class, 'handle'])->name('api.payments.fedapay.webhook');
Route::post('/payments/paypal/webhook', [PayPalWebhookController::class, 'handle'])->name('api.payments.paypal.webhook');
Route::post('/payouts/fedapay/webhook', [FedaPayPayoutWebhookController::class, 'handle'])->name('api.payouts.fedapay.webhook');
Route::get('/sourcing/oauth/{platform}/callback', [\App\Http\Controllers\Api\AdminSupplierOAuthController::class, 'callback']);

Route::get('/guides/shop2game-freefire', [GuideController::class, 'shop2gameFreeFire']);

// CORS preflight fallback for API routes.
// Ensures browsers always receive a fast 204 on OPTIONS before auth/route middlewares.
Route::options('/{path}', function () {
    return response()->noContent();
})->where('path', '.*');

// Web Push (public key)
Route::get('/push/vapid-public-key', [PushController::class, 'vapidPublicKey']);

// Protected routes
Route::middleware(['auth:sanctum', 'lastSeen'])->group(function () {

    // Play Integrity verification (soft gate for sensitive actions)
    Route::post('/play-integrity/verify', [PlayIntegrityController::class, 'verify']);

    // Products actions
    Route::post('products/{product}/like', [ProductController::class, 'like']);
        Route::post('likes/toggle', [LikeController::class, 'toggle']);

    // Orders
    Route::apiResource('orders', OrderController::class)->only(['index', 'show']);
    Route::get('/orders/{order}/redeem-codes', [OrderController::class, 'redeemCodes']);
    Route::post('/orders/{order}/redeem-codes/resend', [OrderController::class, 'resendRedeemCodes']);

    // Cart
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);

    // Payments
    Route::get('/payments/cinetpay/status', [PaymentController::class, 'status'])->name('api.payments.cinetpay.status');
    Route::get('/payments/fedapay/status', [PaymentController::class, 'statusFedapay'])->name('api.payments.fedapay.status');
    Route::get('/payments/paypal/status', [PaymentController::class, 'statusPaypal'])->name('api.payments.paypal.status');

    // Premium
    Route::get('/premium/status', [PremiumController::class, 'status']);
    Route::post('/premium/request', [PremiumController::class, 'submit']);

    // Chat
    Route::get('/chat/rooms', [ChatController::class, 'rooms']);
    Route::get('/chat/messages/{room}', [ChatController::class, 'messages']);
    Route::post('/chat/messages', [ChatController::class, 'sendMessage']);
    Route::delete('/chat/messages/{message}', [ChatController::class, 'deleteMessage']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    // Wallet
    Route::get('/wallet', [WalletController::class, 'show']);
    Route::get('/wallet/transactions', [WalletController::class, 'transactions']);
    Route::get('/wallet/payouts', [WalletController::class, 'payouts']);
    Route::get('/wallet/recipient', [WalletController::class, 'resolveRecipient']);
    Route::post('/wallet/transfer', [WalletController::class, 'transfer']);
    Route::post('/wallet/topup', [WalletController::class, 'topup']);

    // Sensitive actions (Play Integrity required)
    Route::middleware('playIntegrity')->group(function () {
        // Orders
        Route::post('orders', [OrderController::class, 'store']);

        // Payments
        Route::post('/payments/cinetpay/init', [PaymentController::class, 'init'])->name('api.payments.cinetpay.init');
        Route::post('/payments/fedapay/init', [PaymentController::class, 'initFedapay'])->name('api.payments.fedapay.init');
        Route::post('/payments/paypal/init', [PaymentController::class, 'initPaypal'])->name('api.payments.paypal.init');
        Route::post('/payments/wallet/pay', [PaymentController::class, 'payWithWallet'])->name('api.payments.wallet.pay');
        Route::post('/payments/wallet-reward/pay', [PaymentController::class, 'payWithRewardWallet'])->name('api.payments.wallet_reward.pay');
        Route::post('/payments/wallet-reward/exchange', [PaymentController::class, 'exchangeRewardWallet'])->name('api.payments.wallet_reward.exchange');

        // Premium
        Route::post('/premium/init', [PremiumController::class, 'init']);
        Route::post('/premium/init-wallet', [PremiumController::class, 'initWallet']);
        Route::post('/premium/subscribe', [PremiumController::class, 'subscribe']);
        Route::post('/premium/cancel', [PremiumController::class, 'cancel']);
    });

    // Referrals
    Route::get('/referrals/me', [ReferralController::class, 'me']);
    Route::post('/referrals/generate', [ReferralController::class, 'generate']);

    // Web Push
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushController::class, 'unsubscribe']);
    Route::post('/push/test', [PushController::class, 'test']);

    // Native Push (FCM/APNS tokens)
    Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);

    // Profile
    Route::get('/me/profile', [UserProfileController::class, 'show']);
    Route::patch('/me/profile', [UserProfileController::class, 'update']);

    // Phone change (Basic users)
    Route::post('/me/phone-change-requests', [PhoneChangeRequestController::class, 'store']);

    // Redeem deliveries
    Route::get('/me/redeems', [MeRedeemController::class, 'index']);

    // Reviews
    Route::get('/reviews', [ReviewController::class, 'index']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // Tournaments
    Route::post('/tournaments/{tournament}/register', [TournamentRegistrationController::class, 'store']);
    Route::get('/tournaments/registrations/mine', [TournamentRegistrationController::class, 'mine']);

    // Support tickets
    Route::get('/support/inbox', [SupportTicketController::class, 'inbox']);
    Route::post('/support/inbox/read-all', [SupportTicketController::class, 'markAllRead']);
    Route::post('/support/tickets', [SupportTicketController::class, 'store']);
    Route::get('/support/tickets/{ticket}', [SupportTicketController::class, 'show']);
    Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'reply']);

    // Gaming Account Marketplace (Seller KYC)
    Route::prefix('gaming-accounts')->group(function () {
        Route::get('/seller/me', [SellerKycController::class, 'me']);
        Route::get('/seller/agreement-pdf', [SellerKycController::class, 'downloadAgreementPdf']);
        Route::post('/seller/apply', [SellerKycController::class, 'apply']);
        Route::post('/seller/kyc/id-front', [SellerKycController::class, 'uploadIdFront']);
        Route::post('/seller/kyc/selfie', [SellerKycController::class, 'captureSelfie']);

        // DB Partner wallet
        Route::get('/partner-wallet', [PartnerWalletController::class, 'show']);
        Route::post('/partner-wallet/withdraw', [PartnerWalletController::class, 'requestWithdraw'])
            ->middleware('playIntegrity');

        // Seller listings
        Route::get('/listings/mine', [MarketplaceListingController::class, 'mine']);
        Route::post('/listings', [MarketplaceListingController::class, 'store']);
        Route::patch('/listings/{sellerListing}', [MarketplaceListingController::class, 'update']);
        Route::patch('/listings/{sellerListing}/status', [MarketplaceListingController::class, 'setStatus']);

        // Buyer checkout + post-payment WhatsApp reveal
        Route::post('/listings/{sellerListing}/checkout', [MarketplaceCheckoutController::class, 'checkout'])
            ->middleware('playIntegrity');
        Route::get('/orders/{order}/whatsapp', [MarketplaceOrderController::class, 'whatsapp']);

        // Buyer delivery tracking
        Route::get('/orders/{order}/marketplace', [MarketplaceOrderController::class, 'showMarketplace']);
        Route::post('/orders/{order}/confirm-delivered', [MarketplaceOrderController::class, 'confirmDelivered']);

        // Disputes
        Route::post('/orders/{order}/dispute', [MarketplaceOrderController::class, 'openDispute']);
        Route::get('/disputes/mine', [MarketplaceDisputeController::class, 'mine']);

        // Seller delivery proof
        Route::get('/seller/orders', [SellerMarketplaceOrderController::class, 'index']);
        Route::post('/seller/orders/{marketplaceOrder}/delivered', [SellerMarketplaceOrderController::class, 'markDelivered']);
    });

});

// Admin routes
Route::middleware(['auth:sanctum', 'lastSeen', 'admin', 'requireRole:admin_super,admin,admin_operations,admin_domain,admin_manager,admin_support,admin_marketing,viewer,staff,admin_article,admin_client'])->prefix('admin')->group(function () {
    Route::get('/me', AdminMeController::class);
    Route::get('/dashboard', [AdminDashboardController::class, 'overview'])->middleware('permission:dashboard.view');
    Route::get('/activity/recent', [\App\Http\Controllers\Api\AdminActivityController::class, 'recent'])
        ->middleware('permission:dashboard.view');
    Route::get('/stats/overview', [AdminDashboardController::class, 'statsOverview'])->middleware('permission:stats.view');
    Route::get('/stats/revenue', [AdminDashboardController::class, 'revenue'])->middleware('permission:stats.view');
    Route::get('/dashboard/tables', [AdminDashboardController::class, 'tables'])->middleware('permission:dashboard.view');
    Route::get('/dashboard/export', [AdminDashboardController::class, 'export'])->middleware('permission:dashboard.view');
    Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary'])->middleware('permission:dashboard.view');
    Route::get('/dashboard/charts', [AdminDashboardController::class, 'charts'])->middleware('permission:stats.view');

    // Orders + fulfillment
    Route::get('/orders', [AdminOrderController::class, 'index'])->middleware('permission:orders.view');
    Route::get('/orders/recent', [AdminOrderController::class, 'recent'])->middleware('permission:orders.view');
    Route::get('/orders/{order}', [AdminOrderController::class, 'show'])->middleware('permission:orders.view');
    Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->middleware('permission:orders.manage');
    Route::patch('/orders/{order}/payment/status', [AdminOrderController::class, 'updatePaymentStatus'])->middleware('permission:orders.manage');
    Route::post('/orders/{order}/refund', [AdminOrderController::class, 'refund'])->middleware('permission:orders.manage');
    Route::post('/orders/{order}/delivery-note-pdf', [AdminOrderController::class, 'deliveryNotePdf'])->middleware('permission:orders.view');
    Route::post('/orders/{order}/resend-code', [AdminOrderController::class, 'resendCode'])->middleware('permission:orders.manage');
    Route::post('/orders/{order}/shipping/generate-document', [AdminOrderController::class, 'generateShippingDocument'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/shipping/generate-mark', [AdminOrderController::class, 'generateShippingMarkDocument'])
        ->middleware('permission:orders.manage');
    Route::get('/orders/{order}/shipping/document', [AdminOrderController::class, 'downloadShippingDocument'])
        ->middleware('permission:orders.view');
    Route::get('/orders/{order}/shipping/mark', [AdminOrderController::class, 'downloadShippingMarkDocument'])
        ->middleware('permission:orders.view');
    Route::patch('/orders/{order}/shipping/status', [AdminOrderController::class, 'updateShippingStatus'])
        ->middleware('permission:orders.manage');
    Route::patch('/orders/{order}/supplier/aliexpress/context', [AdminOrderController::class, 'updateAliExpressFulfillmentContext'])
        ->middleware('permission:orders.manage');
    Route::get('/orders/{order}/supplier/aliexpress/ds-draft', [AdminOrderController::class, 'aliExpressDropshippingDraft'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/create-order', [AdminOrderController::class, 'aliExpressCreateDropshippingOrder'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/sync-order', [AdminOrderController::class, 'syncAliExpressRemoteOrder'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/resolve-mode', [AdminOrderController::class, 'resolveAliExpressShippingMode'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/pack', [AdminOrderController::class, 'aliExpressPack'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/ship', [AdminOrderController::class, 'aliExpressShip'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/repack', [AdminOrderController::class, 'aliExpressRepack'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/print-waybill', [AdminOrderController::class, 'aliExpressPrintWaybill'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/invoice/query-request', [AdminOrderController::class, 'aliExpressQueryInvoiceRequest'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/invoice/upload-brazil', [AdminOrderController::class, 'aliExpressUploadBrazilInvoice'])
        ->middleware('permission:orders.manage');
    Route::post('/orders/{order}/supplier/aliexpress/invoice/push-result', [AdminOrderController::class, 'aliExpressPushInvoiceResult'])
        ->middleware('permission:orders.manage');
    Route::get('/orders/{order}/supplier/aliexpress/invoice/document', [AdminOrderController::class, 'downloadAliExpressInvoiceDocument'])
        ->middleware('permission:orders.view');

    // Gaming Account Marketplace (DM Partner / Sellers)
    Route::get('/marketplace/sellers', [AdminMarketplaceSellerController::class, 'index'])
        ->middleware('permission:marketplace.sellers.view');
    Route::get('/marketplace/sellers/{seller}', [AdminMarketplaceSellerController::class, 'show'])
        ->middleware('permission:marketplace.sellers.view');
    Route::get('/marketplace/sellers/{seller}/kyc/{type}', [AdminMarketplaceSellerController::class, 'downloadKycFile'])
        ->middleware('permission:marketplace.sellers.view');
    Route::post('/marketplace/sellers/{seller}/approve', [AdminMarketplaceSellerController::class, 'approve'])
        ->middleware('permission:marketplace.sellers.manage');
    Route::post('/marketplace/sellers/{seller}/refuse', [AdminMarketplaceSellerController::class, 'refuse'])
        ->middleware('permission:marketplace.sellers.manage');
    Route::post('/marketplace/sellers/{seller}/suspend', [AdminMarketplaceSellerController::class, 'suspend'])
        ->middleware('permission:marketplace.sellers.manage');
    Route::post('/marketplace/sellers/{seller}/ban', [AdminMarketplaceSellerController::class, 'ban'])
        ->middleware('permission:marketplace.sellers.manage');
    Route::post('/marketplace/sellers/{seller}/freeze-wallet', [AdminMarketplaceSellerController::class, 'freezeWallet'])
        ->middleware('permission:marketplace.sellers.manage');
    Route::post('/marketplace/sellers/{seller}/unfreeze-wallet', [AdminMarketplaceSellerController::class, 'unfreezeWallet'])
        ->middleware('permission:marketplace.sellers.manage');

    // Gaming Account Marketplace (Listings moderation)
    Route::get('/marketplace/listings', [AdminMarketplaceListingController::class, 'index'])
        ->middleware('permission:marketplace.listings.manage');
    Route::get('/marketplace/listings/{sellerListing}', [AdminMarketplaceListingController::class, 'show'])
        ->middleware('permission:marketplace.listings.manage');
    Route::post('/marketplace/listings/{sellerListing}/approve', [AdminMarketplaceListingController::class, 'approve'])
        ->middleware('permission:marketplace.listings.manage');
    Route::post('/marketplace/listings/{sellerListing}/reject', [AdminMarketplaceListingController::class, 'reject'])
        ->middleware('permission:marketplace.listings.manage');
    Route::post('/marketplace/listings/{sellerListing}/suspend', [AdminMarketplaceListingController::class, 'suspend'])
        ->middleware('permission:marketplace.listings.manage');

    // Gaming Account Marketplace (Withdraw requests)
    Route::get('/marketplace/withdraw-requests', [AdminMarketplaceWithdrawController::class, 'index'])
        ->middleware('permission:marketplace.withdraws.manage');
    Route::post('/marketplace/withdraw-requests/{partnerWithdrawRequest}/mark-paid', [AdminMarketplaceWithdrawController::class, 'markPaid'])
        ->middleware('permission:marketplace.withdraws.manage');
    Route::post('/marketplace/withdraw-requests/{partnerWithdrawRequest}/reject', [AdminMarketplaceWithdrawController::class, 'reject'])
        ->middleware('permission:marketplace.withdraws.manage');
    Route::get('/premium/requests', [AdminPremiumRequestController::class, 'index'])
        ->middleware('permission:premium.manage');
    Route::post('/premium/requests/{premiumRequest}/approve', [AdminPremiumRequestController::class, 'approve'])
        ->middleware('permission:premium.manage');
    Route::post('/premium/requests/{premiumRequest}/refuse', [AdminPremiumRequestController::class, 'refuse'])
        ->middleware('permission:premium.manage');

    // Gaming Account Marketplace (Disputes)
    Route::get('/marketplace/disputes', [AdminMarketplaceDisputeController::class, 'index'])
        ->middleware('permission:marketplace.disputes.manage');
    Route::post('/marketplace/disputes/{dispute}/resolve', [AdminMarketplaceDisputeController::class, 'resolve'])
        ->middleware('permission:marketplace.disputes.manage');

    // Gaming Account Marketplace (Manual release)
    Route::get('/marketplace/orders', [AdminMarketplaceOrderController::class, 'index'])
        ->middleware('permission:marketplace.orders.manage');
    Route::get('/marketplace/orders/{marketplaceOrder}', [AdminMarketplaceOrderController::class, 'show'])
        ->middleware('permission:marketplace.orders.manage');
    Route::get('/marketplace/orders/{marketplaceOrder}/delivery-proof', [AdminMarketplaceOrderController::class, 'downloadDeliveryProof'])
        ->middleware('permission:marketplace.orders.manage');
    Route::post('/marketplace/orders/{marketplaceOrder}/release', [AdminMarketplaceOrderController::class, 'release'])
        ->middleware('permission:marketplace.orders.manage');

    // Gaming Account Marketplace (Commission rules)
    Route::get('/marketplace/commission-rules', [AdminMarketplaceCommissionController::class, 'index'])
        ->middleware('permission:marketplace.settings.manage');
    Route::post('/marketplace/commission-rules', [AdminMarketplaceCommissionController::class, 'upsert'])
        ->middleware('permission:marketplace.settings.manage');

    // Redeem inventory
    Route::get('/redeem-lots', [AdminRedeemLotController::class, 'index'])->middleware('permission:redeems.view');
    Route::post('/redeem-lots', [AdminRedeemLotController::class, 'store'])->middleware('permission:redeems.manage');

    Route::get('/redeem/denominations', [AdminRedeemCodeController::class, 'denominations'])->middleware('permission:redeems.view');
    Route::get('/redeem/stats', [AdminRedeemCodeController::class, 'stats'])->middleware('permission:redeems.view');
    Route::get('/redeem', [AdminRedeemCodeController::class, 'index'])->middleware('permission:redeems.view');
    Route::get('/redeem/used', [AdminRedeemCodeController::class, 'used'])->middleware('permission:redeems.view');
    Route::get('/redeem/export', [AdminRedeemCodeController::class, 'export'])->middleware('permission:redeems.view');
    Route::post('/redeem', [AdminRedeemCodeController::class, 'store'])->middleware('permission:redeems.manage');
    Route::post('/redeem/import', [AdminRedeemCodeController::class, 'import'])->middleware('permission:redeems.manage');
    Route::post('/redeem/{redeemCode}/invalidate', [AdminRedeemCodeController::class, 'invalidate'])->middleware('permission:redeems.manage');
    Route::get('/redeem/low-stock', [AdminRedeemCodeController::class, 'lowStockProducts'])->middleware('permission:redeems.view');

    Route::get('/redeem-codes', [AdminRedeemCodeController::class, 'index'])->middleware('permission:redeems.view');
    Route::get('/redeem-codes/used', [AdminRedeemCodeController::class, 'used'])->middleware('permission:redeems.view');
    Route::get('/redeem-codes/stats', [AdminRedeemCodeController::class, 'stats'])->middleware('permission:redeems.view');
    Route::get('/redeem-codes/denominations', [AdminRedeemCodeController::class, 'denominations'])->middleware('permission:redeems.view');
    Route::get('/redeem-codes/low-stock', [AdminRedeemCodeController::class, 'lowStockProducts'])->middleware('permission:redeems.view');
    Route::get('/redeem-codes/export', [AdminRedeemCodeController::class, 'export'])->middleware('permission:redeems.view');
    Route::post('/redeem-codes', [AdminRedeemCodeController::class, 'store'])->middleware('permission:redeems.manage');
    Route::post('/redeem-codes/import', [AdminRedeemCodeController::class, 'import'])->middleware('permission:redeems.manage');
    Route::post('/redeem-codes/{redeemCode}/invalidate', [AdminRedeemCodeController::class, 'invalidate'])->middleware('permission:redeems.manage');

    // Chat moderation
    Route::post('/chat/rooms/{room}/mute', [ChatController::class, 'muteUser'])->middleware('permission:support.manage');
    Route::post('/chat/rooms/{room}/ban', [ChatController::class, 'banUser'])->middleware('permission:support.manage');

    // Settings reserved for admins (admin + super)
    Route::middleware('requireRole:admin_super,admin')->group(function () {
        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::post('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/logo', [AdminSettingsController::class, 'uploadLogo']);
    });

    Route::middleware('requireRole:admin_super,admin,admin_operations,admin_domain,staff,admin_article,admin_manager,admin_marketing,admin_client,admin_support,viewer')->group(function () {
        Route::post('/products', [AdminProductController::class, 'store'])->middleware('permission:products.manage');
        Route::patch('/products/{product}', [AdminProductController::class, 'update'])->middleware('permission:products.manage');
        Route::delete('/products/{product}', [AdminProductController::class, 'destroy'])->middleware('permission:products.manage');
        Route::post('/products/{product}/image', [AdminProductController::class, 'uploadImage'])->middleware('permission:products.manage');
        Route::post('/products/{product}/video', [AdminProductController::class, 'uploadVideo'])->middleware('permission:products.manage');

        Route::post('/offers/likes', [AdminOfferController::class, 'boostLikes'])->middleware('permission:promotions.manage');

        Route::get('/categories', [AdminCategoryController::class, 'index'])->middleware('permission:categories.manage');
        Route::post('/categories', [AdminCategoryController::class, 'store'])->middleware('permission:categories.manage');
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update'])->middleware('permission:categories.manage');
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy'])->middleware('permission:categories.manage');
        Route::post('/categories/{category}/image', [AdminCategoryController::class, 'uploadImage'])->middleware('permission:categories.manage');

        Route::get('/games', [\App\Http\Controllers\Api\AdminGameController::class, 'index'])->middleware('permission:categories.manage');
        Route::post('/games', [\App\Http\Controllers\Api\AdminGameController::class, 'store'])->middleware('permission:categories.manage');
        Route::patch('/games/{game}', [\App\Http\Controllers\Api\AdminGameController::class, 'update'])->middleware('permission:categories.manage');
        Route::delete('/games/{game}', [\App\Http\Controllers\Api\AdminGameController::class, 'destroy'])->middleware('permission:categories.manage');

        Route::get('/tournaments', [AdminTournamentController::class, 'index'])->middleware('permission:tournaments.view');
        Route::get('/tournaments/{tournament}', [AdminTournamentController::class, 'show'])->middleware('permission:tournaments.view');
        Route::get('/tournaments/{tournament}/registrations', [AdminTournamentController::class, 'registrations'])->middleware('permission:tournaments.view');
        Route::get('/tournaments/{tournament}/registrations/export', [AdminTournamentController::class, 'exportRegistrations'])->middleware('permission:tournaments.view');
        Route::post('/tournaments', [AdminTournamentController::class, 'store'])->middleware('permission:tournaments.manage');
        Route::patch('/tournaments/{tournament}', [AdminTournamentController::class, 'update'])->middleware('permission:tournaments.manage');
        Route::delete('/tournaments/{tournament}', [AdminTournamentController::class, 'destroy'])->middleware('permission:tournaments.manage');
        Route::post('/tournaments/{tournament}/rewards/publish', [AdminTournamentController::class, 'publishRewards'])->middleware('permission:tournaments.manage');
    });

    Route::get('/coupons', [\App\Http\Controllers\Api\AdminCouponController::class, 'index'])
        ->middleware('permission:coupons.manage');
    Route::get('/coupons/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'show'])
        ->middleware('permission:coupons.manage');
    Route::post('/coupons', [\App\Http\Controllers\Api\AdminCouponController::class, 'store'])
        ->middleware('permission:coupons.manage');
    Route::patch('/coupons/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'update'])
        ->middleware('permission:coupons.manage');
    Route::delete('/coupons/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'destroy'])
        ->middleware('permission:coupons.manage');

    Route::get('/promotions', [\App\Http\Controllers\Api\AdminCouponController::class, 'index'])
        ->middleware('permission:coupons.manage');
    Route::get('/promotions/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'show'])
        ->middleware('permission:coupons.manage');
    Route::post('/promotions', [\App\Http\Controllers\Api\AdminCouponController::class, 'store'])
        ->middleware('permission:coupons.manage');
    Route::patch('/promotions/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'update'])
        ->middleware('permission:coupons.manage');
    Route::delete('/promotions/{coupon}', [\App\Http\Controllers\Api\AdminCouponController::class, 'destroy'])
        ->middleware('permission:coupons.manage');

    Route::middleware('requireRole:admin_super')->group(function () {
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
    });

    Route::get('/email-logs', [\App\Http\Controllers\Api\AdminEmailLogsController::class, 'index'])
        ->middleware('permission:email.view');
    Route::get('/email-templates', [\App\Http\Controllers\Api\AdminEmailTemplateController::class, 'index'])
        ->middleware('permission:email.manage');
    Route::get('/email-templates/{emailTemplate}', [\App\Http\Controllers\Api\AdminEmailTemplateController::class, 'show'])
        ->middleware('permission:email.manage');
    Route::post('/email-templates', [\App\Http\Controllers\Api\AdminEmailTemplateController::class, 'store'])
        ->middleware('permission:email.manage');
    Route::patch('/email-templates/{emailTemplate}', [\App\Http\Controllers\Api\AdminEmailTemplateController::class, 'update'])
        ->middleware('permission:email.manage');
    Route::delete('/email-templates/{emailTemplate}', [\App\Http\Controllers\Api\AdminEmailTemplateController::class, 'destroy'])
        ->middleware('permission:email.manage');

    Route::post('/email/send-direct', [\App\Http\Controllers\Api\AdminEmailSendController::class, 'sendDirect'])
        ->middleware('permission:email.manage');

    Route::get('/support/tickets', [\App\Http\Controllers\Api\AdminSupportController::class, 'index'])
        ->middleware('permission:support.view');
    Route::post('/support/tickets/{ticket}/reply', [\App\Http\Controllers\Api\AdminSupportController::class, 'reply'])
        ->middleware('permission:support.manage');
    Route::patch('/support/tickets/{ticket}', [\App\Http\Controllers\Api\AdminSupportController::class, 'update'])
        ->middleware('permission:support.manage');

    Route::post('/notifications/broadcast', [\App\Http\Controllers\Api\AdminNotificationController::class, 'broadcast'])
        ->middleware('permission:notifications.manage');

    Route::get('/stock/movements', [\App\Http\Controllers\Api\AdminStockController::class, 'movements'])
        ->middleware('permission:stock.manage');
    Route::post('/stock/products/{product}/adjust', [\App\Http\Controllers\Api\AdminStockController::class, 'adjustProduct'])
        ->middleware('permission:stock.manage');
    Route::get('/stock/movements/export', [\App\Http\Controllers\Api\AdminStockController::class, 'export'])
        ->middleware('permission:stock.manage');

    Route::get('/sourcing/supplier-accounts', [\App\Http\Controllers\Api\AdminSupplierAccountController::class, 'index'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/supplier-accounts', [\App\Http\Controllers\Api\AdminSupplierAccountController::class, 'store'])
        ->middleware('permission:sourcing.manage');
    Route::patch('/sourcing/supplier-accounts/{supplierAccount}', [\App\Http\Controllers\Api\AdminSupplierAccountController::class, 'update'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/supplier-accounts/{supplierAccount}/oauth/connect', [\App\Http\Controllers\Api\AdminSupplierOAuthController::class, 'connect'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/supplier-accounts/{supplierAccount}/oauth/refresh', [\App\Http\Controllers\Api\AdminSupplierOAuthController::class, 'refresh'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/supplier-products', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'index'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/catalog/import', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'import'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/aliexpress/bulk-import', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'bulkImportAliExpress'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/aliexpress/ds-bulk-import', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'bulkImportAliExpressDs'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/aliexpress/auto-map-ds', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'autoMapAliExpressDs'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/supplier-products/bulk-delete', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'bulkDelete'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/fetch-remote', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'fetchRemote'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/search-remote', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'searchRemote'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/predict-category', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'predictCategory'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/videos/upload', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'uploadVideo'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/videos/upload-result', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'videoUploadResult'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/videos/query', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'queryVideos'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/videos/attach-main', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'attachMainVideo'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/buyer-items/add', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'buyerAddItem'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/buyer-items/update', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'buyerUpdateItem'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/buyer-items/delete', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'buyerDeleteItem'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/buyer-items/query', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'buyerQueryItems'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/buyer-eco/{operation}', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'buyerEcoOperation'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/iop/{operation}', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'iopOperation'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/catalog/iop/order-attachment-upload', [\App\Http\Controllers\Api\AdminSupplierCatalogController::class, 'uploadOrderAttachment'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/dashboard', [\App\Http\Controllers\Api\AdminProcurementController::class, 'dashboard'])
        ->middleware('permission:sourcing.view');
    Route::get('/sourcing/local-products', [\App\Http\Controllers\Api\AdminProductSourcingController::class, 'localProducts'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/local-products/bulk-delete', [\App\Http\Controllers\Api\AdminProductSourcingController::class, 'bulkDeleteLocalProducts'])
        ->middleware('permission:sourcing.manage');
    Route::get('/sourcing/mappings', [\App\Http\Controllers\Api\AdminProductSourcingController::class, 'mappings'])
        ->middleware('permission:sourcing.view');
    Route::get('/sourcing/supplier-skus', [\App\Http\Controllers\Api\AdminProductSourcingController::class, 'supplierSkus'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/mappings', [\App\Http\Controllers\Api\AdminProductSourcingController::class, 'storeMapping'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/demands', [\App\Http\Controllers\Api\AdminProcurementController::class, 'demands'])
        ->middleware('permission:sourcing.view');
    Route::get('/sourcing/batches', [\App\Http\Controllers\Api\AdminProcurementController::class, 'batches'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/batches/draft', [\App\Http\Controllers\Api\AdminProcurementController::class, 'createDraftBatch'])
        ->middleware('permission:sourcing.manage');
    Route::patch('/sourcing/batches/{procurementBatch}/approve', [\App\Http\Controllers\Api\AdminProcurementController::class, 'approveBatch'])
        ->middleware('permission:sourcing.manage');
    Route::patch('/sourcing/batches/{procurementBatch}/submit', [\App\Http\Controllers\Api\AdminProcurementController::class, 'submitBatch'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/inbound-shipments', [\App\Http\Controllers\Api\AdminInboundShipmentController::class, 'index'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/inbound-shipments', [\App\Http\Controllers\Api\AdminInboundShipmentController::class, 'store'])
        ->middleware('permission:sourcing.manage');
    Route::post('/sourcing/warehouse-receipts', [\App\Http\Controllers\Api\AdminInboundShipmentController::class, 'storeReceipt'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/countries', [\App\Http\Controllers\Api\AdminSupplierCountryController::class, 'index'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/countries', [\App\Http\Controllers\Api\AdminSupplierCountryController::class, 'store'])
        ->middleware('permission:sourcing.manage');
    Route::patch('/sourcing/countries/{supplierCountry}', [\App\Http\Controllers\Api\AdminSupplierCountryController::class, 'update'])
        ->middleware('permission:sourcing.manage');
    Route::delete('/sourcing/countries/{supplierCountry}', [\App\Http\Controllers\Api\AdminSupplierCountryController::class, 'destroy'])
        ->middleware('permission:sourcing.manage');

    Route::get('/sourcing/receiving-addresses', [\App\Http\Controllers\Api\AdminSupplierReceivingAddressController::class, 'index'])
        ->middleware('permission:sourcing.view');
    Route::post('/sourcing/receiving-addresses', [\App\Http\Controllers\Api\AdminSupplierReceivingAddressController::class, 'store'])
        ->middleware('permission:sourcing.manage');
    Route::patch('/sourcing/receiving-addresses/{supplierReceivingAddress}', [\App\Http\Controllers\Api\AdminSupplierReceivingAddressController::class, 'update'])
        ->middleware('permission:sourcing.manage');
    Route::delete('/sourcing/receiving-addresses/{supplierReceivingAddress}', [\App\Http\Controllers\Api\AdminSupplierReceivingAddressController::class, 'destroy'])
        ->middleware('permission:sourcing.manage');

    Route::get('/payments', [\App\Http\Controllers\Api\AdminPaymentsController::class, 'index'])
        ->middleware('permission:payments.view');
    Route::post('/payments/{payment}/resync', [\App\Http\Controllers\Api\AdminPaymentsController::class, 'resync'])
        ->middleware('permission:payments.resync');

    Route::get('/users', [\App\Http\Controllers\Api\AdminUsersController::class, 'index'])
        ->middleware('permission:users.view');
    Route::get('/users/{user}', [\App\Http\Controllers\Api\AdminUsersController::class, 'show'])
        ->middleware('permission:users.view');

    // Phone changes
    Route::get('/users/{user}/phone-change-requests', [AdminPhoneChangeController::class, 'indexByUser'])
        ->middleware('permission:users.view');
    Route::post('/users/{user}/phone/change', [AdminPhoneChangeController::class, 'applyManual'])
        ->middleware('permission:users.manage');
    Route::post('/phone-change-requests/{phoneChangeRequest}/approve', [AdminPhoneChangeController::class, 'approve'])
        ->middleware('permission:users.manage');
    Route::post('/phone-change-requests/{phoneChangeRequest}/reject', [AdminPhoneChangeController::class, 'reject'])
        ->middleware('permission:users.manage');

    // DBWallet (admin-only manual operations)
    Route::get('/dbwallet/transactions', [AdminDbWalletController::class, 'transactions'])
        ->middleware('permission:wallet.manage');
    Route::get('/dbwallet/payouts', [AdminDbWalletController::class, 'payouts'])
        ->middleware('permission:wallet.manage');
    Route::post('/dbwallet/payouts/{payout}/sync', [AdminDbWalletController::class, 'syncPayout'])
        ->middleware('permission:wallet.manage');
    Route::post('/dbwallet/credit', [AdminDbWalletController::class, 'credit'])
        ->middleware('permission:wallet.manage');
    Route::get('/dbwallet/blocked', [AdminDbWalletController::class, 'blocked'])
        ->middleware('permission:wallet.manage');
    Route::post('/dbwallet/block', [AdminDbWalletController::class, 'block'])
        ->middleware('permission:wallet.manage');
    Route::post('/dbwallet/unblock', [AdminDbWalletController::class, 'unblock'])
        ->middleware('permission:wallet.manage');

    // Marketing welcome bonus (first 20 users, 24h validity)
    Route::get('/dbwallet/welcome-bonus', [AdminDbWalletWelcomeBonusController::class, 'index'])
        ->middleware('permission:wallet.manage');
    Route::post('/dbwallet/welcome-bonus/grant', [AdminDbWalletWelcomeBonusController::class, 'grant'])
        ->middleware('permission:wallet.manage');

    Route::post('/users/{user}/wallet/credit', [\App\Http\Controllers\Api\AdminUsersController::class, 'creditWallet'])
        ->middleware('permission:wallet.manage');
    Route::patch('/users/{user}', [\App\Http\Controllers\Api\AdminUsersController::class, 'update'])
        ->middleware('permission:users.manage');
    Route::get('/users/export', [\App\Http\Controllers\Api\AdminUsersController::class, 'export'])
        ->middleware('permission:users.view');
});

// SSE streaming endpoint (auth handled inside controller to allow token query param)
Route::get('/chat/stream/{room}', [ChatController::class, 'stream']);