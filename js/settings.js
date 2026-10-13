import {
    db,
    loadRecoveryCodes, issueRecoveryCodes
} from './db.js';

class SettingsModule {
    constructor() {
        this.container = document.getElementById('view-settings');
        this.config = {
            storeName: 'My Store',
            storePhone: '', // NEW: Store phone number
            storeAddress: '', // NEW: Store address
            currencySymbol: '$',
            currencyCode: 'USD',
            storeLogo: null, // Base64
            storeCountry: 'Kenya', // Default: Kenya, Somalia, Uganda, Others

            // Kenya (M-Pesa)
            mpesaPaybill: '',
            mpesaAccount: '',
            mpesaBuyGoods: '',
            mpesaAgent: '',
            mpesaStoreNumber: '', // New Field for Withdrawal Store No

            // Somalia (M-Pesa KSH or Local Payment Methods)
            somaliaMpesaPaybill: '',
            somaliaMpesaAccount: '',
            somaliaMpesaBuyGoods: '',
            somaliaMpesaAgent: '',
            somaliaMpesaStoreNumber: '',
            somaliaEVC: '',
            somaliaJeeb: '',
            somaliaEdahab: '',
            somaliaSalaam: '',
            somaliaMerchant: '',

            // Uganda (Airtel, MTN)
            ugandaAirtel: '',
            ugandaMTN: '',
            ugandaOther: ''
        };
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.render();
        this.bindEvents();
    }

