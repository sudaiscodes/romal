<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\User;
use App\Models\Variety;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoryTest extends TestCase
{
    use RefreshDatabase;

    private Party $party;

    private Variety $variety;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::factory()->create(['name' => 'Faisal']));
        $this->party = Party::create(['name' => 'Khan Traders']);
        $this->variety = Variety::create(['name' => 'Cotton Check', 'category' => 'Romal']);
    }

    private function invoicePayload(array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-10-01',
            'party_id' => $this->party->id,
            'items' => [['variety_id' => $this->variety->id, 'qty' => 3, 'price' => 1200]],
        ], $overrides);
    }

    private function createInvoice(): array
    {
        return $this->postJson('/api/invoices', $this->invoicePayload())->assertOk()->json();
    }

    private function createPayment(): array
    {
        return $this->postJson('/api/payments', [
            'party_id' => $this->party->id, 'date' => '2026-10-02', 'method' => 'Cash', 'amount' => 2000,
        ])->assertOk()->json();
    }

    public function test_editing_an_invoice_records_the_values_before_and_after(): void
    {
        $invoice = $this->createInvoice();

        $this->putJson("/api/invoices/{$invoice['id']}", $this->invoicePayload([
            'items' => [['variety_id' => $this->variety->id, 'qty' => 5, 'price' => 1200]],
        ]))->assertOk();

        $this->getJson('/api/history')
            ->assertOk()
            ->assertJsonCount(1, 'edits')
            ->assertJsonPath('edits.0.type', 'invoice')
            ->assertJsonPath('edits.0.by', 'Faisal')
            ->assertJsonPath('edits.0.before.total', 3600)
            ->assertJsonPath('edits.0.after.total', 6000)
            ->assertJsonPath('edits.0.after.items.0.qty', 5);
    }

    public function test_saving_an_invoice_without_changes_is_not_logged(): void
    {
        $invoice = $this->createInvoice();

        $this->putJson("/api/invoices/{$invoice['id']}", $this->invoicePayload())->assertOk();

        $this->assertSame(0, ActivityLog::count());
    }

    public function test_editing_a_payment_records_the_values_before_and_after(): void
    {
        $payment = $this->createPayment();

        $this->putJson("/api/payments/{$payment['id']}", [
            'party_id' => $this->party->id, 'date' => '2026-10-02', 'method' => 'Online', 'amount' => 2500,
        ])->assertOk();

        $this->getJson('/api/history')
            ->assertJsonPath('edits.0.type', 'payment')
            ->assertJsonPath('edits.0.before.method', 'Cash')
            ->assertJsonPath('edits.0.after.method', 'Online')
            ->assertJsonPath('edits.0.after.amount', 2500);
    }

    public function test_deleted_invoices_and_payments_are_listed_with_who_deleted_them(): void
    {
        $invoice = $this->createInvoice();
        $payment = $this->createPayment();

        $this->deleteJson("/api/invoices/{$invoice['id']}")->assertNoContent();
        $this->deleteJson("/api/payments/{$payment['id']}")->assertNoContent();

        $deleted = collect($this->getJson('/api/history')->assertJsonCount(2, 'deleted')->json('deleted'))->keyBy('type');

        $this->assertSame('Faisal', $deleted['invoice']['by']);
        $this->assertSame($invoice['no'], $deleted['invoice']['record']['no']);
        $this->assertSame('Khan Traders', $deleted['invoice']['record']['party']);
        $this->assertSame('Cotton Check', $deleted['invoice']['record']['items'][0]['product']);
        $this->assertSame(2000, $deleted['payment']['record']['amount']);
    }

    public function test_invoices_deleted_before_logging_began_still_appear(): void
    {
        $invoice = $this->createInvoice();
        Invoice::find($invoice['id'])->delete();

        $this->getJson('/api/history')
            ->assertJsonCount(1, 'deleted')
            ->assertJsonPath('deleted.0.record.no', $invoice['no'])
            ->assertJsonPath('deleted.0.by', null);
    }

    public function test_a_deleted_bill_keeps_its_variety_and_party_names_after_they_are_deleted(): void
    {
        $invoice = $this->createInvoice();
        $this->deleteJson("/api/invoices/{$invoice['id']}")->assertNoContent();
        $this->deleteJson("/api/varieties/{$this->variety->id}")->assertNoContent();
        $this->deleteJson("/api/parties/{$this->party->id}")->assertNoContent();

        $this->getJson('/api/history')
            ->assertJsonPath('deleted.0.record.party', 'Khan Traders')
            ->assertJsonPath('deleted.0.record.items.0.product', 'Cotton Check');
    }

    public function test_the_invoice_ledger_credit_is_not_listed_as_a_deleted_payment(): void
    {
        $invoice = $this->createInvoice();
        $this->deleteJson("/api/invoices/{$invoice['id']}")->assertNoContent();

        $this->getJson('/api/history')
            ->assertJsonCount(1, 'deleted')
            ->assertJsonPath('deleted.0.type', 'invoice');
    }
}
