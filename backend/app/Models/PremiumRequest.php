<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PremiumRequest extends Model
{
    protected $fillable = [
        'user_id',
        'level',
        'status',
        'social_platform',
        'social_handle',
        'social_url',
        'followers_count',
        'other_platforms',
        'motivation',
        'promotion_channels',
        'admin_note',
        'rejection_reasons',
        'send_refusal_email',
        'processed_by_admin_id',
        'processed_at',
        'approved_at',
        'refused_at',
        'conditions_pdf_path',
        'certificate_pdf_path',
        'refusal_pdf_path',
        'decision_email_sent_at',
    ];

    protected $casts = [
        'followers_count' => 'integer',
        'other_platforms' => 'array',
        'promotion_channels' => 'array',
        'rejection_reasons' => 'array',
        'send_refusal_email' => 'boolean',
        'processed_at' => 'datetime',
        'approved_at' => 'datetime',
        'refused_at' => 'datetime',
        'decision_email_sent_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_admin_id');
    }
}