    async loadSettings() {
        const settings = await db.getAll('settings');
        settings.forEach(setting => {
            this.config[setting.key] = setting.value;
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="space-y-6 max-w-6xl">
                <!-- General Settings -->
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 class="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                        <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </span>
                        <span class="min-w-0">
                            <span class="block font-bold text-slate-900 leading-tight">Store Configuration</span>
                            <span class="block text-xs text-slate-500 mt-0.5">Details printed on every receipt and used across the till</span>
                        </span>
                    </h2>
                    
                    <form id="settings-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-bold text-slate-500 mb-1">Store Name</label>
                            <input type="text" id="setting-name" value="${this.config.storeName}" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                        </div>
                         <!-- Contact Info -->
                         <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Store Phone</label>
                                <input type="text" id="setting-phone" value="${this.config.storePhone || ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                            </div>
                             <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Store Address</label>
                                <input type="text" id="setting-address" value="${this.config.storeAddress || ''}" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Currency</label>
                                <select id="setting-currency-select" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                                    <option value="USD|$" ${this.config.currencyCode === 'USD' ? 'selected' : ''}>USD ($)</option>
                                    <option value="KES|Ksh" ${this.config.currencyCode === 'KES' ? 'selected' : ''}>Kenya Shilling (Ksh)</option>
                                    <option value="UGX|USh" ${this.config.currencyCode === 'UGX' ? 'selected' : ''}>Uganda Shilling (USh)</option>
                                    <option value="TZS|TSh" ${this.config.currencyCode === 'TZS' ? 'selected' : ''}>Tanzania Shilling (TSh)</option>
                                    <option value="SOS|Ssh" ${this.config.currencyCode === 'SOS' ? 'selected' : ''}>Somali Shilling (Ssh)</option>
                                    <option value="EUR|€" ${this.config.currencyCode === 'EUR' ? 'selected' : ''}>Euro (€)</option>
                                    <option value="GBP|£" ${this.config.currencyCode === 'GBP' ? 'selected' : ''}>British Pound (£)</option>
                                    <option value="Custom|Custom" ${(this.config.currencyCode !== 'USD' && this.config.currencyCode !== 'KES' && this.config.currencyCode !== 'UGX' && this.config.currencyCode !== 'TZS' && this.config.currencyCode !== 'SOS' && this.config.currencyCode !== 'EUR' && this.config.currencyCode !== 'GBP') ? 'selected' : ''}>Custom</option>
                                </select>
                            </div>
                             <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Symbol (Auto)</label>
                                <input type="text" id="setting-currency-symbol" value="${this.config.currencySymbol}" class="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-600 outline-none font-medium" readonly>
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Country</label>
                                <select id="setting-country" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                                    <option value="Kenya" ${this.config.storeCountry === 'Kenya' ? 'selected' : ''}>Kenya</option>
                                    <option value="Somalia" ${this.config.storeCountry === 'Somalia' ? 'selected' : ''}>Somalia</option>
                                    <option value="Uganda" ${this.config.storeCountry === 'Uganda' ? 'selected' : ''}>Uganda</option>
                                    <option value="Others" ${this.config.storeCountry === 'Others' ? 'selected' : ''}>Others</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">Currency Code</label>
                                <input type="text" id="setting-currency-code" value="${this.config.currencyCode}" class="w-full bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-600 outline-none font-medium" readonly>
                            </div>
                        </div>
                        
                        <!-- Multi-Country Electronic Money Settings -->
                        <div class="border-t border-slate-100 pt-4 mt-2">
                            <h3 class="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wide">Electronic Money Configuration</h3>
                            
                            <!-- KENYA -->
                            <div id="fields-kenya" class="country-fields ${this.config.storeCountry !== 'Kenya' ? 'hidden' : ''} space-y-6">
                                
                                <!-- 1. Buy Goods Section -->
                                <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <h4 class="font-bold text-emerald-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                        Option 1: Buy Goods (Till Number)
                                    </h4>
                                    <div>
                                        <label class="block text-xs font-bold text-emerald-700 mb-1">Buy Goods / Till No.</label>
                                        <input type="text" id="setting-buygoods" value="${this.config.mpesaBuyGoods || ''}" placeholder="e.g. 123456" class="w-full bg-white border border-emerald-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-medium placeholder-emerald-300">
                                    </div>
                                </div>

                                <!-- 2. Paybill Section -->
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 class="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        Option 2: Paybill
                                    </h4>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-bold text-blue-700 mb-1">Paybill Number</label>
                                            <input type="text" id="setting-paybill" value="${this.config.mpesaPaybill || ''}" placeholder="e.g. 247247" class="w-full bg-white border border-blue-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder-blue-300">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-blue-700 mb-1">Account No.</label>
                                            <input type="text" id="setting-paybill-acc" value="${this.config.mpesaAccount || ''}" placeholder="e.g. Store123" class="w-full bg-white border border-blue-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder-blue-300">
                                        </div>
                                    </div>
                                </div>

                                <!-- 3. Withdrawal Section -->
                                <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <h4 class="font-bold text-purple-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        Option 3: Agency Withdrawal
                                    </h4>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-bold text-purple-700 mb-1">Agent Number</label>
                                            <input type="text" id="setting-agent" value="${this.config.mpesaAgent || ''}" placeholder="e.g. 987654" class="w-full bg-white border border-purple-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none font-medium placeholder-purple-300">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-purple-700 mb-1">Store Number</label>
                                            <input type="text" id="setting-store-no" value="${this.config.mpesaStoreNumber || ''}" placeholder="For Withdrawal" class="w-full bg-white border border-purple-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none font-medium placeholder-purple-300">
                                        </div>
                                    </div>
                                    <p class="text-[10px] text-slate-400 mt-2 italic">* Both fields required for Agent Withdrawal</p>
                                </div>

                            </div>

                            <!-- SOMALIA -->
                            <div id="fields-somalia" class="country-fields ${this.config.storeCountry !== 'Somalia' ? 'hidden' : ''} space-y-6">
                                
                                <!-- 1. M-PESA (KSH) for Somalia -->
                                <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                    <h4 class="font-bold text-emerald-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                                        M-PESA KSH (Till Number)
                                    </h4>
                                    <div>
                                        <label class="block text-xs font-bold text-emerald-700 mb-1">Buy Goods / Till No.</label>
                                        <input type="text" id="setting-som-mpesa-buygoods" value="${this.config.somaliaMpesaBuyGoods || ''}" placeholder="e.g. 123456" class="w-full bg-white border border-emerald-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-medium placeholder-emerald-300">
                                    </div>
                                </div>

                                <!-- 2. M-PESA Paybill (KSH) -->
                                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 class="font-bold text-blue-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                                        M-PESA Paybill (KSH)
                                    </h4>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-bold text-blue-700 mb-1">Paybill Number</label>
                                            <input type="text" id="setting-som-mpesa-paybill" value="${this.config.somaliaMpesaPaybill || ''}" placeholder="e.g. 247247" class="w-full bg-white border border-blue-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder-blue-300">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-blue-700 mb-1">Account No.</label>
                                            <input type="text" id="setting-som-mpesa-acc" value="${this.config.somaliaMpesaAccount || ''}" placeholder="e.g. Store123" class="w-full bg-white border border-blue-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder-blue-300">
                                        </div>
                                    </div>
                                </div>

                                <!-- 3. M-PESA Agent Withdrawal (KSH) -->
                                <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                                    <h4 class="font-bold text-purple-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        Agency Withdrawal (KSH)
                                    </h4>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-bold text-purple-700 mb-1">Agent Number</label>
                                            <input type="text" id="setting-som-mpesa-agent" value="${this.config.somaliaMpesaAgent || ''}" placeholder="e.g. 987654" class="w-full bg-white border border-purple-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none font-medium placeholder-purple-300">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-bold text-purple-700 mb-1">Store Number</label>
                                            <input type="text" id="setting-som-mpesa-store-no" value="${this.config.somaliaMpesaStoreNumber || ''}" placeholder="For Withdrawal" class="w-full bg-white border border-purple-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-purple-500 outline-none font-medium placeholder-purple-300">
                                        </div>
                                    </div>
                                    <p class="text-[10px] text-slate-400 mt-2 italic">* Both fields required for Agent Withdrawal</p>
                                </div>

                                <!-- 4. Other Payment Methods -->
                                <div class="border-t border-slate-100 pt-4 mt-2">
                                    <h4 class="font-bold text-slate-700 mb-3 text-xs uppercase tracking-wide">Other Payment Methods (Optional)</h4>
                                    <div class="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label class="block text-sm font-bold text-slate-500 mb-1">EVC Plus Number</label>
                                            <input type="text" id="setting-som-evc" value="${this.config.somaliaEVC || ''}" placeholder="e.g. 0615..." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-bold text-slate-500 mb-1">Jeeb Number</label>
                                            <input type="text" id="setting-som-jeeb" value="${this.config.somaliaJeeb || ''}" placeholder="Jeeb No." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-bold text-slate-500 mb-1">e-Dahab Number</label>
                                            <input type="text" id="setting-som-edahab" value="${this.config.somaliaEdahab || ''}" placeholder="e-Dahab No." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-bold text-slate-500 mb-1">Salaam Bank Account</label>
                                            <input type="text" id="setting-som-salaam" value="${this.config.somaliaSalaam || ''}" placeholder="Account No." class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-bold text-slate-500 mb-1">Merchant Account</label>
                                            <input type="text" id="setting-som-merchant" value="${this.config.somaliaMerchant || ''}" placeholder="Merchant ID" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- UGANDA -->
                            <div id="fields-uganda" class="country-fields ${this.config.storeCountry !== 'Uganda' ? 'hidden' : ''}">
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label class="block text-sm font-bold text-slate-500 mb-1">Airtel Money Merchant</label>
                                        <input type="text" id="setting-ug-airtel" value="${this.config.ugandaAirtel || ''}" placeholder="Merchant Code" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-red-500 outline-none font-medium">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-bold text-slate-500 mb-1">MTN Mobile Money</label>
                                        <input type="text" id="setting-ug-mtn" value="${this.config.ugandaMTN || ''}" placeholder="Merchant Code" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-yellow-500 outline-none font-medium">
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-bold text-slate-500 mb-1">Other Payment Info</label>
                                        <input type="text" id="setting-ug-other" value="${this.config.ugandaOther || ''}" placeholder="Other Instructions" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-slate-500 outline-none font-medium">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold text-slate-500 mb-1">Store Logo (Print Header)</label>
                            <input type="file" id="setting-logo" accept="image/*" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-500 pointer text-slate-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-bold
                            file:bg-red-50 file:text-red-700
                            hover:file:bg-red-100 hover:file:text-red-800 cursor-pointer transition">
                            ${this.config.storeLogo ? `<img src="${this.config.storeLogo}" class="h-16 mt-4 rounded border border-slate-200 p-1">` : ''}
                        </div>
                        <button type="button" id="btn-save-settings" class="w-full bg-slate-900 hover:bg-black text-white font-bold py-3 rounded-lg transition mt-4 shadow-lg shadow-gray-500/20">
                            Save Configuration
                        </button>
                    </form>
                </div>

                    <!-- Team Management -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 class="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                            <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-4-4"></path></svg>
                            </span>
                            <span class="min-w-0">
                                <span class="block font-bold text-slate-900 leading-tight">Team Management</span>
                                <span class="block text-xs text-slate-500 mt-0.5">Who can sign in to this terminal, and what each person may do</span>
                            </span>
                        </h2>

                        <!-- At a glance -->
                        <div id="team-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"></div>

                        <!-- Add team member -->
                        <form id="add-user-form" class="mb-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                            <h3 class="font-bold text-slate-900 text-sm mb-0.5">Add a team member</h3>
                            <p class="text-xs text-slate-500 mb-4">They will be asked to choose their own password on first sign-in.</p>
                            <div class="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label for="new-user-name" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full name</label>
                                    <input type="text" id="new-user-name" required placeholder="e.g. Amina Yusuf"
                                        class="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                                </div>
                                <div>
                                    <label for="new-user-username" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                                    <input type="text" id="new-user-username" required placeholder="e.g. amina" autocapitalize="none" autocorrect="off"
                                        class="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                                </div>
                                <div>
                                    <label for="new-user-role" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
                                    <select id="new-user-role"
                                        class="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                                        <option value="cashier">Cashier &mdash; can sell</option>
                                        <option value="manager">Manager &mdash; sell + stock</option>
                                        <option value="admin">Admin &mdash; full access</option>
                                    </select>
                                </div>
                                <div>
                                    <label for="new-user-password" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Temporary password</label>
                                    <input type="password" id="new-user-password" required placeholder="Minimum 6 characters" autocomplete="new-password"
                                        class="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                                </div>
                            </div>
                            <button type="submit"
                                class="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-bold text-sm px-5 py-2.5 rounded-xl transition shadow-sm">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                Create account
                            </button>
                        </form>

                        <!-- Member list -->
                        <div class="rounded-2xl border border-slate-200 overflow-hidden">
                            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                <h3 class="text-sm font-bold text-slate-900">Members</h3>
                                <span class="text-[11px] text-slate-500 font-medium">Admins can edit or remove anyone listed here</span>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-sm">
                                    <thead class="bg-white text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200">
                                        <tr>
                                            <th class="px-4 py-3">Member</th>
                                            <th class="px-4 py-3">Role</th>
                                            <th class="px-4 py-3">Status</th>
                                            <th class="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody id="user-list-body" class="divide-y divide-slate-100"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Profile + Data sit side by side on wide screens -->
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

                     <!-- Profile Settings -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 class="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                            <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            </span>
                            <span class="min-w-0">
                                <span class="block font-bold text-slate-900 leading-tight">Your Profile</span>
                                <span class="block text-xs text-slate-500 mt-0.5">Change your own sign-in details</span>
                            </span>
                        </h2>
                        <form id="profile-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">New Username</label>
                                <input type="text" id="profile-username" placeholder="Leave empty to keep current" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-500 mb-1">New Password</label>
                                <input type="password" id="profile-password" placeholder="Leave empty to keep current" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                            </div>
                             <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition mt-4 shadow-lg shadow-blue-600/20">
                                Update Profile
                            </button>
                        </form>
                    </div>

                    <!-- Backup & Recovery -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 class="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                            <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                            </span>
                            <span class="min-w-0">
                                <span class="block font-bold text-slate-900 leading-tight">Data Management</span>
                                <span class="block text-xs text-slate-500 mt-0.5">Back up everything, or restore from a previous file</span>
                            </span>
                        </h2>
                        
                        <div class="space-y-6">
                            <div class="p-5 bg-slate-50 rounded-xl border border-slate-200">
                                <h3 class="font-bold text-slate-800 mb-2">Backup Data</h3>
                                <p class="text-sm text-slate-500 mb-4">Export all store data (Users, Products, Sales, Settings) to a JSON file. Keep this safe &mdash; the file includes user accounts and their passwords.</p>
                                <button id="btn-export" class="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    Export Database
                                </button>
                            </div>

                            <div class="p-5 bg-red-50 rounded-xl border border-red-100">
                                <h3 class="font-bold text-red-900 mb-2">Restore Data</h3>
                                <p class="text-sm text-red-700/80 mb-4">Overwrite current database with a backup file. <span class="font-bold text-red-700">Warning: This cannot be undone.</span></p>
                                <input type="file" id="file-import" accept=".json" class="hidden">
                                <button id="btn-import" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-red-600/20">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                    Restore Database
                                </button>
                            </div>
                        </div>
                    </div>
                    <!-- Security -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 class="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
                            <span class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                            </span>
                            <span class="min-w-0">
                                <span class="block font-bold text-slate-900 leading-tight">Security</span>
                                <span class="block text-xs text-slate-500 mt-0.5">Backup codes, and how to get back in if a password is forgotten</span>
                            </span>
                        </h2>

                        <div class="p-5 bg-slate-50 rounded-xl border border-slate-200">
                            <h3 class="font-bold text-slate-800 mb-2">Backup codes</h3>
                            <p class="text-sm text-slate-500 mb-4">
                                Five one-time codes. Each one resets a single account's password from the
                                sign-in screen <strong class="text-slate-700">without deleting anything else</strong>
                                on this device. Save them somewhere you can reach later &mdash; a notebook, a
                                photo, a password manager.
                            </p>

                            <p id="security-codes-status" class="text-xs font-bold text-slate-600 mb-3">Checking&hellip;</p>

                            <div id="security-codes-list" class="hidden space-y-2 mb-4"></div>

                            <button type="button" id="security-copy" hidden
                                class="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                Copy all codes
                            </button>

                            <div class="mt-4 pt-4 border-t border-slate-200">
                                <label for="security-password"
                                    class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Your
                                    current password</label>
                                <input type="password" id="security-password" autocomplete="current-password"
                                    class="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">

                                <div class="flex gap-2 mt-3">
                                    <button type="button" id="security-reveal"
                                        class="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-sm py-2.5 rounded-lg transition">
                                        Show codes
                                    </button>
                                    <button type="button" id="security-regenerate"
                                        class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-lg transition shadow-lg shadow-red-600/20">
                                        Generate new
                                    </button>
                                </div>

                                <p class="text-[11px] text-slate-500 mt-3 leading-relaxed">
                                    Generating new codes immediately invalidates every old one &mdash; including
                                    any you have not used yet.
                                </p>
                            </div>

                            <p id="security-error"
                                class="hidden text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium mt-3"></p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Edit Team Member (opened from the Members table) -->
            <div id="edit-user-modal"
                class="hidden fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                    <div class="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <h3 class="font-bold text-slate-900">Edit team member</h3>
                            <p class="text-xs text-slate-500 mt-0.5">Update their name, sign-in details or role.</p>
                        </div>
                        <button type="button" id="edit-user-close"
                            class="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 -m-1 transition" aria-label="Close">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <form id="edit-user-form" class="p-6 space-y-4">
                        <input type="hidden" id="edit-user-id">

                        <div>
                            <label for="edit-user-name" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full name</label>
                            <input type="text" id="edit-user-name" required
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                        </div>

                        <div>
                            <label for="edit-user-username" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                            <input type="text" id="edit-user-username" required autocapitalize="none" autocorrect="off"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                        </div>

                        <div>
                            <label for="edit-user-role" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
                            <select id="edit-user-role"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                                <option value="cashier">Cashier &mdash; can sell</option>
                                <option value="manager">Manager &mdash; sell + stock</option>
                                <option value="admin">Admin &mdash; full access</option>
                            </select>
                        </div>

                        <div>
                            <label for="edit-user-password" class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">New password</label>
                            <input type="password" id="edit-user-password" autocomplete="new-password"
                                placeholder="Leave empty to keep the current password"
                                class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-medium">
                            <p class="text-[11px] text-slate-500 mt-1.5 leading-relaxed">If you enter a password here they will be asked to choose a new one the next time they sign in.</p>
                        </div>

                        <p id="edit-user-error"
                            class="hidden text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 font-medium"></p>

                        <div class="flex gap-3 pt-2">
                            <button type="button" id="edit-user-cancel"
                                class="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm py-2.5 rounded-xl transition">
                                Cancel
                            </button>
                            <button type="submit"
                                class="flex-1 bg-slate-900 hover:bg-black text-white font-bold text-sm py-2.5 rounded-xl transition shadow-sm">
                                Save changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.bindSecurity();

        // NUCLEAR OPTION: Direct Click Listener
        const saveBtn = document.getElementById('btn-save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault(); // Just in case

                // Phase 2.3: store settings are admin-only. Checked at the write,
                // not just by hiding the nav item.
                if (!window.hasCapability || !window.hasCapability('settings:write')) {
                    window.showToast('Access Denied: Restricted Area', 'error');
                    return;
                }

                console.log('Settings: Save Button Clicked');

                // User Feedback - Immediate
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;

                try {
                    // Helper to safely get value
                    const getVal = (id) => {
                        const el = document.getElementById(id);
                        return el ? el.value.trim() : '';
                    };

                    const name = getVal('setting-name');
                    const phone = getVal('setting-phone');
                    const address = getVal('setting-address');
                    const sym = getVal('setting-currency-symbol');
                    const country = getVal('setting-country');
                    const code = getVal('setting-currency-code');

                    // Kenya Values
                    const paybill = getVal('setting-paybill');
                    const paybillAcc = getVal('setting-paybill-acc');
                    const buygoods = getVal('setting-buygoods');
                    const agent = getVal('setting-agent');
                    const storeNo = getVal('setting-store-no');

                    // VALIDATION: Agent & Store Number must be paired
                    if ((agent && !storeNo) || (!agent && storeNo)) {
                        throw new Error('Agent Number and Store Number must BOTH be filled or BOTH be empty.');
                    }

                    // Somalia M-PESA (KSH) Values
                    const somMpesaPaybill = getVal('setting-som-mpesa-paybill');
                    const somMpesaAcc = getVal('setting-som-mpesa-acc');
                    const somMpesaBuygoods = getVal('setting-som-mpesa-buygoods');
                    const somMpesaAgent = getVal('setting-som-mpesa-agent');
                    const somMpesaStoreNo = getVal('setting-som-mpesa-store-no');

                    // VALIDATION: Somalia Agent & Store Number must be paired
                    if ((somMpesaAgent && !somMpesaStoreNo) || (!somMpesaAgent && somMpesaStoreNo)) {
                        throw new Error('Somalia Agent Number and Store Number must BOTH be filled or BOTH be empty.');
                    }

                    // Somalia Local Payment Methods
                    const somEvc = getVal('setting-som-evc');
                    const somJeeb = getVal('setting-som-jeeb');
                    const somEdahab = getVal('setting-som-edahab');
                    const somSalaam = getVal('setting-som-salaam');
                    const somMerchant = getVal('setting-som-merchant');

                    // Uganda Values
                    const ugAirtel = getVal('setting-ug-airtel');
                    const ugMtn = getVal('setting-ug-mtn');
                    const ugOther = getVal('setting-ug-other');

                    const fileInput = document.getElementById('setting-logo');
                    let logoBase64 = this.config.storeLogo;

                    if (fileInput && fileInput.files.length > 0) {
                        logoBase64 = await this.fileToBase64(fileInput.files[0]);
                    }

                    // ONE transaction for the whole form. This used to push one
                    // db.put promise per field into Promise.all, i.e. 26 separate
                    // readwrite transactions, so a failure halfway left the store
                    // half-configured - including writing one half of the Somalia
                    // agent/store-number pair without the other, which the check
                    // above was specifically there to prevent.
                    const settingsRows = [
                        { key: 'storeName', value: name },
                        { key: 'storePhone', value: phone },
                        { key: 'storeAddress', value: address },
                        { key: 'currencySymbol', value: sym },
                        { key: 'storeCountry', value: country },
                        { key: 'currencyCode', value: code },

                        // Kenya
                        { key: 'mpesaPaybill', value: paybill },
                        { key: 'mpesaAccount', value: paybillAcc },
                        { key: 'mpesaBuyGoods', value: buygoods },
                        { key: 'mpesaAgent', value: agent },
                        { key: 'mpesaStoreNumber', value: storeNo },

                        // Somalia M-PESA (KSH)
                        { key: 'somaliaMpesaPaybill', value: somMpesaPaybill },
                        { key: 'somaliaMpesaAccount', value: somMpesaAcc },
                        { key: 'somaliaMpesaBuyGoods', value: somMpesaBuygoods },
                        { key: 'somaliaMpesaAgent', value: somMpesaAgent },
                        { key: 'somaliaMpesaStoreNumber', value: somMpesaStoreNo },

                        // Somalia Local Methods
                        { key: 'somaliaEVC', value: somEvc },
                        { key: 'somaliaJeeb', value: somJeeb },
                        { key: 'somaliaEdahab', value: somEdahab },
                        { key: 'somaliaSalaam', value: somSalaam },
                        { key: 'somaliaMerchant', value: somMerchant },

                        // Uganda
                        { key: 'ugandaAirtel', value: ugAirtel },
                        { key: 'ugandaMTN', value: ugMtn },
                        { key: 'ugandaOther', value: ugOther },
                    ];

                    if (logoBase64) settingsRows.push({ key: 'storeLogo', value: logoBase64 });

                    await db.putSettings(settingsRows);

                    console.log('Settings Saved Successfully');
                    window.showToast('Settings Saved Successfully');

                    // FIX BUG #1: Notify POS module to reload settings BEFORE page refresh
                    if (window.posModule) {
                        try {
                            await window.posModule.loadSettings();
                            window.posModule.renderPaymentButtons();
                            console.log('✓ POS module updated with new settings');
                        } catch (e) {
                            console.error('Failed to update POS:', e);
                        }
                    }
                    // Notify Inventory module
                    if (window.inventoryModule) {
                        try {
                            await window.inventoryModule.loadSettings();
                            console.log('✓ Inventory module updated with new settings');
                        } catch (e) {
                            console.error('Failed to update Inventory:', e);
                        }
                    }
                    // Notify Reports module
                    if (window.reports) {
                        try {
                            await window.reports.loadSettings();
                            console.log('✓ Reports module updated with new settings');
                        } catch (e) {
                            console.error('Failed to update Reports:', e);
                        }
                    }

                    // Force UI Update
                    await this.init();
                    console.log('Settings re-initialized');
                    // User Feedback
                    // No blocking alert(): it froze the till until dismissed, then the
                    // page reloaded underneath the operator. Toast + deferred reload.
                    window.showToast('Settings saved — refreshing…', 'success');
                    setTimeout(() => window.location.reload(), 700);

                } catch (error) {
                    console.error('CRITICAL: Failed to save settings:', error);
                    window.showToast('Error saving settings: ' + error.message, 'error');
                } finally {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }
            });
        }

        // Profile Update Handler
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newUsername = document.getElementById('profile-username').value.trim();
                const newPassword = document.getElementById('profile-password').value.trim();

                if (!newUsername && !newPassword) {
                    window.showToast('Nothing to update', 'error');
                    return;
                }

                // Get current user from storage (self-service: any logged-in role)
                let currentUser = null;
                try {
                    const raw = sessionStorage.getItem('pointify_session_v1');
                    currentUser = raw ? JSON.parse(raw) : null;
                } catch (err) {
                    currentUser = null;
                }

                if (!currentUser || currentUser.id === undefined || currentUser.id === null) {
                    window.showToast('Session Expired. Relogin.', 'error');
                    return;
                }

                try {
                    // Fetch actual user record from DB
                    const userRecord = await db.get('users', currentUser.id);
                    if (!userRecord) {
                        window.showToast('Session Expired. Relogin.', 'error');
                        return;
                    }

                    // Phase 2.3: usernames must stay unique or login becomes ambiguous
                    if (newUsername && newUsername !== userRecord.username) {
                        const allUsers = await db.getAll('users');
                        if (allUsers.some(u => u.id !== userRecord.id && u.username === newUsername)) {
                            window.showToast('Username already exists', 'error');
                            return;
                        }
                        userRecord.username = newUsername;
                    }

                    if (newPassword) userRecord.password = newPassword;

                    await db.put('users', userRecord, 'Username already exists');

                    // Phase 2.1 / 2.5: single projection - never persists the
                    // password, and recomputes mustChangePassword from the record
                    // that was just written.
                    const session = window.sessionFromUser
                        ? window.sessionFromUser(userRecord)
                        : { id: userRecord.id, username: userRecord.username, name: userRecord.name, role: userRecord.role };
                    sessionStorage.setItem('pointify_session_v1', JSON.stringify(session));
                    if (window.syncAuthSession) window.syncAuthSession();

                    // Reset form
                    document.getElementById('profile-username').value = '';
                    document.getElementById('profile-password').value = '';

                    window.showToast('Profile Updated Successfully');
                } catch (err) {
                    console.error(err);
                    window.showToast('Failed to update profile', 'error');
                }
            });
        }

        const addUserForm = document.getElementById('add-user-form');
        if (addUserForm) {
            addUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Phase 2.3: user management is admin-only
                if (!window.hasCapability || !window.hasCapability('users:write')) {
                    window.showToast('Access Denied: Restricted Area', 'error');
                    return;
                }

                const name = document.getElementById('new-user-name').value;
                const username = document.getElementById('new-user-username').value;
                const password = document.getElementById('new-user-password').value;
                const role = document.getElementById('new-user-role').value;

                // D3 (final): only these three roles may exist
                if (!['admin', 'manager', 'cashier'].includes(role)) {
                    window.showToast('Invalid role', 'error');
                    return;
                }

                try {
                    // Simple duplication check (in a real app, use index/constraint)
                    const allUsers = await db.getAll('users');
                    if (allUsers.find(u => u.username === username)) {
                        window.showToast('Username already exists', 'error');
                        return;
                    }

                    // D2: an admin-created account starts on a password they were
                    // handed, exactly like the seed account, so it must be replaced
                    // on first login. Without this the user record shape differed
                    // between seeded and created accounts.
                    await db.add('users',
                        { name, username, password, role, mustChangePassword: true },
                        'Username already exists');
                    window.showToast('User Created Successfully');
                    e.target.reset();
                    this.loadUsers();
                } catch (err) {
                    console.error(err);
                    window.showToast((err && err.message) || 'Failed to create user', 'error');
                }
            });
        }

        // Initialize user list
        this.loadUsers();

        // Member table: one delegated listener instead of re-binding every row.
        const userListBody = document.getElementById('user-list-body');
        if (userListBody) {
            userListBody.addEventListener('click', (e) => {
                const editBtn = e.target.closest ? e.target.closest('.edit-user-btn') : null;
                if (editBtn) {
                    this.openEditUser(parseInt(editBtn.dataset.id, 10));
                    return;
                }
                const delBtn = e.target.closest ? e.target.closest('.delete-user-btn') : null;
                if (delBtn) this.removeUser(parseInt(delBtn.dataset.id, 10));
            });
        }

        // Edit member modal
        const editForm = document.getElementById('edit-user-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEditUser();
            });
        }
        ['edit-user-close', 'edit-user-cancel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => this.closeEditModal());
        });
        const editModal = document.getElementById('edit-user-modal');
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                // Clicking the dimmed backdrop dismisses; clicks inside do not.
                if (e.target === editModal) this.closeEditModal();
            });
        }
        const editPassword = document.getElementById('edit-user-password');
        if (editPassword) {
            editPassword.addEventListener('input', () => this.showEditErrorHide());
        }

        // Country Toggle
        const countrySelect = document.getElementById('setting-country');
        if (countrySelect) {
            countrySelect.addEventListener('change', (e) => {
                const val = e.target.value;
                document.querySelectorAll('.country-fields').forEach(el => el.classList.add('hidden'));
                if (val === 'Kenya') document.getElementById('fields-kenya')?.classList.remove('hidden');
                if (val === 'Somalia') document.getElementById('fields-somalia')?.classList.remove('hidden');
                if (val === 'Uganda') document.getElementById('fields-uganda')?.classList.remove('hidden');
            });
        }

        // Currency Selector Logic
        const currencySelect = document.getElementById('setting-currency-select');
        const symInput = document.getElementById('setting-currency-symbol');
        const codeInput = document.getElementById('setting-currency-code');

        if (currencySelect) {
            currencySelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'Custom|Custom') {
                    symInput.readOnly = false;
                    codeInput.readOnly = false;
                    symInput.value = '';
                    codeInput.value = '';
                    symInput.classList.remove('bg-slate-100', 'text-slate-600');
                    codeInput.classList.remove('bg-slate-100', 'text-slate-600');
                    symInput.classList.add('bg-white', 'text-slate-800');
                    codeInput.classList.add('bg-white', 'text-slate-800');
                    symInput.focus();
                } else {
                    const [code, sym] = val.split('|');
                    symInput.value = sym;
                    codeInput.value = code;
                    symInput.readOnly = true;
                    codeInput.readOnly = true;
                    symInput.classList.add('bg-slate-100', 'text-slate-600');
                    codeInput.classList.add('bg-slate-100', 'text-slate-600');
                    symInput.classList.remove('bg-white', 'text-slate-800');
                    codeInput.classList.remove('bg-white', 'text-slate-800');
                }
            });
        }

        // --- Backup & Recovery (Phase 1.3) ---------------------------------
        // These two buttons existed in the markup with no handler at all, so
        // the app advertised a backup feature it never actually performed.
        const exportBtn = document.getElementById('btn-export');
        const importBtn = document.getElementById('btn-import');
        const importFile = document.getElementById('file-import');

        const canManageData = () => {
            if (window.hasCapability && window.hasCapability('settings:write')) return true;
            window.showToast('Access Denied: Restricted Area', 'error');
            return false;
        };

        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                if (!canManageData() || exportBtn.disabled) return;

                // Never touch button textContent - it would delete the inline SVG.
                exportBtn.disabled = true;
                try {
                    const json = await db.exportData();
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `pointify-backup_${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    window.showToast('Backup file downloaded');
                } catch (err) {
                    console.error(err);
                    window.showToast((err && err.message) || 'Backup failed', 'error');
                } finally {
                    exportBtn.disabled = false;
                }
            });
        }

        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => {
                if (!canManageData()) return;
                importFile.value = ''; // allow re-picking the same file
                importFile.click();
            });

            importFile.addEventListener('change', async () => {
                const file = importFile.files && importFile.files[0];
                if (!file) return;
                if (!canManageData() || importBtn.disabled) return;

                try {
                    const text = await this.fileToText(file);

                    // Validate BEFORE the confirm dialog, so the user sees what is
                    // inside and a bad file can never reach a store.clear().
                    const check = db.parseBackup(text);
                    if (!check.ok) {
                        window.showToast(check.error, 'error');
                        return;
                    }

                    const c = check.counts;
                    const created = check.exportedAt
                        ? new Date(check.exportedAt).toLocaleString()
                        : 'unknown date';

                    const confirmed = confirm(
                        'RESTORE DATABASE?\n\n' +
                        `Backup created: ${created}\n\n` +
                        `Users: ${c.users}\n` +
                        `Products: ${c.products}\n` +
                        `Sales: ${c.sales}\n` +
                        `Settings: ${c.settings}\n\n` +
                        'This OVERWRITES everything currently in the app and cannot be undone.'
                    );
                    if (!confirmed) return;

                    importBtn.disabled = true;
                    await db.importData(text);

                    // Reload so seed(), RBAC, the session and every module's state
                    // are rebuilt from the restored data.
                    window.showToast('Restore complete. Reloading...');
                    setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                    console.error(err);
                    window.showToast((err && err.message) || 'Restore failed', 'error');
                    importBtn.disabled = false;
                    importFile.value = '';
                }
            });
        }
    }

    // One protection rule shared by the table AND every write. The previous
    // render used `username === 'Super'` *after* lowercasing (a dead check)
    // while the delete path used ['admin','super'], so a lowercase "super"
    // rendered as removable and was then refused on click.
    isProtectedUser(user) {
        if (!user) return false;
        return ['admin', 'super'].includes(String(user.username || '').trim().toLowerCase());
    }

    // D6: the rule is enforced in db.js, but the picker says so up front so
    // nobody fills in a whole form only to be told no at the last step.
    syncAdminOption() {
        const adminExists = (this._users || []).some(u => u.role === 'admin');
        ['new-user-role', 'edit-user-role'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const opt = sel.querySelector('option[value="admin"]');
            if (!opt) return;

            opt.disabled = adminExists;
            opt.textContent = adminExists ? 'Admin \u2014 only one allowed' : 'Admin \u2014 full access';

            // If the picker is sitting on a choice that is no longer possible,
            // move it off rather than let the form submit something the
            // database will reject.
            if (adminExists && sel.value === 'admin') sel.value = 'manager';
        });
    }

    async loadUsers() {
        const list = document.getElementById('user-list-body');
        if (!list) return; // Guard

        this.syncAdminOption();

        const users = await db.getAll('users');
        this._users = users;

        let session = null;
        try { session = JSON.parse(sessionStorage.getItem('pointify_session_v1')); } catch (err) { session = null; }

        // --- At a glance -----------------------------------------------------
        const stats = document.getElementById('team-stats');
        if (stats) {
            const counts = { admin: 0, manager: 0, cashier: 0 };
            users.forEach(u => { if (Object.prototype.hasOwnProperty.call(counts, u.role)) counts[u.role]++; });
            const chip = (value, label) => `
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div class="text-2xl font-extrabold text-slate-900 leading-none">${value}</div>
                    <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">${label}</div>
                </div>`;
            stats.innerHTML =
                chip(users.length, 'Members') +
                chip(counts.admin, 'Admins') +
                chip(counts.manager, 'Managers') +
                chip(counts.cashier, 'Cashiers');
        }

        // --- Rows ------------------------------------------------------------
        const badge = {
            admin: 'bg-slate-900 text-white border-slate-900',
            manager: 'bg-amber-50 text-amber-700 border-amber-200',
            cashier: 'bg-sky-50 text-sky-700 border-sky-200'
        };

        list.innerHTML = '';

        if (!users.length) {
            list.innerHTML = `<tr><td colspan="4" class="px-4 py-10 text-center text-sm text-slate-400">No team members yet.</td></tr>`;
            return;
        }

        users.forEach(u => {
            const isMe = !!(session && session.id === u.id);
            const protectedUser = this.isProtectedUser(u);
            const name = u.name || u.username || 'Unnamed';
            const initial = (String(name).trim().charAt(0) || '?').toUpperCase();
            const pending = u.mustChangePassword === true;

            let statusHtml;
            let actionHtml;

            if (protectedUser) {
                statusHtml = '<span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>Protected</span>';
                actionHtml = '<span class="text-[11px] text-slate-300 font-medium">Owner account</span>';
            } else if (isMe) {
                statusHtml = '<span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>You are signed in</span>';
                actionHtml = '<span class="text-[11px] text-slate-400 font-medium">Use &ldquo;Your Profile&rdquo; below</span>';
            } else {
                statusHtml = pending
                    ? '<span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Password not chosen yet</span>'
                    : '<span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>';
                actionHtml = `
                    <button type="button" class="edit-user-btn font-bold text-xs px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition" data-id="${u.id}">Edit</button>
                    <button type="button" class="delete-user-btn font-bold text-xs px-2.5 py-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition" data-id="${u.id}">Remove</button>`;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-extrabold text-slate-600 flex-shrink-0">${initial}</div>
                        <div class="min-w-0">
                            <div class="font-bold text-slate-800 truncate">${name}</div>
                            <div class="text-xs text-slate-400 font-mono truncate">@${u.username}</div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <span class="inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${badge[u.role] || 'bg-slate-50 text-slate-500 border-slate-200'}">${u.role}</span>
                </td>
                <td class="px-4 py-3">${statusHtml}</td>
                <td class="px-4 py-3">
                    <div class="flex items-center justify-end gap-1">${actionHtml}</div>
                </td>
            `;
            list.appendChild(row);
        });
    }

    // --- Member management ---------------------------------------------------

    openEditModal() {
        const modal = document.getElementById('edit-user-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeEditModal() {
        const modal = document.getElementById('edit-user-modal');
        if (modal) modal.classList.add('hidden');
        const err = document.getElementById('edit-user-error');
        if (err) { err.classList.add('hidden'); err.textContent = ''; }
    }

    showEditErrorHide() {
        const err = document.getElementById('edit-user-error');
        if (err) { err.classList.add('hidden'); err.textContent = ''; }
    }

    showEditError(text) {
        const err = document.getElementById('edit-user-error');
        if (!err) return;
        err.textContent = text;
        err.classList.remove('hidden');
    }

    async openEditUser(id) {
        // Phase 2.3 / Phase 6: editing members is the same admin-only write as
        // creating or removing them. Checked here AND again at the save.
        if (!window.hasCapability || !window.hasCapability('users:write')) {
            window.showToast('Access Denied: Restricted Area', 'error');
            return;
        }
        if (!Number.isInteger(id)) return;

        try {
            const target = await db.get('users', id);
            if (!target) {
                window.showToast('That account no longer exists', 'error');
                this.loadUsers();
                return;
            }

            let session = null;
            try { session = JSON.parse(sessionStorage.getItem('pointify_session_v1')); } catch (err) { session = null; }

            if (this.isProtectedUser(target)) {
                window.showToast('The owner account cannot be edited', 'error');
                return;
            }
            if (session && session.id === target.id) {
                window.showToast('Use Your Profile to change your own details', 'error');
                return;
            }

            document.getElementById('edit-user-id').value = String(target.id);
            document.getElementById('edit-user-name').value = target.name ?? '';
            document.getElementById('edit-user-username').value = target.username ?? '';
            document.getElementById('edit-user-role').value = ['admin', 'manager', 'cashier'].includes(target.role) ? target.role : 'cashier';
            document.getElementById('edit-user-password').value = '';
            this.openEditModal();
        } catch (err) {
            console.error(err);
            window.showToast('Could not open that account', 'error');
        }
    }

    async saveEditUser() {
        if (!window.hasCapability || !window.hasCapability('users:write')) {
            this.showEditError('You do not have permission to change accounts.');
            return;
        }

        const rawId = document.getElementById('edit-user-id').value;
        const id = parseInt(rawId, 10);
        if (!Number.isInteger(id)) { this.showEditError('Invalid account.'); return; }

        const name = document.getElementById('edit-user-name').value.trim();
        const username = document.getElementById('edit-user-username').value.trim();
        const role = document.getElementById('edit-user-role').value;
        const password = document.getElementById('edit-user-password').value;

        if (!name) { this.showEditError('Full name is required.'); return; }
        if (!username) { this.showEditError('Username is required.'); return; }
        // D3: exactly three roles may exist
        if (!['admin', 'manager', 'cashier'].includes(role)) { this.showEditError('Invalid role.'); return; }
        if (password && password.length < 6) { this.showEditError('New password must be at least 6 characters.'); return; }

        try {
            let session = null;
            try { session = JSON.parse(sessionStorage.getItem('pointify_session_v1')); } catch (err) { session = null; }

            const target = await db.get('users', id);
            if (!target) { this.showEditError('That account no longer exists.'); this.loadUsers(); return; }

            if (this.isProtectedUser(target)) { this.showEditError('The owner account cannot be edited.'); return; }
            if (session && session.id === target.id) { this.showEditError('Use Your Profile to change your own details.'); return; }

            // Unique username, ignoring the account we are editing.
            const allUsers = await db.getAll('users');
            const clash = allUsers.find(u => u.id !== id && String(u.username || '').trim() === username);
            if (clash) { this.showEditError('That username is already taken by "' + (clash.name || clash.username) + '".'); return; }

            // Blank password = keep the current one and keep whatever password
            // state the account already had. A filled password = admin handed
            // them one, exactly like account creation, so D2 forces a change.
            const patch = { name, username, role };
            if (password) {
                patch.password = password;
                patch.mustChangePassword = true;
            }

            await db.put('users', Object.assign({}, target, patch), 'That username is already taken');

            this.closeEditModal();
            window.showToast(password ? 'Account updated — they must set a new password' : 'Account updated');
            this.loadUsers();
        } catch (err) {
            console.error(err);
            this.showEditError((err && err.message) || 'Failed to save changes');
        }
    }

    async removeUser(id) {
        if (!window.hasCapability || !window.hasCapability('users:write')) {
            window.showToast('Access Denied: Restricted Area', 'error');
            return;
        }
        if (!Number.isInteger(id)) return;

        try {
            const target = await db.get('users', id);
            if (!target) return;

            let session = null;
            try { session = JSON.parse(sessionStorage.getItem('pointify_session_v1')); } catch (err) { session = null; }

            if (this.isProtectedUser(target) || (session && session.id === target.id)) {
                window.showToast('This account cannot be removed', 'error');
                return;
            }

            if (confirm('Remove "' + (target.name || target.username) + '" from the team? They will no longer be able to sign in.')) {
                await db.delete('users', id);
                window.showToast('Member removed');
                this.loadUsers();
            }
        } catch (err) {
            console.error(err);
            window.showToast('Failed to remove member', 'error');
        }
    }

    // --- Security / backup codes -----------------------------------------------

    bindSecurity() {
        const reveal = document.getElementById('security-reveal');
        const regen = document.getElementById('security-regenerate');
        const copy = document.getElementById('security-copy');
        if (reveal) reveal.addEventListener('click', () => this.revealSecurityCodes(false));
        if (regen) regen.addEventListener('click', () => this.revealSecurityCodes(true));
        if (copy) {
            copy.addEventListener('click', async () => {
                const ok = await window.copyPointifyText((this.securityCodes || []).join('\n'));
                window.showToast(ok ? 'Codes copied' : 'Could not copy - write them down', ok ? undefined : 'error');
            });
        }
        this.refreshSecurityStatus();
    }

    async refreshSecurityStatus() {
        const el = document.getElementById('security-codes-status');
        if (!el) return;
        try {
            const codes = await loadRecoveryCodes();
            el.textContent = codes.length > 0
                ? codes.length + ' of 5 codes remaining.'
                : 'No backup codes yet \u2014 generate a set so you are never locked out.';
            el.classList.toggle('text-red-600', codes.length === 0);
            el.classList.toggle('text-slate-600', codes.length > 0);
        } catch (err) {
            console.error(err);
            el.textContent = 'Could not check backup codes.';
        }
    }

    // Both "Show codes" and "Generate new" pass through here, because both are
    // credential actions and both need the signed-in password re-entered.
    async revealSecurityCodes(regenerate) {
        const errEl = document.getElementById('security-error');
        const fail = msg => {
            if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
        };
        if (errEl) errEl.classList.add('hidden');

        // Check the write capability at the action, not by hiding the card.
        if (window.hasCapability && !window.hasCapability('users:write')) {
            fail('Only an admin can manage backup codes.');
            return;
        }

        const pwInput = document.getElementById('security-password');
        const pw = pwInput ? pwInput.value : '';
        if (!pw) { fail('Enter your current password first.'); return; }

        let session = null;
        try { session = JSON.parse(sessionStorage.getItem('pointify_session_v1')); } catch (err) { session = null; }
        if (!session || session.id === undefined) { fail('Sign out and back in again.'); return; }

        // Passwords are stored in plain text by decision D1 (single device, no
        // backend), so verification is a straight comparison against the record.
        let record = null;
        try { record = await db.get('users', session.id); } catch (err) { record = null; }
        if (!record || record.password !== pw) { fail('That password is not correct.'); return; }

        try {
            const codes = regenerate ? await issueRecoveryCodes() : await loadRecoveryCodes();
            this.securityCodes = codes;

            const list = document.getElementById('security-codes-list');
            const copyBtn = document.getElementById('security-copy');
            if (list) {
                list.innerHTML = codes.length
                    ? codes.map(code =>
                        '<div class="flex items-center justify-center bg-white border border-slate-200 rounded-xl px-4 py-2.5">' +
                        '<span class="font-mono font-bold tracking-widest text-slate-900">' + code + '</span>' +
                        '</div>').join('')
                    : '<p class="text-xs text-slate-500 text-center py-2">None left \u2014 generate a new set.</p>';
                list.classList.remove('hidden');
            }
            if (copyBtn) copyBtn.hidden = codes.length === 0;
            if (pwInput) pwInput.value = '';

            if (regenerate) window.showToast('New backup codes generated. Old codes no longer work.');
            this.refreshSecurityStatus();
        } catch (err) {
            console.error(err);
            fail('Could not update backup codes.');
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

    // FileReader instead of File.text() - POS hardware often runs older WebViews,
    // and this matches the reader already used for product images.
    fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Could not read the selected file.'));
            reader.readAsText(file);
        });
    }
}

export const settings = new SettingsModule();
window.settingsModule = settings;
