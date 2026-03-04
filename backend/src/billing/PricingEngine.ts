export const calculatePrice = (durationSeconds: number) => {
    const roundedMinutes = Math.ceil(durationSeconds / 60) || 1; // At least 1 minute
    let pricePerMinute = 10;
    let tier = "0-5 min";

    if (roundedMinutes > 20) {
        pricePerMinute = 6;
        tier = "20+ min";
    } else if (roundedMinutes > 5) {
        pricePerMinute = 8;
        tier = "5-20 min";
    }

    const totalPrice = roundedMinutes * pricePerMinute;

    return { roundedMinutes, pricePerMinute, totalPrice, tier };
};
