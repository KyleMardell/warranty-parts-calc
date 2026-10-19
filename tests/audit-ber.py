"""Audit the B.E.R calculator against the supplied workbook and agreed SEAT variants.
Run: python warranty-parts-calc/tests/audit-ber.py [path-to-workbook]
"""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import csv
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1]
workbook = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r'C:\Users\kyles\Downloads\Max amount payable (1).xlsx')
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(workbook) as archive:
    strings = [''.join(t.text or '' for t in si.findall('.//m:t', ns)) for si in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', ns)]
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
    rows = {}
    for row in sheet.findall('.//m:sheetData/m:row', ns):
        cells = {}
        for cell in row.findall('m:c', ns):
            value = cell.find('m:v', ns)
            if value is not None:
                cells[''.join(c for c in cell.get('r') if c.isalpha())] = strings[int(value.text)] if cell.get('t') == 's' else value.text
        rows[row.get('r')] = cells

source = (root / 'assets/js/berpolicies.js').read_text(encoding='utf-8-sig')
policies = json.loads(source.split('const BER_POLICIES = ', 1)[1].strip().removesuffix(';'))
assert {p['id'] for p in policies} == {str(i) for i in range(2, 18)} | {'4-fixed', '5-fixed'}
brands = {'AUDI': 'Audi', 'SEAT': 'SEAT', 'SKODA': '\u0160koda', 'CUPRA': 'CUPRA', 'VWPC': 'Volkswagen', 'VWCV': 'Volkswagen CV'}

# Independent expected rules taken from column G. The two split SEAT rows use
# the owner's explicit clarification, rather than combining both restrictions.
category_rules = {
    'Purchase Price - Previous claims': ('purchase', True),
    '\u00a31000 / Purchase Price': ('purchase', True),
    '\u00a31000 / CMV - Previous claims': ('cmv', True),
    'CMV': ('cmv', False),
    'CMV - Previous claims': ('cmv', True),
}
regular_scenarios = [
    ('Typical settlement', '18000', '0', '3200', '0', '0'),
    ('Previous claims and payments', '12500', '1750', '2400', '100', '360'),
    ('Pence and VAT rounding', '8750.65', '1234.56', '1575.25', '250', '149.99'),
    ('Low remaining allowance', '4200', '3900', '700', '100', '240'),
    ('Salvage exceeds allowance', '6500', '1200', '7000', '250', '480'),
]
fixed_scenarios = [
    ('Low salvage', '18000', '0', '120', '0', '0'),
    ('Typical fixed-limit settlement', '12500', '1750', '275.50', '100', '360'),
    ('Pence and VAT rounding', '8750.65', '1234.56', '640.25', '250', '149.99'),
    ('Salvage equals limit', '4200', '3900', '1000', '100', '240'),
    ('Salvage exceeds limit', '6500', '1200', '1350', '250', '480'),
]

def cents(value):
    return int((Decimal(value) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

fixtures = []
for policy in policies:
    row = rows[policy['id'].split('-')[0]]
    fixed = policy['id'].endswith('-fixed')
    basis, previous = ('fixed', False) if fixed else category_rules[row['G']]
    family = 'allin' if row['A'] == 'All-In' else 'approved'
    non_vwg = 'NON VWG' in row['A']
    consequential = row['H'] != 'N/A'
    expected_metadata = dict(program=row['B'], name=row['C'].strip(), brand=row['D'], cover=row['E'], wording=row['F'], family=family, nonVwg=non_vwg, basis=basis, previous=previous, consequential=consequential)
    for key, value in expected_metadata.items():
        assert policy[key] == value, (policy['id'], key, policy[key], value)
    if consequential:
        assert Decimal(row['H']) == 2000
    if fixed:
        assert policy['variant'] == '\u00a31,000 limit'
    for scenario in fixed_scenarios if fixed else regular_scenarios:
        title, vehicle, prior, salvage, excess, payments = scenario
        allowance = 100000 if fixed else cents(vehicle)
        previous_amount = cents(prior) if previous else 0
        excess_amount = cents(excess) if family == 'allin' else 0
        payment_amount = cents(payments) if family == 'allin' else 0
        remaining = max(0, allowance - previous_amount)
        payout = max(0, remaining - cents(salvage) - excess_amount - payment_amount)
        net = int((Decimal(payout) / Decimal('1.2')).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
        fixtures.append(dict(
            id=policy['id'], scenario=title, family=family,
            brandKey=policy['brand'] + (':nonvwg' if non_vwg else ''),
            brandLabel=brands[policy['brand']] + (': non brand' if non_vwg else ''),
            optionLabel=policy['cover'] + (': ' + policy['variant'] if policy['variant'] else ''),
            wording=row['F'], consequential=consequential,
            values=dict(vehicleValue=vehicle, previousClaims=prior, salvageCosts=salvage, excessAmount=excess, remainingPayment=payments),
            expected=dict(limit=allowance, previous=previous_amount, salvage=cents(salvage), excess=excess_amount, payments=payment_amount, remaining=remaining, customer=payout, claim=net, vat=payout-net),
        ))

# Exercise the actual button handlers and form submission as well as the
# calculation function. Reuse the lightweight DOM harness in ber.test.cjs.
runner = (root / 'tests/ber.test.cjs').read_text(encoding='utf-8-sig') + r'''
const auditFixtures = JSON.parse(fs.readFileSync(0, 'utf8'));
const formatAuditMoney = pence => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
function auditClick(group, label) {
    const options = group === 'brand' ? [...elements['brand-main'].options, ...elements['brand-non-brand'].options] : elements[group].options;
    const button = options.find(button => button.textContent === label);
    assert.ok(button && button.handlers.click, `Missing clickable option ${group}: ${label}`);
    button.handlers.click();
}
for (const fixture of auditFixtures) {
    auditClick('policyType', fixture.family === 'allin' ? 'All-In / Extended' : 'Approved Used');
    auditClick('brand', fixture.brandLabel);
    if (elements.policy.value !== fixture.id) auditClick('policy', fixture.optionLabel);
    assert.equal(elements.policy.value, fixture.id);
    assert.equal(elements['policy-wording'].textContent, fixture.wording);
    assert.equal(elements['consequential-notice'].hidden, !fixture.consequential);
    const policy = policies.find(policy => policy.id === fixture.id);
    assert.equal(elements.vehicleValue.disabled, policy.basis === 'fixed');
    assert.equal(elements.previousClaims.disabled, !policy.previous);
    assert.equal(elements.excessAmount.disabled, fixture.family !== 'allin');
    assert.equal(elements.remainingPayment.disabled, fixture.family !== 'allin');
    for (const [id, value] of Object.entries(fixture.values)) elements[id].value = value;
    const actual = calculate(policy, fixture.values);
    for (const [field, expected] of Object.entries(fixture.expected)) {
        assert.equal(actual[field], expected, `${fixture.id} / ${fixture.scenario} / ${field}`);
    }
    submit();
    for (const [field, id] of Object.entries({limit:'result-limit', remaining:'result-remaining', customer:'result-to-customer', claim:'result-on-claim', vat:'vat-amount'})) {
        assert.equal(elements[id].textContent, formatAuditMoney(fixture.expected[field]), `${fixture.id} / ${fixture.scenario} / display ${field}`);
    }
    assert.equal(elements['zero-notice'].hidden, fixture.expected.customer > 0);
    assert.equal(elements['result-card'].hidden, false);
    assert.ok(elements['output-template'].value.endsWith(fixture.wording));
    assert.ok(elements['output-template'].value.includes(`Amount to customer: ${formatAuditMoney(fixture.expected.customer)} inc VAT`));
}
console.log(`Audit passed: ${auditFixtures.length} scenarios across ${policies.length} policy variants, including calculated values, form outputs, wording and conditional fields.`);
'''
# __dirname must resolve to the tests directory for the existing harness.
completed = subprocess.run(['node', '-e', runner], input=json.dumps(fixtures), text=True, cwd=root/'tests', capture_output=True)
print(completed.stdout, end='')
if completed.returncode:
    print(completed.stderr, file=sys.stderr)
    sys.exit(completed.returncode)
report = root / 'tests/ber-audit-results.csv'
with report.open('w', newline='', encoding='utf-8-sig') as handle:
    writer = csv.writer(handle)
    writer.writerow(['Policy ID', 'Programme', 'Policy', 'Cover', 'Variant', 'Scenario', 'Vehicle value', 'Previous claims entered', 'Salvage', 'Excess entered', 'Payments entered', 'Previous claims applied', 'Excess applied', 'Payments applied', 'Remaining limit', 'Customer inc VAT', 'Claim exc VAT', 'VAT', 'Result'])
    for fixture in fixtures:
        policy = next(p for p in policies if p['id'] == fixture['id'])
        v, e = fixture['values'], fixture['expected']
        amount = lambda key: f'{Decimal(e[key])/100:.2f}'
        writer.writerow([policy['id'], policy['program'], policy['name'], policy['cover'], policy['variant'], fixture['scenario'], v['vehicleValue'], v['previousClaims'], v['salvageCosts'], v['excessAmount'], v['remainingPayment'], amount('previous'), amount('excess'), amount('payments'), amount('remaining'), amount('customer'), amount('claim'), amount('vat'), 'PASS'])
print('Spreadsheet audit passed: all 18 policy definitions and full wording extracts match the workbook, with the owner-confirmed split SEAT variants.')
print('Detailed results:', report)
