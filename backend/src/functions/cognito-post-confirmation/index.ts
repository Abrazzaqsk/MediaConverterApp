import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
    if (event.request.userAttributes.email) {
        await docClient.send(new PutCommand({
            TableName: process.env.USERS_TABLE!,
            Item: {
                userId: event.userName,
                email: event.request.userAttributes.email,
                free_conversions_used: 0,
                paid_credits: 0,
                plan: "free",
                createdAt: new Date().toISOString()
            }
        }));
    }
    return event;
};
