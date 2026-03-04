import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (event: any) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims.sub;
        // Cognito sub is the user id

        const { Item } = await docClient.send(new GetCommand({
            TableName: process.env.USERS_TABLE!,
            Key: { userId }
        }));

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(Item || {})
        };
    } catch (err: any) {
        return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
    }
};
