import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const JOB_TABLE = process.env.DYNAMODB_TABLE!;

export const handler = async (event: any) => {
    console.log("Received event:", JSON.stringify(event));
    try {
        const detail = event.detail;
        const jobId = detail.jobId;
        const status = detail.status; // SUBMITTED, PROGRESSING, COMPLETE, ERROR

        if (!jobId || !status) return;

        await docClient.send(new UpdateCommand({
            TableName: JOB_TABLE,
            Key: { jobId },
            UpdateExpression: "set #status = :s, updatedAt = :u",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
                ":s": status,
                ":u": new Date().toISOString()
            }
        }));

        console.log(`Updated job ${jobId} to status ${status}`);
    } catch (err) {
        console.error("Error updating job status:", err);
    }
};
