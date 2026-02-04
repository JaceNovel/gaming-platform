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
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\FedaPayWebhookController;
use App\Http\Controllers\Api\PremiumController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PushController;
use App\Http\Controllers\Api\ReferralController;
use App\Http\Controllers\Api\GuideController;
use App\Http\Controllers\Api\UserProfileController;
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
use App\Http\Controllers\Api\AdminMarketplaceWithdrawController;
use App\Http\Controllers\Api\MarketplaceListingController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    Route::post('/password/update', [AuthController::class, 'updatePassword'])->middleware('auth:sanctum');
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
        'app' => 'BADBOYSHOP',
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

// Client-side error reporting (best-effort, no auth)
Route::post('/client-errors', [\App\Http\Controllers\Api\ClientErrorController::class, 'store']);

// Image proxy (for external image URLs copied from websites)
Route::get('/image-proxy', [ImageProxyController::class, 'show']);

// Public listing routes
Route::apiResource('games', GameController::class)->only(['index', 'show']);
Route::get('products/{product}', [ProductController::class, 'show']);
Route::get('products', [ProductController::class, 'index']);
Route::get('categories', [CategoryController::class, 'index']);
Route::get('categories/{category}', [CategoryController::class, 'show']);
Route::get('gaming-accounts/listings', [MarketplaceListingController::class, 'index']);
Route::get('gaming-accounts/listings/{sellerListing}', [MarketplaceListingController::class, 'showPublic']);
Route::get('/stats/overview', [PublicStatsController::class, 'overview']);
Route::get('/likes/stats', [LikeController::class, 'stats']);

// Webhooks (no auth required)
Route::post('/payments/cinetpay/webhook', [PaymentWebhookController::class, 'handle'])->name('api.payments.cinetpay.webhook');
Route::match(['get', 'post'], '/payments/cinetpay/return', [PaymentWebhookController::class, 'redirect'])->name('api.payments.cinetpay.return');
Route::match(['get', 'post'], '/payments/fedapay/return', [PaymentController::class, 'redirectFedapayReturn'])->name('api.payments.fedapay.return');
Route::post('/payments/fedapay/webhook', [FedaPayWebhookController::class, 'handle'])->name('api.payments.fedapay.webhook');

Route::get('/guides/shop2game-freefire', [GuideController::class, 'shop2gameFreeFire']);

// Web Push (public key)
Route::get('/push/vapid-public-key', [PushController::class, 'vapidPublicKey']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Products actions
    Route::post('products/{product}/like', [ProductController::class, 'like']);
        Route::post('likes/toggle', [LikeController::class, 'toggle']);

    // Orders
    Route::apiResource('orders', OrderController::class)->only(['index', 'show', 'store']);
    Route::get('/orders/{order}/redeem-codes', [OrderController::class, 'redeemCodes']);
    Route::post('/orders/{order}/redeem-codes/resend', [OrderController::class, 'resendRedeemCodes']);

    // Cart
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);

    // Payments
    Route::post('/payments/cinetpay/init', [PaymentController::class, 'init'])->name('api.payments.cinetpay.init');
    Route::get('/payments/cinetpay/status', [PaymentController::class, 'status'])->name('api.payments.cinetpay.status');

    Route::post('/payments/fedapay/init', [PaymentController::class, 'initFedapay'])->name('api.payments.fedapay.init');
    Route::get('/payments/fedapay/status', [PaymentController::class, 'statusFedapay'])->name('api.payments.fedapay.status');

    Route::post('/payments/wallet/pay', [PaymentController::class, 'payWithWallet'])->name('api.payments.wallet.pay');

    // Premium
    Route::get('/premium/status', [PremiumController::class, 'status']);
    Route::post('/premium/init', [PremiumController::class, 'init']);
    Route::post('/premium/subscribe', [PremiumController::class, 'subscribe']);
    Route::post('/premium/cancel', [PremiumController::class, 'cancel']);

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

    // Referrals
    Route::get('/referrals/me', [ReferralController::class, 'me']);
    Route::post('/referrals/generate', [ReferralController::class, 'generate']);

    // Web Push
    Route::post('/push/subscribe', [PushController::class, 'subscribe']);
    Route::post('/push/unsubscribe', [PushController::class, 'unsubscribe']);
    Route::post('/push/test', [PushController::class, 'test']);

    // Profile
    Route::get('/me/profile', [UserProfileController::class, 'show']);
    Route::patch('/me/profile', [UserProfileController::class, 'update']);

    // Redeem deliveries
    Route::get('/me/redeems', [MeRedeemController::class, 'index']);

    // Reviews
    Route::get('/reviews', [ReviewController::class, 'index']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // Support tickets
    Route::get('/support/inbox', [SupportTicketController::class, 'inbox']);
    Route::post('/support/inbox/read-all', [SupportTicketController::class, 'markAllRead']);
    Route::post('/support/tickets', [SupportTicketController::class, 'store']);
    Route::get('/support/tickets/{ticket}', [SupportTicketController::class, 'show']);
    Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'reply']);

    // Gaming Account Marketplace (Seller KYC)
    Route::prefix('gaming-accounts')->group(function () {
        Route::get('/seller/me', [SellerKycController::class, 'me']);
        Route::post('/seller/apply', [SellerKycController::class, 'apply']);
        Route::post('/seller/kyc/id-front', [SellerKycController::class, 'uploadIdFront']);
        Route::post('/seller/kyc/selfie', [SellerKycController::class, 'captureSelfie']);

        // DB Partner wallet
        Route::get('/partner-wallet', [PartnerWalletController::class, 'show']);
        Route::post('/partner-wallet/withdraw', [PartnerWalletController::class, 'requestWithdraw']);

        // Seller listings
        Route::get('/listings/mine', [MarketplaceListingController::class, 'mine']);
        Route::post('/listings', [MarketplaceListingController::class, 'store']);
        Route::patch('/listings/{sellerListing}', [MarketplaceListingController::class, 'update']);
        Route::patch('/listings/{sellerListing}/status', [MarketplaceListingController::class, 'setStatus']);
    });

});

