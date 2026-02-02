<?php

namespace Tests\Unit;

use App\Support\FedaPayWebhookSignature;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FedaPayWebhookSignatureUnitTest extends TestCase
{
    #[Test]
    public function parse_header_extracts_timestamp_and_v1(): void
    {
        $parsed = FedaPayWebhookSignature::parseFedaPaySignatureHeader('t=1769900000,v1=abc');

        $this->assertSame('t_v1', $parsed['format']);
        $this->assertSame('1769900000', $parsed['timestamp']);
        $this->assertSame(['abc'], $parsed['v1']);
    }

    #[Test]
    public function parse_header_supports_multiple_v1_with_spaces(): void
    {
        $parsed = FedaPayWebhookSignature::parseFedaPaySignatureHeader('t=1769900000, v1=deadbeef, v1=good');

        $this->assertSame('t_v1', $parsed['format']);
        $this->assertSame('1769900000', $parsed['timestamp']);
        $this->assertSame(['deadbeef', 'good'], $parsed['v1']);
    }

    #[Test]
    public function parse_header_falls_back_to_raw_format(): void
    {
        $parsed = FedaPayWebhookSignature::parseFedaPaySignatureHeader('rawsig');

        $this->assertSame('raw', $parsed['format']);
        $this->assertNull($parsed['timestamp']);
        $this->assertSame(['rawsig'], $parsed['v1']);
    }

    #[Test]
    public function verify_accepts_timestamp_dot_raw_hex_signature(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $raw = '{"id":"evt_1","name":"transaction.approved","entity":{"id":"TX-FEDA-1","status":"approved"}}';
        $timestamp = '1769900000';

        $sig = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);
        $header = 't=' . $timestamp . ',v1=' . $sig;

        $this->assertTrue(FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, $header, $secret, 0));
    }

    #[Test]
    public function verify_accepts_multiple_v1_when_one_matches(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $raw = '{"id":"evt_2","name":"transaction.approved","entity":{"id":"TX-FEDA-2","status":"approved"}}';
        $timestamp = '1769900001';

        $sig = hash_hmac('sha256', $timestamp . '.' . $raw, $secret);
        $header = 't=' . $timestamp . ',v1=deadbeef,v1=' . $sig;

        $this->assertTrue(FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, $header, $secret, 0));
    }

    #[Test]
    public function verify_accepts_legacy_raw_signature_header_hex(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $raw = '{"id":"evt_3","name":"transaction.approved","entity":{"id":"TX-FEDA-3","status":"approved"}}';

        $sig = hash_hmac('sha256', $raw, $secret);

        $this->assertTrue(FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, $sig, $secret, 0));
    }

    #[Test]
    public function verify_rejects_composite_header_without_v1(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $raw = '{"id":"evt_4","name":"transaction.approved","entity":{"id":"TX-FEDA-4","status":"approved"}}';

        $this->assertFalse(FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, 't=1769900000', $secret, 0));
    }

    #[Test]
    public function verify_rejects_invalid_signature(): void
    {
        $secret = 'whsec_test_secret_1234567890';
        $raw = '{"id":"evt_bad","name":"transaction.approved","entity":{"id":"TX-FEDA-X","status":"approved"}}';
        $timestamp = '1769900002';

        $this->assertFalse(FedaPayWebhookSignature::verifyFedapayWebhookSignature($raw, 't=' . $timestamp . ',v1=deadbeef', $secret, 0));
    }
}
