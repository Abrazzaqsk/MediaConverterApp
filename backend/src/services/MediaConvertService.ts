import { MediaConvertClient, CreateJobCommand } from "@aws-sdk/client-mediaconvert";

export class MediaConvertService {
    private mcClient: MediaConvertClient;
    private roleArn: string;

    constructor() {
        this.mcClient = new MediaConvertClient({
            region: process.env.AWS_REGION,
            endpoint: process.env.MEDIACONVERT_ENDPOINT
        });
        this.roleArn = process.env.MEDIACONVERT_ROLE_ARN!;
    }

    public async createJob(
        inputS3Url: string,
        outputS3Url: string,
        userMetadata: Record<string, string>,
        profile: 'single' | 'adaptive'
    ): Promise<string | undefined> {

        // We conditionally load templates so they are only required for prod
        const singleTemplate = require("../../templates/single.json");
        const adaptiveTemplate = require("../../templates/adaptive.json");

        const template = profile === 'adaptive' ? adaptiveTemplate.default || adaptiveTemplate : singleTemplate.default || singleTemplate;
        const jobSettings = JSON.parse(JSON.stringify(template));
        jobSettings.Inputs[0].FileInput = inputS3Url;
        jobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = outputS3Url;

        const command = new CreateJobCommand({
            Role: this.roleArn,
            Settings: jobSettings,
            UserMetadata: userMetadata
        });

        const response = await this.mcClient.send(command);
        return response.Job?.Id;
    }
}
