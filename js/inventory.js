import { db } from './db.js';

class InventoryModule {
    constructor() {
        this.container = document.getElementById('view-inventory');
        this.products = [];
        this.init();
    }

    async init() {
        await this.loadSettings(); // Load currency settings first
        this.renderLayout();
        await this.loadProducts();
        this.bindEvents();
    }

    async loadSettings() {
        this.currencySymbol = '$'; // Default
        const storedSettings = await db.getAll('settings');
        const sym = storedSettings.find(s => s.key === 'currencySymbol');
        if (sym) this.currencySymbol = sym.value;
    }

    async loadProducts() {
        this.products = await db.getAll('products');
        this.renderTable();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="flex flex-col h-full">
                <!-- Header -->
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-slate-800">Inventory Management</h2>
                    <button id="btn-add-product" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition shadow-md shadow-red-500/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        Add Product
                    </button>
                </div>

                <!-- Search & Filters -->
                <div class="bg-white p-4 rounded-t-xl border border-slate-200 border-b-0 flex gap-4">
                    <div class="relative flex-1">
                        <svg class="w-5 h-5 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input type="text" id="inventory-search" placeholder="Search by name or barcode..." class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none">
                    </div>
                </div>

                <!-- Products Table -->
                <div class="bg-white rounded-b-xl border border-slate-200 flex-1 overflow-auto shadow-sm">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th class="p-4 font-bold">Product</th>
                                <th class="p-4 font-bold">Price</th>
                                <th class="p-4 font-bold">Cost</th>
                                <th class="p-4 font-bold">Stock</th>
                                <th class="p-4 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="inventory-list" class="divide-y divide-slate-100 text-sm">
                            <!-- Rows injected here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Form (Hidden by default) -->
            <div id="product-modal" class="fixed inset-0 z-50 bg-slate-900/40 hidden flex items-center justify-center backdrop-blur-sm">
                <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-100 max-h-[90vh] overflow-y-auto">
                    <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 class="text-xl font-bold text-slate-800" id="modal-title">Add Product</h3>
                        <button id="modal-close" class="text-slate-400 hover:text-red-500">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <form id="product-form" class="p-6 space-y-4">
                        <input type="hidden" id="prod-id">
                        
                        <div>
                            <label class="block text-sm font-bold text-slate-500 mb-1">Product Name</label>
                            <input type="text" id="prod-name" required class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-500 mb-1">Barcode (Optional)</label>
                            <input type="text" id="prod-barcode" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                             <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Selling Price</label>
                                <input type="number" step="0.01" id="prod-price" required class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                            </div>
                             <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Cost Price</label>
                                <input type="number" step="0.01" id="prod-cost" required class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Current Stock</label>
                                <input type="number" id="prod-stock" required class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Low Stock Alert</label>
                                <input type="number" id="prod-alert" value="5" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none">
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-500 mb-1">Product Image</label>
                             <input type="file" id="prod-image" accept="image/*" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-500 file:bg-white file:border-0 file:rounded-md file:text-red-600 file:font-bold file:px-2 file:mr-4 hover:file:bg-red-50 cursor-pointer">
                        </div>

                        <div class="pt-4 flex gap-3">
                             <button type="button" id="btn-delete-prod" class="hidden flex-1 bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-lg font-bold transition">Delete</button>
                            <button type="submit" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold transition shadow-lg shadow-red-600/20">Save Product</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    renderTable(searchTerm = '') {
        const tbody = document.getElementById('inventory-list');
        tbody.innerHTML = '';

        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchTerm))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 italic">No products found. Add some!</td></tr>`;
            return;
        }

        filtered.forEach(p => {
            const row = document.createElement('tr');
            row.className = "hover:bg-red-50/50 transition cursor-pointer group";

            // Low stock logic
            const isLowStock = p.stock <= (p.alertLevel || 5);
            const stockClass = isLowStock ? 'text-red-500 font-bold' : 'text-slate-600';
            const iconHtml = p.image
                ? `<img src="${p.image}" class="w-10 h-10 rounded object-cover border border-slate-200 shadow-sm">`
                : `<div class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400 font-bold">IMG</div>`;

            // Permissions Check
            const user = JSON.parse(sessionStorage.getItem('pointify_session_v1'));
            const isAdmin = user && user.role === 'admin';
            const isManager = user && user.role === 'manager';

            // Managers can ADD, but NOT EDIT. Admins can do everything.
            const canEdit = isAdmin;

            const editBtnHtml = canEdit
                ? `<button class="text-red-600 hover:text-red-800 p-2 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition edit-btn font-medium">Edit</button>`
                : `<span class="text-xs text-slate-400 italic">View Only</span>`;

            row.innerHTML = `
                <td class="p-4 flex items-center gap-3">
                    ${iconHtml}
                    <div>
                        <div class="font-bold text-slate-700">${p.name}</div>
                        <div class="text-xs text-slate-400 font-mono">${p.barcode || 'No Barcode'}</div>
                    </div>
                </td>
                <td class="p-4 text-red-600 font-mono font-bold">${this.currencySymbol}${parseFloat(p.price).toFixed(2)}</td>
                <td class="p-4 text-slate-500 font-mono text-xs">${this.currencySymbol}${parseFloat(p.costPrice || 0).toFixed(2)}</td>
                <td class="p-4 ${stockClass}">
                    ${p.stock}
                    ${isLowStock ? '<span class="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold">LOW</span>' : ''}
                </td>
                <td class="p-4 text-right">
                    ${editBtnHtml}
                </td>
             `;

            // Click row to edit ONLY if admin
            if (canEdit) {
                row.addEventListener('click', () => this.openModal(p));
            }
            tbody.appendChild(row);
        });
    }

    bindEvents() {
        document.getElementById('inventory-search').addEventListener('input', (e) => {
            this.renderTable(e.target.value);
        });

        document.getElementById('btn-add-product').addEventListener('click', () => {
            this.openModal();
        });

        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProduct();
        });

        document.getElementById('btn-delete-prod').addEventListener('click', async () => {
            // Phase 2.3: deleting stock is admin-only
            if (!window.hasCapability || !window.hasCapability('products:delete')) {
                window.showToast('Access Denied: Restricted Area', 'error');
                return;
            }

            const id = document.getElementById('prod-id').value;
            // Ensure id is number if it was stored as number
            if (id && confirm('Delete this product permanently?')) {
                await db.delete('products', parseInt(id));
                window.showToast('Product Deleted', 'success');
                this.closeModal();
                await this.loadProducts();
            }
        });
    }

    openModal(product = null) {
        // Phase 2.3: creating is allowed for admin + manager, editing only for
        // admin (inventory.js:157). Checked at the write, not just via CSS.
        const capability = product ? 'products:edit' : 'products:create';
        if (!window.hasCapability || !window.hasCapability(capability)) {
            window.showToast('Access Denied: Restricted Area', 'error');
            return;
        }

        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        const deleteBtn = document.getElementById('btn-delete-prod');
        const title = document.getElementById('modal-title');

        form.reset();
        modal.classList.remove('hidden');

        if (product) {
            title.textContent = 'Edit Product';
            document.getElementById('prod-id').value = product.id;
            // ?? not || : a legitimate 0 must survive. `costPrice || ''` blanked the
            // field for a 0-cost product, and saveProduct() then refused to save it
            // with "Cost price is required" - editing that product was impossible.
            document.getElementById('prod-name').value = product.name ?? '';
            document.getElementById('prod-barcode').value = product.barcode ?? '';
            document.getElementById('prod-price').value = product.price ?? 0;
            document.getElementById('prod-cost').value = product.costPrice ?? 0;
            document.getElementById('prod-stock').value = product.stock ?? 0;
            document.getElementById('prod-alert').value = product.alertLevel ?? 5;
            deleteBtn.classList.remove('hidden');
        } else {
            title.textContent = 'Add New Product';
            document.getElementById('prod-id').value = '';
            deleteBtn.classList.add('hidden');
        }
    }

    closeModal() {
        document.getElementById('product-modal').classList.add('hidden');
    }

    async saveProduct() {
        const id = document.getElementById('prod-id').value;

        // Phase 2.3: an existing id means EDIT, an empty id means CREATE
        const capability = id ? 'products:edit' : 'products:create';
        if (!window.hasCapability || !window.hasCapability(capability)) {
            window.showToast('Access Denied: Restricted Area', 'error');
            return;
        }

        const name = document.getElementById('prod-name').value.trim();
        const barcode = document.getElementById('prod-barcode').value.trim();
        const priceRaw = document.getElementById('prod-price').value.trim();
        const costRaw = document.getElementById('prod-cost').value.trim();
        const stockRaw = document.getElementById('prod-stock').value.trim();
        const alertRaw = document.getElementById('prod-alert').value.trim();
        const imageFile = document.getElementById('prod-image').files[0];

        // --- Validation ----------------------------------------------------
        // parseFloat('')/parseInt('') return NaN, which used to be stored as-is.
        // calcLine then does Number(NaN) || 0, so a product could be saved with a
        // NaN price and silently sell for FREE while reports showed 0 revenue;
        // a NaN stock made processSale see stock 0 and refuse every sale with
        // "Insufficient stock (available: 0)" forever.
        if (!name) {
            window.showToast('Product name is required', 'error');
            return;
        }

        const readNumber = (raw, label, integer) => {
            if (raw === '') throw new Error(`${label} is required`);
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be 0 or more`);
            if (integer && !Number.isInteger(n)) throw new Error(`${label} must be a whole number`);
            return n;
        };

        let price, cost, stock, alertLevel;
        try {
            price = readNumber(priceRaw, 'Selling price', false);
            cost = readNumber(costRaw, 'Cost price', false);
            stock = readNumber(stockRaw, 'Stock', true);
            alertLevel = readNumber(alertRaw, 'Alert level', true);
        } catch (e) {
            window.showToast(e.message, 'error');
            return;
        }

        // The id field comes from a hidden input; a non-numeric value would make
        // store.put reject with DataError because NaN is not a valid key.
        const editingId = id ? parseInt(id, 10) : null;
        if (id && !Number.isInteger(editingId)) {
            window.showToast('Invalid product id', 'error');
            return;
        }

        // products.barcode has a unique index - catch the clash here so the user
        // learns WHICH product owns the barcode instead of a raw ConstraintError.
        if (barcode) {
            const clash = this.products.find(p => p.barcode === barcode && p.id !== editingId);
            if (clash) {
                window.showToast(`Barcode already used by "${clash.name}"`, 'error');
                return;
            }
        }

        let imageBase64 = null;
        if (imageFile) {
            imageBase64 = await this.fileToBase64(imageFile);
        } else if (editingId !== null) {
            // Keep existing image if editing and no new file
            const existing = this.products.find(p => p.id === editingId);
            if (existing) imageBase64 = existing.image;
        }

        const productData = {
            name,
            price,
            costPrice: cost,
            stock,
            alertLevel,
            image: imageBase64
        };

        // Only add barcode if it's not empty, to avoid unique constraint violations on ""
        if (barcode !== "") {
            productData.barcode = barcode;
        }

        try {
            if (editingId !== null) {
                productData.id = editingId;
                await db.put('products', productData, 'Barcode already exists');
                window.showToast('Product Updated');
            } else {
                await db.add('products', productData, 'Barcode already exists');
                window.showToast('Product Added');
            }
            this.closeModal();
            await this.loadProducts();
        } catch (err) {
            console.error(err);
            window.showToast((err && err.message) || 'Error saving product', 'error');
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
}

export const inventory = new InventoryModule();
window.inventoryModule = inventory;
