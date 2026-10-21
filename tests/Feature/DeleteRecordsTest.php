<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Models\Variety;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeleteRecordsTest extends TestCase
{
    use RefreshDatabase;

    private Party $party;

    private Variety $variety;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::factory()->create());
        $this->party = Party::create(['name' => 'Khan Traders']);
        $this->variety = Variety::create(['name' => 'Cotton Check', 'category' => 'Romal']);
    }

    private function createInvoice(array $overrides = []): array
    {
        return $this->postJson('/api/invoices', array_merge([
            'date' => '2026-10-01',
            'party_id' => $this->party->id,
            'items' => [['variety_id' => $this->variety->id, 'qty' => 3, 'price' => 1200]],
        ], $overrides))->assertOk()->json();
    }

    private function createPayment(): array
    {
        return $this->postJson('/api/payments', [
            'party_id' => $this->party->id, 'date' => '2026-10-02', 'method' => 'Cash', 'amount' => 2000,
        ])->assertOk()->json();
    }

    public function test_deleting_an_invoice_removes_it_and_its_ledger_entry(): void
    {
        $invoice = $this->createInvoice();

        $this->deleteJson("/api/invoices/{$invoice['id']}")->assertNoContent();

        $this->assertSoftDeleted('invoices', ['id' => $invoice['id']]);
        $this->assertSame(0, LedgerEntry::where('invoice_id', $invoice['id'])->count());
        $this->getJson('/api/bootstrap')->assertJsonCount(0, 'invoices')->assertJsonCount(0, 'parties.0.entries');
    }

    public function test_invoice_numbers_are_not_reused_after_a_delete(): void
    {
        $first = $this->createInvoice();
        $this->deleteJson("/api/invoices/{$first['id']}")->assertNoContent();

        $this->assertSame($first['no'] + 1, $this->createInvoice()['no']);
    }

    public function test_deleting_a_payment_removes_it_from_the_ledger(): void
    {
        $payment = $this->createPayment();

        $this->deleteJson("/api/payments/{$payment['id']}")->assertNoContent();

        $this->assertSoftDeleted('ledger_entries', ['id' => $payment['id']]);
    }

    public function test_an_invoice_ledger_entry_cannot_be_deleted_as_a_payment(): void
    {
        $invoice = $this->createInvoice();
        $credit = LedgerEntry::where('invoice_id', $invoice['id'])->first();

        $this->deleteJson("/api/payments/{$credit->id}")->assertNotFound();

        $this->assertNotSoftDeleted('ledger_entries', ['id' => $credit->id]);
    }

    public function test_a_party_with_ledger_entries_cannot_be_deleted(): void
    {
        $this->createPayment();

        $this->deleteJson("/api/parties/{$this->party->id}")->assertUnprocessable();

        $this->assertNotSoftDeleted('parties', ['id' => $this->party->id]);
    }

    public function test_a_party_can_be_deleted_once_its_entries_are_deleted_and_its_name_reused(): void
    {
        $payment = $this->createPayment();
        $this->deleteJson("/api/payments/{$payment['id']}")->assertNoContent();

        $this->deleteJson("/api/parties/{$this->party->id}")->assertNoContent();

        $this->assertSoftDeleted('parties', ['id' => $this->party->id]);
        $this->postJson('/api/parties', ['name' => 'Khan Traders'])->assertOk();
    }

    public function test_a_deleted_party_cannot_receive_new_entries(): void
    {
        $this->deleteJson("/api/parties/{$this->party->id}")->assertNoContent();

        $this->postJson('/api/payments', [
            'party_id' => $this->party->id, 'date' => '2026-10-02', 'method' => 'Cash', 'amount' => 500,
        ])->assertJsonValidationErrors('party_id');
    }

    public function test_a_variety_used_on_an_invoice_cannot_be_deleted(): void
    {
        $this->createInvoice();

        $this->deleteJson("/api/varieties/{$this->variety->id}")->assertUnprocessable();

        $this->assertNotSoftDeleted('varieties', ['id' => $this->variety->id]);
    }

    public function test_a_variety_only_used_on_deleted_invoices_can_be_deleted_and_its_name_reused(): void
    {
        $invoice = $this->createInvoice();
        $this->deleteJson("/api/invoices/{$invoice['id']}")->assertNoContent();

        $this->deleteJson("/api/varieties/{$this->variety->id}")->assertNoContent();

        $this->assertSoftDeleted('varieties', ['id' => $this->variety->id]);
        $this->postJson('/api/varieties', ['name' => 'Cotton Check', 'category' => 'Shawl'])->assertOk();
        $this->postJson('/api/invoices', [
            'date' => '2026-10-01',
            'party_id' => $this->party->id,
            'items' => [['variety_id' => $this->variety->id, 'qty' => 1, 'price' => 100]],
        ])->assertJsonValidationErrors('items.0.variety_id');
    }

    public function test_decimal_quantities_and_amounts_are_rejected(): void
    {
        $this->postJson('/api/invoices', [
            'date' => '2026-10-01',
            'party_id' => $this->party->id,
            'items' => [['variety_id' => $this->variety->id, 'qty' => 1.5, 'price' => 1200.5]],
        ])->assertJsonValidationErrors(['items.0.qty', 'items.0.price']);

        $this->postJson('/api/payments', [
            'party_id' => $this->party->id, 'date' => '2026-10-02', 'method' => 'Cash', 'amount' => 99.5,
        ])->assertJsonValidationErrors('amount');

        $this->assertSame(0, Invoice::count());
    }
}
