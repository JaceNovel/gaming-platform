<?php

namespace App\Exceptions;

class BulkImportDiagnosticException extends \RuntimeException
{
    public function __construct(string $message, private readonly array $diagnostic = [], int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }

    public function diagnostic(): array
    {
        return $this->diagnostic;
    }
}