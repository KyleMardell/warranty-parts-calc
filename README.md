# warranty-parts-calc

A simple program to work out warranty parts price calculations dependant on manufacturer in the VAG group.

## Beyond economical repair calculator

Open `ber.html`. Select Approved Used or All-In / Extended, the warranty brand, and the policy/cover/limit variant. Programme numbers and vehicle groups identify the applicable policy.

- Policy definitions and the full, unchanged spreadsheet wording are in `assets/js/berpolicies.js`.
- SEAT Named Component programmes 149 and 571 each have separate £1,000 and vehicle-value variants, as confirmed by the policy owner. These variants share their original full wording extract.
- The starting allowance is the purchase price, independently confirmed CMV, or £1,000 fixed claim limit. Deduct previous claims where specified, then salvage. All-In / Extended additionally deducts excess and remaining payments. Exhausted allowances pay £0.
- All monetary inputs include VAT. The customer amount is separated into a claim amount excluding VAT and VAT at 20%, rounded in pence.
- Programme 573 displays a consequential damage warning. Its £2,000 restriction is not applied to the entire claim; consequential repair costs require separate assessment.
- Extended currently shares All-In rules. Its definitions can be separated later.
- Changing inputs invalidates the previous result and copyable summary.

Run the calculation and form-behaviour checks with:

```sh
node warranty-parts-calc/tests/ber.test.cjs
```

Run this command from the repository's parent directory (the directory containing `warranty-parts-calc`). No dependencies or build step are required.
