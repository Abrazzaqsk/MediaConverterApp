import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const JOB_TABLE = process.env.DYNAMODB_TABLE!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export const handler = async (event: any) => {
    try {
        const jobId = event.pathParameters?.jobId;

        if (!jobId) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Missing jobId" })
            };
        }

        const { Item } = await docClient.send(new GetCommand({
            TableName: JOB_TABLE,
            Key: { jobId }
        }));

        if (!Item) {
            return {
                statusCode: 404,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Not found" })
            };
        }

        let outputUrl = null;
        if (Item.status === "COMPLETE") {
            // Typically, we'll store the master/index file name or infer it based on the profile
            // If Adaptive, it's typically master.m3u8, Single is index.m3u8 usually
            const filename = Item.profile === 'adaptive' ? 'master.m3u8' : 'index.m3u8';
            outputUrl = `https://${CLOUDFRONT_DOMAIN}/${Item.outputPrefix}/${filename}`;
        }

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ ...Item, outputUrl }),
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
