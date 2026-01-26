<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ADMIN_ROLES = [
        'admin',
        'admin_super',
        'admin_manager',
        'admin_support',
        'admin_marketing',
        'admin_article',
        'admin_client',
        'staff',
        'viewer',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'game_username',
        'country_code',
        'country_name',
        'avatar_id',
        'premium_tier',
        'is_premium',
        'premium_level',
        'premium_expiration',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'premium_expiration' => 'datetime',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(Like::class);
    }

    public function premiumMemberships(): HasMany
    {
        return $this->hasMany(PremiumMembership::class);
    }

    public function walletBd(): HasOne
    {
        return $this->hasOne(WalletBd::class);
    }

    public function walletAccount(): HasOne
    {
        return $this->hasOne(WalletAccount::class);
    }

    public function walletTransactions(): HasMany
    {
        return $this->hasManyThrough(WalletTransaction::class, WalletAccount::class, 'user_id', 'wallet_account_id');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(Payout::class);
    }

    public function referrals(): HasMany
    {
        return $this->hasMany(Referral::class, 'referrer_id');
    }

    public function referredBy(): HasMany
    {
        return $this->hasMany(Referral::class, 'referred_id');
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function chatMemberships(): HasMany
    {
        return $this->hasMany(ChatRoomUser::class);
    }

    public function chatRooms(): BelongsToMany
    {
        return $this->belongsToMany(ChatRoom::class, 'chat_room_user', 'user_id', 'room_id')
            ->withPivot(['role', 'muted_until', 'banned_until', 'message_count'])
            ->withTimestamps();
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(EmailLog::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function adminLogs(): HasMany
    {
        return $this->hasMany(AdminLog::class, 'admin_id');
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, self::ADMIN_ROLES, true);
    }

    public function permissions(): array
    {
        $role = (string) $this->role;
        $map = config('permissions.roles', []);
        $permissions = $map[$role] ?? [];

        if (in_array('*', $permissions, true)) {
            $all = config('permissions.all', []);
            return array_values(array_unique($all));
        }

        return $permissions;
    }

    public function hasPermission(string $permission): bool
    {
        $permissions = $this->permissions();
        return in_array($permission, $permissions, true);
    }
}
