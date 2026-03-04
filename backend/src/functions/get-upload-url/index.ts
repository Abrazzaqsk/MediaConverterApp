import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.INPUT_BUCKET!;

export const handler = async (event: any) => {
    try {
        const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!userId) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        const { filename, contentType } = JSON.parse(event.body || "{}");

        if (!filename) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "filename is required" })
            };
        }

        // Isolate by user
        const key = `users/${userId}/input/${uuidv4()}-${filename}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: contentType || "video/mp4",
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ uploadUrl, key, bucket: BUCKET }),
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
