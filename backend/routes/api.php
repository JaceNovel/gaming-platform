<?php

use App\Http\Controllers\Api\AdminCategoryController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminProductController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AdminOrderController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\GameController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PremiumController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\UserProfileController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\LikeController;
use App\Http\Controllers\Api\PublicStatsController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ReviewController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

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
    return response()->json([
        'ok' => true,
        'app' => 'BADBOYSHOP',
        'env' => app()->environment(),
        'time' => now()->toIso8601String(),
    ]);
});

// Public listing routes
Route::apiResource('games', GameController::class)->only(['index', 'show']);
Route::get('products/{product}', [ProductController::class, 'show']);
Route::get('products', [ProductController::class, 'index']);
Route::get('categories', [CategoryController::class, 'index']);
Route::get('categories/{category}', [CategoryController::class, 'show']);
Route::get('/stats/overview', [PublicStatsController::class, 'overview']);
Route::get('/likes/stats', [LikeController::class, 'stats']);

// Webhooks (no auth required)
Route::post('/payments/cinetpay/webhook', [PaymentController::class, 'webhookCinetpay'])->name('api.payments.cinetpay.webhook');
Route::post('/wallet/topup/webhook', [WalletController::class, 'webhookTopup'])->name('api.wallet.topup.webhook');

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Products actions
    Route::post('products/{product}/like', [ProductController::class, 'like']);
        Route::post('likes/toggle', [LikeController::class, 'toggle']);

    // Orders
    Route::apiResource('orders', OrderController::class)->only(['index', 'show', 'store']);

    // Cart
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/add', [CartController::class, 'add']);

    // Payments
    Route::post('/payments/cinetpay/init', [PaymentController::class, 'initCinetpay']);

    // Premium
    Route::get('/premium/status', [PremiumController::class, 'status']);
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
    Route::post('/wallet/topup/init', [WalletController::class, 'initTopup']);

    // Profile
    Route::get('/me/profile', [UserProfileController::class, 'show']);
    Route::patch('/me/profile', [UserProfileController::class, 'update']);

    // Reviews
    Route::get('/reviews', [ReviewController::class, 'index']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // Support tickets
    Route::get('/support/inbox', [SupportTicketController::class, 'inbox']);
    Route::post('/support/inbox/read-all', [SupportTicketController::class, 'markAllRead']);
    Route::post('/support/tickets', [SupportTicketController::class, 'store']);
    Route::get('/support/tickets/{ticket}', [SupportTicketController::class, 'show']);
    Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'reply']);

});

// Admin routes
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminDashboardController::class, 'overview']);
    Route::get('/dashboard/tables', [AdminDashboardController::class, 'tables']);
    Route::get('/dashboard/export', [AdminDashboardController::class, 'export']);

    Route::middleware('role:admin,admin_super')->group(function () {
        Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
        Route::get('/dashboard/charts', [AdminDashboardController::class, 'charts']);

        Route::get('/settings', [AdminSettingsController::class, 'show']);
        Route::post('/settings', [AdminSettingsController::class, 'update']);
        Route::post('/settings/logo', [AdminSettingsController::class, 'uploadLogo']);

        // Orders
        Route::patch('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);
        Route::post('/orders/{order}/delivery-note-pdf', [AdminOrderController::class, 'deliveryNotePdf']);

        // Chat moderation
        Route::post('/chat/rooms/{room}/mute', [ChatController::class, 'muteUser']);
        Route::post('/chat/rooms/{room}/ban', [ChatController::class, 'banUser']);
    });

    Route::middleware('role:admin,admin_super,admin_article')->group(function () {
        Route::post('/products', [AdminProductController::class, 'store']);
        Route::patch('/products/{product}', [AdminProductController::class, 'update']);
        Route::delete('/products/{product}', [AdminProductController::class, 'destroy']);

        Route::get('/categories', [AdminCategoryController::class, 'index']);
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::patch('/categories/{category}', [AdminCategoryController::class, 'update']);
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy']);
    });
});

// SSE streaming endpoint (auth handled inside controller to allow token query param)
Route::get('/chat/stream/{room}', [ChatController::class, 'stream']);