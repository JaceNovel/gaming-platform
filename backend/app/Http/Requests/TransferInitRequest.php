<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransferInitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $min = (int) env('WALLET_MIN_TRANSFER', 500);
        $max = (int) env('WALLET_MAX_TRANSFER', 500000);

        return [
            'amount' => ['required', 'numeric', 'min:' . $min, 'max:' . $max],
            'phone' => ['required', 'regex:/^\+[1-9]\d{7,14}$/'],
            'country' => ['required', 'in:TG,CM,GA,BJ,CI,SN,ML,NG'],
            'operator' => ['nullable', 'string', 'max:50'],
        ];
    }
}
