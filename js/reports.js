import { db, calcLine, calcSale } from './db.js';

class ReportsModule {
    constructor() {
        this.container = document.getElementById('view-reports');
        // The period the user is currently looking at. A till's default question
        // is "how much today?", so that is what opens - and it is what a refresh
        // returns to, rather than silently resetting to All Time.
        this.currentFilter = 'today';
        this.init();
    }

    async init() {
        this.renderLayout();
        await this.loadSettings();
        await this.generateReport(); // Opens on Today
        this.bindEvents();
    }

    async loadSettings() {
        const rows = await db.getAll('settings');
        const get = key => {
            const hit = rows.find(r => r.key === key);
            return hit ? hit.value : '';
        };
        this.currencySymbol = get('currencySymbol') || '$';
        // The exported report is a letterhead, so it carries the same identity
        // the receipt already prints: name, address, phone and logo.
        this.store = {
            name: (get('storeName') || '').trim() || 'My Store',
            address: (get('storeAddress') || '').trim(),
            phone: (get('storePhone') || '').trim(),
            logo: get('storeLogo') || ''
        };
    }

    // d/Mmm/yyyy - "10/Jan/2026" - the format the shop asked for.
    fmtDate(ms) {
        const d = new Date(ms);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${d.getDate()}/${months[d.getMonth()]}/${d.getFullYear()}`;
    }

    // 12-hour with an explicit AM/PM marker. A shop closes in the evening, so a
    // bare 08:19 vs 20:19 is exactly the sort of ambiguity a printed record
    // should never carry.
    fmtStamp(ms = Date.now()) {
        const d = new Date(ms);
        const raw = d.getHours();
        const suffix = raw >= 12 ? 'PM' : 'AM';
        const hour = raw % 12 || 12;
        const pad = n => String(n).padStart(2, '0');
        return `${this.fmtDate(ms)}, ${hour}:${pad(d.getMinutes())} ${suffix}`;
    }

    // "10/Jan/2026 to 20/Oct/2026" - the exact span the filter produced.
    rangeText() {
        const r = this.currentRange;
        if (!r) return '';
        return `${this.fmtDate(r.from)} to ${this.fmtDate(r.to)}`;
    }

    rangeLabel() {
        const r = this.currentRange;
        if (!r) return 'All Time';
        return r.label;
    }

    // Best-effort name of the machine that produced the report, so a printed
    // sheet says which till it came from instead of the meaningless "this
    // device". Android exposes the model in the user agent; everything else is
    // identified by platform.
    generatedOn() {
        const ua = navigator.userAgent || '';
        // Samsung prints its model code directly, e.g. "SM-A065F".
        const sm = ua.match(/Android [^;]+;\s*(SM-[A-Z0-9]+)/i);
        if (sm) return 'Samsung ' + sm[1];
        // Everyone else puts the marketing model immediately before Build/.
        // Chrome's reduced-UA mode sends a single "K" as a model placeholder,
        // which would otherwise print the device name as "K".
        const model = ua.match(/Android [^;]+;\s*([^;)]+?)\s*(?:Build\/|[;)])/);
        if (model && model[1].trim().length > 1) return model[1].trim();
        if (/Android/i.test(ua)) return 'Android device';
        if (/iPhone/i.test(ua)) return 'iPhone';
        if (/iPad/i.test(ua)) return 'iPad';
        if (/Windows/i.test(ua)) return 'Windows PC';
        if (/CrOS/i.test(ua)) return 'Chromebook';
        if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
        if (/Linux/i.test(ua)) return 'Linux PC';
        return 'Unknown device';
    }

    generatedBy() {
        try {
            const u = JSON.parse(sessionStorage.getItem('pointify_session_v1'));
            return u ? `${u.username} (${u.role})` : 'Unknown';
        } catch (e) {
            return 'Unknown';
        }
    }

    // Fills the print-only block at the top of the report.
    updateLetterhead() {
        const st = this.store || {};
        const set = (id, value) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = value || '';
            el.classList.toggle('hidden', !value);
        };

        const logo = document.getElementById('rl-logo');
        if (logo) {
            if (st.logo) {
                logo.src = st.logo;
                logo.classList.remove('hidden');
            } else {
                logo.classList.add('hidden');
            }
        }

        set('rl-name', st.name);
        set('rl-address', st.address);
        set('rl-phone', st.phone ? `Tel: ${st.phone}` : '');
        set('rl-range', this.rangeText() ? `Period: ${this.rangeText()}` : '');
        set('rl-generated',
            `Generated ${this.fmtStamp()} by ${this.generatedBy()}`);
        set('rl-device', `on ${this.generatedOn()}`);
    }

    renderLayout() {
        this.container.innerHTML = `
            <div class="flex flex-col space-y-6">

                <!-- Print-only letterhead: shop identity, span and generation
                     stamp. Hidden on screen, top of every PDF and CSV. -->
                <div id="report-letterhead" class="print-only border-b-2 border-slate-800 pb-3 mb-5">
                    <div class="flex justify-between items-start gap-8">
                        <div class="min-w-0">
                            <img id="rl-logo" class="hidden mb-2 h-14 object-contain" alt="">
                            <div id="rl-name" class="text-2xl font-black text-slate-900 leading-tight tracking-tight"></div>
                            <div id="rl-address" class="text-[11px] text-slate-600 mt-1 leading-snug"></div>
                            <div id="rl-phone" class="text-[11px] text-slate-600 leading-snug"></div>
                        </div>
                        <div class="text-right shrink-0">
                            <div class="text-sm font-black uppercase tracking-[0.2em] text-slate-900">Financial Report</div>
                            <div id="rl-range" class="text-[11px] font-bold text-slate-700 mt-2"></div>
                            <div id="rl-generated" class="text-[10px] text-slate-500 mt-2"></div>
                            <div id="rl-device" class="text-[10px] text-slate-500"></div>
                        </div>
                    </div>
                </div>
                <!-- Header & Controls -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                     <div class="flex flex-col">
                        <h2 class="text-2xl font-bold text-slate-800">Financial Reports</h2>
                        <span class="text-xs text-slate-500 font-medium" id="report-period-label">All Time</span>
                     </div>
                     
                     <div class="flex flex-wrap gap-2 items-center">
                        <div class="relative">
                            <svg class="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            <input type="text" id="report-item-search" placeholder="Search Item..." class="w-40 md:w-56 bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-500 transition">
                        </div>

                        <div class="h-8 w-px bg-slate-200 mx-2"></div>

                        <div class="flex bg-slate-100 rounded-lg p-1">
                            <button data-filter="today" class="filter-btn px-3 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-red-600">Today</button>
                            <button data-filter="week" class="filter-btn px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white hover:shadow-sm transition text-slate-600">This Week</button>
                            <button data-filter="month" class="filter-btn px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white hover:shadow-sm transition text-slate-600">This Month</button>
                            <button id="btn-filter-year" data-filter="year" class="filter-btn px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white hover:shadow-sm transition text-slate-600">This Year</button>
                            <button id="btn-filter-all" data-filter="all" class="filter-btn px-3 py-1.5 text-xs font-bold rounded-md hover:bg-white hover:shadow-sm transition text-slate-600">All</button>
                        </div>
                        
                        <!-- Manager Scope Toggle -->
                        <div id="manager-scope-toggle" class="hidden flex bg-slate-100 rounded-lg p-1 ml-2">
                             <button data-scope="mine" class="scope-btn px-3 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-red-600 transition">My Sales</button>
                             <button data-scope="all" class="scope-btn px-3 py-1.5 text-xs font-bold rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition">All Sales</button>
                        </div>
                        
                        <div class="h-8 w-px bg-slate-200 mx-2"></div>

                        <button id="btn-export-csv" class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            CSV
                        </button>
                        <button id="btn-print-report" class="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            Print/PDF
                        </button>
                     </div>
                </div>
                
                <!-- Stat Cards -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 remove-print-margin"> <!-- Added class for print styling -->
                    <div class="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                        <div class="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1" id="label-revenue">Revenue</div>
                        <div class="text-3xl font-black text-slate-800" id="report-revenue">...</div>
                    </div>
                    
                    <div class="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                        <div class="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1" id="label-profit">Net Profit</div>
                        <div class="text-3xl font-black text-red-600" id="report-second-metric">...</div>
                    </div>

                    <div class="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between shadow-sm">
                         <div class="text-slate-500 text-sm font-bold uppercase tracking-wider mb-1" id="label-orders">Orders</div>
                        <div class="text-3xl font-black text-slate-800" id="report-orders">...</div>
                    </div>
                </div>

                <!-- Payment Method Breakdown (Admin/Manager) -->
                <div id="payment-summary-container" class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8">
                     <div class="flex-1">
                        <h3 class="font-bold text-slate-700 mb-4 uppercase text-xs tracking-wider">Payment Summary</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                                <div class="text-xs font-bold text-emerald-700 uppercase mb-1">Total Cash</div>
                                <div class="text-xl font-black text-emerald-800" id="summary-cash">...</div>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <div class="text-xs font-bold text-blue-700 uppercase mb-1">Total Electronic</div>
                                <div class="text-xl font-black text-blue-800" id="summary-electronic">...</div>
                            </div>
                        </div>
                     </div>
                     <div class="flex-1 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-8">
                        <h3 class="font-bold text-slate-700 mb-4 uppercase text-xs tracking-wider">Detailed Breakdown</h3>
                        <div class="space-y-2" id="summary-list">
                            <!-- Injected JS -->
                        </div>
                     </div>
                </div>

                <!-- Recent Sales List -->
                <div class="min-h-[20rem] bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm print:border-0">
                    <div class="p-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-50/50 flex justify-between">
                        <span>Transactions Log</span>
                        <span class="text-xs text-slate-400 font-normal" id="report-log-count"></span>
                    </div>
                    <div class="max-h-[70vh] overflow-auto p-0">
                         <table class="w-full text-left text-sm" id="report-table">
                            <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-bold sticky top-0">
                                <tr>
                                    <th class="p-3 border-b border-slate-200">Date</th>
                                    <th class="p-3 border-b border-slate-200 hidden md:table-cell">Order No</th>
                                    <th class="p-3 border-b border-slate-200">Cashier</th>
                                    <th class="p-3 border-b border-slate-200 hidden md:table-cell">Customer</th>
                                    <th class="p-3 border-b border-slate-200">Payment</th>
                                    <th class="p-3 border-b border-slate-200">Item</th>
                                    <th class="p-3 border-b border-slate-200 text-center">Qty</th>
                                    <th class="p-3 border-b border-slate-200 text-right">Price</th>
                                    <th class="p-3 border-b border-slate-200 text-right">Discount</th>
                                    <th class="p-3 border-b border-slate-200 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody id="report-sales-list" class="divide-y divide-slate-100">
                                <!-- Sales Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>

                 <!-- Employee Performance (Admin Only) -->
                <div id="admin-stats-container" class="hidden bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-4">
                    <div class="p-4 border-b border-slate-200 font-bold text-slate-700 bg-slate-50/50">
                        Employee Performance
                    </div>
                    <div class="p-0 overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                <tr>
                                    <th class="p-3 border-b border-slate-200">Employee</th>
                                    <th class="p-3 border-b border-slate-200 text-center">Orders</th>
                                    <th class="p-3 border-b border-slate-200 text-center">Items Sold</th>
                                    <th class="p-3 border-b border-slate-200 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody id="employee-stats-list" class="divide-y divide-slate-100"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // UI Toggle
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('bg-white', 'shadow-sm', 'text-red-600');
                    b.classList.add('text-slate-600');
                });
                e.target.classList.add('bg-white', 'shadow-sm', 'text-red-600');
                e.target.classList.remove('text-slate-600');

                // Apply filter
                const filter = e.target.dataset.filter;
                this.generateReport(filter);
            });
        });

        // Search Input Listener
        const searchInput = document.getElementById('report-item-search');
        let debounce;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const currentFilter = document.querySelector('.filter-btn.text-red-600')?.dataset.filter || 'all';
                this.generateReport(currentFilter);
            }, 300);
        });

        // Scope Toggle Listeners (Manager)
        document.querySelectorAll('.scope-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.scope-btn').forEach(b => {
                    b.classList.remove('bg-white', 'shadow-sm', 'text-red-600');
                    b.classList.add('text-slate-600');
                });
                e.target.classList.add('bg-white', 'shadow-sm', 'text-red-600');
                e.target.classList.remove('text-slate-600');

                // Re-run report with current time filter but new scope
                const currentFilter = document.querySelector('.filter-btn.text-red-600')?.dataset.filter || 'all';
                this.generateReport(currentFilter);
            });
        });

        document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
        document.getElementById('btn-print-report').addEventListener('click', () => this.printReport());
    }

    // Public entry point. Remembers the period the user picked so that
    // re-entering Reports, or finishing a sale, refreshes the SAME period
    // instead of dumping them back onto All Time.
    async generateReport(filter) {
        this.currentFilter = filter || this.currentFilter || 'today';
        try {
            await this._buildReport(this.currentFilter);
        } catch (err) {
            // Without this a single bad record left yesterday's numbers sitting
            // on screen with no indication anything had failed.
            console.error('Report could not be built', err);
            if (window.showToast) window.showToast('Report could not be refreshed', 'error');
        }
    }

    async _buildReport(filter) {
        const sales = await db.getAll('sales');
        // Search Term
        const itemSearch = document.getElementById('report-item-search').value.trim().toLowerCase();

        let filteredSales = sales;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        let label = "All Time";
        let rangeFrom = null;

        if (filter === 'today') {
            filteredSales = sales.filter(s => new Date(s.date).getTime() >= startOfDay);
            label = "Today";
            rangeFrom = startOfDay;
        } else if (filter === 'week') {
            const startOfWeek = startOfDay - (6 * 24 * 60 * 60 * 1000); // 7 days ago
            filteredSales = sales.filter(s => new Date(s.date).getTime() >= startOfWeek);
            label = "Last 7 Days";
            rangeFrom = startOfWeek;
        } else if (filter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            filteredSales = sales.filter(s => new Date(s.date).getTime() >= startOfMonth);
            label = "This Month";
            rangeFrom = startOfMonth;
        } else if (filter === 'year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
            filteredSales = sales.filter(s => new Date(s.date).getTime() >= startOfYear);
            label = "This Year";
            rangeFrom = startOfYear;
        }

        // "All Time" has no synthetic boundary - the span starts at the earliest
        // sale that actually exists, so the printed range is never a lie.
        if (rangeFrom === null) {
            const times = sales
                .map(s => new Date(s.date).getTime())
                .filter(t => Number.isFinite(t));
            rangeFrom = times.length ? Math.min(...times) : now.getTime();
        }
        this.currentRange = { from: rangeFrom, to: now.getTime(), label };

        document.getElementById('report-period-label').textContent = label;
        this.updateLetterhead();
        const user = JSON.parse(sessionStorage.getItem('pointify_session_v1'));
        const isAdmin = user && user.role === 'admin';
        const isManager = user && user.role === 'manager';

        let managerScope = 'mine'; // Default for manager
        if (isManager) {
            document.getElementById('manager-scope-toggle').classList.remove('hidden');
            const activeScopeBtn = document.querySelector('.scope-btn.text-red-600');
            if (activeScopeBtn) managerScope = activeScopeBtn.dataset.scope;
        } else {
            document.getElementById('manager-scope-toggle').classList.add('hidden');
        }

        // 1. Filter Logic & Role Based UI Adjustments
        // Cashier OR (Manager AND Scope is 'mine')
        const isRestrictedView = (!isAdmin && !isManager) || (isManager && managerScope === 'mine');

        if (isRestrictedView && user) {
            // Restricted Logic (Cashier or Manager-My-Sales)
            filteredSales = filteredSales.filter(s => s.cashier === user.username);

            const btnYear = document.getElementById('btn-filter-year');
            const btnAll = document.getElementById('btn-filter-all');

            if (!isManager) {
                // Strict restrictions for Cashier
                if (btnYear) btnYear.classList.add('hidden');
                if (btnAll) btnAll.classList.add('hidden');
            } else {
                // Manager can see years/all even for "My Sales"
                if (btnYear) btnYear.classList.remove('hidden');
                if (btnAll) btnAll.classList.remove('hidden');
            }

            // Adjust Cards Metadata
            document.getElementById('label-revenue').textContent = "My Sales";
            document.getElementById('label-profit').textContent = "Items Sold";
            document.getElementById('label-orders').textContent = "My Orders";

            // Change color of second metric
            const metric2 = document.getElementById('report-second-metric');
            metric2.classList.remove('text-red-600');
            metric2.classList.add('text-blue-600');

        } else {
            // Admin Logic OR Manager-All-Sales
            const btnYear = document.getElementById('btn-filter-year');
            const btnAll = document.getElementById('btn-filter-all');
            if (btnYear) btnYear.classList.remove('hidden');
            if (btnAll) btnAll.classList.remove('hidden');

            document.getElementById('label-revenue').textContent = "Revenue";
            document.getElementById('label-profit').textContent = "Net Profit";
            document.getElementById('label-orders').textContent = "Orders";

            const metric2 = document.getElementById('report-second-metric');
            metric2.classList.add('text-red-600');
            metric2.classList.remove('text-blue-600');
        }

        // 2. Calculate Totals (With Item Filter)
        let totalRevenue = 0;
        let metric2Value = 0; // Net Profit or Items Sold
        let totalOrders = 0;

        // Stats placeholders if item filter is on
        let filteredStats = {};
        const matchedOrders = new Set();

        // 1.2.4: the payment breakdown is always whole-sale scope - an item search
        // must not shrink what was actually tendered - so its denominator comes
        // from the same scope instead of the item-filtered revenue card.
        const paymentScopeTotal = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        filteredSales.forEach(sale => {
            let saleRevenue = 0;
            let saleProfit = 0;
            let saleItemsCount = 0;
            let hasMatch = false;

            (sale.items || []).forEach(item => {
                // SEARCH FILTER LOGIC
                if (itemSearch && !item.name.toLowerCase().includes(itemSearch)) {
                    return; // Skip this item line
                }

                hasMatch = true;

                // 1.2.1: canonical line math
                const line = calcLine(item);

                saleRevenue += line.net;
                saleProfit += line.profit;
                saleItemsCount += line.qty;

                // Track Employee performance for THIS item
                const cashier = sale.cashier || 'Unknown';
                if (!filteredStats[cashier]) filteredStats[cashier] = { orders: 0, items: 0, revenue: 0 };

                filteredStats[cashier].items += line.qty;
                filteredStats[cashier].revenue += line.net;
            });

            if (hasMatch) {
                totalRevenue += saleRevenue;
                // Metric 2 Logic
                if (!isRestrictedView) {
                    metric2Value += saleProfit;
                } else {
                    metric2Value += saleItemsCount;
                }
                matchedOrders.add(sale.id);

                // For employee stats, we only increment order count once per valid sale
                if (filteredStats[sale.cashier]) {
                    filteredStats[sale.cashier].orders++;
                }
            }
        });

        totalOrders = matchedOrders.size;
        // Snapshot for exportCSV(): the employee section of the CSV must cover
        // exactly the same period as the transactions above it.
        this.currentStats = filteredStats;

        // (1.2.5) `this.currentData` is assigned further down from `sortedSales`,
        // so the CSV shares the table's scope and date order and never aliases an
        // array whose `.sort()` mutates it.

        // Apply to DOM
        document.getElementById('report-revenue').textContent = `${this.currencySymbol}${totalRevenue.toFixed(2)}`;
        document.getElementById('report-orders').textContent = totalOrders;

        if (!isRestrictedView) {
            document.getElementById('report-second-metric').textContent = `${this.currencySymbol}${metric2Value.toFixed(2)}`;
        } else {
            document.getElementById('report-second-metric').textContent = metric2Value;
        }

        // 3. Payment Breakdown Calculation
        const paymentStats = {
            cash: 0,
            electronic: 0,
            methods: {}
        };

        filteredSales.forEach(sale => {
            const method = sale.paymentMethod || 'CASH';
            const amount = Number(sale.total) || 0;

            if (!paymentStats.methods[method]) paymentStats.methods[method] = 0;
            paymentStats.methods[method] += amount;

            if (method === 'CASH') {
                paymentStats.cash += amount;
            } else {
                paymentStats.electronic += amount;
            }
        });

        // Render Summary
        const container = document.getElementById('payment-summary-container');
        // FIX BUG-006: Keep payment summary visible even when searching (for administrative visibility)
        // Don't hide the payment summary - it helps with analysis
        if (container) {
            // Visibility: Only visible if NOT restricted, or if Manager wants to see it?
            // "i need the reports setion of manager and admin add the calcuter"
            if (isRestrictedView && !isManager) {
                container.classList.add('hidden');
            } else {
                container.classList.remove('hidden'); // Admin & Manager see it

                document.getElementById('summary-cash').textContent = `${this.currencySymbol}${paymentStats.cash.toFixed(2)}`;
                document.getElementById('summary-electronic').textContent = `${this.currencySymbol}${paymentStats.electronic.toFixed(2)}`;

                const list = document.getElementById('summary-list');
                list.innerHTML = '';

                Object.keys(paymentStats.methods).forEach(method => {
                    const amt = paymentStats.methods[method];
                    const percent = paymentScopeTotal > 0 ? ((amt / paymentScopeTotal) * 100).toFixed(1) : 0;

                    list.innerHTML += `
                        <div class="flex justify-between items-center text-sm">
                            <span class="font-medium text-slate-600">${method}</span>
                            <div class="flex items-center gap-3">
                                <span class="text-xs text-slate-400 font-mono bg-slate-50 px-1 rounded">${percent}%</span>
                                <span class="font-bold text-slate-800">${this.currencySymbol}${amt.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                });
            }
        }

        // Render Table (Limit 100 recent entries logic needs adjustment for line items)
        const tbody = document.getElementById('report-sales-list');
        tbody.innerHTML = '';

        // Sort sales by date first (sort a copy: `filteredSales` keeps its own order)
        let sortedSales = [...filteredSales].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Fix: If searching, only show sales that contained the item in the table list
        if (itemSearch) {
            sortedSales = sortedSales.filter(s => matchedOrders.has(s.id));
        }

        // 1.2.5: CSV export shares this exact array - same scope as the table
        // (item search applied) and same newest-first order - as a standalone copy.
        this.currentData = sortedSales;

        // Flatten to Line Items for Table Display
        // We want 100 line items max to prevent lag, or maybe 50 sales worth? 
        // Let's grab first 50 sales and show all their items.
        const recentSales = sortedSales.slice(0, 50);

        // The header used to claim "up to 100 recent records" while the code
        // sliced at 50, and neither said when it had cut anything off. The
        // export always carries every sale, so say so.
        const logCount = document.getElementById('report-log-count');
        if (logCount) {
            logCount.textContent = sortedSales.length > recentSales.length
                ? `Showing ${recentSales.length} of ${sortedSales.length} sales \u2014 CSV export includes all`
                : `${sortedSales.length} sale${sortedSales.length === 1 ? '' : 's'}`;
        }

        if (recentSales.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400 italic">No sales found for this period.</td></tr>`;
        }

        // Hide Admin/Global Specifics
        const adminStatsContainer = document.getElementById('admin-stats-container');

        if (isRestrictedView) {
            if (adminStatsContainer) adminStatsContainer.classList.add('hidden');
        } else {
            // Employee Stats: Visible for Admin OR Manager-All-Sales.
            // One renderer for both cases: `filteredStats` is already built from
            // canonical line math over every sale in scope (it is only narrowed
            // when an item search is active), so the item-search and no-search
            // paths can no longer drift apart.
            if (adminStatsContainer) {
                adminStatsContainer.classList.remove('hidden');
                this.renderEmployeeStats(filteredStats);
            }
        }

        recentSales.forEach(sale => {
            const dateObj = new Date(sale.date);
            const date = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
            const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            (sale.items || []).forEach(item => {
                // FILTER TABLE ROWS
                if (itemSearch && !item.name.toLowerCase().includes(itemSearch)) {
                    return;
                }
                const tr = document.createElement('tr');

                // 1.2.1: canonical line math (discount is a flat line amount)
                const line = calcLine(item);
                const unitPrice = line.unitPrice;
                const discount = line.discount;
                const lineTotal = line.net;

                // User Requested Columns:
                // Date, Cashier, Customer, Payment, Item, Qty, Price, Discount, Total

                tr.innerHTML = `
                    <td class="p-3 text-slate-600 font-medium whitespace-nowrap align-middle">
                        <div>${date}</div>
                        <div class="text-xs text-slate-400">${time}</div>
                    </td>
                    <td class="p-3 text-slate-700 font-mono font-bold text-xs align-middle whitespace-nowrap hidden md:table-cell">${sale.orderNo || '-'}</td>
                    <td class="p-3 text-slate-600 align-middle">${sale.cashier || '-'}</td>
                    <td class="p-3 text-slate-600 align-middle hidden md:table-cell">${sale.customer || '-'}</td>
                    <td class="p-3 text-slate-600 font-bold text-xs align-middle uppercase">${sale.paymentMethod || 'CASH'}</td>
                    <td class="p-3 text-slate-700 font-bold align-middle">${item.name}</td>
                    <td class="p-3 text-center text-slate-600 align-middle">${item.qty}x</td>
                    <td class="p-3 text-right text-slate-600 font-mono align-middle">${this.currencySymbol}${unitPrice.toFixed(2)}</td>
                    <td class="p-3 text-right text-red-500 font-mono align-middle">${discount > 0 ? this.currencySymbol + discount.toFixed(2) : '-'}</td>
                    <td class="p-3 text-right text-slate-800 font-bold font-mono align-middle">${this.currencySymbol || '$'}${lineTotal.toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        });

    }

    renderEmployeeStats(stats) {
        const tbody = document.getElementById('employee-stats-list');
        tbody.innerHTML = '';

        Object.keys(stats).forEach(cashier => {
            const row = stats[cashier];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3 font-medium text-slate-700">${cashier}</td>
                <td class="p-3 text-center text-slate-600">${row.orders}</td>
                <td class="p-3 text-center text-slate-600">${row.items}</td>
                <td class="p-3 text-right font-bold text-slate-800">${this.currencySymbol}${row.revenue.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    printReport() {
        // The letterhead is rebuilt on every report, but re-stamp it here so
        // the time on the PDF is the moment it was generated, not the moment
        // the filters were last touched.
        this.currentRange = Object.assign({}, this.currentRange, { to: Date.now() });
        this.updateLetterhead();
        window.print();
    }

    exportCSV() {
        if (!this.currentData || this.currentData.length === 0) {
            window.showToast('No data to export', 'error');
            return;
        }

        // Quoting guard: user-entered names can contain commas/quotes/newlines
        const esc = v => {
            const q = String(v ?? '');
            return /[",\n]/.test(q) ? `"${q.replace(/"/g, '""')}"` : q;
        };
        // Money is a bare number so a spreadsheet can actually add it up. The
        // currency lives in the column header, not repeated in every cell.
        const num = n => (Number(n) || 0).toFixed(2);
        // ISO sorts correctly as text. dd/mm/yyyy sorts as words, which puts
        // 1 January of one year after 13 December of the next.
        const iso = ms => {
            const d = new Date(ms);
            const p = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
                   `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        };

        const sym = this.currencySymbol;
        const rows = [];

        // 1. Transactions. One row per sale, header at row 1, so the file opens
        //    as a single clean table that can be sorted and filtered straight
        //    away - no letterhead rows to delete first.
        rows.push([
            'Date', 'Order No', 'Customer', 'Cashier', 'Payment',
            'Items', 'Item Details',
            `Subtotal (${sym})`, `Discount (${sym})`, `Total (${sym})`, `Net Profit (${sym})`
        ].map(esc).join(','));

        this.currentData.forEach(row => {
            const totals = calcSale(row.items);
            // Total is what was stored at the moment of sale; the recomputed
            // net is only a fallback if that field is somehow absent.
            const storedTotal = Number(row.total);
            const total = Number.isFinite(storedTotal) ? storedTotal : totals.net;
            // The basket stays readable without exploding to one row per item.
            const detail = (row.items || []).map(i =>
                `${i.name} x${Number(i.qty) || 0} @ ${num(i.price)}`
            ).join('; ');

            rows.push([
                iso(row.date),
                row.orderNo || '',
                row.customer || '',
                row.cashier || 'Unknown',
                row.paymentMethod || 'CASH',
                totals.qty,
                detail,
                num(totals.gross),
                num(totals.discount),
                num(total),
                num(totals.profit)
            ].map(esc).join(','));
        });

        // 2. Employee performance - a second table below a full-width break, so
        //    the transactions above it keep their own column structure.
        const stats = this.currentStats;
        if (stats && Object.keys(stats).length > 0) {
            rows.push('');
            rows.push('Employee Performance');
            rows.push(['Employee', 'Orders', 'Items Sold', `Revenue (${sym})`].map(esc).join(','));
            Object.keys(stats).forEach(name => {
                const r = stats[name];
                rows.push([esc(name), r.orders, r.items, num(r.revenue)].join(','));
            });
        }

        // 3. Provenance, at the very bottom where it cannot disturb the tables.
        //    Every exported file says the span it covers and the machine that
        //    produced it.
        rows.push('');
        const spanText = this.rangeText();
        rows.push(esc(spanText ? `${this.rangeLabel()} - ${spanText}` : this.rangeLabel()));
        rows.push(esc(`Generated ${this.fmtStamp()} by ${this.generatedBy()} on ${this.generatedOn()}`));

        // 4. BOM. Without it Excel on Windows ignores the UTF-8 declaration and
        //    mangles any non-ASCII character in a product or customer name.
        const csv = '\uFEFF' + rows.join('\n');

        // 5. Blob, never a data: URI. A data URI is a web link, and in a web
        //    link '#' starts a fragment - so any item or customer name
        //    containing '#' silently destroyed everything after it.
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // 6. Shop name and period travel in the filename, so the file still
        //    identifies itself sitting alone in a Downloads folder.
        const clean = t => String(t || '').replace(/[^\w.-]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'report';
        const span = this.currentRange
            ? `${this.fmtDate(this.currentRange.from).replace(/\//g, '-')}_to_${this.fmtDate(this.currentRange.to).replace(/\//g, '-')}`
            : new Date().toISOString().split('T')[0];

        const link = document.createElement('a');
        link.href = url;
        link.download = `${clean((this.store || {}).name)}_sales_${span}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Revoking immediately can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 4000);

        window.showToast(`Exported ${this.currentData.length} sale${this.currentData.length === 1 ? '' : 's'}`);
    }
}

export const reports = new ReportsModule();
window.reports = reports;
