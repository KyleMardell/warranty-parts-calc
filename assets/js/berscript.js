/* Amounts are calculated in pence. Policy wording lives in berpolicies.js. */
function calculateBer(policy, values) {
    const pence = (value) => Math.round(Number(value) * 100);
    const limit = policy.basis === 'fixed' ? 100000 : pence(values.vehicleValue);
    const previous = policy.previous ? pence(values.previousClaims) : 0;
    const salvage = pence(values.salvageCosts);
    const excess = policy.family === 'allin' ? pence(values.excessAmount) : 0;
    const payments = policy.family === 'allin' ? pence(values.remainingPayment) : 0;
    const remaining = Math.max(0, limit - previous);
    const customer = Math.max(0, remaining - salvage - excess - payments);
    const claim = Math.round(customer / 1.2);
    return { limit, previous, salvage, excess, payments, remaining, customer, claim, vat: customer - claim };
}

const byId = (id) => document.getElementById(id);
const money = (pence) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const brandNames = { AUDI: 'Audi', SEAT: 'SEAT', SKODA: 'Škoda', CUPRA: 'CUPRA', VWPC: 'Volkswagen', VWCV: 'Volkswagen CV' };
const policyDescription = (policy) => `${policy.name} | Programme ${policy.program} | ${policy.cover} | ${policy.family === 'approved' ? (policy.nonVwg ? 'Non-VWG vehicle' : 'VWG vehicle') : 'All-In / Extended'}${policy.variant ? ' | ' + policy.variant : ''}`;
const selectedPolicy = () => BER_POLICIES.find((policy) => policy.id === byId('policy').value);

function invalidateResult() {
    byId('result-card').hidden = true;
    byId('output-template').value = '';
    byId('result-status').textContent = '';
}

