import { db, calcLine, calcSale } from './db.js';

class POSModule {
    constructor() {
        this.container = document.getElementById('view-pos');
        this.cart = [];
        this.products = [];
        this.settings = { currencySymbol: '$', storeName: '' };
        this.discountTarget = null;
        this.discountMax = 0;
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.renderLayout();
        await this.loadProducts();
        this.bindEvents();
    }

    async loadSettings() {
        const storedSettings = await db.getAll('settings');
        storedSettings.forEach(s => this.settings[s.key] = s.value);
    }

    async loadProducts() {
        this.products = await db.getAll('products');
        this.renderProductGrid();
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="flex flex-col h-full gap-4">

                <!-- D1: POS was the only view with no page heading -->
                <div class="shrink-0 flex items-center gap-3">
                    <span class="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 4a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                    </span>
                    <div class="min-w-0">
                        <h1 class="text-lg font-extrabold text-slate-900 tracking-tight leading-tight">Point of Sale</h1>
                        <p class="text-xs text-slate-500 font-medium truncate">Scan a barcode or tap a product to add it to the order</p>
                    </div>
                </div>

                <!-- M4: heights come from this flex chain, not from 100vh guesses -->
                <div class="flex flex-col md:flex-row flex-1 min-h-0 gap-4 relative">

                    <!-- Left: product grid -->
                    <div id="pos-panel-products" class="w-full md:flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
                        <!-- D2: toolbars are white, scroll wells are cream - two tones only -->
                        <div class="p-3 sm:p-4 border-b border-slate-200 bg-white shrink-0">
                            <div class="relative">
                                <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                <input type="text" id="pos-search" placeholder="Scan barcode or search..."
                                    class="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition">
                            </div>
                        </div>

                        <!-- M8: 3-col tier on tablets, tighter cards -->
                        <div id="pos-grid" class="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start bg-cream pb-20 md:pb-4">
                        </div>

                        <!-- D8: was a near-black slab; now a floating white card -->
                        <div class="md:hidden absolute bottom-3 left-3 right-3">
                            <button id="mobile-cart-toggle" class="w-full bg-white border border-slate-200 shadow-xl rounded-xl px-4 py-3.5 flex justify-between items-center active:scale-[0.99] transition">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <span class="bg-red-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full min-w-[22px] text-center" id="mobile-cart-count">0</span>
                                    <span class="font-bold text-sm text-slate-900 truncate">View current order</span>
                                </div>
                                <span class="font-mono font-extrabold text-base text-slate-900 shrink-0" id="mobile-cart-total-btn">0.00</span>
                            </button>
                        </div>
                    </div>

                    <!-- Right: cart. Full-screen modal on phones, side panel on desktop -->
                    <div id="pos-panel-cart" class="hidden md:flex w-full md:w-96 bg-white md:rounded-2xl border border-slate-200 flex-col min-h-0 shadow-sm fixed inset-0 z-50 md:static md:inset-auto">

                        <!-- M6: Clear now sits in the header, same as desktop -->
                        <div class="md:hidden p-3 border-b border-slate-200 flex items-center gap-2 bg-white shrink-0">
                            <button id="mobile-back-products" class="w-11 h-11 -ml-1 rounded-xl text-slate-600 hover:text-red-600 hover:bg-slate-50 flex items-center justify-center transition" aria-label="Back to products">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            <span class="font-extrabold text-base text-slate-900 flex-1 min-w-0 truncate">Current order</span>
                            <button id="clear-cart-mobile" class="min-h-[44px] px-3 rounded-lg text-xs font-extrabold uppercase tracking-wider text-red-600 hover:bg-red-50 transition">Clear</button>
                        </div>

                        <div class="hidden md:flex p-4 border-b border-slate-200 justify-between items-center bg-white shrink-0">
                            <span class="font-extrabold text-base text-slate-900">Current order</span>
                            <button id="clear-cart" class="min-h-[44px] px-3 text-xs font-extrabold uppercase tracking-wider text-red-600 hover:text-red-700 transition">Clear</button>
                        </div>

                        <!-- Cart items -->
                        <div id="cart-items" class="flex-1 overflow-y-auto p-2 space-y-2 bg-cream">
                        </div>

                        <!-- M3: safe-area so Charge clears the iPhone home indicator -->
                        <div class="p-4 bg-white border-t border-slate-200 space-y-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
                            <input type="text" id="customer-name" placeholder="Customer name (optional)"
                                class="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition">

                            <div>
                                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Payment method</label>
                                <div class="flex flex-wrap gap-2" id="payment-methods-container">
                                </div>
                            </div>

                            <div class="flex justify-between text-sm">
                                <span class="text-slate-500 font-medium">Subtotal</span>
                                <span id="cart-subtotal" class="font-mono font-semibold text-slate-700">0.00</span>
                            </div>
                            <div id="cart-discount-row" class="hidden text-sm text-red-600 font-semibold">
                                <div class="flex justify-between">
                                    <span>Discount</span>
                                    <span id="cart-discount" class="font-mono font-bold">0.00</span>
                                </div>
                            </div>
                            <div class="flex justify-between items-baseline pt-1">
                                <span class="text-sm font-bold text-slate-500">Total</span>
                                <span id="cart-total" class="font-mono font-extrabold text-xl text-red-600">0.00</span>
                            </div>
                            <button id="btn-checkout"
                                class="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold text-xl py-4 rounded-xl transition shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                Charge <span id="btn-charge-amount">0.00</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- D7: window.prompt() opened the OS keyboard over the till -->
            <div id="discount-modal" class="hidden fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                    <div class="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h3 class="font-extrabold text-slate-900">Add discount</h3>
                            <p class="text-xs text-slate-500 mt-0.5 truncate" id="discount-item-name"></p>
                        </div>
                        <button id="discount-close" class="w-11 h-11 -mr-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition shrink-0" aria-label="Close">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="p-5 space-y-4">
                        <div class="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs text-slate-500">
                            <div class="flex justify-between"><span>Line total</span><span id="discount-line-total" class="font-mono font-bold text-slate-900"></span></div>
                            <div class="flex justify-between"><span>Maximum discount</span><span id="discount-max" class="font-mono font-bold text-slate-700"></span></div>
                        </div>
                        <div>
                            <label for="discount-value" class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Discount amount</label>
                            <input type="number" id="discount-value" min="0" step="0.01" inputmode="decimal" placeholder="0.00"
                                class="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-base font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition">
                        </div>
                        <p id="discount-error" class="hidden text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"></p>
                        <div class="flex gap-3">
                            <button id="discount-cancel" class="flex-1 min-h-[44px] rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
                            <button id="discount-apply" class="flex-1 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-700 text-sm font-extrabold text-white transition shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">Apply</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderPaymentButtons();

        // Mobile cart modal
        document.getElementById('mobile-cart-toggle').addEventListener('click', () => {
            document.getElementById('pos-panel-products').classList.add('hidden');
            const cart = document.getElementById('pos-panel-cart');
            cart.classList.remove('hidden');          // D9: was remove('hidden','hidden')
            cart.classList.add('flex');
        });

        document.getElementById('mobile-back-products').addEventListener('click', () => {
            const cart = document.getElementById('pos-panel-cart');
            cart.classList.add('hidden');
            cart.classList.remove('flex');
            document.getElementById('pos-panel-products').classList.remove('hidden');
        });

        const clearMobile = document.getElementById('clear-cart-mobile');
        if (clearMobile) {
            clearMobile.addEventListener('click', () => {
                if (confirm("Clear cart?")) {
                    this.cart = [];
                    this.renderCart();
                }
            });
        }

        // Discount modal
        document.getElementById('discount-close').addEventListener('click', () => this.closeDiscountModal());
        document.getElementById('discount-cancel').addEventListener('click', () => this.closeDiscountModal());
        document.getElementById('discount-apply').addEventListener('click', () => this.applyDiscount());
        document.getElementById('discount-modal').addEventListener('click', (e) => {
            if (e.target.id === 'discount-modal') this.closeDiscountModal();
        });
        document.getElementById('discount-value').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.applyDiscount(); }
        });
    }

    renderPaymentButtons() {
        const container = document.getElementById('payment-methods-container');
        if (!container) return;

        const containerParent = container.parentElement;
        // Ensure the parent label is visible if we have methods, or handled gracefully

        const country = this.settings?.storeCountry || 'Kenya'; // Safety check
        const currencyCode = this.settings?.currencyCode || 'USD'; // Safety check
        const s = this.settings || {}; // Safety check
        let methods = [];

        // Always add CASH for all countries
        methods.push({ id: 'CASH', label: 'CASH', color: 'green' });

        if (country === 'Kenya') {
            // Kenya M-PESA
            if (s.mpesaPaybill || s.mpesaBuyGoods || s.mpesaAgent) {
                methods.push({ id: 'MPESA', label: 'M-PESA', color: 'blue' });
            }
        } else if (country === 'Somalia') {
            // FIX BUG #3: Improved Somalia M-PESA validation
            // Show M-PESA if ANY option is configured (Till, Paybill, or Agent)
            const hasSomaliaMpesaTill = s.currencyCode === 'KES' && s.somaliaMpesaBuyGoods;
            const hasSomaliaMpesaPaybill = s.currencyCode === 'KES' && s.somaliaMpesaPaybill;
            const hasSomaliaMpesaAgent = s.currencyCode === 'KES' && s.somaliaMpesaAgent && s.somaliaMpesaStoreNumber; // Require both
            
            if (hasSomaliaMpesaTill || hasSomaliaMpesaPaybill || hasSomaliaMpesaAgent) {
                methods.push({ id: 'MPESA', label: 'M-PESA (KES)', color: 'blue' });
            }
            
            // Somalia local payment methods - show if configured
            if (s.somaliaEVC) methods.push({ id: 'EVC Plus', label: 'EVC+', color: 'blue' });
            if (s.somaliaJeeb) methods.push({ id: 'Jeeb', label: 'Jeeb', color: 'purple' });
            if (s.somaliaEdahab) methods.push({ id: 'e-Dahab', label: 'e-Dahab', color: 'yellow' });
            if (s.somaliaSalaam) methods.push({ id: 'Salaam', label: 'Salaam', color: 'slate' });
            if (s.somaliaMerchant) methods.push({ id: 'Merchant', label: 'Merchant', color: 'red' });
        } else if (country === 'Uganda') {
            // FIX BUG #2: Remove duplicate CASH (already added globally above)
            // CASH already added above, just add electronic methods
            if (s.ugandaAirtel) methods.push({ id: 'Airtel Money', label: 'Airtel', color: 'red' });
            if (s.ugandaMTN) methods.push({ id: 'MTN MoMo', label: 'MTN', color: 'yellow' });
            if (s.ugandaOther) methods.push({ id: 'Other', label: 'Other', color: 'slate' });
        } else {
            // Others/Default - CASH already added
            methods.push({ id: 'Card', label: 'Card', color: 'blue' });
            methods.push({ id: 'Other', label: 'Other', color: 'slate' });
        }

        // FIX BUG-005: Fix Tailwind colors - dynamic classes don't work, use static mapping
        const colorClasses = {
            'green': 'peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:border-emerald-200',
            'blue': 'peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-checked:border-blue-200',
            'yellow': 'peer-checked:bg-yellow-50 peer-checked:text-yellow-700 peer-checked:border-yellow-200',
            'purple': 'peer-checked:bg-purple-50 peer-checked:text-purple-700 peer-checked:border-purple-200',
            'red': 'peer-checked:bg-red-50 peer-checked:text-red-700 peer-checked:border-red-200',
            'slate': 'peer-checked:bg-slate-50 peer-checked:text-slate-700 peer-checked:border-slate-200'
        };

        // FIX: Only render if we have methods
        if (methods.length === 0) {
            container.innerHTML = '<div class="text-center text-xs text-red-600 py-2">⚠️ No payment methods configured. Go to Settings.</div>';
            return;
        }

        // M7: 44px minimum touch target, and exactly two chips per row on a phone
        container.innerHTML = methods.map((m, index) => `
             <label class="cursor-pointer flex-1 min-w-[calc(50%-0.5rem)]">
                 <input type="radio" name="payment-method" value="${m.id}" ${index === 0 ? 'checked' : ''} class="peer sr-only">
                 <div class="min-h-[44px] px-3 py-2 flex items-center justify-center text-center border border-slate-200 rounded-xl text-xs font-bold text-slate-600 ${colorClasses[m.color] || colorClasses['slate']} transition hover:bg-slate-50">
                     ${m.label}
                 </div>
             </label>
        `).join('');
    }

    renderProductGrid(searchTerm = '') {
        const grid = document.getElementById('pos-grid');
        grid.innerHTML = '';

        const filtered = this.products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.includes(searchTerm))
        );

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-8 italic font-medium">No products found</div>`;
            return;
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            // D3: one radius inside the panel (rounded-xl). Price carries the brand
            // red - it is the number people scan for, and greying it out hurt scan speed.
            card.className = "bg-white hover:shadow-md p-3 rounded-xl cursor-pointer transition flex flex-col gap-2 border border-slate-200 hover:border-red-300 active:scale-[0.98]";

            const imgHtml = p.image
                ? `<div class="h-20 lg:h-24 w-full bg-cover bg-center rounded-lg bg-red-50" style="background-image: url('${p.image}')"></div>`
                : `<div class="h-20 lg:h-24 w-full rounded-lg bg-red-50 flex items-center justify-center text-red-300">
                       <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2 1.6-1.6a2 2 0 012.8 0L20 14M4 6h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg>
                   </div>`;

            // M8: price + stock share one line so the card is ~20px shorter
            card.innerHTML = `
                ${imgHtml}
                <div class="font-semibold text-sm text-slate-800 truncate leading-snug">${p.name}</div>
                <div class="flex items-center justify-between gap-2 -mt-1">
                    <span class="text-red-600 font-extrabold text-sm">${this.settings.currencySymbol}${parseFloat(p.price).toFixed(2)}</span>
                    <span class="text-xs font-semibold shrink-0 ${p.stock > 0 ? 'text-slate-500' : 'text-red-600'}">${p.stock > 0 ? p.stock + ' left' : 'Out of stock'}</span>
                </div>
             `;

            card.addEventListener('click', () => this.addToCart(p));
            grid.appendChild(card);
        });
    }

    // D4: cart lines carry only sale-relevant fields (no Base64 image blob)
    buildCartLine(product) {
        return {
            id: product.id,
            name: product.name,
            barcode: product.barcode || null,
            price: product.price,
            costPrice: product.costPrice || 0,
            stock: product.stock,
            qty: 1
        };
    }

    // Returns true when the item was actually added
    addToCart(product) {
        if (product.stock <= 0) {
            window.showToast('Out of Stock!', 'error');
            return false;
        }

        const existing = this.cart.find(item => item.id === product.id);
        if (existing) {
            if (existing.qty >= product.stock) {
                window.showToast('Max stock reached', 'error');
                return false;
            }
            existing.qty++;
        } else {
            this.cart.push(this.buildCartLine(product));
        }
        this.renderCart();
        return true;
    }

    removeFromCart(id) {
        this.cart = this.cart.filter(item => item.id !== id);
        this.renderCart();
    }

    updateQty(id, delta) {
        const item = this.cart.find(i => i.id === id);
        if (!item) return;

        const newQty = item.qty + delta;

        if (newQty <= 0) {
            this.removeFromCart(id);
        } else if (newQty > item.stock) {
            window.showToast('Max stock reached', 'error');
        } else {
            item.qty = newQty;

            // Integrity Check: Ensure discount doesn't exceed profit margin (Selling below cost)
            const line = calcLine(item);

            if (line.discount && line.net <= line.costTotal) {
                const maxDiscount = Math.max(0, line.gross - line.costTotal - 1); // Ensure at least 1 unit profit
                item.discount = maxDiscount;
                window.showToast(`Discount adjusted to protection limit`, 'info');
            }

            this.renderCart();
        }
    }

    renderCart() {
        const container = document.getElementById('cart-items');
        container.innerHTML = '';

        let itemCount = 0;

        this.cart.forEach(item => {
            // 1.2.1: canonical line math
            const line = calcLine(item);
            const itemTotal = line.net;

            itemCount += item.qty;

            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded-xl border border-slate-200 shadow-sm transition";
            div.innerHTML = `
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-bold text-slate-900 truncate leading-snug">${item.name}</div>
                        <div class="text-xs text-slate-500 font-mono mt-1">
                            ${item.qty} x ${this.settings.currencySymbol}${Number(item.price).toFixed(2)}${line.discount ? ` <span class="text-red-600 font-bold">-${this.settings.currencySymbol}${line.discount.toFixed(2)}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-sm font-extrabold text-slate-900 font-mono shrink-0">${this.settings.currencySymbol}${itemTotal.toFixed(2)}</div>
                </div>
                <div class="flex items-center justify-between gap-2 mt-2.5">
                     <button class="btn-discount w-11 h-11 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 border border-slate-200 hover:border-blue-200 flex items-center justify-center transition active:scale-95" title="Add discount" aria-label="Add discount for ${item.name}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path></svg>
                     </button>
                     <div class="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1 border border-slate-200">
                        <button class="btn-minus w-11 h-11 rounded-lg bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 flex items-center justify-center text-xl font-bold transition active:scale-95" aria-label="Decrease quantity">-</button>
                        <span class="w-9 text-center text-sm font-extrabold text-slate-900 tabular-nums">${item.qty}</span>
                        <button class="btn-plus w-11 h-11 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 flex items-center justify-center text-xl font-bold transition active:scale-95" aria-label="Increase quantity">+</button>
                     </div>
                </div>
            `;

            div.querySelector('.btn-discount').onclick = () => this.promptDiscount(item);

            div.querySelector('.btn-minus').onclick = () => this.updateQty(item.id, -1);
            div.querySelector('.btn-plus').onclick = () => this.updateQty(item.id, 1);
            container.appendChild(div);
        });

        // 1.2.1: single source of truth for the cart totals
        const totals = calcSale(this.cart);
        const sym = this.settings.currencySymbol;

        document.getElementById('cart-subtotal').textContent = `${sym}${totals.gross.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `${sym}${totals.net.toFixed(2)}`;
        document.getElementById('btn-charge-amount').textContent = `${sym}${totals.net.toFixed(2)}`;

        // Discount row only appears when there is a discount to show
        const discountRow = document.getElementById('cart-discount-row');
        if (discountRow) {
            discountRow.classList.toggle('hidden', totals.discount <= 0);
            document.getElementById('cart-discount').textContent = `-${sym}${totals.discount.toFixed(2)}`;
        }

        // Update Mobile Floating Button Stats
        const mobileCount = document.getElementById('mobile-cart-count');
        const mobileTotal = document.getElementById('mobile-cart-total-btn');
        if (mobileCount) mobileCount.textContent = itemCount;
        if (mobileTotal) mobileTotal.textContent = `${sym}${totals.net.toFixed(2)}`;

        const checkoutBtn = document.getElementById('btn-checkout');
        if (this.cart.length === 0) {
            checkoutBtn.disabled = true;
            checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    cleanPrice(val) {
        return parseFloat(val.toString().replace(/[^0-9.]/g, '')) || 0;
    }

    // D7: window.prompt() raised the OS keyboard on top of the till. This opens
    // the in-app modal instead. The maths and the "must stay above cost" guard
    // are the same rules as before.
    promptDiscount(item) {
        const hypothetical = calcLine({ ...item, discount: 0 });
        // Leave 1 unit of profit as a buffer (unchanged rule).
        const maxDiscount = Math.max(0, hypothetical.gross - hypothetical.costTotal - 1);

        this.discountTarget = item;
        this.discountMax = maxDiscount;

        document.getElementById('discount-item-name').textContent = `${item.qty} x ${item.name}`;
        document.getElementById('discount-line-total').textContent = `${this.settings.currencySymbol}${hypothetical.gross.toFixed(2)}`;
        document.getElementById('discount-max').textContent = `${this.settings.currencySymbol}${maxDiscount.toFixed(2)}`;

        const input = document.getElementById('discount-value');
        input.value = item.discount ? String(item.discount) : '';

        const applyBtn = document.getElementById('discount-apply');
        applyBtn.disabled = maxDiscount <= 0;
        this.showDiscountError(maxDiscount <= 0 ? 'There is no room for a discount on this line.' : '');

        document.getElementById('discount-modal').classList.remove('hidden');
        setTimeout(() => { input.focus(); input.select(); }, 60);
    }

    closeDiscountModal() {
        const modal = document.getElementById('discount-modal');
        if (modal) modal.classList.add('hidden');
        this.discountTarget = null;
    }

    showDiscountError(message) {
        const el = document.getElementById('discount-error');
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('hidden', !message);
    }

    applyDiscount() {
        const item = this.discountTarget;
        if (!item) { this.closeDiscountModal(); return; }

        const sym = this.settings.currencySymbol;
        const raw = document.getElementById('discount-value').value.trim();
        const discount = parseFloat(raw);

        if (raw === '' || isNaN(discount) || discount < 0) {
            return this.showDiscountError('Enter a valid discount amount.');
        }
        if (discount > this.discountMax + 0.0001) {
            return this.showDiscountError(`Maximum discount is ${sym}${this.discountMax.toFixed(2)}.`);
        }

        const applied = calcLine({ ...item, discount });
        if (applied.net <= applied.costTotal) {
            return this.showDiscountError(`Selling price must stay above cost (${sym}${applied.costTotal.toFixed(2)}).`);
        }

        item.discount = discount;
        this.closeDiscountModal();
        this.renderCart();
    }



    reset() {
        // Called by auth.logout(). A cashier must never inherit the previous
        // user's cart, customer name or product search.
        this.cart = [];
        this.renderCart();
        const customerInput = document.getElementById('customer-name');
        if (customerInput) customerInput.value = '';
        const searchInput = document.getElementById('pos-search');
        if (searchInput) searchInput.value = '';
        this.renderProductGrid('');
    }

    bindEvents() {
        // Search Listener
        const searchInput = document.getElementById('pos-search');
        let debounce;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                // Check if exact match exists (Barcode scanner usually sends CR at end, acting like enter or fast input)
                const val = e.target.value.trim();
                const exactMatch = this.products.find(p => p.barcode === val);

                if (exactMatch) {
                    if (this.addToCart(exactMatch)) {
                        e.target.value = ''; // Clear after scan
                        this.renderProductGrid('');
                    }
                } else {
                    this.renderProductGrid(val);
                }
            }, 300);
        });

        // Barcode Scanner/Keyboard Support (Enter Key)
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (!query) return;

                // 1. Try Exact Barcode Match first (Priority)
                const perfectMatch = this.products.find(p => p.barcode === query);
                if (perfectMatch) {
                    if (this.addToCart(perfectMatch)) {
                        searchInput.value = ''; // Clear for next scan
                        this.renderProductGrid(''); // Reset view
                        window.showToast('Item Scanned', 'success');
                    }
                    return;
                }

                // 2. If no barcode match, and only 1 filtered result exists, select it
                const filtered = this.products.filter(p =>
                    p.name.toLowerCase().includes(query.toLowerCase()) ||
                    (p.barcode && p.barcode.includes(query))
                );

                if (filtered.length === 1) {
                    if (this.addToCart(filtered[0])) {
                        searchInput.value = '';
                        this.renderProductGrid('');
                    }
                    return;
                }
            }
        });

        document.getElementById('clear-cart').addEventListener('click', () => {
            if (confirm("Clear cart?")) {
                this.cart = [];
                this.renderCart();
            }
        });

        document.getElementById('btn-checkout').addEventListener('click', async () => {
            if (this.cart.length === 0) return;
            await this.processCheckout();
        });


    }

    async processCheckout() {
        const checkoutBtn = document.getElementById('btn-checkout');
        if (checkoutBtn) checkoutBtn.disabled = true;

        try {
            // A5: re-validate against the database, not the in-memory snapshot
            const fresh = await this.validateCheckout();
            if (!fresh.ok) {
                window.showToast(fresh.message, 'error');
                await this.loadProducts();
                return;
            }

            // 1.2.1: canonical totals (db.processSale re-derives the same values)
            const totals = calcSale(this.cart);

            const customerName = document.getElementById('customer-name').value.trim() || 'Walk-in Customer';

            // Get Payment Method
            const selectedMethod = document.querySelector('input[name="payment-method"]:checked');
            const paymentMethod = selectedMethod ? selectedMethod.value : 'CASH';

            const saleData = {
                date: new Date(),
                items: this.cart,
                subtotal: totals.gross,
                discountTotal: totals.discount,
                total: totals.net,
                customer: customerName,
                cashier: JSON.parse(sessionStorage.getItem('pointify_session_v1'))?.username || 'Unknown',
                paymentMethod: paymentMethod
            };

            await db.processSale(saleData, this.cart);
            window.showToast('Sale Completed Successfully!');
            this.generateReceipt(saleData);
            this.cart = [];
            this.renderCart();
            // Clear Customer Name for next sale
            document.getElementById('customer-name').value = '';
            await this.loadProducts(); // Reload stock

            // Reports used to only refresh when its tab was opened, so a sale
            // just taken did not appear until the user left and came back.
            // Refresh it here so it is already correct the moment they open it.
            if (window.reports) window.reports.generateReport();
        } catch (error) {
            console.error(error);
            window.showToast((error && error.message) || 'Transaction Failed', 'error');
        } finally {
            if (checkoutBtn) checkoutBtn.disabled = this.cart.length === 0;
            this.renderCart();
        }
    }

    // A5: stock is re-checked against IndexedDB immediately before the sale;
    // the discount invariant is re-checked on the exact values that will be charged.
    async validateCheckout() {
        for (const item of this.cart) {
            const stored = await db.get('products', item.id);

            if (!stored) {
                return { ok: false, message: `"${item.name}" is no longer in inventory` };
            }

            const storedStock = Number(stored.stock) || 0;
            if (storedStock < item.qty) {
                return {
                    ok: false,
                    message: `Insufficient stock for "${stored.name}" (available: ${storedStock}, requested: ${item.qty})`
                };
            }

            const discount = Number(item.discount) || 0;

            // Only discount-bearing lines are re-checked; undiscounted sales keep
            // the original behaviour (price at cost is allowed).
            if (discount > 0) {
                const line = calcLine(item);
                if (line.net <= line.costTotal) {
                    return {
                        ok: false,
                        message: `Discount on "${stored.name}" is at or below cost. Adjust it and try again.`
                    };
                }
            }
        }
        return { ok: true };
    }

    generateReceipt(sale) {
        const modal = document.getElementById('receipt-modal');
        const content = document.getElementById('receipt-content');
        const date = new Date(sale.date).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, year: 'numeric', month: 'numeric', day: 'numeric' });

        const logoHtml = this.settings.storeLogo
            ? `<div class="text-center mb-2"><img src="${this.settings.storeLogo}" class="max-h-12 mx-auto filter grayscale"></div>`
            : '';

        // 1.2.1: receipt totals come from the same canonical formula as the cart
        const totals = calcSale(sale.items);
        const sym = this.settings.currencySymbol;

        const itemsHtml = sale.items.map(item => {
            const line = calcLine(item);

            return `
            <div style="margin-bottom: 5px; border-bottom: 1px dotted #ddd; padding-bottom: 3px;">
                <div style="font-weight: bold; font-size: 13px;">${item.name}</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #333;">
                    <span>${item.qty} x ${sym}${Number(item.price).toFixed(2)}</span>
                    <span>${sym}${line.gross.toFixed(2)}</span>
                </div>
                ${line.discount ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #e11d48;">
                    <span>Discount</span>
                    <span>-${sym}${line.discount.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 2px;">
                    <span>Item Total</span>
                    <span>${sym}${line.net.toFixed(2)}</span>
                </div>` : ''}
            </div>
            `;
        }).join('');

        // The header is the shop's name from Settings > Store Configuration,
        // never the software's own name.
        const storeName = (this.settings.storeName || '').trim() || 'My Store';

        content.innerHTML = `
            <div style="font-family: 'Courier New', monospace; font-size: 13px; width: 100%; color: black; line-height: 1.45;">
                ${logoHtml}
                <div style="text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 3px;">${storeName}</div>
                <div style="text-align: center; font-size: 11px; color: #444; margin-bottom: 9px;">
                    ${this.settings.storeAddress ? `<div>${this.settings.storeAddress}</div>` : ''}
                    ${this.settings.storePhone ? `<div>Tel: ${this.settings.storePhone}</div>` : ''}
                </div>

                <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; font-size: 12px;">
                    <div>${date}</div>
                    <div>Order: #${sale.orderNo || 'NEW'}</div>
                    <div style="font-weight: bold; margin-top: 3px;">Cashier: ${sale.cashier.toUpperCase()}</div>
                    <div style="margin-top: 3px;">Customer: ${sale.customer || 'Walk-in'}</div>
                </div>

                <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
                    ${itemsHtml}
                </div>

                <div style="margin-top: 6px; font-size: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal</span>
                        <span>${sym}${totals.gross.toFixed(2)}</span>
                    </div>
                    ${totals.discount > 0 ? `
                    <div style="display: flex; justify-content: space-between; color: #e11d48;">
                        <span>Discount</span>
                        <span>-${sym}${totals.discount.toFixed(2)}</span>
                    </div>` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 17px; margin-top: 6px;">
                    <span>TOTAL</span>
                    <span>${sym}${totals.net.toFixed(2)}</span>
                </div>

                <div style="margin-top: 11px; border-top: 1px dashed #000; padding-top: 6px;">
                    <div style="font-weight: bold; font-size: 12px;">Payment: ${sale.paymentMethod}</div>
                    <div style="font-size: 11px; margin-top: 3px;">
                        ${this.getPaymentDetailsHtml(sale.paymentMethod)}
                    </div>
                </div>

                <div style="text-align: center; margin-top: 18px; padding-top: 12px; border-top: 1px dashed #000;">
                    <div style="font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">Thank you for shopping!</div>
                    <div style="margin-top: 8px; font-size: 10px; color: #666; line-height: 1.6;">
                        Powered by Pointify<br>
                        Questions or feedback &mdash; contact@jaalle.me
                    </div>
                </div>
            </div>

            <div class="mt-6 flex gap-3 no-print">
                <button onclick="printReceipt()" class="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-black transition">Print Receipt</button>
                <button id="close-receipt-btn" class="flex-1 bg-slate-100 text-slate-800 py-3 rounded-lg font-bold hover:bg-slate-200 transition">Close</button>
            </div>
        `;

        modal.classList.remove('hidden');

        // Dynamic bind for the specific button created above
        document.getElementById('close-receipt-btn').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }

    getPaymentDetailsHtml(method) {
        const s = this.settings;
        let html = '';

        // FIX BUG-002: Check country to show correct M-PESA details
        if (method === 'MPESA') {
            const country = s.storeCountry || 'Kenya';
            
            if (country === 'Somalia') {
                // Use Somalia M-PESA fields
                if (s.somaliaMpesaBuyGoods) html += `<div>Buy Goods: <b>${s.somaliaMpesaBuyGoods}</b></div>`;
                if (s.somaliaMpesaPaybill) html += `<div>Paybill: <b>${s.somaliaMpesaPaybill}</b></div>`;
                if (s.somaliaMpesaAccount) html += `<div>Account: <b>${s.somaliaMpesaAccount}</b></div>`;
                if (s.somaliaMpesaAgent && s.somaliaMpesaStoreNumber) {
                    html += `<div>Agent No: <b>${s.somaliaMpesaAgent}</b></div>`;
                    html += `<div>Store No: <b>${s.somaliaMpesaStoreNumber}</b></div>`;
                } else if (s.somaliaMpesaAgent) {
                    html += `<div>Agent No: <b>${s.somaliaMpesaAgent}</b></div>`;
                }
            } else {
                // Use Kenya M-PESA fields
                if (s.mpesaPaybill) html += `<div>Paybill: <b>${s.mpesaPaybill}</b></div>`;
                if (s.mpesaAccount) html += `<div>Account: <b>${s.mpesaAccount}</b></div>`;
                if (s.mpesaBuyGoods) html += `<div>Buy Goods: <b>${s.mpesaBuyGoods}</b></div>`;
                if (s.mpesaAgent && s.mpesaStoreNumber) {
                    html += `<div>Agent No: <b>${s.mpesaAgent}</b></div>`;
                    html += `<div>Store No: <b>${s.mpesaStoreNumber}</b></div>`;
                } else if (s.mpesaAgent) {
                    html += `<div>Agent No: <b>${s.mpesaAgent}</b></div>`;
                }
            }
        }
        else if (method === 'EVC Plus' && s.somaliaEVC) html += `<div>EVC+: <b>${s.somaliaEVC}</b></div>`;
        else if (method === 'Jeeb' && s.somaliaJeeb) html += `<div>Jeeb: <b>${s.somaliaJeeb}</b></div>`;
        else if (method === 'e-Dahab' && s.somaliaEdahab) html += `<div>e-Dahab: <b>${s.somaliaEdahab}</b></div>`;
        else if (method === 'Salaam' && s.somaliaSalaam) html += `<div>Salaam Acc: <b>${s.somaliaSalaam}</b></div>`;
        else if (method === 'Merchant' && s.somaliaMerchant) html += `<div>Merchant: <b>${s.somaliaMerchant}</b></div>`;
        else if (method === 'Airtel Money' && s.ugandaAirtel) html += `<div>Airtel Merch: <b>${s.ugandaAirtel}</b></div>`;
        else if (method === 'MTN MoMo' && s.ugandaMTN) html += `<div>MTN Merch: <b>${s.ugandaMTN}</b></div>`;
        else if (method === 'Other' && s.ugandaOther) html += `<div>Info: <b>${s.ugandaOther}</b></div>`;

        return html;
    }
}

export const pos = new POSModule();
window.posModule = pos;
