<?php

use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminSettingsController;
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
use App\Http\Controllers\Api\TransferController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\TournamentController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Auth routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// Public listing routes
Route::apiResource('games', GameController::class)->only(['index', 'show']);
Route::apiResource('products', ProductController::class)->only(['index', 'show']);
Route::apiResource('tournaments', TournamentController::class)->only(['index', 'show']);

// Webhooks (no auth required)
Route::post('/payments/cinetpay/webhook', [PaymentController::class, 'webhookCinetpay'])->name('api.payments.cinetpay.webhook');
Route::post('/wallet/topup/webhook', [WalletController::class, 'webhookTopup'])->name('api.wallet.topup.webhook');
Route::post('/transfers/cinetpay/webhook', [TransferController::class, 'webhook'])->name('api.transfers.cinetpay.webhook');

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Products actions
    Route::post('products/{product}/like', [ProductController::class, 'like']);

    // Orders
    Route::apiResource('orders', OrderController::class)->only(['index', 'show', 'store']);

    // Payments
    Route::post('/payments/cinetpay/init', [PaymentController::class, 'initCinetpay']);

    // Premium
    Route::get('/premium/status', [PremiumController::class, 'status']);
    Route::post('/premium/subscribe', [PremiumController::class, 'subscribe']);

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
    Route::get('/me', [UserProfileController::class, 'show']);
    Route::patch('/me', [UserProfileController::class, 'update']);

    // Transfers
    Route::post('/transfers/init', [TransferController::class, 'init'])->middleware('throttle:5,1');

    // Support tickets
    Route::get('/support/inbox', [SupportTicketController::class, 'inbox']);
    Route::post('/support/inbox/read-all', [SupportTicketController::class, 'markAllRead']);
    Route::post('/support/tickets', [SupportTicketController::class, 'store']);
    Route::get('/support/tickets/{ticket}', [SupportTicketController::class, 'show']);
    Route::post('/support/tickets/{ticket}/messages', [SupportTicketController::class, 'reply']);

});

// Admin routes
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard/summary', [AdminDashboardController::class, 'summary']);
    Route::get('/dashboard/charts', [AdminDashboardController::class, 'charts']);
    Route::get('/dashboard/tables', [AdminDashboardController::class, 'tables']);
    Route::get('/dashboard/export', [AdminDashboardController::class, 'export']);

    Route::get('/settings', [AdminSettingsController::class, 'show']);
    Route::post('/settings', [AdminSettingsController::class, 'update']);
    Route::post('/settings/logo', [AdminSettingsController::class, 'uploadLogo']);

    // Chat moderation
    Route::post('/chat/rooms/{room}/mute', [ChatController::class, 'muteUser']);
    Route::post('/chat/rooms/{room}/ban', [ChatController::class, 'banUser']);
});

// SSE streaming endpoint (auth handled inside controller to allow token query param)
Route::get('/chat/stream/{room}', [ChatController::class, 'stream']);