// Admin routes
Route::middleware(['auth:sanctum', 'admin', 'requireRole:admin_super,admin_manager,admin_support,admin_marketing,viewer,admin,staff,admin_article,admin_client'])->prefix('admin')->group(function () {
    Route::get('/me', AdminMeController::class);
    Route::get('/dashboard', [AdminDashboardController::class, 'overview']);
    Route::get('/stats/overview', [AdminDashboardController::class, 'statsOverview'])->middleware('permission:stats.view');
    Route::get('/stats/revenue', [AdminDashboardController::class, 'revenue'])->middleware('permission:stats.view');
    Route::get('/dashboard/tables', [AdminDashboardController::class, 'tables']);
    Route::get('/dashboard/export', [AdminDashboardController::class, 'export']);
    Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
    Route::get('/dashboard/charts', [AdminDashboardController::class, 'charts']);

    // Orders + fulfillment
    Route::get('/orders', [AdminOrderController::class, 'index'])->middleware('permission:orders.view');
    Route::get('/orders/recent', [AdminOrderController::class, 'recent'])->middleware('permission:orders.view');
    Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
    Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->middleware('permission:orders.manage');
    Route::patch('/orders/{order}/payment/status', [AdminOrderController::class, 'updatePaymentStatus'])->middleware('permission:orders.manage');
    Route::post('/orders/{order}/refund', [AdminOrderController::class, 'refund'])->middleware('permission:orders.manage');
    Route::post('/orders/{order}/delivery-note-pdf', [AdminOrderController::class, 'deliveryNotePdf']);
    Route::post('/orders/{order}/resend-code', [AdminOrderController::class, 'resendCode']);
    Route::post('/orders/{order}/shipping/generate-document', [AdminOrderController::class, 'generateShippingDocument'])
        ->middleware('permission:orders.manage');
    Route::get('/orders/{order}/shipping/document', [AdminOrderController::class, 'downloadShippingDocument'])
        ->middleware('permission:orders.view');
    Route::patch('/orders/{order}/shipping/status', [AdminOrderController::class, 'updateShippingStatus'])
        ->middleware('permission:orders.manage');

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

    // Gaming Account Marketplace (Withdraw requests)
    Route::get('/marketplace/withdraw-requests', [AdminMarketplaceWithdrawController::class, 'index'])
        ->middleware('permission:marketplace.withdraws.manage');
    Route::post('/marketplace/withdraw-requests/{partnerWithdrawRequest}/mark-paid', [AdminMarketplaceWithdrawController::class, 'markPaid'])
        ->middleware('permission:marketplace.withdraws.manage');
    Route::post('/marketplace/withdraw-requests/{partnerWithdrawRequest}/reject', [AdminMarketplaceWithdrawController::class, 'reject'])
        ->middleware('permission:marketplace.withdraws.manage');

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
    Route::post('/chat/rooms/{room}/mute', [ChatController::class, 'muteUser']);
    Route::post('/chat/rooms/{room}/ban', [ChatController::class, 'banUser']);

    // Settings reserved for admins (admin + super)
    Route::middleware('requireRole:admin_super,admin')->group(function () {
        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::post('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/logo', [AdminSettingsController::class, 'uploadLogo']);
    });

    Route::middleware('requireRole:admin_super,admin,staff,admin_article,admin_manager,admin_marketing')->group(function () {
        Route::post('/products', [AdminProductController::class, 'store']);
        Route::patch('/products/{product}', [AdminProductController::class, 'update']);
        Route::delete('/products/{product}', [AdminProductController::class, 'destroy']);
        Route::post('/products/{product}/image', [AdminProductController::class, 'uploadImage']);

        Route::post('/offers/likes', [AdminOfferController::class, 'boostLikes']);

        Route::get('/categories', [AdminCategoryController::class, 'index']);
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update']);
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy']);
        Route::post('/categories/{category}/image', [AdminCategoryController::class, 'uploadImage']);

        Route::get('/games', [\App\Http\Controllers\Api\AdminGameController::class, 'index']);
        Route::post('/games', [\App\Http\Controllers\Api\AdminGameController::class, 'store']);
        Route::patch('/games/{game}', [\App\Http\Controllers\Api\AdminGameController::class, 'update']);
        Route::delete('/games/{game}', [\App\Http\Controllers\Api\AdminGameController::class, 'destroy']);
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

    Route::get('/payments', [\App\Http\Controllers\Api\AdminPaymentsController::class, 'index'])
        ->middleware('permission:payments.view');
    Route::post('/payments/{payment}/resync', [\App\Http\Controllers\Api\AdminPaymentsController::class, 'resync'])
        ->middleware('permission:payments.resync');

    Route::get('/users', [\App\Http\Controllers\Api\AdminUsersController::class, 'index'])
        ->middleware('permission:users.view');
    Route::get('/users/{user}', [\App\Http\Controllers\Api\AdminUsersController::class, 'show'])
        ->middleware('permission:users.view');

    // DBWallet (admin-only manual operations)
    Route::get('/dbwallet/transactions', [AdminDbWalletController::class, 'transactions'])
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