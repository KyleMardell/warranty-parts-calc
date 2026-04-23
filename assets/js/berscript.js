// Toggle extended inputs visibility
const policyRadios = document.querySelectorAll('input[name="policyType"]');
const extendedInputs = document.getElementById("extended-inputs");

// Hide on initial load
extendedInputs.style.display = "none";

// Listen for policy change
policyRadios.forEach(radio => {
    radio.addEventListener("change", () => {
        const selectedPolicy = document.querySelector('input[name="policyType"]:checked').id;

        if (selectedPolicy === "extended") {
            extendedInputs.style.display = "block";
        } else {
            extendedInputs.style.display = "none";
        }
    });
});


// Form submit
document.getElementById("ber-form").addEventListener("submit", function (event) {
    event.preventDefault();

    const vehicleValue = parseFloat(document.getElementById("vehicleValue").value) || 0;
    const salvageCosts = parseFloat(document.getElementById("salvageCosts").value) || 0;
    const remainingPaymentInput = parseFloat(document.getElementById("remainingPayment").value) || 0;

    const policyType = document.querySelector('input[name="policyType"]:checked').id;
    const excessSelection = document.querySelector('input[name="excessAmount"]:checked').id;

    let excessAmount = 0;
    let remainingPayment = 0;

    // Only apply these if Extended
    if (policyType === "extended") {
        if (excessSelection === "excess-100") excessAmount = 100;
        if (excessSelection === "excess-250") excessAmount = 250;

        remainingPayment = remainingPaymentInput;
    }

    // Main calculation
    const amountToCustomer = vehicleValue - (salvageCosts + excessAmount + remainingPayment);

    // Correct VAT reverse calculation
    const amountOnClaim = amountToCustomer / 1.2;
    const vatAmount = amountToCustomer - amountOnClaim;

    // Update UI
    document.getElementById("result-to-customer").innerText = amountToCustomer.toFixed(2);
    document.getElementById("result-on-claim").innerText = amountOnClaim.toFixed(2);
    document.getElementById("vat-amount").innerText = vatAmount.toFixed(2);
});