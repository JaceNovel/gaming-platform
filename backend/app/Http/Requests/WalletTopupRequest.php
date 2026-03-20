<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WalletTopupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:100'],
            'provider' => ['nullable', 'string', 'in:moneroo,fedapay,paypal,bank_card,cinetpay'],
            'customer_phone' => ['nullable', 'string', 'max:32'],
            'customer_country' => ['nullable', 'string', 'size:2'],
            'return_url' => ['nullable', 'url', 'max:2048'],
        ];
    }
}
