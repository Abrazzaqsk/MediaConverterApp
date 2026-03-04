import Stripe from "stripe";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {} as any);
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
    const sig = event.headers["stripe-signature"];

    let stripeEvent;

    try {
        // API Gateway HTTP API passes payload directly, we just need to keep in mind base64 
        const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
        stripeEvent = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET as string
        );
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === "checkout.session.completed") {
        const session = stripeEvent.data.object as any;
        const userId = session.metadata?.userId;
        const conversions_str = session.metadata?.conversions || "1";
        const conversions = parseInt(conversions_str, 10);

        if (userId) {
            try {
                await docClient.send(new UpdateCommand({
                    TableName: process.env.USERS_TABLE!,
                    Key: { userId },
                    UpdateExpression: "SET paid_credits = if_not_exists(paid_credits, :zero) + :incr",
                    ExpressionAttributeValues: {
                        ":zero": 0,
                        ":incr": conversions
                    }
                }));

                // Log payment in payments table
                await docClient.send(new PutCommand({
                    TableName: process.env.PAYMENTS_TABLE!,
                    Item: {
                        paymentId: session.id,
                        userId,
                        conversions,
                        amountTotal: session.amount_total,
                        createdAt: new Date().toISOString()
                    }
                }));
            } catch (e) {
                console.error("DB error", e);
            }
        }
    }

    return { statusCode: 200, body: "OK" };
};
