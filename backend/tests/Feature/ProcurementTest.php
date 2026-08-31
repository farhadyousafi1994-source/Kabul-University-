<?php

namespace Tests\Feature;

use App\Domains\Asset\Models\AssetCategory;
use App\Domains\Procurement\Models\PurchaseRequest;
use App\Domains\Procurement\Models\Supplier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SeedsPermissions;
use Tests\TestCase;

class ProcurementTest extends TestCase
{
    use RefreshDatabase;
    use SeedsPermissions;

    public function test_purchase_request_approve_and_purchase_order_flow(): void
    {
        $this->actingAsUserWithPermissions([
            'procurement.view', 'procurement.create', 'procurement.update', 'procurement.approve',
            'suppliers.view',
        ]);

        $supplier = Supplier::create([
            'code' => 'SUP-KC',
            'name' => 'Kabul Computers LLC',
            'contact_person' => 'Ahmad',
            'phone' => '+93 700 000 000',
            'email' => 'sales@kabul-computers.example',
            'status' => 'active',
        ]);

        // 1. Purchase request
        $pr = $this->postJson('/api/purchase-requests', [
            'supplier_id' => $supplier->id,
            'notes' => 'Lab computers for CS faculty',
        ]);

        $pr->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'draft');

        $prId = $pr->json('data.id');
        $this->assertStringStartsWith('PR-', $pr->json('data.pr_number'));

        // 2. Approve the purchase request
        $this->postJson("/api/purchase-requests/{$prId}/approve", ['approve' => true])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        // 3. Create purchase order with one item
        $category = AssetCategory::create(['code' => 'IT', 'name' => 'IT Equipment', 'status' => 'active']);

        $po = $this->postJson('/api/purchase-orders', [
            'purchase_request_id' => $prId,
            'supplier_id' => $supplier->id,
            'tax' => 100,
            'items' => [
                [
                    'name' => 'Desktop PC',
                    'asset_category_id' => $category->id,
                    'brand' => 'HP',
                    'model' => 'ProDesk 400',
                    'quantity' => 3,
                    'unit_price' => 800,
                ],
            ],
        ]);

        $po->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.total', 2500); // 3 × 800 + 100 tax

        $poId = $po->json('data.id');

        // The linked purchase request moved to `ordered`.
        $this->assertDatabaseHas('purchase_requests', ['id' => $prId, 'status' => 'ordered']);

        // 4. Send the order
        $this->postJson("/api/purchase-orders/{$poId}/send")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'sent');

        // 5. Receive goods: assets are registered automatically
        $this->postJson("/api/purchase-orders/{$poId}/receive", [
            'notes' => 'Received in good condition',
        ])->assertStatus(201)
            ->assertJsonPath('data.purchase_order_id', $poId)
            ->assertJsonPath('data.receipt_number', 'RCV-'.now()->format('Y').'-0001');

        $this->assertDatabaseHas('purchase_receipts', ['purchase_order_id' => $poId]);
        $this->assertDatabaseHas('purchase_orders', ['id' => $poId, 'status' => 'received']);
        $this->assertDatabaseHas('assets', [
            'name' => 'Desktop PC',
            'supplier_id' => $supplier->id,
            'status' => 'available',
        ]);
        // Three assets created (quantity 3).
        $this->assertSame(3, \App\Domains\Asset\Models\Asset::where('name', 'Desktop PC')->count());
    }

    public function test_purchase_request_rejection(): void
    {
        $this->actingAsUserWithPermissions(['procurement.view', 'procurement.create', 'procurement.approve']);

        $pr = $this->postJson('/api/purchase-requests', ['notes' => 'Rejected request'])
            ->assertStatus(201)->json('data');

        $this->postJson("/api/purchase-requests/{$pr['id']}/approve", ['approve' => false])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_purchase_order_requires_items(): void
    {
        $this->actingAsUserWithPermissions(['procurement.view', 'procurement.create']);

        $supplier = Supplier::create(['code' => 'SUP-S', 'name' => 'S', 'status' => 'active']);

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'items' => [],
        ])->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['items']]);
    }

    public function test_procurement_permission_enforcement(): void
    {
        $this->actingAsUserWithPermissions(['procurement.view']);

        $this->postJson('/api/purchase-requests', ['notes' => 'nope'])
            ->assertStatus(403);
    }

    public function test_supplier_crud(): void
    {
        $this->actingAsUserWithPermissions([
            'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
        ]);

        $response = $this->postJson('/api/suppliers', [
            'code' => 'SUP-RS',
            'name' => 'Rahimi Office Supplies',
            'contact_person' => 'Rahimi',
            'phone' => '+93 700 111 222',
            'email' => 'info@rahimi.example',
            'address' => 'Charahi Qambar, Kabul',
            'status' => 'active',
        ]);

        $response->assertStatus(201)->assertJsonPath('data.name', 'Rahimi Office Supplies');
        $id = $response->json('data.id');

        $this->putJson("/api/suppliers/{$id}", ['name' => 'Rahimi Office Supplies Co.', 'contact_person' => 'Rahimi'])
            ->assertStatus(200);

        $this->deleteJson("/api/suppliers/{$id}")->assertStatus(200);
        $this->assertSoftDeleted('suppliers', ['id' => $id]);
    }
}
