document.getElementById("calc-form").addEventListener("submit", function(event) {
    event.preventDefault();

    const price = parseFloat(document.getElementById("price").value);
    const brand = document.querySelector('input[name="brand-options"]:checked').id;
    const discountLevel = document.getElementById("discount-level").value;
    const result = calculateFinalPrice(price, brand, discountLevel);

    document.getElementById("result-price").innerText = result.finalPrice;
    document.getElementById("discount-applied").innerText = result.discount;
    document.getElementById("rate-applied").innerText = result.increase;
});

function calculateFinalPrice(price, brand, discountLevel) {

    const discounts = {
        "0": "0.00",
        "1": "49.00",
        "2": "41.50",
        "3": "34.00",
        "4": "26.00",
        "5": "19.00",
        "6": "17.00",
        "7": "13.50",
        "8": "11.00",
        "vwa": "4.30",
        "other": "5.00",

    };

    let increase = 0.00;
    let discount = parseFloat(discounts[discountLevel]);

    if (brand == "vwa") {
        increase = parseFloat(discounts.vwa);
    } else {
        increase = parseFloat(discounts.other);
    };

    let reducedPrice = price - ((price / 100) * discount);
    let amountToAdd = (reducedPrice / 100) * increase;
    let finalPrice = reducedPrice + amountToAdd;
    finalPrice = finalPrice.toFixed(2);

    if (finalPrice == "NaN") {
        return {
            finalPrice: "No price provided",
            discount: "No discount applied",
            increase: increase.toFixed(2)
        }
    }
    
    return {
        finalPrice: finalPrice,
        discount: discount.toFixed(2),
        increase: increase.toFixed(2)
    };
}