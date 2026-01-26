<?php

namespace App\Exceptions;

use Exception;

class RedeemStockDepletedException extends Exception
{
    public static function forDenomination(int $denominationId): self
    {
        return new self("No redeem codes available for denomination {$denominationId}");
    }
}