// Native buttons retain keyboard activation and announce their selected state.
function fillButtons(group, options, preferred, onChange, render) {
    group.value = options.some(([value]) => value === preferred) ? preferred : options[0][0];
    const buttons = options.map(([value, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-secondary';
        button.textContent = label;
        button.setAttribute('aria-pressed', String(value === group.value));
        button.addEventListener('click', () => {
            group.value = value;
            buttons.forEach((item, index) => item.setAttribute('aria-pressed', String(options[index][0] === value)));
            onChange();
        });
        return button;
    });
    if (render) render(buttons);
    else group.replaceChildren(...buttons);
}

const brandKey = (policy) => policy.brand + (policy.nonVwg ? ':nonvwg' : '');

function updateBrands() {
    const family = byId('policyType').value;
    const policies = BER_POLICIES.filter((policy) => policy.family === family);
    const brands = [...new Set(policies.map(brandKey))];
    const mainBrands = brands.filter((key) => !key.includes(':'));
    const nonBrands = brands.filter((key) => key.includes(':'));
    const orderedBrands = [...mainBrands, ...nonBrands];
    const preferred = brands.includes(byId('brand').value) ? byId('brand').value : (byId('brand').value || '').split(':')[0];
    fillButtons(byId('brand'), orderedBrands.map((key) => {
        const [brand, nonVwg] = key.split(':');
        return [key, brandNames[brand] + (nonVwg ? ': non brand' : '')];
    }), preferred, updatePolicies, (buttons) => {
        byId('brand-main').replaceChildren(...buttons.slice(0, mainBrands.length));
        byId('brand-non-brand').replaceChildren(...buttons.slice(mainBrands.length));
    });
    byId('non-brand-section').hidden = nonBrands.length === 0;
    byId('non-brand-section').open = byId('brand').value.includes(':');
    byId('brand-help').hidden = nonBrands.length === 0;
    updatePolicies();
}

function updatePolicies() {
    const policies = BER_POLICIES.filter((policy) => policy.family === byId('policyType').value && brandKey(policy) === byId('brand').value);
    const options = policies.map((policy) => [policy.id, policy.cover + (policy.variant ? ': ' + policy.variant : '')]);
    if (options.length === 1) {
        byId('policy').value = options[0][0];
        const label = document.createElement('p');
        label.className = 'mb-0';
        label.textContent = options[0][1];
        byId('policy').replaceChildren(label);
    } else {
        fillButtons(byId('policy'), options, byId('policy').value, updatePolicy);
    }
    updatePolicy();
}

function updatePolicy() {
    const policy = selectedPolicy();
    byId('selected-programme').textContent = policyDescription(policy);
    const fixed = policy.basis === 'fixed';
    const allin = policy.family === 'allin';
    const basisLabel = policy.basis === 'purchase' ? 'Purchase price' : 'Current market value (CMV)';
    byId('limit-rule').textContent = (fixed ? '£1,000 per claim' : basisLabel) + (policy.previous ? ' − previous claims (including VAT)' : '');
    byId('policy-wording').textContent = policy.wording;
    byId('consequential-notice').hidden = !policy.consequential;
    byId('vehicle-field').hidden = fixed;
    byId('vehicleValue').disabled = fixed;
    byId('vehicle-label').textContent = basisLabel;
    byId('value-help').textContent = policy.basis === 'purchase'
        ? 'If ownership has transferred, confirm the purchase price with the customer.'
        : '';
    byId('value-help').hidden = policy.basis !== 'purchase';
    byId('previous-field').hidden = !policy.previous;
    byId('previousClaims').disabled = !policy.previous;
    byId('extended-inputs').hidden = !allin;
    byId('excessAmount').disabled = !allin;
    byId('remainingPayment').disabled = !allin;
    invalidateResult();
}

byId('policyType').addEventListener('change', updateBrands);
byId('brand').addEventListener('change', updatePolicies);
byId('policy').addEventListener('change', updatePolicy);
byId('ber-form').addEventListener('input', invalidateResult);
byId('ber-form').addEventListener('change', invalidateResult);
byId('ber-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const policy = selectedPolicy();
    const values = Object.fromEntries(['vehicleValue', 'previousClaims', 'salvageCosts', 'excessAmount', 'remainingPayment'].map((id) => [id, byId(id).value || 0]));
    const result = calculateBer(policy, values);
    byId('result-limit').textContent = money(result.limit);
    byId('result-remaining').textContent = money(result.remaining);
    byId('result-to-customer').textContent = money(result.customer);
    byId('result-on-claim').textContent = money(result.claim);
    byId('vat-amount').textContent = money(result.vat);
    const breakdown = `${money(result.remaining)} remaining limit − ${money(result.salvage)} salvage` + (policy.family === 'allin' ? ` − ${money(result.excess)} excess − ${money(result.payments)} remaining payments` : '') + ` = ${money(result.customer)} payable (minimum £0.00).`;
    byId('calculation-breakdown').textContent = breakdown;
    byId('zero-notice').hidden = result.customer > 0;
    const lines = [
        `Policy: ${policyDescription(policy)}`,
        `Limit basis: ${policy.basis === 'fixed' ? '£1,000 fixed per-claim limit' : policy.basis === 'purchase' ? 'Purchase price' : 'Independently confirmed CMV'}`,
        `Policy claim limit before deductions: ${money(result.limit)} inc VAT`,
        ...(policy.previous ? [`Previous claims: ${money(result.previous)} inc VAT (confirm VAT-inclusive)`] : []),
        `Remaining claim limit after previous claims: ${money(result.remaining)} inc VAT`,
        `Salvage value: ${money(result.salvage)} inc VAT`,
        ...(policy.family === 'allin' ? [`Policy excess: ${money(result.excess)} inc VAT`, `Remaining payments: ${money(result.payments)} inc VAT`] : []),
        `Amount to customer: ${money(result.customer)} inc VAT`,
        `Total claim value: ${money(result.claim)} exc VAT`,
        `VAT on claim (20%): ${money(result.vat)}`,
        ...(policy.consequential ? [byId('consequential-notice').textContent] : []),
        '', 'Official policy wording:', policy.wording
    ];
    byId('output-template').value = lines.join('\n');
    byId('result-card').hidden = false;
    byId('result-status').textContent = 'Calculation complete. All displayed limits and deductions include VAT; the claim amount excluding VAT is shown separately.';
});
fillButtons(byId('policyType'), [['approved', 'Approved Used'], ['allin', 'All-In / Extended']], 'approved', updateBrands);
updateBrands();
byId('result-status').textContent = 'Enter the policy details and values, then calculate.';
