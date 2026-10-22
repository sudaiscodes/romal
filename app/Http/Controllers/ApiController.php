<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\Variety;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ApiController extends Controller
{
    const UNITS = ['Romal' => 'dz', 'Shawl' => 'pcs', 'Lungi' => 'sets'];

    // ---------- load everything ----------
    public function bootstrap(Request $request)
    {
        $varieties = Variety::orderBy('name')->get()->map(fn ($v) => [
            'id' => $v->id, 'name' => $v->name, 'category' => $v->category,
        ]);

        $invoices = Invoice::with('items.variety')->orderBy('invoice_no')->get()
            ->map(fn ($i) => $this->invoiceJson($i));

        $parties = Party::with(['entries' => fn ($q) => $q->orderBy('date')->orderBy('id')])
            ->orderBy('name')->get()->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'entries' => $p->entries->map(fn ($e) => $this->entryJson($e))->all(),
            ]);

        $user = ['name' => $request->user()->name, 'email' => $request->user()->email];

        return compact('parties', 'invoices', 'varieties', 'user');
    }

    // ---------- profile ----------
    public function updateProfile(Request $r)
    {
        $d = $r->validate(['name' => ['required', 'string', 'max:255']]);
        $r->user()->update(['name' => trim($d['name'])]);

        return ['name' => $r->user()->name, 'email' => $r->user()->email];
    }

    // ---------- parties ----------
    public function storeParty(Request $r)
    {
        $d = $r->validate(['name' => ['required', 'string', 'max:255', Rule::unique('parties', 'name')->withoutTrashed()]]);
        $p = Party::create(['name' => trim($d['name'])]);

        return ['id' => $p->id, 'name' => $p->name, 'entries' => []];
    }

    public function updateParty(Request $r, Party $party)
    {
        $d = $r->validate(['name' => ['required', 'string', 'max:255', Rule::unique('parties', 'name')->withoutTrashed()->ignore($party->id)]]);
        $party->update(['name' => trim($d['name'])]);

        return ['id' => $party->id, 'name' => $party->name];
    }

    public function destroyParty(Party $party)
    {
        abort_if($party->entries()->exists(), 422, 'اس پارٹی کے کھاتے میں اندراجات موجود ہیں۔ پہلے اس کے بل اور ادائیگیاں حذف کریں۔');
        $party->delete();

        return response()->noContent();
    }

    // ---------- varieties ----------
    public function storeVariety(Request $r)
    {
        $d = $r->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('varieties', 'name')->withoutTrashed()],
            'category' => ['required', Rule::in(array_keys(self::UNITS))],
        ]);
        $v = Variety::create(['name' => trim($d['name']), 'category' => $d['category']]);

        return ['id' => $v->id, 'name' => $v->name, 'category' => $v->category];
    }

    public function updateVariety(Request $r, Variety $variety)
    {
        $d = $r->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('varieties', 'name')->withoutTrashed()->ignore($variety->id)],
            'category' => ['required', Rule::in(array_keys(self::UNITS))],
        ]);
        $variety->update(['name' => trim($d['name']), 'category' => $d['category']]);

        return ['id' => $variety->id, 'name' => $variety->name, 'category' => $variety->category];
    }

    public function destroyVariety(Variety $variety)
    {
        $inUse = InvoiceItem::where('variety_id', $variety->id)->whereHas('invoice')->exists();
        abort_if($inUse, 422, 'یہ ورائٹی بلوں میں استعمال ہو رہی ہے۔ پہلے وہ بل حذف کریں یا ان میں ورائٹی تبدیل کریں۔');
        $variety->delete();

        return response()->noContent();
    }

    // ---------- invoices ----------
    public function storeInvoice(Request $r)
    {
        $d = $r->validate($this->invoiceRules());

        return DB::transaction(function () use ($d) {
            $no = (int) Invoice::lockForUpdate()->max('invoice_no') + 1;
            $inv = $this->saveInvoice(new Invoice(['invoice_no' => $no]), $d);

            return $this->invoiceJson($inv);
        });
    }

    public function updateInvoice(Request $r, Invoice $invoice)
    {
        $d = $r->validate($this->invoiceRules());

        return DB::transaction(function () use ($r, $invoice, $d) {
            $before = $this->invoiceSnapshot($invoice);
            $inv = $this->saveInvoice($invoice, $d);
            $this->logActivity($r, 'invoice', $inv->id, 'updated', $before, $this->invoiceSnapshot($inv));

            return $this->invoiceJson($inv);
        });
    }

    // storeInvoice numbers from the highest remaining invoice, so only deleting the latest frees its number
    public function destroyInvoice(Request $r, Invoice $invoice)
    {
        DB::transaction(function () use ($r, $invoice) {
            $this->logActivity($r, 'invoice', $invoice->id, 'deleted', $this->invoiceSnapshot($invoice));
            $invoice->ledgerEntry()->delete();
            $invoice->delete();
        });

        return response()->noContent();
    }

    // ---------- payments ----------
    public function storePayment(Request $r)
    {
        $e = LedgerEntry::create($r->validate($this->paymentRules()) + ['type' => 'debit']);

        return $this->entryJson($e);
    }

    public function updatePayment(Request $r, LedgerEntry $entry)
    {
        abort_unless($entry->type === 'debit', 404);
        $d = $r->validate($this->paymentRules());

        DB::transaction(function () use ($r, $entry, $d) {
            $before = $this->paymentSnapshot($entry);
            $entry->update($d);
            $this->logActivity($r, 'payment', $entry->id, 'updated', $before, $this->paymentSnapshot($entry));
        });

        return $this->entryJson($entry);
    }

    public function destroyPayment(Request $r, LedgerEntry $entry)
    {
        abort_unless($entry->type === 'debit', 404);

        DB::transaction(function () use ($r, $entry) {
            $this->logActivity($r, 'payment', $entry->id, 'deleted', $this->paymentSnapshot($entry));
            $entry->delete();
        });

        return response()->noContent();
    }

    // ---------- history ----------
    // deleted records come from the soft-deleted rows themselves, so ones deleted before logging began still show
    public function history()
    {
        $deleteLogs = ActivityLog::with('user')->where('action', 'deleted')->get()
            ->keyBy(fn ($l) => $l->subject_type.':'.$l->subject_id);
        $deletedBy = fn (string $type, int $id) => $deleteLogs->get($type.':'.$id)?->user?->name;

        $invoices = Invoice::onlyTrashed()->get()->map(fn ($i) => [
            'type' => 'invoice',
            'id' => $i->id,
            'deletedAt' => $i->deleted_at->format('Y-m-d H:i'),
            'by' => $deletedBy('invoice', $i->id),
            'record' => $this->invoiceSnapshot($i),
        ]);

        $payments = LedgerEntry::onlyTrashed()->where('type', 'debit')->get()->map(fn ($e) => [
            'type' => 'payment',
            'id' => $e->id,
            'deletedAt' => $e->deleted_at->format('Y-m-d H:i'),
            'by' => $deletedBy('payment', $e->id),
            'record' => $this->paymentSnapshot($e),
        ]);

        $edits = ActivityLog::with('user')->where('action', 'updated')->latest('id')->get()->map(fn ($l) => [
            'type' => $l->subject_type,
            'id' => $l->subject_id,
            'at' => $l->created_at->format('Y-m-d H:i'),
            'by' => $l->user?->name,
            'before' => $l->before,
            'after' => $l->after,
        ]);

        return [
            'deleted' => $invoices->concat($payments)->sortByDesc('deletedAt')->values(),
            'edits' => $edits,
        ];
    }

    // ---------- helpers ----------
    private function invoiceRules(): array
    {
        return [
            'date' => 'required|date_format:Y-m-d',
            'party_id' => ['required', Rule::exists('parties', 'id')->withoutTrashed()],
            'shipping_no' => 'nullable|string|max:100',
            'signed_by' => 'nullable|string|max:100',
            'items' => 'required|array|min:1',
            'items.*.variety_id' => ['required', Rule::exists('varieties', 'id')->withoutTrashed()],
            'items.*.qty' => 'required|integer|min:1',
            'items.*.price' => 'required|integer|min:1',
        ];
    }

    private function paymentRules(): array
    {
        return [
            'party_id' => ['required', Rule::exists('parties', 'id')->withoutTrashed()],
            'date' => 'required|date_format:Y-m-d',
            'method' => 'required|in:Cash,Online,Cheque',
            'amount' => 'required|integer|min:1',
        ];
    }

    private function saveInvoice(Invoice $inv, array $d): Invoice
    {
        $varieties = Variety::whereIn('id', collect($d['items'])->pluck('variety_id'))->get()->keyBy('id');

        $inv->fill([
            'date' => $d['date'],
            'party_id' => $d['party_id'],
            'shipping_no' => $d['shipping_no'] ?? null,
            'signed_by' => $d['signed_by'] ?? null,
            'total' => collect($d['items'])->sum(fn ($i) => $i['qty'] * $i['price']),
        ])->save();

        $inv->items()->delete();
        foreach ($d['items'] as $i) {
            $inv->items()->create([
                'variety_id' => $i['variety_id'],
                'qty' => $i['qty'],
                'unit' => self::UNITS[$varieties[$i['variety_id']]->category] ?? 'dz',
                'price' => $i['price'],
                'total' => $i['qty'] * $i['price'],
            ]);
        }

        // the invoice's ledger credit is created/updated automatically
        LedgerEntry::updateOrCreate(
            ['invoice_id' => $inv->id],
            ['party_id' => $inv->party_id, 'date' => $inv->date, 'type' => 'credit', 'amount' => $inv->total]
        );

        return $inv->load('items.variety');
    }

    private function invoiceJson(Invoice $i): array
    {
        return [
            'id' => $i->id,
            'no' => $i->invoice_no,
            'date' => $i->date->format('Y-m-d'),
            'partyId' => $i->party_id,
            'shipping' => $i->shipping_no ?? '',
            'signedBy' => $i->signed_by ?? '',
            'total' => $i->total,
            'items' => $i->items->map(fn ($it) => [
                'varietyId' => $it->variety_id,
                'product' => $it->variety->name,
                'category' => $it->variety->category,
                'qty' => $it->qty,
                'unit' => $it->unit,
                'price' => $it->price,
                'total' => $it->total,
            ])->all(),
        ];
    }

    // edits that change nothing are not logged
    private function logActivity(Request $r, string $type, int $id, string $action, array $before, ?array $after = null): void
    {
        if ($before === $after) {
            return;
        }

        ActivityLog::create([
            'user_id' => $r->user()->id,
            'subject_type' => $type,
            'subject_id' => $id,
            'action' => $action,
            'before' => $before,
            'after' => $after,
        ]);
    }

    // names are copied in, so the history still reads right after a party or variety is renamed or deleted
    private function invoiceSnapshot(Invoice $i): array
    {
        $i->load(['party' => fn ($q) => $q->withTrashed(), 'items.variety' => fn ($q) => $q->withTrashed()]);

        return [
            'no' => $i->invoice_no,
            'date' => $i->date->format('Y-m-d'),
            'party' => $i->party?->name,
            'shipping' => $i->shipping_no ?? '',
            'signedBy' => $i->signed_by ?? '',
            'total' => $i->total,
            'items' => $i->items->map(fn ($it) => [
                'product' => $it->variety?->name,
                'category' => $it->variety?->category,
                'qty' => $it->qty,
                'unit' => $it->unit,
                'price' => $it->price,
                'total' => $it->total,
            ])->all(),
        ];
    }

    private function paymentSnapshot(LedgerEntry $e): array
    {
        $e->load(['party' => fn ($q) => $q->withTrashed()]);

        return [
            'date' => $e->date->format('Y-m-d'),
            'party' => $e->party?->name,
            'method' => $e->method,
            'amount' => $e->amount,
        ];
    }

    private function entryJson(LedgerEntry $e): array
    {
        return [
            'id' => $e->id,
            'partyId' => $e->party_id,
            'date' => $e->date->format('Y-m-d'),
            'type' => $e->type,
            'amount' => $e->amount,
            'invoiceId' => $e->invoice_id,
            'method' => $e->method,
        ];
    }
}
