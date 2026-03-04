import { MediaConvertClient, CreateJobCommand } from "@aws-sdk/client-mediaconvert";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const mcClient = new MediaConvertClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.MEDIACONVERT_ENDPOINT
});
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN!;
const OUTPUT_BUCKET = process.env.OUTPUT_BUCKET!;
const JOB_TABLE = process.env.DYNAMODB_TABLE!;

import * as adaptiveTemplate from "../../templates/adaptive.json";

export const handler = async (event: any) => {
    try {
        for (const record of event.Records) {
            const inputBucket = record.s3.bucket.name;
            const inputKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

            // Ignore anything not in input-videos
            if (!inputKey.startsWith("input-videos/")) continue;

            const outputPrefix = inputKey.replace("input-videos/", "output-hls/").replace(/\.[^/.]+$/, "");
            const inputS3Url = `s3://${inputBucket}/${inputKey}`;
            const outputS3Url = `s3://${OUTPUT_BUCKET}/${outputPrefix}/`;

            const template = adaptiveTemplate.default || adaptiveTemplate;
            const jobSettings = JSON.parse(JSON.stringify(template));
            jobSettings.Inputs[0].FileInput = inputS3Url;
            jobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = outputS3Url;

            const command = new CreateJobCommand({
                Role: ROLE_ARN,
                Settings: jobSettings,
            });

            const response = await mcClient.send(command);
            const jobId = response.Job?.Id;

            if (jobId) {
                await docClient.send(new PutCommand({
                    TableName: JOB_TABLE,
                    Item: {
                        jobId,
                        status: "SUBMITTED",
                        inputKey,
                        outputPrefix,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        profile: "adaptive" // default profile for auto upload
                    }
                }));
            }
        }
    } catch (error) {
        console.error("Error processing S3 trigger:", error);
    }
};
