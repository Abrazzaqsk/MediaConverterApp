import { conversionService } from "../../services/ConversionService";
import { calculatePrice } from "../../billing/PricingEngine";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, GetCommand, UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const JOB_TABLE = process.env.DYNAMODB_TABLE || "VideoConversionJobs";
const USERS_TABLE = process.env.USERS_TABLE || "VideoConverterUsers";
const FREE_CONV = parseInt(process.env.FREE_CONVERSIONS || "3", 10);

export const handler = async (event: any) => {
    try {
        const isDev = process.env.NODE_ENV === "development";
        // Mock user for local testing if no authorizer is provided
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub || (isDev ? "mock-user-id" : null);

        if (!userId) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        const body = event.body ? (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : {};
        let { inputBucket, inputKey, outputBucket, outputPrefix, profile = 'single' } = body;

        if (!inputBucket || !inputKey || !outputBucket || !outputPrefix) {
            return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Missing required params" }) };
        }

        // 1. Fetch User Profile (Mock for dev if necessary)
        let user: any = null;
        if (process.env.MOCK_DB === "true") {
            // local dev mock user
            user = { free_conversions_used: 0, paid_credits: 500, plan: "free" };
        } else if (isDev) {
            // local dev mock user without mock db (using real DB)
            try {
                const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
                user = userRes.Item;
            } catch (e) {
                user = { free_conversions_used: 0, paid_credits: 500, plan: "free" };
            }
            // Create mock user if missing
            if (!user) {
                user = { free_conversions_used: 0, paid_credits: 500, plan: "free" };
                try {
                    await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: { userId, ...user } }));
                } catch (e) { }
            }
        } else {
            const userRes = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
            user = userRes.Item;
        }

        if (!user) {
            return { statusCode: 403, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "User not found" }) };
        }

        // 2. Determine Input File URI for Probing
        let probeTarget = "";
        if (isDev) {
            probeTarget = path.resolve(process.cwd(), '..', 'local-storage', 'input', inputKey.replace('input-videos/', ''));
        } else {
            const command = new GetObjectCommand({ Bucket: inputBucket, Key: inputKey });
            probeTarget = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }

        // 3. Probe Video Duration BEFORE Conversion
        const durationSeconds = await conversionService.getDuration(probeTarget);
        if (!durationSeconds) {
            return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Could not probe video duration" }) };
        }

        // 4. Calculate Price
        const billing = calculatePrice(durationSeconds);
        const { totalPrice } = billing;

        // 5. Check Conversion Limits
        let type = "";
        if (process.env.MOCK_DB !== "true") {
            try {
                if (user.free_conversions_used < FREE_CONV) {
                    type = "free";
                    await docClient.send(new UpdateCommand({
                        TableName: USERS_TABLE,
                        Key: { userId },
                        UpdateExpression: "SET free_conversions_used = free_conversions_used + :one",
                        ExpressionAttributeValues: { ":one": 1 }
                    }));
                } else if (user.paid_credits >= totalPrice) {
                    type = "paid";
                    await docClient.send(new UpdateCommand({
                        TableName: USERS_TABLE,
                        Key: { userId },
                        UpdateExpression: "SET paid_credits = paid_credits - :cost",
                        ExpressionAttributeValues: { ":cost": totalPrice }
                    }));
                } else {
                    return {
                        statusCode: 402, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({
                            error: "Insufficient credits",
                            required: totalPrice,
                            available: user.paid_credits
                        })
                    };
                }
            } catch (e) {
                console.error("Local mock dynamo failure ignored", e);
                type = user.free_conversions_used < FREE_CONV ? "free" : "paid";
            }
        } else {
            type = user.free_conversions_used < FREE_CONV ? "free" : "paid";
        }

        const sanitizedPrefix = outputPrefix.replace(/\/$/, "");

        // Overwrite profile choice for free users
        if (type === "free") profile = "single";

        let inputTarget = isDev ? probeTarget : `s3://${inputBucket}/${inputKey}`;
        let outputTarget = isDev ? sanitizedPrefix : `s3://${outputBucket}/${sanitizedPrefix}/`;

        // 6. Start Conversion
        const jobId = await conversionService.startConversion(
            inputTarget,
            outputTarget,
            profile,
            { application: "VideoConverter", inputKey, outputPrefix: sanitizedPrefix }
        );

        // 7. Store Job & Billing in DB
        const jobData = {
            jobId, userId, type,
            status: "SUBMITTED", inputKey, outputPrefix: sanitizedPrefix,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), profile,
            billing: {
                duration_seconds: durationSeconds,
                rounded_minutes: billing.roundedMinutes,
                price_per_min: billing.pricePerMinute,
                total_price: billing.totalPrice,
                tier: billing.tier
            }
        };

        if (process.env.MOCK_DB !== "true") {
            try {
                await docClient.send(new PutCommand({ TableName: JOB_TABLE, Item: jobData }));
            } catch (err) { }
        }

        return {
            statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(jobData),
        };
    } catch (err: any) {
        console.error(err);
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
    }
};
