<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderSupplierFulfillment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'supplier_account_id',
        'platform',
        'external_order_id',
        'external_order_lines_json',
        'seller_id',
        'locale',
        'shipping_mode',
        'shipping_provider_code',
        'shipping_provider_name',
        'carrier_code',
        'tracking_number',
        'package_id',
        'pickup_address_id',
        'refund_address_id',
        'invoice_customer_id',
        'invoice_status',
        'invoice_request_no',
        'invoice_no',
        'invoice_date',
        'invoice_file_type',
        'invoice_file_name',
        'invoice_direction',
        'invoice_file_path',
        'invoice_document_url',
        'invoice_latest_request_payload_json',
        'invoice_latest_response_payload_json',
        'invoice_requested_at',
        'invoice_uploaded_at',
        'invoice_pushed_at',
        'asf_status',
        'asf_sub_status',
        'latest_document_type',
        'document_url',
        'document_bytes_base64',
        'resolved_shipping_services_json',
        'latest_request_payload_json',
        'latest_response_payload_json',
        'metadata_json',
        'last_synced_at',
        'packed_at',
        'shipped_at',
        'repacked_at',
        'waybill_printed_at',
    ];

    protected $casts = [
        'external_order_lines_json' => 'array',
        'invoice_latest_request_payload_json' => 'array',
        'invoice_latest_response_payload_json' => 'array',
        'resolved_shipping_services_json' => 'array',
        'latest_request_payload_json' => 'array',
        'latest_response_payload_json' => 'array',
        'metadata_json' => 'array',
        'invoice_date' => 'datetime',
        'invoice_requested_at' => 'datetime',
        'invoice_uploaded_at' => 'datetime',
        'invoice_pushed_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'packed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'repacked_at' => 'datetime',
        'waybill_printed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(SupplierAccount::class);
    }
}