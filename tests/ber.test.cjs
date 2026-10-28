const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ber.html'), 'utf8');
const elements = {};
for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
    elements[id] = { value: '0', hidden: false, disabled: false, textContent: '', handlers: {},
        addEventListener(type, handler) { (this.handlers[type] ||= []).push(handler); },
        replaceChildren(...options) { this.options = options; },
        reportValidity() { return true; }
    };
}
elements.policyType.value = 'approved';
const copiedSummaries = [];
const context = vm.createContext({ document: { createElement: (tagName) => ({ tagName, attributes: {}, handlers: {}, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(type, handler) { this.handlers[type] = handler; } }), getElementById: id => {
    assert.ok(elements[id], `Missing HTML element: ${id}`); return elements[id];
} }, navigator: { clipboard: { async writeText(text) { copiedSummaries.push(text); } } }, Option: function(text, value) { return { text, value }; }, Intl });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/berpolicies.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/berscript.js'), 'utf8'), context);
const policies = vm.runInContext('BER_POLICIES', context);
const calculate = context.calculateBer;
assert.equal(elements.policy.options.length, 1);
assert.equal(elements.policy.options[0].tagName, 'p');
assert.equal(elements.policy.options[0].handlers.click, undefined);
assert.equal(policies.length, 18);
assert.equal(new Set(policies.map(p => p.id)).size, 18);
const expected = {
    '2': ['purchase', true], '3': ['purchase', true], '4-fixed': ['fixed', false],
    '4': ['purchase', true], '5-fixed': ['fixed', false], '5': ['cmv', true],
    '6': ['purchase', true], '7': ['cmv', false], '8': ['purchase', true],
    '9': ['purchase', true], '10': ['cmv', false], '11': ['cmv', false],
    '12': ['cmv', false], '13': ['cmv', true], '14': ['cmv', true],
    '15': ['cmv', false], '16': ['cmv', true], '17': ['cmv', false]
};
for (const p of policies) {
    assert.deepEqual([p.basis, p.previous], expected[p.id], p.name);
    assert.ok(p.wording.length > 0);
    const r = calculate(p, { vehicleValue: 10000, previousClaims: 3000, salvageCosts: 200, excessAmount: 100, remainingPayment: 300 });
    const expectedRemaining = p.basis === 'fixed' ? 100000 : p.previous ? 700000 : 1000000;
    assert.equal(r.remaining, expectedRemaining);
    assert.equal(r.customer, expectedRemaining - 20000 - (p.family === 'allin' ? 40000 : 0));
    assert.equal(r.claim + r.vat, r.customer);
}
const values = { vehicleValue: 10000, previousClaims: 3000, salvageCosts: 2000, excessAmount: 100, remainingPayment: 300 };
assert.equal(calculate(policies.find(p => p.id === '2'), values).customer, 500000);
assert.equal(calculate(policies.find(p => p.id === '13'), values).customer, 460000);
assert.equal(calculate(policies.find(p => p.id === '15'), values).customer, 760000);
assert.equal(calculate(policies.find(p => p.id === '10'), values).customer, 800000, 'Consequential damage warning must not cap whole claim');
assert.equal(calculate(policies[0], { ...values, previousClaims: 20000 }).customer, 0);
assert.equal(calculate(policies[0], { ...values, salvageCosts: 20000 }).customer, 0);
const fractional = calculate(policies[0], { ...values, vehicleValue: 100.01, previousClaims: 0, salvageCosts: 0.02 });
assert.equal(fractional.customer, 9999);
assert.equal(fractional.claim, 8333);
assert.equal(fractional.vat, 1666);
function change(id, value) {
    const labels = {
        policyType: { approved: 'Approved Used', allin: 'All-In / Extended' },
        brand: { SEAT: 'SEAT', VWPC: 'Volkswagen', 'VWPC:nonvwg': 'Volkswagen: non brand' }
    };
    const policy = policies.find(p => p.id === value);
    const label = id === 'policy' ? policy.cover + (policy.variant ? ': ' + policy.variant : '') : labels[id][value];
    const buttons = id === 'brand' ? [...elements['brand-main'].options, ...elements['brand-non-brand'].options] : elements[id].options;
    const button = buttons.find(button => button.textContent === label);
    assert.ok(button, `Missing button ${id}: ${value}`);
    button.handlers.click();
    assert.equal(button.attributes['aria-pressed'], 'true');
    assert.equal(buttons.filter(b => b.attributes['aria-pressed'] === 'true').length, 1);
}
function submit() {
    elements['ber-form'].handlers.submit[0]({ preventDefault() {}, currentTarget: elements['ber-form'] });
}
change('policyType', 'allin');
assert.equal(elements['extended-inputs'].hidden, false);
assert.equal(elements.previousClaims.disabled, false);
elements.vehicleValue.value = '10000';
elements.previousClaims.value = '3000';
elements.salvageCosts.value = '2000';
elements.excessAmount.value = '100';
elements.remainingPayment.value = '300';
submit();
assert.equal(elements['result-to-customer'].textContent, '£4,600.00');
assert.ok(!elements['output-template'].value.includes('Official policy wording:'));
assert.ok(!elements['output-template'].value.includes('Policy:'));
assert.ok(!elements['output-template'].value.includes('Limit basis:'));
assert.ok(elements['output-template'].value.includes('Policy excess: £100.00 inc VAT'));
assert.equal(elements['result-remaining-row'].hidden, false);
change('policyType', 'approved');
assert.equal(elements['result-card'].hidden, true);
assert.equal(elements['output-template'].value, '');
assert.equal(elements.excessAmount.disabled, true);
submit();
assert.equal(elements['result-to-customer'].textContent, '£5,000.00');
change('brand', 'SEAT');
assert.equal(elements.policy.options.length, 3);
assert.ok(elements.policy.options.every(option => option.tagName === 'button' && option.handlers.click));
change('policy', '4-fixed');
assert.equal(elements.vehicleValue.disabled, true);
assert.equal(elements.previousClaims.disabled, true);
assert.equal(elements['policy-wording'].textContent, policies.find(p => p.id === '4').wording);
elements.salvageCosts.value = '200';
submit();
assert.equal(elements['result-to-customer'].textContent, '£800.00');
assert.equal(elements['result-remaining-row'].hidden, true);
assert.ok(!elements['output-template'].value.includes('Previous claims:'));
assert.ok(!elements['output-template'].value.includes('Remaining claim limit:'));
change('brand', 'VWPC:nonvwg');
assert.equal(elements.policy.value, '10');
assert.equal(elements.policy.options[0].tagName, 'p');
assert.equal(elements.policy.options[0].handlers.click, undefined);
assert.equal(elements['consequential-notice'].hidden, false);
submit();
assert.ok(!elements['output-template'].value.includes('consequential'));
assert.equal(elements['selected-programme'].textContent.includes('Programme 573'), true);
change('policyType', 'allin');
assert.equal(elements.brand.value, 'VWPC');
assert.equal(elements['consequential-notice'].hidden, true);
assert.equal(elements['non-brand-section'].hidden, true);
assert.equal(elements['brand-non-brand'].options.length, 0);
change('policyType', 'approved');
assert.equal(elements['non-brand-section'].hidden, false);
assert.equal(elements['non-brand-section'].open, false);
assert.equal(elements['brand-main'].options.length, 6);
assert.equal(elements['brand-non-brand'].options.length, 4);
assert.ok(elements['brand-non-brand'].options.every(b => b.textContent.endsWith(': non brand')));
change('brand', 'VWPC:nonvwg');
assert.equal(elements.policy.value, '10');
assert.equal(elements.policy.options[0].tagName, 'p');
assert.equal(elements.policy.options[0].handlers.click, undefined);
assert.equal(elements['brand-main'].options.filter(b => b.attributes['aria-pressed'] === 'true').length, 0);
change('brand', 'SEAT');
assert.equal(elements['brand-non-brand'].options.filter(b => b.attributes['aria-pressed'] === 'true').length, 0);
submit();
elements['copy-summary'].handlers.click[0]().then(async () => {
    assert.equal(copiedSummaries[0], elements['output-template'].value);
    assert.equal(elements['copy-status'].textContent, 'Claim summary copied.');
    context.navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable'); };
    let selected = false;
    elements['output-template'].focus = () => {};
    elements['output-template'].select = () => { selected = true; };
    await elements['copy-summary'].handlers.click[0]();
    assert.equal(selected, true);
    assert.ok(elements['copy-status'].textContent.includes('Ctrl+C'));
    elements['ber-form'].handlers.input[0]();
    assert.equal(elements['copy-status'].textContent, '');
    assert.equal(elements['result-card'].hidden, true);
    console.log('Passed: all 18 policy mappings, deductions, VAT rounding, zero floor, consequential limit, policy switching, concise claim summary and clipboard success/fallback.');
}).catch(error => { console.error(error); process.exitCode = 1; });
