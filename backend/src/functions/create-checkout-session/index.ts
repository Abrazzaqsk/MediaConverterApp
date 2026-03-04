import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);

export const handler = async (event: any) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims.sub;
        const body = JSON.parse(event.body || "{}");
        const quantity = body.conversions || 1;
        const pricePerConversion = parseInt(process.env.PRICE_PER_CONVERSION || "15");

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: "Video Conversion Credits",
                            description: "Credits for media conversions",
                        },
                        unit_amount: pricePerConversion * 100, // Stripe uses cents/paise
                    },
                    quantity: quantity,
                },
            ],
            metadata: {
                userId,
                conversions: quantity.toString(),
            },
            // In production use your real domain (e.g. from environment)
            success_url: "http://localhost:5173/dashboard?payment=success",
            cancel_url: "http://localhost:5173/dashboard?payment=cancel",
        });

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ url: session.url }),
        };
    } catch (err: any) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
